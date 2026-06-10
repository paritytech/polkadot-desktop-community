// Unified migration flow. Each schema bump in `../schema.ts` calls
// `.version(N).stores(SCHEMA_VN).upgrade(migrationN)`; the upgrade function is a
// named `(tx: Transaction) => Promise<void>` defined in `migration-N.ts` and
// re-exported here. v1 is the baseline schema and has no upgrade.
//
// export { migrateExampleTable } from './migration-1';
export {};
