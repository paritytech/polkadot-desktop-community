import { type ReactNode, useEffect, useState } from 'react';
import { IntlProvider } from 'react-intl';

import defaultLocale from './locales/en.json';
import { type Locale } from './types';
import { flattenMessages } from './utils';

function loadLocale(locale: Locale) {
  return import(`./locales/${locale}.json`);
}

const DEFAULT_LOCALE = 'en';

type TranslationProviderProps = {
  children: ReactNode;
  locale?: Locale;
  fallback?: ReactNode;
};

export const TranslationProvider = ({ children, locale, fallback }: TranslationProviderProps) => {
  const [messages, setMessages] = useState<Record<string, string> | null>(() => (locale ? null : flattenMessages(defaultLocale)));
  const [currentLocale, setCurrentLocale] = useState(locale ?? DEFAULT_LOCALE);

  useEffect(() => {
    if (!locale) {
      return;
    }

    if (locale === DEFAULT_LOCALE) {
      setMessages(flattenMessages(defaultLocale));
    }

    let cancelled = false;

    const loadMessages = async () => {
      try {
        const loadedMessages = await loadLocale(locale);

        if (!cancelled) {
          setMessages(flattenMessages(loadedMessages));
          setCurrentLocale(locale);
        }
      } catch (error) {
        console.error(`Failed to load locale "${locale}":`, error);
        setMessages(flattenMessages(defaultLocale));
      }
    };

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [locale, loadLocale]);

  if (!messages) {
    return fallback;
  }

  return (
    <IntlProvider locale={currentLocale} messages={messages} defaultLocale={DEFAULT_LOCALE}>
      {children}
    </IntlProvider>
  );
};
