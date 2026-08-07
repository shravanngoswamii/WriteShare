/** Substitute {tokens} in a template; unknown tokens are left as-is. */
export function applyTemplate(template: string, vars: Record<string, string | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => vars[key] ?? whole);
}

export const DEFAULT_COMMIT_TEMPLATE = "{action} {path} (via WriteShare)";
