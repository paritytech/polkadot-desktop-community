import { useNavigate } from '@tanstack/react-router';
import { FormattedMessage } from 'react-intl';

import { ListItem, SettingsList, SettingsSection } from '@/shared/components';
import { useTranslation } from '@/shared/translation';
import { type PermissionId, useWatchAggregatedPermissions } from '@/domains/product';
import { PERMISSION_CATEGORIES, PERMISSION_METADATA } from '@/widgets/Permission';

export const PermissionListPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: aggregated } = useWatchAggregatedPermissions();

  const handleClick = (id: PermissionId) => {
    navigate({ to: '/settings/privacy/permissions/$permissionId', params: { permissionId: id } });
  };

  return (
    <SettingsList title={t('feature.permissionSettings.heading')} subtitle={t('feature.permissionSettings.subheading')}>
      <div className="flex flex-col gap-6">
        {PERMISSION_CATEGORIES.map(category => {
          const items = PERMISSION_METADATA.filter(m => m.category === category.key);
          const aggregatedByCategory = items.map(item => ({
            meta: item,
            agg: aggregated.find(a => a.id === item.id),
          }));

          return (
            <SettingsSection
              layout="list"
              key={category.key}
              title={t('feature.permissionSettings.categoryHeading', { name: t(category.labelKey) })}
            >
              {aggregatedByCategory.map(({ meta, agg }) => (
                <ListItem
                  key={meta.id}
                  icon={meta.icon}
                  label={t(meta.labelKey)}
                  description={
                    <FormattedMessage id="feature.permissionSettings.appCount" values={{ count: agg?.apps.length ?? 0 }} />
                  }
                  chevron
                  onClick={() => handleClick(meta.id)}
                />
              ))}
            </SettingsSection>
          );
        })}
      </div>
    </SettingsList>
  );
};
