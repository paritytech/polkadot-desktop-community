export type Locale = string;

export type TranslationMessages = Record<string, unknown>;

export type FlatMessages = Record<string, string>;

export type LocaleLoader = (locale: Locale) => Promise<TranslationMessages>;
