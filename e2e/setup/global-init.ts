import { removePool } from './bot-user-pool';

/**
 * Runs once per `playwright test` invocation before any worker starts. Wipes
 * a stale pool file from a crashed previous run — per-project setups merge
 * into the pool file, so we need a clean slate each time.
 */
export default async function globalInit(): Promise<void> {
  await removePool();
}
