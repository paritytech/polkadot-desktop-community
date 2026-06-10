# Database migrations

One unified migration flow for `polkadot-desktop-app-v1`.

## Adding a migration

1. Add `migration-<N>.ts` exporting one named `(tx: Transaction) => Promise<void>`:

   ```ts
   import { type Transaction } from 'dexie';

   export async function migrateThing(tx: Transaction): Promise<void> {
     await tx.table('things').toCollection().modify(row => {
       // mutate row in place; keep idempotent
     });
   }
   ```

2. Re-export it from `index.ts`.
3. In `../schema.ts`, add `SCHEMA_V<N>` (the full store map after the change) and
   append `dexie.version(<N>).stores(SCHEMA_V<N>).upgrade(migrateThing)`.

Keep migrations idempotent. Index-only changes need no upgrade callback.
