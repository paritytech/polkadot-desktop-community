import { type ReactNode } from 'react';

import { createPipeline, createSDK, createSlot, createTransformer } from '@/shared/di';
import { type DashboardCardLayoutRules, type DashboardCardPayload, type WidgetSizeIconVariant } from '@/domains/application';

import { type CardRenderProps, type DashboardCardMetadata } from './types';

export const dashboardCardContentTransformer = createTransformer<CardRenderProps, ReactNode>({
  name: 'dashboardCardContent',
});

export const dashboardCardMetadataTransformer = createTransformer<DashboardCardPayload, DashboardCardMetadata>({
  name: 'dashboardCardMetadata',
});

export const dashboardCardActionsSlot = createSlot<{ payload: DashboardCardPayload }>({
  name: 'dashboardCardActions',
});

// Self-describing copy/preview the Add Widget modal renders for a native card.
// Carried by the entry so the modal renders exactly what the feature declares —
// no per-kind branching inside the dashboard feature.
type AddableWidgetCardDefinition = {
  titleKey: string;
  descriptionKey: string;
  previewVariant: WidgetSizeIconVariant;
  sizeVariants: WidgetSizeIconVariant[];
};

export type AddableDashboardCard = {
  kind: string;
  // Stable grid id (`card.i`) used for placement and dedup. Distinct from
  // `kind` (the payload type): e.g. Favorites has kind `folder:favorites` but
  // grid id `folder-favorites`, and Chat has kind `native:chat` / grid id `chat`.
  gridId: string;
  // i18n keys (not literals): entries are declared at module load, outside React,
  // so the sidebar label and panel header are translated at render time. Keeping
  // them as keys also avoids a second source of truth drifting from `en.json`.
  displayNameKey: string;
  descriptionKey?: string;
  icon?: ReactNode;
  defaultLayoutRules?: DashboardCardLayoutRules;
  widgetCard: AddableWidgetCardDefinition;
  createCard: () => { payload: DashboardCardPayload; gridSize: { w: number; h: number } };
};

// Catalog of native widgets the user can add to the dashboard. Product
// widgets aren't here — the modal lists them from `useProducts()` directly.
export const addableDashboardCardsPipeline = createPipeline<AddableDashboardCard[], object>({
  name: 'addableDashboardCards',
});

export const dashboardCardSDK = createSDK({
  required: {
    content: dashboardCardContentTransformer,
  },
  optional: {
    metadata: dashboardCardMetadataTransformer,
    actions: dashboardCardActionsSlot,
    addable: addableDashboardCardsPipeline,
  },
});
