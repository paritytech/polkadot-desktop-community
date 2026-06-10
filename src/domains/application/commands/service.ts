import * as v from 'valibot';

import { type SideEffectIdentifier, createSideEffect } from '@/shared/di';

import { type Command } from './types';

const handlers = new Set<SideEffectIdentifier<Command>>();

function processCommand(command: Command) {
  for (const handler of handlers) {
    handler.apply(command);
  }
}

type ParamsSchema = v.ObjectSchema<Record<string, v.StringSchema<undefined>>, undefined>;

function createCommand<const Action extends string, const Schema extends ParamsSchema>(action: Action, schema: Schema) {
  const sideEffect = createSideEffect<Command<Action, v.InferOutput<Schema>>>({
    name: `command ${action} handler`,
    filter: command => command.action === action && v.safeParse(schema, command.params).success,
  });

  handlers.add(sideEffect);

  return sideEffect;
}

function createDeeplinkCommand<const Action extends string, const Schema extends ParamsSchema>(
  action: Action,
  params: v.InferOutput<Schema>,
) {
  const searchParams = new URLSearchParams(params);
  return `/${action}?${searchParams.toString()}`;
}

export const commandsService = {
  processCommand,
  createCommand,
  createDeeplinkCommand,
};
