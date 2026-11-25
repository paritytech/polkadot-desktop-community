import { RadioGroup, SettingsList } from '@/shared/components';
import { SUPPORTED_LOCALES, saveLocale, useLocalePreference, useTranslation } from '@/shared/translation';

export const LanguageSettings = () => {
  const { t } = useTranslation();
  const locale = useLocalePreference();

  const handleChange = (value: string) => {
    const selected = SUPPORTED_LOCALES.find(item => item.id === value);
    if (!selected) return;

    saveLocale(selected.id);
  };

  return (
    <SettingsList title={t('feature.languageSettings.title')}>
      <RadioGroup.Root label={t('feature.languageSettings.title')} value={locale} onValueChange={handleChange}>
        {SUPPORTED_LOCALES.map(({ id, nativeName }) => (
          <RadioGroup.Item key={id} value={id} title={t(`feature.languageSettings.locale.${id}`)} description={nativeName} />
        ))}
      </RadioGroup.Root>
    </SettingsList>
  );
};
