export type NotificationId = number;

export type ScheduleRequest = {
  productId: string;
  title: string;
  text: string;
  deeplink: string | null;
  // null or a past timestamp means "fire immediately" — short-circuits the
  // persisted queue (no cap check, no store write).
  scheduledAt: number | null;
};

export type QueueEntry = {
  hostId: number;
  productId: string;
  perProductId: NotificationId;
  title: string;
  text: string;
  deeplink: string | null;
  scheduledAt: number;
};

export type ScheduleResult =
  | { ok: true; id: NotificationId }
  | { ok: false; error: 'ScheduleLimitReached' | 'Unknown'; reason?: string };

export type NotificationActivatedEvent = {
  productId: string;
  deeplink: string | null;
};

export const HOST_QUEUE_CAPACITY = 64;
