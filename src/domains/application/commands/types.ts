// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Command<Action extends string = any, Params extends Record<string, unknown> = any> = {
  action: Action;
  params: Params;
};
