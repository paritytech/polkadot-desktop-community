import { type ProductExecutables } from '@/domains/product';

import { pickProductSurface } from './pickProductSurface';

const room = { sessionId: '0xsession' };

const app: ProductExecutables['app'] = { kind: 'app', identifier: 'app.x.dot', appVersion: [1, 0, 0], contenthash: '0xa' };
const chatWorker: ProductExecutables['worker'] = {
  kind: 'worker',
  identifier: 'worker.x.dot',
  appVersion: [1, 0, 0],
  contenthash: '0xw',
  entrypoint: 'index.js',
  includes: { chat: true, pocket: false },
};
const backgroundWorker: ProductExecutables['worker'] = { ...chatWorker, includes: { chat: false, pocket: true } };

describe('pickProductSurface', () => {
  it('prefers the app when present, regardless of chat/room', () => {
    expect(pickProductSurface({ app, worker: chatWorker }, room)).toEqual({ kind: 'app' });
  });

  it('opens the chat room when a chat worker has an existing room and no app', () => {
    expect(pickProductSurface({ worker: chatWorker }, room)).toEqual({ kind: 'chat', sessionId: '0xsession' });
  });

  it('does nothing when a chat worker has no room', () => {
    expect(pickProductSurface({ worker: chatWorker }, null)).toEqual({ kind: 'none' });
  });

  it('does nothing for a background-only worker even with a room', () => {
    expect(pickProductSurface({ worker: backgroundWorker }, room)).toEqual({ kind: 'none' });
  });

  it('does nothing when there are no interactable executables', () => {
    expect(pickProductSurface({}, room)).toEqual({ kind: 'none' });
  });
});
