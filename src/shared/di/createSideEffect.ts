import { createAbstractIdentifier } from './createAbstractIdentifier';
import { type Identifier } from './types';

// Public interface
type SideEffectHandler<Params> = (value: Params) => unknown | Promise<unknown>;

export type SideEffectIdentifier<Params> = Identifier<Params, Promise<PromiseSettledResult<void>>, SideEffectHandler<Params>> & {
  apply(params: Params): Promise<PromiseSettledResult<void>[]>;
};

type FactoryParams<Params> = {
  name?: string;
  filter?: (params: Params) => boolean;
};

export const createSideEffect = <Params>(config?: FactoryParams<Params>): SideEffectIdentifier<Params> => {
  const identifier = createAbstractIdentifier<Params, Promise<PromiseSettledResult<void>>, SideEffectHandler<Params>>({
    type: 'sideEffect',
    name: config?.name ?? 'unknownSideEffect',
    processHandler: handler => ({
      key: handler.key,
      available: handler.available,
      body: ({ input }) => {
        try {
          if (config?.filter && !config.filter(input)) {
            return Promise.resolve({ status: 'fulfilled', value: undefined });
          }

          const result = handler.body(input);
          const promise = result instanceof Promise ? result : Promise.resolve(result);

          return promise
            .then<PromiseSettledResult<void>>(() => ({ status: 'fulfilled', value: undefined }))
            .catch<PromiseSettledResult<void>>(e => {
              console.error('Error in side effect:');
              console.error(e);

              return { status: 'rejected', reason: e };
            });
        } catch (e) {
          return Promise.resolve({ status: 'rejected', reason: e });
        }
      },
    }),
  });

  return {
    ...identifier,
    apply(params: Params) {
      const handlers = identifier.$handlers.getState();
      const acc: Promise<PromiseFulfilledResult<void>> = Promise.resolve({ status: 'fulfilled', value: undefined });
      const result: Promise<PromiseSettledResult<void>>[] = [];

      for (let index = 0; index < handlers.length; index++) {
        const handler = handlers[index];
        if (!handler) {
          continue;
        }

        try {
          if (handler.available()) {
            result.push(handler.body({ acc, input: params, index }));
          }
        } catch (error) {
          result.push(Promise.resolve({ status: 'rejected', reason: error }));
        }
      }

      return Promise.all(result);
    },
  };
};
