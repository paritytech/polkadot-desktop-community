import path from 'node:path';

/**
 * @param {string} root
 * @param {string} filename
 */
export function getPackageName(root, filename) {
  const relativePath = path.relative(root, filename);

  return relativePath.split(path.sep, 2).join(path.sep);
}
