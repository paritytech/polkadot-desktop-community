import { type JsonRpcConnection, type RequiredHostCallbacks } from '@parity/truapi-host';
import { type JsonRpcProvider } from 'polkadot-api';
import { toHex } from 'polkadot-api/utils';
import * as v from 'valibot';

import { environmentUseCase } from '@/domains/application';
import { type Chain, chainRegistry, customChainUseCase, genesisHash } from '@/domains/network';

type ChainCallbacks = Pick<RequiredHostCallbacks, 'chain' | 'extrinsicVersion' | 'features'>;

/**
 * Adapt a polkadot-api `JsonRpcProvider` (push-style: hand it a listener, get a
 * `send`/`disconnect` handle) to the core's `JsonRpcConnection`, which pulls
 * replies through `responses()`.
 *
 * Responses that arrive before the core asks for them are buffered, so no reply
 * is dropped between `connect` and the first `next()`.
 */
function openConnection(provider: JsonRpcProvider): JsonRpcConnection {
  const buffered: string[] = [];
  // `null` ends the generator; a string is a response. Anyone parked here when the
  // connection closes must be released with `null`, never with an empty string — the
  // core cannot tell that apart from a reply and would hand it to a subscription.
  const waiting: ((message: string | null) => void)[] = [];
  let closed = false;

  // polkadot-api hands the listener a parsed JSON-RPC message and expects a parsed
  // request back; the core works in raw strings on both sides. This is the only
  // place the two representations meet.
  const connection = provider(message => {
    const serialized = JSON.stringify(message);
    const resolve = waiting.shift();
    if (resolve) {
      resolve(serialized);
    } else {
      buffered.push(serialized);
    }
  });

  async function* responses(): AsyncGenerator<string> {
    while (!closed) {
      const buffedMessage = buffered.shift();
      if (buffedMessage !== undefined) {
        yield buffedMessage;
        continue;
      }

      const next = await new Promise<string | null>(resolve => {
        waiting.push(resolve);
        if (closed) resolve(null);
      });

      if (next === null) return;
      yield next;
    }
  }

  return {
    send(request) {
      // Defence in depth at a wire boundary, not the last line of it: the core's own
      // worker already catches a throwing `send` (`handleChainSend`) and warns. Kept
      // because the host cannot see a future core that stops doing so, and because a
      // malformed frame is one request's problem — log it and keep the pipe alive.
      try {
        connection.send(JSON.parse(request));
      } catch (error) {
        console.warn('[truapi] rpc send dropped', error);
      }
    },
    responses,
    close() {
      if (closed) return;
      closed = true;
      // Release anyone parked on `responses()` before tearing the socket down.
      for (const resolve of waiting.splice(0)) resolve(null);
      connection.disconnect();
    },
  };
}

/**
 * The host's chain surface: which chains it serves, and a JSON-RPC connection to
 * each. The core drives the chainHead state machine on top of these.
 */
/**
 * The chain the host serves under this genesis hash, or `undefined`.
 *
 * Read per call rather than captured: the set changes when the user adds a custom
 * chain or switches environment, and a captured map would answer with the set as it
 * stood when the core booted.
 */
async function findChain(raw: string): Promise<Chain | undefined> {
  const parsed = v.safeParse(genesisHash, raw);
  if (!parsed.success) return undefined;

  const chains = await customChainUseCase.getAllChainsMap();

  return chains[parsed.output];
}

export function createChainCallbacks(): ChainCallbacks {
  return {
    // The host builds no extrinsics of its own — it signs statements only — so it builds
    // none as V5, and the core keeps its own extrinsics on V4 to match.
    extrinsicVersion: { transactionExtensionVersions: async () => ({ chains: [] }) },
    features: {
      // `HostFeatureSupportedRequest` is a single-variant union (`tag: 'Chain'`),
      // so there is no other branch to answer.
      featureSupported: async request => ({ supported: Boolean(await findChain(request.value.genesisHash)) }),

      supportedChains: async () => {
        const environment = await environmentUseCase.getActive();

        // `ChainIdentifier` is a closed set of four protocol roles, so this
        // reports the role chains only — not every chain the registry serves.
        // Whether that also bounds `connect` is unresolved; see
        // `docs/_plans/truapi-upstream-issues.md` § 5.
        const entries = environment
          ? [
              { identifier: 'People' as const, genesisHash: environment.peopleChain.genesisHash },
              { identifier: 'Bulletin' as const, genesisHash: environment.bulletinChain.genesisHash },
              { identifier: 'AssetHub' as const, genesisHash: environment.dotnsChain.genesisHash },
            ]
          : [];

        return { network: environment?.id ?? '', chains: entries };
      },
    },

    chain: {
      connect: async genesisHash => {
        const chain = await findChain(toHex(genesisHash));
        if (!chain) {
          throw new Error(`No chain registered for genesis ${toHex(genesisHash)}`);
        }

        return openConnection(chainRegistry.getProvider(chain));
      },
    },
  };
}
