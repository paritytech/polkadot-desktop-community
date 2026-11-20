import { Button, Input, Label } from '@novasamatech/tr-ui';
import {
  type Arrangement,
  type BlendingMode,
  type ColorToken,
  type ContentAlignment,
  type Dimensions,
  type HorizontalAlignment,
  type Modifier,
  type Shape,
  type TypographyStyle,
  type VerticalAlignment,
} from '@parity/truapi';
import { type CSSProperties, type ReactNode } from 'react';

import { type ActionHandler, type RendererTreeNode } from '../types';

import { RendererImage } from './RendererImage';

// v0.8 migrated the custom-renderer design tokens to the hierarchical design-system scale.
// The on-wire variant order is unchanged — these are TypeScript-level identifier renames, so
// each new token keeps the CSS variable its v0.7 predecessor mapped to.
const COLOR_TOKEN_CSS: Record<ColorToken, string> = {
  FgPrimary: 'var(--fg-primary)',
  FgSecondary: 'var(--fg-secondary)',
  FgTertiary: 'var(--fg-tertiary)',
  BgSurfaceMain: 'var(--bg-surface-main)',
  BgSurfaceContainer: 'var(--bg-surface-container)',
  BgSurfaceNested: 'var(--bg-surface-nested)',
  FgError: 'var(--fg-error)',
  FgSuccess: 'var(--fg-success)',
  FgWarning: 'var(--fg-warning)',
};

const TYPOGRAPHY_CSS: Record<TypographyStyle, CSSProperties> = {
  HeadlineLarge: {
    fontSize: 'var(--font-size-32)',
    lineHeight: 'var(--line-height-40)',
    fontWeight: 'var(--font-weight-bold)',
  },
  TitleMediumRegular: {
    fontSize: 'var(--font-size-24)',
    lineHeight: 'var(--line-height-32)',
    fontWeight: 'var(--font-weight-bold)',
  },
  BodyLargeRegular: {
    fontSize: 'var(--font-size-14)',
    lineHeight: 'var(--line-height-20)',
    fontWeight: 'var(--font-weight-regular)',
  },
  BodyMediumRegular: {
    fontSize: 'var(--font-size-12)',
    lineHeight: 'var(--line-height-16)',
    fontWeight: 'var(--font-weight-regular)',
  },
  BodySmallRegular: {
    fontSize: 'var(--font-size-10)',
    lineHeight: 'var(--line-height-14)',
    fontWeight: 'var(--font-weight-regular)',
  },
};

const ARRANGEMENT_TO_JUSTIFY: Record<Arrangement, string> = {
  Start: 'flex-start',
  End: 'flex-end',
  Center: 'center',
  SpaceBetween: 'space-between',
  SpaceAround: 'space-around',
  SpaceEvenly: 'space-evenly',
};

const ALIGN_TO_FLEX: Record<HorizontalAlignment | VerticalAlignment, string> = {
  Start: 'flex-start',
  End: 'flex-end',
  Center: 'center',
  Top: 'flex-start',
  Bottom: 'flex-end',
};

const CONTENT_ALIGNMENT: Record<ContentAlignment, [alignItems: string, justifyItems: string]> = {
  TopStart: ['start', 'start'],
  TopCenter: ['start', 'center'],
  TopEnd: ['start', 'end'],
  CenterStart: ['center', 'start'],
  Center: ['center', 'center'],
  CenterEnd: ['center', 'end'],
  BottomStart: ['end', 'start'],
  BottomCenter: ['end', 'center'],
  BottomEnd: ['end', 'end'],
};

// The wire names the same set CSS does, so this is a spelling map and nothing more.
const BLEND_MODE_CSS: Record<BlendingMode, NonNullable<CSSProperties['mixBlendMode']>> = {
  Normal: 'normal',
  Multiply: 'multiply',
  Screen: 'screen',
  Overlay: 'overlay',
  Darken: 'darken',
  Lighten: 'lighten',
  ColorDodge: 'color-dodge',
  ColorBurn: 'color-burn',
  HardLight: 'hard-light',
  SoftLight: 'soft-light',
  Difference: 'difference',
  Exclusion: 'exclusion',
  Hue: 'hue',
  Saturation: 'saturation',
  Color: 'color',
  Luminosity: 'luminosity',
};

const px = (v: number | bigint) => `${Number(v)}px`;

const textEncoder = new TextEncoder();

function shapeToBorderRadius(shape: Shape | undefined): string | undefined {
  if (!shape) return undefined;
  if (shape.tag === 'Circle') return '50%';
  if (shape.tag === 'Square') return '0';

  return px(shape.value);
}

// CSS shorthand order is top/right/bottom/left; the wire names the horizontal pair
// `end`/`start` and lets each optional side fall back to its opposite.
function dimensionsToCss({ top, end, bottom, start }: Dimensions): string {
  return `${px(top)} ${px(end)} ${px(bottom ?? top)} ${px(start ?? end)}`;
}

