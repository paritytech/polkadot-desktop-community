import { describe, expect, it } from 'vitest';

import { archiveGateway } from './gateway';

describe('archiveGateway', () => {
  it('fetchExecutable returns null when the executable kind is absent', async () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal fixture for the absent-kind branch
    const product = { baseName: 'app.dot', executables: {} } as never;
    expect(await archiveGateway.fetchExecutable(product, 'worker')).toBeNull();
  });
});
