import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import {
  getMethodSnippet,
  generateJsDoc,
  getMethodInfo,
  getReturnType,
} from './api-spec-loader.js';

/**
 * Render a Handlebars template relative to the project root.
 * Templates live under `src/templates` to be bundled by ts-node/tsc.
 */

function registerPartials(baseDir: string) {
  const partialsDir = path.join(path.dirname(baseDir), 'partials');
  let files: string[] = [];
  try {
    files = readdirSync(partialsDir);
  } catch {
    return; // no partials
  }
  for (const file of files) {
    if (file.endsWith('.hbs')) {
      const partialPath = path.join(partialsDir, file);
      const source = readFileSync(partialPath, 'utf-8');
      const name = path.basename(file, '.hbs');
      Handlebars.registerPartial(name, source);
    }
  }
}

export function renderTemplate(
  relPath: string,
  data: Record<string, unknown>
): string {
  const templatePath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '../../templates',
    relPath
  );
  registerPartials(templatePath);
  const source = readFileSync(templatePath, 'utf-8');
  const template = Handlebars.compile(source, { noEscape: true });
  return template(data);
}

// Register helpers once at module load
Handlebars.registerHelper('includes', (arr: any[], item: any) => {
  if (!Array.isArray(arr)) return false;
  return arr.includes(item);
});

Handlebars.registerHelper('methodSnippet', function (...args) {
  // args: [lang?, className, methodName]
  let lang = 'js';
  let className: string;
  let methodName: string;
  if (args.length === 3) {
    [lang, className, methodName] = args as string[];
  } else {
    [className, methodName] = args as string[];
  }
  const snippet = getMethodSnippet(lang, className, methodName);
  return snippet || `${className}.${methodName}()`;
});

Handlebars.registerHelper('jsDoc', function (...args) {
  let lang = 'js';
  let className: string;
  let methodName: string;
  if (args.length === 3) {
    [lang, className, methodName] = args as string[];
  } else {
    [className, methodName] = args as string[];
  }
  return generateJsDoc(lang, className, methodName);
});

Handlebars.registerHelper('paramList', function (...args) {
  let lang = 'js';
  let className: string;
  let methodName: string;
  if (args.length === 3) {
    [lang, className, methodName] = args as string[];
  } else {
    [className, methodName] = args as string[];
  }
  const info = generateJsDoc(lang, className, methodName); // we actually need param list
  const mi = getMethodInfo(className, methodName, lang);
  if (!mi) return '';
  return mi.params.map((p: any) => p.name).join(', ');
});

Handlebars.registerHelper('returnType', function (...args) {
  let lang = 'js';
  let className: string;
  let methodName: string;
  if (args.length === 3) {
    [lang, className, methodName] = args as string[];
  } else {
    [className, methodName] = args as string[];
  }
  return getReturnType(lang, className, methodName) || 'void';
});
