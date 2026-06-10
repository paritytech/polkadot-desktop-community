import { createEvent, createStore, sample } from 'effector';
import { readonly } from 'patronum';

import { type DefaultHandlerBody, type Handler, type Identifier } from './types';

type Params<HandlerBody, ProcessedHandlerBody> = {
  type: string;
  name: string;
  processHandler(handler: Handler<HandlerBody>): Handler<ProcessedHandlerBody>;
};

type HandlerEntry<HandlerBody, ProcessedHandlerBody> = {
  original: Handler<HandlerBody>;
  processed: Handler<ProcessedHandlerBody>;
};

export const createAbstractIdentifier = <
  Input,
  Output,
  HandlerBody = DefaultHandlerBody<Input, Output>,
  ProcessedHandlerBody = DefaultHandlerBody<Input, Output>,
>({
  type,
  name,
  processHandler,
}: Params<HandlerBody, ProcessedHandlerBody>) => {
  type ResultIdentifier = Identifier<Input, Output, HandlerBody, ProcessedHandlerBody>;
  type Entry = HandlerEntry<HandlerBody, ProcessedHandlerBody>;

  const $entries = createStore<Entry[]>([]);
  const $handlers = $entries.map(entries => entries.map(entry => entry.processed));
  const resetHandlers = createEvent<void>();
  const registerHandler = createEvent<Handler<HandlerBody>>();
  const removeHandler = createEvent<Handler<HandlerBody>>();
  const forceUpdate = createEvent();

  sample({
    clock: registerHandler,
    source: $entries,
    filter: (entries, original) => !entries.some(entry => entry.original === original),
    fn: (entries, original) => {
      const processed = processHandler(original);
      const entry: Entry = { original, processed };

      if (processed.key) {
        const index = entries.findIndex(e => e.processed.key === processed.key);
        if (index === -1) {
          return entries.concat(entry);
        } else {
          return entries.map((e, i) => (i === index ? entry : e));
        }
      } else {
        return entries.concat(entry);
      }
    },
    target: $entries,
  });

  sample({
    clock: removeHandler,
    source: $entries,
    filter: (entries, original) => entries.some(entry => entry.original === original),
    fn: (entries, original) => entries.filter(entry => entry.original !== original),
    target: $entries,
  });

  sample({
    clock: resetHandlers,
    fn: () => [],
    target: $entries,
  });

  const identifier: ResultIdentifier = {
    type,
    identifierName: name,
    $handlers: readonly($handlers),
    resetHandlers,
    registerHandler,
    removeHandler,
    updateHandlers: forceUpdate,
    __BRAND: 'Identifier',
  };

  return identifier;
};
