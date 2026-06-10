import { type ChatActionPayload, type CodecType } from '@novasamatech/host-api';
import { type Container } from '@novasamatech/host-container';
import { type UserSession } from '@novasamatech/host-papp';
import { type FetchResolver, type Sandbox } from '@novasamatech/host-worker-sandbox';
import { type Emitter } from 'nanoevents';

import { type ChatSession } from '@/domains/chat';
import { type Product } from '../product/types';

export type { FetchResolver, Sandbox };

export type WorkerEvents = {
  sendChatAction: (roomId: string, productId: string, payload: CodecType<typeof ChatActionPayload>) => void;
};

export type ProductWorkerInstance = {
  readonly productId: string;
  readonly contenthash: string;
  readonly sandbox: Sandbox;
  readonly container: Container;
  readonly events: Emitter<WorkerEvents>;
  readonly disposed: boolean;
  dispose(): void;
};

export type WorkerDeps = {
  getProduct: () => Product;
  getSession: () => UserSession | null;
  getChatSessions: () => ChatSession[];
};

export type Binding = (instance: ProductWorkerInstance, deps: WorkerDeps) => VoidFunction;
