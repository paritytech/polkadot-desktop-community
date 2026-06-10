import { createAbstractIdentifier } from './createAbstractIdentifier';
import { syncApplyImpl } from './syncApplyImpl';

describe('createAbstractIdentifier.', () => {
  it('should handle basic pipeline', () => {
    const identifier = createAbstractIdentifier<string, string>({
      type: 'test',
      name: 'test',
      processHandler: handler => handler,
    });

    identifier.registerHandler({
      available: () => true,
      body: input => `${input.acc} ${input.input} ${input.index}`,
    });

    const result = syncApplyImpl({
      identifier,
      acc: 'Hello',
      input: 'World',
    });

    expect(result).toBe('Hello World 0');
  });

  it('should correctly process handlers', () => {
    const identifier = createAbstractIdentifier<void, string>({
      type: 'test',
      name: 'test',
      processHandler: handler => ({
        available: () => true,
        body: value => handler.body(value) + ' attached',
      }),
    });

    identifier.registerHandler({
      available: () => true,
      body: input => input.acc + ' World',
    });

    const result = syncApplyImpl({
      identifier,
      acc: 'Hello',
      input: undefined,
    });

    expect(result).toBe('Hello World attached');
  });

  it("should skip handler when it's unavailable", () => {
    const identifier = createAbstractIdentifier<void, string>({
      type: 'test',
      name: 'test',
      processHandler: handler => handler,
    });

    identifier.registerHandler({
      available: () => false,
      body: input => input.acc + ' World',
    });

    const result = syncApplyImpl({
      identifier,
      acc: 'Hello',
      input: undefined,
    });

    expect(result).toBe('Hello');
  });

  it('should remove handler by reference', () => {
    const identifier = createAbstractIdentifier<void, number>({
      type: 'test',
      name: 'test',
      processHandler: handler => handler,
    });

    const handlerA = {
      available: () => true,
      body: (input: { acc: number }) => input.acc + 1,
    };
    const handlerB = {
      available: () => true,
      body: (input: { acc: number }) => input.acc + 10,
    };

    identifier.registerHandler(handlerA);
    identifier.registerHandler(handlerB);

    expect(syncApplyImpl({ identifier, acc: 0, input: undefined })).toBe(11);

    identifier.removeHandler(handlerA);

    expect(syncApplyImpl({ identifier, acc: 0, input: undefined })).toBe(10);
    expect(identifier.$handlers.getState()).toHaveLength(1);

    identifier.removeHandler(handlerB);

    expect(syncApplyImpl({ identifier, acc: 0, input: undefined })).toBe(0);
    expect(identifier.$handlers.getState()).toHaveLength(0);
  });

  it('should ignore removeHandler for unknown reference', () => {
    const identifier = createAbstractIdentifier<void, number>({
      type: 'test',
      name: 'test',
      processHandler: handler => handler,
    });

    const handler = {
      available: () => true,
      body: (input: { acc: number }) => input.acc + 1,
    };
    const stranger = {
      available: () => true,
      body: (input: { acc: number }) => input.acc + 100,
    };

    identifier.registerHandler(handler);
    identifier.removeHandler(stranger);

    expect(syncApplyImpl({ identifier, acc: 0, input: undefined })).toBe(1);
    expect(identifier.$handlers.getState()).toHaveLength(1);
  });

  it('should remove handler that was deduped by key', () => {
    const identifier = createAbstractIdentifier<void, number>({
      type: 'test',
      name: 'test',
      processHandler: handler => handler,
    });

    const handlerV1 = {
      key: 'shared',
      available: () => true,
      body: (input: { acc: number }) => input.acc + 1,
    };
    const handlerV2 = {
      key: 'shared',
      available: () => true,
      body: (input: { acc: number }) => input.acc + 5,
    };

    identifier.registerHandler(handlerV1);
    identifier.registerHandler(handlerV2);

    expect(syncApplyImpl({ identifier, acc: 0, input: undefined })).toBe(5);
    expect(identifier.$handlers.getState()).toHaveLength(1);

    identifier.removeHandler(handlerV2);

    expect(syncApplyImpl({ identifier, acc: 0, input: undefined })).toBe(0);
    expect(identifier.$handlers.getState()).toHaveLength(0);

    identifier.removeHandler(handlerV1);

    expect(identifier.$handlers.getState()).toHaveLength(0);
  });

  it('should clear all handlers on resetHandlers', () => {
    const identifier = createAbstractIdentifier<void, number>({
      type: 'test',
      name: 'test',
      processHandler: handler => handler,
    });

    identifier.registerHandler({
      available: () => true,
      body: (input: { acc: number }) => input.acc + 1,
    });
    identifier.registerHandler({
      available: () => true,
      body: (input: { acc: number }) => input.acc + 2,
    });

    expect(identifier.$handlers.getState()).toHaveLength(2);

    identifier.resetHandlers();

    expect(identifier.$handlers.getState()).toHaveLength(0);
    expect(syncApplyImpl({ identifier, acc: 0, input: undefined })).toBe(0);
  });

  it('should skip duplicate registerHandler with same reference', () => {
    const identifier = createAbstractIdentifier<void, number>({
      type: 'test',
      name: 'test',
      processHandler: handler => handler,
    });

    const handler = {
      available: () => true,
      body: (input: { acc: number }) => input.acc + 1,
    };

    identifier.registerHandler(handler);
    identifier.registerHandler(handler);

    expect(identifier.$handlers.getState()).toHaveLength(1);
  });

  it('should skip handler on error', () => {
    const identifier = createAbstractIdentifier<void, number>({
      type: 'test',
      name: 'test',
      processHandler: handler => handler,
    });

    identifier.registerHandler({
      available: () => true,
      body: input => input.acc + 1,
    });
    identifier.registerHandler({
      available: () => true,
      body: input => {
        throw new Error('fail');

        return input.acc + 1;
      },
    });
    identifier.registerHandler({
      available: () => true,
      body: input => input.acc + 1,
    });

    const result = syncApplyImpl({
      identifier,
      acc: 0,
      input: undefined,
    });

    expect(result).toBe(2);
  });
});
