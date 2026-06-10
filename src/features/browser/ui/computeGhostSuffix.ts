export const computeGhostSuffix = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return '';
  if (/^(localhost|127\.0\.0\.1)([:/]|$)/i.test(trimmed)) return '';
  if (/\.dot(\.li)?([/?#]|$)/i.test(trimmed)) return '';
  return '.dot';
};
