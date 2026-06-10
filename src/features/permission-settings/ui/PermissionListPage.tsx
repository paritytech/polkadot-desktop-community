import { useNavigate } from '@tanstack/react-router';
import { type PropsWithChildren } from 'react';
import { FormattedMessage } from 'react-intl';

import { ListItem, SettingsList } from '@/shared/components';
import { useTranslation } from '@/shared/translation';
import { type PermissionId, useAggregatedPermissions } from '@/domains/product';
import { PERMISSION_CATEGORIES, PERMISSION_METADATA } from '@/widgets/Permission';

export const PermissionListPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: aggregated } = useAggregatedPermissions();

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
            <PermissionGroup
              key={category.key}
              title={t('feature.permissionSettings.categoryHeading', { name: t(category.labelKey) })}
            >
              {aggregatedByCategory.map(({ meta, agg }) => (
                <ListItem
                  key={meta.id}
                  variant="icon"
                  icon={meta.icon}
                  label={t(meta.labelKey)}
                  description={
                    <FormattedMessage id="feature.permissionSettings.appCount" values={{ count: agg?.apps.length ?? 0 }} />
                  }
                  onClick={() => handleClick(meta.id)}
                />
              ))}
            </PermissionGroup>
          );
        })}
      </div>
    </SettingsList>
  );
};

const PermissionGroup = ({ title, children }: PropsWithChildren<{ title: string }>) => (
  <div className="flex flex-col gap-1">
    <div className="text-sm leading-5 font-semibold text-fg-primary">{title}</div>
    <div className="flex flex-col">{children}</div>
  </div>
);
