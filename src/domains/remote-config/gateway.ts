import { getValue } from 'firebase/remote-config';
import * as v from 'valibot';

import { getRemoteConfigInstance } from './bootstrap';

function readRaw(key: string): string | null {
  const remoteConfig = getRemoteConfigInstance();
  if (!remoteConfig) return null;
  const raw = getValue(remoteConfig, key).asString();
  return raw === '' ? null : raw;
}

// Return null on missing/invalid; the schema is the trust boundary (RC is
// untrusted). Reads are sync against the last-activated snapshot, so callers that
// need fresh data `await remoteConfigReady` first.
function tryGetJson<TSchema extends v.GenericSchema>(key: string, schema: TSchema): v.InferOutput<TSchema> | null {
  const raw = readRaw(key);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn(`[remote-config] param "${key}" is not valid JSON`, error);
    return null;
  }

  const result = v.safeParse(schema, parsed);
  if (!result.success) {
    console.warn(`[remote-config] param "${key}" failed validation`, result.issues);
    return null;
  }
  return result.output;
}

function tryGetString<TSchema extends v.GenericSchema<string>>(key: string, schema: TSchema): v.InferOutput<TSchema> | null {
  const raw = readRaw(key);
  if (raw === null) return null;

  const result = v.safeParse(schema, raw);
  if (!result.success) {
    console.warn(`[remote-config] param "${key}" failed validation`, result.issues);
    return null;
  }
  return result.output;
}

export const remoteConfigGateway = {
  tryGetJson,
  tryGetString,
};
