// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TEST_IDS } from '@/shared/test-ids';
import { TranslationProvider } from '@/shared/translation';
import type * as productDomain from '@/domains/product';
import { type PermissionStatus } from '@/domains/product';
import type * as permissionWidget from '@/widgets/Permission';

import { AppPermissionEntityPage } from './AppPermissionEntityPage';

const executable = { identifier: 'app.x', contenthash: '0x00' };

const mocks = vi.hoisted(() => ({
  product: null as unknown,
  permissions: null as unknown,
  run: vi.fn(),
}));

vi.mock('@/widgets/Permission', async () => {
  const actual = await vi.importActual<typeof permissionWidget>('@/widgets/Permission');
  return {
    ...actual,
    PermissionStatusDropdown: ({ value, onChange }: { value: PermissionStatus; onChange: (v: PermissionStatus) => void }) => (
      <select data-testid="permission-status-dropdown" value={value} onChange={e => onChange(e.target.value as PermissionStatus)}>
        <option value="ask">Ask</option>
        <option value="granted">Allow</option>
        <option value="denied">Deny</option>
      </select>
    ),
  };
});

vi.mock('@/domains/product', async () => {
  const actual = await vi.importActual<typeof productDomain>('@/domains/product');
  return {
    ...actual,
    useDisplayedProduct: () => ({ data: mocks.product, pending: false, error: null }),
    useProductPermissions: () => ({ data: mocks.permissions, pending: false }),
    useAllAliasPermissions: () => ({ data: [], pending: false }),
    useSetAliasPermission: () => ({ run: mocks.run }),
    useRemoveAliasPermission: () => ({ run: mocks.run }),
    useSetDevicePermission: () => ({ run: mocks.run }),
    useSetRemotePermission: () => ({ run: mocks.run }),
    useSetRemotePermissionsBatch: () => ({ run: mocks.run }),
    useResetPermissionToDefault: () => ({ run: mocks.run }),
  };
});

const baseProduct = {
  baseName: 'hack3m.dot',
  displayName: 'Hack3m',
  description: '',
  icon: null,
  executables: {},
};

const Providers = ({ children }: PropsWithChildren) => <TranslationProvider>{children}</TranslationProvider>;

const renderPage = (permissionId = 'Microphone') =>
  render(
    <Providers>
      <AppPermissionEntityPage productId="hack3m.dot" permissionId={permissionId} backLabel="Back" onBack={() => {}} />
    </Providers>,
  );

describe('AppPermissionEntityPage modality rows', () => {
  it('renders one row per manifest-declared modality, worker excluded', () => {
    mocks.product = { ...baseProduct, executables: { app: executable, widget: executable, worker: executable } };

    renderPage();

    const rows = screen.getAllByTestId(TEST_IDS.permissionModalityRow);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('App');
    expect(rows[1]).toHaveTextContent('Widgets');
  });

  it('renders only the app row when the manifest declares no widget', () => {
    mocks.product = { ...baseProduct, executables: { app: executable } };

    renderPage();

    expect(screen.getAllByTestId(TEST_IDS.permissionModalityRow)).toHaveLength(1);
  });

  it('renders ExternalRequest modality rows as navigation entries (no inline dropdown)', () => {
    mocks.product = { ...baseProduct, executables: { app: executable, widget: executable } };

    renderPage('ExternalRequest');

    const rows = screen.getAllByTestId(TEST_IDS.permissionModalityRow);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.tagName).toBe('BUTTON');
    }
  });

  it('invokes reset-to-default for the permission', async () => {
    mocks.product = { ...baseProduct, executables: { app: executable } };
    mocks.run.mockClear();

    renderPage();
    await userEvent.click(screen.getByTestId(TEST_IDS.permissionResetButton));

    expect(mocks.run).toHaveBeenCalledWith({ productId: 'hack3m.dot', permissionId: 'Microphone' });
  });

  it('calls useSetDevicePermission().run with widget modality when the Widgets row status is changed to granted', async () => {
    mocks.product = { ...baseProduct, executables: { app: executable, widget: executable } };
    mocks.run.mockClear();

    renderPage('Microphone');

    const dropdowns = screen.getAllByTestId('permission-status-dropdown');
    // First row = App (index 0), second row = Widgets (index 1)
    expect(dropdowns).toHaveLength(2);
    const widgetDropdown = dropdowns[1];
    if (!widgetDropdown) throw new Error('Expected widget dropdown to exist');

    await userEvent.selectOptions(widgetDropdown, 'granted');

    expect(mocks.run).toHaveBeenCalledWith({
      productId: 'hack3m.dot',
      permission: { payload: { name: 'Microphone' }, modality: 'widget', status: 'granted' },
    });
  });
});
