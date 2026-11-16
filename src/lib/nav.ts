/** Remove trailing slashes so "/learn/" and "/learn" compare equal. "/" stays "/". */
export function normalizePath(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/**
 * True when `currentPath` is the nav link's page or a page inside its section.
 * "/" only matches the home page itself.
 */
export function isCurrentPath(currentPath: string, href: string): boolean {
  const current = normalizePath(currentPath);
  const target = normalizePath(href);
  if (target === '/') return current === '/';
  return current === target || current.startsWith(`${target}/`);
}
