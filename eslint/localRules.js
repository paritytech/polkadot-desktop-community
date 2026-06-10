import enforceDiNamingConvention from './rules/enforce-di-naming-convention.js';
import noRelativeImportFromRoot from './rules/no-relative-import-from-root.js';
import noSelfImport from './rules/no-self-import.js';

export const localRules = {
  meta: {
    name: 'local-rules',
    version: '1.0.0',
  },
  rules: {
    'no-self-import': noSelfImport,
    'no-relative-import-from-root': noRelativeImportFromRoot,
    'enforce-di-naming-convention': enforceDiNamingConvention,
  },
};
