/**
 * Documentation Index Service
 *
 * Handles indexing, searching, and retrieval of processed MDX documents.
 * Uses LangChain's vector stores and embeddings for semantic search.
 */

import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { HierarchicalTextSplitter } from './hierarchical-text-splitter.js';
import type {
  ParsedMDXDocument,
  DocumentationResult,
  DocumentationSearchFilters,
  IndexResult,
  DocumentationStats,
  CodeExample,
  RelatedDocument,
  AIInsights,
} from '../../types/documentation-types.js';
import { MDXProcessorService } from './mdx-processor.js';
import { VectorService } from './vector-service.js';
import { createVectorAdapter } from '../vector/adapter-factory.js';
import { startSpan, setSpanAttributes } from '../../common/otel.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';

export class DocumentationIndexService {
  private mdxProcessor: MDXProcessorService;
  private vectorService: VectorService;
  private documents: Map<string, ParsedMDXDocument> = new Map();
  private textSplitter:
    | RecursiveCharacterTextSplitter
    | HierarchicalTextSplitter;
  private initialized = false;

  constructor() {
    this.mdxProcessor = new MDXProcessorService();
    const adapter = createVectorAdapter();
    this.vectorService = new VectorService({}, adapter);
    const useHier = process.env.USE_HIER_SPLITTER === 'true';
    this.textSplitter = useHier
      ? new HierarchicalTextSplitter({ chunkSize: 1000, chunkOverlap: 200 })
      : new RecursiveCharacterTextSplitter({
          chunkSize: 1000,
          chunkOverlap: 200,
          separators: ['\n\n', '\n', ' ', ''],
        });
    if (useHier) {
      console.log('🔀 Using HierarchicalTextSplitter for MDX processing');
    }
  }

  /**
   * Index all MDX documents from the specified directory
   */
  async indexDocuments(
    mdxDirectory: string = 'spec/mdx',
    forceReindex: boolean = false
  ): Promise<IndexResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let documentsIndexed = 0;
    let codeExamplesExtracted = 0;

    try {
      // Find all MDX files recursively
      const mdxFiles = await this.findMDXFiles(mdxDirectory);
      console.log(`Found ${mdxFiles.length} MDX files to index`);

      // Process each MDX file
      for (const filePath of mdxFiles) {
        try {
          const parsedDoc = await this.mdxProcessor.parseMDXFile(filePath);
          this.documents.set(parsedDoc.id, parsedDoc);
          documentsIndexed++;
          codeExamplesExtracted += parsedDoc.content.codeBlocks.length;
        } catch (error) {
          const errorMsg = `Failed to process ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.warn(errorMsg);
        }
      }

      // Initialize and create vector embeddings for semantic search
      await this.vectorService.initialize();
      if (await this.vectorService.isAvailable()) {
        // Pass forceReindex flag to vector service
        this.vectorService.config.forceReindex = forceReindex;
        await this.vectorService.indexDocuments(
          Array.from(this.documents.values())
        );
      }

      this.initialized = true;
      const indexingTime = Date.now() - startTime;

      console.log(
        `Indexed ${documentsIndexed} documents with ${codeExamplesExtracted} code examples in ${indexingTime}ms`
      );

      return {
        documentsIndexed,
        codeExamplesExtracted,
        indexingTime,
        errors,
        success: true,
      };
    } catch (error) {
      const errorMsg = `Indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);

      return {
        documentsIndexed,
        codeExamplesExtracted,
        indexingTime: Date.now() - startTime,
        errors,
        success: false,
      };
    }
  }

