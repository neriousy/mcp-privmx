export function generateMethodKey(options: {
  language: string;
  namespace: string;
  className?: string;
  methodName: string;
  parameters: { type: string; optional: boolean }[];
}): string {
  const paramSig = options.parameters
    .map((p) => `${p.type}${p.optional ? '?' : ''}`)
    .join(',');
  const classPart = options.className ? `${options.className}.` : '';
  return `${options.language}.${options.namespace}.${classPart}${options.methodName}(${paramSig})`;
}
