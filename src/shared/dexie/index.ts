import Dexie, { type Table } from 'dexie';

type TableMap = Record<string, unknown>;

type DatabaseParams<TTables extends TableMap> = {
  name: string;
  version: number;
  schema: { [K in keyof TTables]: string };
};

export function createDexieDatabase<TTables extends TableMap>({
  name,
  version,
  schema,
}: DatabaseParams<TTables>): { [K in keyof TTables]: Table<TTables[K], string> } {
  const dexie = new Dexie(name);
  dexie.version(version).stores(schema);

  const entries = Object.keys(schema).map(tableName => [tableName, dexie.table(tableName)] as const);

  // Keys come from `schema`, which is typed as `{ [K in keyof TTables]: string }`,
  // so the resulting record matches the declared return type by construction.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return Object.fromEntries(entries) as { [K in keyof TTables]: Table<TTables[K], string> };
}