export function modifiersToStyle(modifiers: Modifier[]): CSSProperties {
  const style: CSSProperties = {};

  for (const mod of modifiers) {
    switch (mod.tag) {
      case 'Width':
        style.width = px(mod.value);
        break;
      case 'Height':
        style.height = px(mod.value);
        break;
      case 'MinWidth':
        style.minWidth = px(mod.value);
        break;
      case 'MinHeight':
        style.minHeight = px(mod.value);
        break;
      case 'FillWidth':
        if (mod.value) style.width = '100%';
        break;
      case 'FillHeight':
        if (mod.value) style.height = '100%';
        break;
      // The wire carries a byte; CSS wants a fraction.
      case 'Opacity':
        style.opacity = mod.value / 255;
        break;
      case 'BlendingMode':
        style.mixBlendMode = BLEND_MODE_CSS[mod.value];
        break;
      case 'Margin':
        style.margin = dimensionsToCss(mod.value);
        break;
      case 'Padding':
        style.padding = dimensionsToCss(mod.value);
        break;
      case 'Background': {
        style.backgroundColor = COLOR_TOKEN_CSS[mod.value.color];
        const radius = shapeToBorderRadius(mod.value.shape);
        if (radius) style.borderRadius = radius;
        break;
      }
      case 'Border': {
        style.borderWidth = px(mod.value.width);
        style.borderColor = COLOR_TOKEN_CSS[mod.value.color];
        style.borderStyle = 'solid';
        const radius = shapeToBorderRadius(mod.value.shape);
        if (radius) style.borderRadius = radius;
        break;
      }
    }
  }

  return style;
}

/**
 * One node of a product-authored render tree, as host UI.
 *
 * The tree is a closed vocabulary — the product names layouts and tokens, never
 * markup, styles or URLs — so everything it can express is drawn from the host's
 * own design system here. That is what keeps a product's own drawing inside the
 * host's look and unable to reach past it.
 */
export function renderNode(node: RendererTreeNode, productId: string, onAction: ActionHandler, key?: string | number): ReactNode {
  switch (node.tag) {
    case 'Nil':
      return null;

    case 'String':
      return node.value.text;

    case 'Box': {
      const { modifiers, props, children } = node.value;
      const alignment = props.contentAlignment;
      const [alignItems, justifyItems] = alignment ? CONTENT_ALIGNMENT[alignment] : [];
      const style: CSSProperties = { alignItems, justifyItems, ...modifiersToStyle(modifiers) };
      return (
        <div key={key} className="grid" style={style}>
          {children.map((child, i) => renderNode(child, productId, onAction, i))}
        </div>
      );
    }

    case 'Column': {
      const { modifiers, props, children } = node.value;
      const style: CSSProperties = {
        alignItems: props.horizontalAlignment ? ALIGN_TO_FLEX[props.horizontalAlignment] : undefined,
        justifyContent: props.verticalArrangement ? ARRANGEMENT_TO_JUSTIFY[props.verticalArrangement] : undefined,
        ...modifiersToStyle(modifiers),
      };
      return (
        <div key={key} className="flex flex-col" style={style}>
          {children.map((child, i) => renderNode(child, productId, onAction, i))}
        </div>
      );
    }

    case 'Row': {
      const { modifiers, props, children } = node.value;
      const style: CSSProperties = {
        justifyContent: props.horizontalArrangement ? ARRANGEMENT_TO_JUSTIFY[props.horizontalArrangement] : undefined,
        alignItems: props.verticalAlignment ? ALIGN_TO_FLEX[props.verticalAlignment] : undefined,
        ...modifiersToStyle(modifiers),
      };
      return (
        <div key={key} className="flex flex-row" style={style}>
          {children.map((child, i) => renderNode(child, productId, onAction, i))}
        </div>
      );
    }

    case 'Spacer': {
      const { modifiers } = node.value;
      return <div key={key} className="flex-1" style={modifiersToStyle(modifiers)} />;
    }

    case 'Text': {
      const { modifiers, props, children } = node.value;
      const style: CSSProperties = {
        ...(props.style ? TYPOGRAPHY_CSS[props.style] : {}),
        ...(props.color ? { color: COLOR_TOKEN_CSS[props.color] } : {}),
        ...modifiersToStyle(modifiers),
      };
      return (
        <span key={key} style={style}>
          {children.map((child, i) => renderNode(child, productId, onAction, i))}
        </span>
      );
    }

    case 'Button': {
      const { modifiers, props } = node.value;
      const variant = props.variant === 'Primary' ? 'default' : props.variant === 'Secondary' ? 'secondary' : 'ghost';
      const clickAction = props.clickAction;
      return (
        <Button
          key={key}
          variant={variant}
          disabled={props.enabled === false || props.loading === true}
          style={modifiersToStyle(modifiers)}
          onClick={clickAction ? () => onAction(clickAction) : undefined}
        >
          {props.text}
        </Button>
      );
    }

    case 'TextField': {
      const { modifiers, props } = node.value;
      const valueChangeAction = props.valueChangeAction;
      return (
        <div key={key} className="flex flex-col gap-1" style={modifiersToStyle(modifiers)}>
          {props.label && <Label>{props.label}</Label>}
          <Input
            value={props.text}
            placeholder={props.placeholder}
            disabled={props.enabled === false}
            onChange={valueChangeAction ? e => onAction(valueChangeAction, textEncoder.encode(e.target.value)) : undefined}
          />
        </div>
      );
    }

    case 'Image': {
      const { modifiers, props } = node.value;
      return <RendererImage key={key} productId={productId} modifiers={modifiers} props={props} />;
    }

    case 'Materials': {
      // The host draws no materials and answers the `Materials` feature probe `false`,
      // so every node takes the RFC's fallback: its children, placed like a `Box`,
      // with the layers skipped.
      const { children } = node.value;
      return (
        <div key={key} className="grid">
          {children.map((child, i) => renderNode(child, productId, onAction, i))}
        </div>
      );
    }
  }
}
