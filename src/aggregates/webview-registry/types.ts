export type WebviewCrashInfo = {
  webContentsId: number;
  url: string;
  reason: string;
  exitCode: number;
  at: number;
};

export type WebviewUnresponsiveInfo = {
  webContentsId: number;
  url: string;
  at: number;
};

export type WebviewHealthState = 'healthy' | 'degraded' | 'unresponsive' | 'crashed';

export type WebviewHealthReason = { kind: string };

export type WebviewHealthEntry = {
  webContentsId: number;
  productId: string | null;
  state: WebviewHealthState;
  reason: WebviewHealthReason;
  since: number;
};
