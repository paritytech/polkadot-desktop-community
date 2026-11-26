// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type PropsWithChildren } from 'react';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_IDS } from '@/shared/test-ids';
import { TranslationProvider } from '@/shared/translation';
import {
  type PermissionStatus,
  type PersistedProduct,
  type ProductPermissionEntry,
  permissionsUseCase,
  productsResource,
} from '@/domains/product';

import { AppPermissionEntityPage } from './AppPermissionEntityPage';

const executable = { identifier: 'app.x', contenthash: '0x00' };

const mocks = vi.hoisted(() => ({
  product: null as unknown,
  entries: [] as ProductPermissionEntry[],
  patterns: [] as { pattern: string; status: PermissionStatus }[],
  run: vi.fn(),
}));

// The real `PermissionStatusDropdown` is a Radix menu whose trigger shows the current
// status label; the cases below open it and pick an item the way a user does.
// The permission reads and the write are core-backed (an injected adapter, not a
// resource), so the use-case methods behind the hooks are spied in place; the hooks
// themselves stay real.
vi.spyOn(permissionsUseCase, 'watchProductPermissions').mockImplementation(() => of(mocks.entries));
vi.spyOn(permissionsUseCase, 'watchGrantedPatterns').mockImplementation(() => of(mocks.patterns));
vi.spyOn(permissionsUseCase, 'watchGrantedAccountAccess').mockReturnValue(of([]));
vi.spyOn(permissionsUseCase, 'setPermissionStatus').mockImplementation(params => {
  mocks.run(params);

  return Promise.resolve();
});

const baseProduct = {
  baseName: 'hack3m.dot',
  displayName: 'Hack3m',
  description: '',
  icon: { cid: '', format: 'png' },
  executables: {},
  pinned: false,
  createdAt: 1000,
  updatedAt: 1000,
};

function seedProduct(record: object) {
  productsResource.instead(() => of([record as unknown as PersistedProduct]));
}

const Providers = ({ children }: PropsWithChildren) => <TranslationProvider>{children}</TranslationProvider>;

const renderPage = async (permissionId = 'Microphone') => {
  const result = render(
    <Providers>
      <AppPermissionEntityPage productId="hack3m.dot" permissionId={permissionId} onBack={() => {}} />
    </Providers>,
  );
  await screen.findAllByTestId(TEST_IDS.permissionRow);
  return result;
};

describe('AppPermissionEntityPage', () => {
  beforeEach(() => {
    seedProduct({ ...baseProduct, executables: { app: executable, widget: executable } });
    mocks.entries = [{ permissionId: 'Microphone', status: 'granted' }];
    mocks.patterns = [];
    mocks.run.mockClear();
  });

  // One row, not one per surface: a stored decision no longer carries a modality.
  it('renders a single row for the permission', async () => {
    await renderPage();

    const rows = screen.getAllByTestId(TEST_IDS.permissionRow);
    expect(rows).toHaveLength(1);
  });

  it('shows the status the core reports', async () => {
    await renderPage();

    expect(screen.getByRole('button', { name: /Allowed/ })).toBeInTheDocument();
  });

  it('renders the external-request row as a navigation entry, with no inline dropdown', async () => {
    mocks.patterns = [{ pattern: 'cdn.example.com', status: 'granted' }];

    await renderPage('ExternalRequest');

    const rows = screen.getAllByTestId(TEST_IDS.permissionRow);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tagName).toBe('BUTTON');
    expect(screen.queryByRole('button', { name: /Allowed/ })).toBeNull();
  });

  it('disables the external-request row when the core holds no granted domain', async () => {
    mocks.patterns = [];

    await renderPage('ExternalRequest');

    expect(screen.getByTestId(TEST_IDS.permissionRow)).toBeDisabled();
  });

  it('writes the chosen status to the core', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /Allowed/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Denied' }));

    expect(mocks.run).toHaveBeenCalledWith({
      productId: 'hack3m.dot',
      request: { tag: 'Device', value: 'Microphone' },
      status: 'denied',
    });
  });

  // Reset means "prompt me again", which is the core's NotDetermined.
  it('resets to default by writing ask', async () => {
    await renderPage();
    await userEvent.click(screen.getByTestId(TEST_IDS.permissionResetButton));

    expect(mocks.run).toHaveBeenCalledWith({
      productId: 'hack3m.dot',
      request: { tag: 'Device', value: 'Microphone' },
      status: 'ask',
    });
  });
});
