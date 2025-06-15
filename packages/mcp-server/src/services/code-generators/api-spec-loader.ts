import fs from 'fs';
import path from 'path';

interface MethodSpec {
  name: string;
  snippet: string;
}

const specCache: Record<string, any> = {};

function languageToSpecPath(lang: string): string {
  switch (lang) {
    case 'javascript':
    case 'js':
      return 'spec/api/js/out.js.json';
    case 'typescript':
      return 'spec/api/js/out.js.json';
    case 'java':
      return 'spec/api/java/privmx-endpoint.json';
    case 'swift':
      return 'spec/api/swift/PrivMXEndpointSwift.json';
    default:
      return 'spec/api/js/out.js.json';
  }
}

function loadSpec(lang = 'js'): any {
  if (specCache[lang]) return specCache[lang];
  const specPath = path.resolve(process.cwd(), languageToSpecPath(lang));
  try {
    const raw = fs.readFileSync(specPath, 'utf-8');
    specCache[lang] = JSON.parse(raw);
  } catch {
    specCache[lang] = {};
  }
  return specCache[lang];
}

interface MethodInfo {
  snippet: string;
  description: string;
  params: { name: string; description: string; type: { name: string } }[];
  returns: { type: { name: string }; description: string }[] | null;
}

function findClassObj(spec: any, className: string): any | null {
  const section = Object.values(spec).find(
    (sec: any) =>
      Array.isArray(sec) && sec.some((c: any) => c.name === className)
  ) as any[] | undefined;
  if (!section) return null;
  return section.find((c) => c.name === className) || null;
}

export function getMethodInfo(
  className: string,
  methodName: string,
  lang: string = 'js'
): MethodInfo | null {
  const spec = loadSpec(lang);
  const classObj = findClassObj(spec, className);
  if (!classObj) return null;
  const method = (classObj.methods || []).find(
    (m: any) => m.name === methodName
  );
  if (!method) return null;
  return {
    snippet: method.snippet,
    description: method.description,
    params: method.params || [],
    returns: method.returns || null,
  };
}

export function getMethodSnippet(
  lang: string,
  className: string,
  methodName: string
): string | null {
  const info = getMethodInfo(className, methodName, lang);
  return info ? info.snippet : null;
}

export function generateJsDoc(
  lang: string,
  className: string,
  methodName: string
): string {
  const info = getMethodInfo(className, methodName, lang);
  if (!info) return '';
  const lines: string[] = ['/**', ` * ${info.description}`];
  for (const p of info.params) {
    lines.push(` * @param {${p.type.name}} ${p.name} - ${p.description}`);
  }
  if (info.returns && info.returns.length > 0) {
    const r = info.returns[0];
    lines.push(` * @returns {${r.type.name}} ${r.description}`);
  }
  lines.push(' */');
  return lines.join('\n');
}

export function getReturnType(
  lang: string,
  className: string,
  methodName: string
): string | null {
  const info = getMethodInfo(className, methodName, lang);
  if (!info || !info.returns || info.returns.length === 0) return null;
  return info.returns[0].type.name;
}
