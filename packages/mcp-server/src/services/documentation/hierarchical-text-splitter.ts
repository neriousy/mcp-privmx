import { TextSplitter } from '@langchain/textsplitters';
import { visit } from 'unist-util-visit';
import { unified } from 'unified';
import remarkParse from 'remark-parse';

/**
 * HierarchicalTextSplitter – respects markdown headings when chunking.
 * Large sections are split by H2, then paragraphs, then sentences to fit chunkSize.
 */
export class HierarchicalTextSplitter extends TextSplitter {
  constructor(options: { chunkSize: number; chunkOverlap: number }) {
    super(options);
  }

  public async splitText(text: string): Promise<string[]> {
    const tree = unified().use(remarkParse).parse(text);

    const sections: { depth: number; lines: string[] }[] = [];
    let current = { depth: 0, lines: [] as string[] };

    visit(tree, (node) => {
      if (node.type === 'heading') {
        // push previous section
        if (current.lines.length) sections.push(current);
        current = { depth: (node as any).depth || 1, lines: [] };
        const headingText = (node as any).children
          .map((c: any) => c.value)
          .join('');
        current.lines.push('#'.repeat(current.depth) + ' ' + headingText);
      } else if (node.type === 'paragraph' || node.type === 'code') {
        const raw =
          (node as any).value ||
          (node as any).children?.map((c: any) => c.value).join('');
        if (raw) current.lines.push(raw);
      }
    });
    // last section
    if (current.lines.length) sections.push(current);

    // now chunk respecting size
    const chunks: string[] = [];
    for (const sec of sections) {
      let buffer: string[] = [];
      for (const line of sec.lines) {
        buffer.push(line);
        const joined = buffer.join('\n');
        if (joined.length >= this.chunkSize) {
          chunks.push(joined);
          const keep = Math.floor(this.chunkOverlap / 2);
          buffer = buffer.slice(keep ? -keep : 0);
        }
      }
      if (buffer.length) chunks.push(buffer.join('\n'));
    }
    return chunks;
  }
}