  /**
   * Search documents using semantic similarity and filters
   */
  async searchDocuments(
    query: string,
    filters?: DocumentationSearchFilters,
    limit: number = 5
  ): Promise<DocumentationResult[]> {
    this.ensureInitialized();

    // First, filter documents based on metadata filters
    let candidateDocuments = Array.from(this.documents.values());

    if (filters) {
      candidateDocuments = this.applyFilters(candidateDocuments, filters);
    }

    // ----- Hybrid search: combine semantic (vector) and lexical (BM25-ish) -----
    return startSpan('docs.hybridSearch', async () => {
      // 1. Semantic search (vector embeddings)
      let semanticResults: {
        documentId: string;
        score: number;
      }[] = [];
      let semanticSearchFailed = false;

      if (
        (await this.vectorService.isAvailable()) &&
        candidateDocuments.length > 0
      ) {
        try {
          const vecRes = await this.vectorService.semanticSearch(
            query,
            filters,
            limit * 2 // fetch more to merge later
          );
          semanticResults = vecRes.map((r) => ({
            documentId: r.documentId,
            score: r.score,
          }));
        } catch (error) {
          semanticSearchFailed = true;
          console.warn(
            'Semantic search failed, proceeding with lexical only:',
            error
          );
          // Record the error in the span
          const span = trace.getActiveSpan();
          span?.recordException(
            error instanceof Error ? error : new Error(String(error))
          );
          span?.setStatus({
            code: SpanStatusCode.ERROR,
            message: 'Semantic search failed, using lexical fallback',
          });
        }
      }

      // 2. Lexical BM25-ish text search
      const lowerQuery = query.toLowerCase();
      const textScores = candidateDocuments.map((doc) => {
        const content =
          `${doc.metadata.title} ${doc.content.markdown}`.toLowerCase();
        const score = this.calculateTextScore(content, lowerQuery);
        return { doc, score };
      });

      const maxTextScore = Math.max(1, ...textScores.map((t) => t.score));

      // Constants for default weights
      const DEFAULT_LEXICAL_WEIGHT = 0.5;
      const DEFAULT_SEMANTIC_WEIGHT = 0.5;

      // 3. Combine scores
      const lexicalWeight = Math.max(
        0,
        Math.min(1, Number(process.env.TEXT_WEIGHT ?? DEFAULT_LEXICAL_WEIGHT))
      );
      const semanticWeight = Math.max(
        0,
        Math.min(
          1,
          Number(process.env.VECTOR_WEIGHT ?? DEFAULT_SEMANTIC_WEIGHT)
        )
      );

      // Ensure weights sum to 1 for stability
      // Edge case: if both weights are 0 (user set both TEXT_WEIGHT and VECTOR_WEIGHT to 0),
      // we fall back to equal weighting (0.5 each) to prevent division by zero and ensure
      // the search still functions with balanced scoring
      const weightSum = lexicalWeight + semanticWeight;
      const lexW =
        weightSum === 0 ? DEFAULT_LEXICAL_WEIGHT : lexicalWeight / weightSum;
      const semW =
        weightSum === 0 ? DEFAULT_SEMANTIC_WEIGHT : semanticWeight / weightSum;

      const combinedMap = new Map<
        string,
        { doc: ParsedMDXDocument; score: number }
      >();

      // Add lexical scores
      for (const { doc, score } of textScores) {
        if (score === 0) continue;
        const normalized = score / maxTextScore; // 0..1
        combinedMap.set(doc.id, { doc, score: normalized * lexW });
      }

      // Add semantic scores
      for (const sem of semanticResults) {
        const doc = this.documents.get(sem.documentId);
        if (!doc) continue;
        const current = combinedMap.get(doc.id)?.score ?? 0;
        combinedMap.set(doc.id, {
          doc,
          score: current + sem.score * semW,
        });
      }

      // Fallback: if semantic unavailable and no lexical results, run performTextSearch
      if (combinedMap.size === 0) {
        return this.performTextSearch(candidateDocuments, query, limit);
      }

      // Sort and return top
      const combinedSorted = Array.from(combinedMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // Set span attributes for observability
      setSpanAttributes({
        textWeight: lexW,
        vectorWeight: semW,
        lexicalCandidates: textScores.length,
        semanticCandidates: semanticResults.length,
        semanticSearchFailed,
        combinedResultsCount: combinedSorted.length,
      });

      return combinedSorted.map((item) =>
        this.convertToDocumentationResult(item.doc, item.score)
      );
    });
  }

  /**
   * Get related documents based on document ID
   */
  async getRelatedDocuments(docId: string): Promise<DocumentationResult[]> {
    this.ensureInitialized();

    const document = this.documents.get(docId);
    if (!document) return [];

    const related: RelatedDocument[] = [];

    // Sort by score and return top results
    const topRelated = related.sort((a, b) => b.score - a.score).slice(0, 5);

    return topRelated.map((rel) => {
      const doc = this.documents.get(rel.id);
      if (!doc) {
        throw new Error(`Document not found: ${rel.id}`);
      }
      return this.convertToDocumentationResult(doc);
    });
  }

  /**
   * Get documents filtered by language
   */
  async getDocumentsByLanguage(
    language: string
  ): Promise<DocumentationResult[]> {
    this.ensureInitialized();

    const languageDocuments = Array.from(this.documents.values())
      .filter((doc) => doc.metadata.language === language)
      .slice(0, 20); // Limit to prevent overwhelming results

    return languageDocuments.map((doc) =>
      this.convertToDocumentationResult(doc)
    );
  }

  /**
   * Get service statistics
   */
  getStats(): DocumentationStats {
    const documentsByLanguage: Record<string, number> = {};
    const documentsByCategory: Record<string, number> = {};
    let totalCodeExamples = 0;

    for (const doc of this.documents.values()) {
      // Count by language
      const lang = doc.metadata.language || 'unknown';
      documentsByLanguage[lang] = (documentsByLanguage[lang] || 0) + 1;

      // Count by category
      const category = doc.metadata.category || 'unknown';
      documentsByCategory[category] = (documentsByCategory[category] || 0) + 1;

      // Count code examples
      totalCodeExamples += doc.content.codeBlocks.length;
    }

    return {
      totalDocuments: this.documents.size,
      documentsByLanguage,
      documentsByCategory,
      totalCodeExamples,
      averageProcessingTime: 0, // Would need to track this during indexing
      lastIndexUpdate: new Date(),
    };
  }

  /**
   * Find all MDX files recursively
   */
  private async findMDXFiles(directory: string): Promise<string[]> {
    const mdxFiles: string[] = [];

    try {
      const entries = await readdir(directory);

      for (const entry of entries) {
        const fullPath = join(directory, entry);
        const stats = await stat(fullPath);

        if (stats.isDirectory()) {
          // Recursively search subdirectories
          const subFiles = await this.findMDXFiles(fullPath);
          mdxFiles.push(...subFiles);
        } else if (entry.endsWith('.mdx')) {
          mdxFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Failed to read directory ${directory}:`, error);
    }

    return mdxFiles;
  }

  /**
   * Apply metadata filters to documents
   */
  private applyFilters(
    documents: ParsedMDXDocument[],
    filters: DocumentationSearchFilters
  ): ParsedMDXDocument[] {
    return documents.filter((doc) => {
      if (filters.language && doc.metadata.language !== filters.language)
        return false;
      if (filters.framework && doc.metadata.framework !== filters.framework)
        return false;
      if (filters.skillLevel && doc.metadata.skillLevel !== filters.skillLevel)
        return false;
      if (filters.category && doc.metadata.category !== filters.category)
        return false;
      if (filters.namespace && doc.metadata.namespace !== filters.namespace)
        return false;
      if (filters.hasCodeExamples && doc.content.codeBlocks.length === 0)
        return false;
      if (filters.tags && filters.tags.length > 0) {
        const docTags = doc.metadata.tags || [];
        if (!filters.tags.some((tag) => docTags.includes(tag))) return false;
      }
      return true;
    });
  }

  /**
   * Perform text-based search as fallback
   */
  private performTextSearch(
    documents: ParsedMDXDocument[],
    query: string,
    limit: number
  ): DocumentationResult[] {
    const lowerQuery = query.toLowerCase();
    const scored = documents.map((doc) => {
      const content =
        `${doc.metadata.title} ${doc.content.markdown}`.toLowerCase();
      const score = this.calculateTextScore(content, lowerQuery);
      return { doc, score };
    });

    return scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => this.convertToDocumentationResult(item.doc, item.score));
  }

  /**
   * Calculate text-based similarity score
   */
  private calculateTextScore(content: string, query: string): number {
    const queryWords = query.split(/\s+/);
    let score = 0;

    for (const word of queryWords) {
      if (word.length < 3) continue; // Skip very short words

      try {
        // Escape special regex characters to handle things like "C++"
        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedWord, 'gi');
        const matches = content.match(regex);
        if (matches) {
          score += matches.length;
        }
      } catch (error) {
        // If regex still fails, fall back to simple string matching
        console.warn(
          `Regex failed for word "${word}", using string matching:`,
          error
        );
        const lowerWord = word.toLowerCase();
        const lowerContent = content.toLowerCase();
        let index = 0;
        while ((index = lowerContent.indexOf(lowerWord, index)) !== -1) {
          score++;
          index += lowerWord.length;
        }
      }
    }

    return score;
  }

  /**
   * Find document by content chunk
   */
  private findDocumentByContent(content: string): string | null {
    for (const [id, doc] of this.documents) {
      if (doc.content.markdown.includes(content.substring(0, 100))) {
        return id;
      }
    }
    return null;
  }

  /**
   * Calculate similarity score between two documents
   */
  private calculateSimilarityScore(
    doc1: ParsedMDXDocument,
    doc2: ParsedMDXDocument
  ): number {
    let score = 0;

    // Same language bonus
    if (doc1.metadata.language === doc2.metadata.language) score += 0.3;

    // Same namespace bonus
    if (doc1.metadata.namespace === doc2.metadata.namespace) score += 0.2;

    // Shared concepts
    const concepts1 = doc1.content.concepts;
    const concepts2 = doc2.content.concepts;
    const sharedConcepts = concepts1.filter((c) => concepts2.includes(c));
    score += sharedConcepts.length * 0.1;

    // Shared API references
    const apis1 = doc1.content.apiReferences;
    const apis2 = doc2.content.apiReferences;
    const sharedAPIs = apis1.filter((api) => apis2.includes(api));
    score += sharedAPIs.length * 0.15;

    return Math.min(score, 1); // Cap at 1.0
  }

  /**
   * Determine relationship type between documents
   */
  private determineRelationshipType(
    doc1: ParsedMDXDocument,
    doc2: ParsedMDXDocument
  ): 'similar' | 'prerequisite' | 'next-step' | 'related-api' {
    // Check for prerequisite relationship
    if (
      doc1.metadata.skillLevel === 'intermediate' &&
      doc2.metadata.skillLevel === 'beginner'
    ) {
      return 'prerequisite';
    }

    // Check for next-step relationship
    if (
      doc1.metadata.skillLevel === 'beginner' &&
      doc2.metadata.skillLevel === 'intermediate'
    ) {
      return 'next-step';
    }

    // Check for API relationship
    const sharedAPIs = doc1.content.apiReferences.filter((api) =>
      doc2.content.apiReferences.includes(api)
    );
    if (sharedAPIs.length > 0) {
      return 'related-api';
    }

    return 'similar';
  }

  /**
   * Convert parsed document to documentation result
   */
  private convertToDocumentationResult(
    doc: ParsedMDXDocument,
    score: number = 1.0
  ): DocumentationResult {
    // Safely access content properties with fallbacks
    const content = doc.content || {
      markdown: '',
      codeBlocks: [],
      apiReferences: [],
      concepts: [],
      internalLinks: [],
      externalLinks: [],
    };

    // Extract relevant code examples
    const codeExamples: CodeExample[] = (content.codeBlocks || []).map(
      (block) => ({
        language: block.language || 'text',
        code: block.code || '',
        title: block.title,
        complexity: this.determineComplexity(block.code || ''),
        isRunnable: block.isComplete || false,
        prerequisites: [],
        sourceDocument: doc.id,
      })
    );

    // Generate AI insights
    const aiInsights: AIInsights = {
      keyTakeaways: this.extractKeyTakeaways(doc),
      commonPitfalls: this.extractPitfalls(doc),
      bestPractices: this.extractBestPractices(doc),
      prerequisites: this.extractPrerequisites(doc),
      nextSteps: this.extractNextSteps(doc),
    };

    // Create summary
    const summary = this.generateSummary(doc);

    // Safely access markdown content
    const markdownContent = content.markdown || '';
    const contentPreview =
      markdownContent.length > 500
        ? markdownContent.substring(0, 500) + '...'
        : markdownContent;

    return {
      id: doc.id,
      title: doc.metadata?.title || 'Untitled Document',
      summary,
      content: contentPreview,
      metadata: doc.metadata || {},
      codeExamples,
      relatedAPIs: content.apiReferences || [],
      relatedDocs: [], // Will be populated by getRelatedDocuments if needed
      score,
      aiInsights,
    };
  }

  /**
   * Determine code complexity level
   */
  private determineComplexity(
    code: string
  ): 'simple' | 'intermediate' | 'advanced' {
    const lines = code.split('\n').length;
    const complexityIndicators = [
      'class',
      'interface',
      'async',
      'await',
      'promise',
      'error',
      'try',
      'catch',
    ];

    let complexityScore = 0;
    for (const indicator of complexityIndicators) {
      if (code.toLowerCase().includes(indicator)) complexityScore++;
    }

    if (lines > 20 || complexityScore > 3) return 'advanced';
    if (lines > 10 || complexityScore > 1) return 'intermediate';
    return 'simple';
  }

  /**
   * Extract key takeaways from document
   */
  private extractKeyTakeaways(doc: ParsedMDXDocument): string[] {
    const takeaways: string[] = [];
    const content = doc.content.markdown.toLowerCase();

    // Look for important statements
    if (content.includes('important'))
      takeaways.push('Contains important information');
    if (content.includes('note:') || content.includes('warning:'))
      takeaways.push('Has special notes or warnings');
    if (doc.content.codeBlocks.length > 0)
      takeaways.push('Includes code examples');
    if (doc.content.apiReferences.length > 0)
      takeaways.push('References PrivMX APIs');

    return takeaways;
  }

  /**
   * Extract common pitfalls mentioned in document
   */
  private extractPitfalls(doc: ParsedMDXDocument): string[] {
    const pitfalls: string[] = [];
    const content = doc.content.markdown.toLowerCase();

    if (content.includes('warning') || content.includes('⚠️')) {
      pitfalls.push('Contains warnings about potential issues');
    }
    if (content.includes('not compatible') || content.includes('limitations')) {
      pitfalls.push('Has compatibility or limitation notes');
    }

    return pitfalls;
  }

  /**
   * Extract best practices from document
   */
  private extractBestPractices(doc: ParsedMDXDocument): string[] {
    const practices: string[] = [];
    const content = doc.content.markdown.toLowerCase();

    if (content.includes('best practice') || content.includes('recommended')) {
      practices.push('Contains recommended practices');
    }
    if (content.includes('security') || content.includes('secure')) {
      practices.push('Includes security considerations');
    }

    return practices;
  }

  /**
   * Extract prerequisites from document
   */
  private extractPrerequisites(doc: ParsedMDXDocument): string[] {
    const prerequisites: string[] = [];

    if (
      doc.metadata.skillLevel === 'intermediate' ||
      doc.metadata.skillLevel === 'advanced'
    ) {
      prerequisites.push('Basic PrivMX knowledge required');
    }

    if (doc.content.concepts.includes('bridge')) {
      prerequisites.push('PrivMX Bridge setup required');
    }

    return prerequisites;
  }

  /**
   * Extract next steps from document
   */
  private extractNextSteps(doc: ParsedMDXDocument): string[] {
    const nextSteps: string[] = [];
    const content = doc.content.markdown.toLowerCase();

    if (content.includes('next steps') || content.includes('next')) {
      nextSteps.push('Document suggests specific next steps');
    }

    if (doc.metadata.category === 'getting-started') {
      nextSteps.push('Continue with intermediate topics');
    }

    return nextSteps;
  }

  /**
   * Generate AI-friendly summary of document
   */
  private generateSummary(doc: ParsedMDXDocument): string {
    const parts = [
      `${doc.metadata.title} documentation`,
      doc.metadata.language ? `for ${doc.metadata.language}` : '',
      doc.metadata.namespace ? `in ${doc.metadata.namespace}` : '',
      doc.content.codeBlocks.length > 0
        ? `with ${doc.content.codeBlocks.length} code examples`
        : '',
    ].filter(Boolean);

    return parts.join(' ');
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'DocumentationIndexService not initialized. Call indexDocuments() first.'
      );
    }
  }
}
