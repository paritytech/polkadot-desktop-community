// Wire contract for the `proxyFetch` IPC — a main-process fetch that lets renderer callers
// bypass CORS. Shared between the main handler and the preload bridge so the two can't drift.

export type ProxyFetchRequest = {
  url: string;
  method: string;
  headers: [string, string][];
  body: Uint8Array | null;
};

export type ProxyFetchResponse = {
  status: number;
  statusText: string;
  headers: [string, string][];
  body: Uint8Array;
  url: string;
  redirected: boolean;
};
