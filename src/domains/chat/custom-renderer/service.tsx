import {
  type CodecType,
  type ColorToken,
  type ContentAlignment,
  type CustomRendererNode,
  type Dimensions,
  type Modifier,
  type TypographyStyle,
} from '@novasamatech/host-api';
import { Button, Input, Label } from '@novasamatech/tr-ui';
import { type CSSProperties, type ReactNode } from 'react';

export type ActionHandler = (actionId: string, value?: Uint8Array) => void;

// v0.8 migrated the custom-renderer design tokens to the hierarchical design-system scale.
// The on-wire variant order is unchanged — these are TypeScript-level identifier renames, so
// each new token keeps the CSS variable its v0.7 predecessor mapped to.
const COLOR_TOKEN_CSS: Record<CodecType<typeof ColorToken>, string> = {
  'fg.primary': 'hsl(var(--text-primary))',
  'fg.secondary': 'hsl(var(--text-secondary))',
  'fg.tertiary': 'hsl(var(--text-tertiary))',
  'bg.surface.main': 'hsl(var(--bg-surface-main))',
  'bg.surface.container': 'hsl(var(--bg-surface-nested))',
  'bg.surface.nested': 'hsl(var(--surface-tertiary))',
  'fg.error': 'hsl(var(--fg-error))',
  'fg.success': 'hsl(var(--fg-success))',
  'fg.warning': 'hsl(var(--fg-warning))',
};

const TYPOGRAPHY_CSS: Record<CodecType<typeof TypographyStyle>, CSSProperties> = {
  'headline.large': {
    fontSize: 'var(--text-heading-xl-size)',
    lineHeight: 'var(--text-heading-xl-line-height)',
    fontWeight: 'var(--text-heading-xl-weight)',
  },
  'title.medium.regular': {
    fontSize: 'var(--text-heading-m-size)',
    lineHeight: 'var(--text-heading-m-line-height)',
    fontWeight: 'var(--text-heading-m-weight)',
  },
  'body.large.regular': {
    fontSize: 'var(--text-body-base-size)',
    lineHeight: 'var(--text-body-base-line-height)',
    fontWeight: 'var(--text-body-base-weight-regular)',
  },
  'body.medium.regular': {
    fontSize: 'var(--text-body-s-size)',
    lineHeight: 'var(--text-body-s-line-height)',
    fontWeight: 'var(--text-body-s-weight-regular)',
  },
  'body.small.regular': {
    fontSize: 'var(--text-body-xs-size)',
    lineHeight: 'var(--text-body-xs-line-height)',
    fontWeight: 'var(--text-body-xs-weight-regular)',
  },
};

const ARRANGEMENT_TO_JUSTIFY: Record<'center' | 'start' | 'end' | 'spaceBetween' | 'spaceAround' | 'spaceEvenly', string> = {
  start: 'flex-start',
  end: 'flex-end',
  center: 'center',
  spaceBetween: 'space-between',
  spaceAround: 'space-around',
  spaceEvenly: 'space-evenly',
};

const ALIGN_TO_FLEX: Record<'start' | 'end' | 'center' | 'top' | 'bottom', string> = {
  start: 'flex-start',
  end: 'flex-end',
  center: 'center',
  top: 'flex-start',
  bottom: 'flex-end',
};

type ContentAlignmentType = CodecType<typeof ContentAlignment>;

const CONTENT_ALIGNMENT: Record<ContentAlignmentType, [alignItems: string, justifyItems: string]> = {
  topStart: ['start', 'start'],
  topCenter: ['start', 'center'],
  topEnd: ['start', 'end'],
  centerStart: ['center', 'start'],
  center: ['center', 'center'],
  centerEnd: ['center', 'end'],
  bottomStart: ['end', 'start'],
  bottomCenter: ['end', 'center'],
  bottomEnd: ['end', 'end'],
};

type ShapeType = { tag: 'Rounded'; value: number | bigint } | { tag: 'Circle'; value: undefined };

const px = (v: number | bigint) => `${Number(v)}px`;

const textEncoder = new TextEncoder();

function shapeToBorderRadius(shape: ShapeType | undefined): string | undefined {
  if (!shape) return undefined;
  if (shape.tag === 'Circle') return '50%';
  return px(shape.value);
}

function dimensionsToCss(dims: CodecType<typeof Dimensions>): string {
  const [a, b, c, d] = dims;
  if (c !== undefined && d !== undefined) return `${px(a)} ${px(b)} ${px(c)} ${px(d)}`;
  if (c !== undefined) return `${px(a)} ${px(b)} ${px(c)}`;
  return `${px(a)} ${px(b)}`;
}

function modifiersToStyle(modifiers: CodecType<typeof Modifier>[]): CSSProperties {
  const style: CSSProperties = {};

  for (const mod of modifiers) {
    switch (mod.tag) {
      case 'width':
        style.width = px(mod.value);
        break;
      case 'height':
        style.height = px(mod.value);
        break;
      case 'minWidth':
        style.minWidth = px(mod.value);
        break;
      case 'minHeight':
        style.minHeight = px(mod.value);
        break;
      case 'fillWidth':
        if (mod.value) style.width = '100%';
        break;
      case 'fillHeight':
        if (mod.value) style.height = '100%';
        break;
      case 'margin':
        style.margin = dimensionsToCss(mod.value);
        break;
      case 'padding':
        style.padding = dimensionsToCss(mod.value);
        break;
      case 'background': {
        style.backgroundColor = COLOR_TOKEN_CSS[mod.value.color];
        const radius = shapeToBorderRadius(mod.value.shape);
        if (radius) style.borderRadius = radius;
        break;
      }
      case 'border': {
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

function renderNode(node: CodecType<typeof CustomRendererNode>, onAction: ActionHandler, key?: string | number): ReactNode {
  switch (node.tag) {
    case 'Nil':
      return null;

    case 'String':
      return node.value;

    case 'Box': {
      const { modifiers, props, children } = node.value;
      const alignment = props.contentAlignment;
      const [alignItems, justifyItems] = alignment ? CONTENT_ALIGNMENT[alignment] : [];
      const style: CSSProperties = { alignItems, justifyItems, ...modifiersToStyle(modifiers) };
      return (
        <div key={key} className="grid" style={style}>
          {children.map((child, i) => renderNode(child, onAction, i))}
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
          {children.map((child, i) => renderNode(child, onAction, i))}
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
          {children.map((child, i) => renderNode(child, onAction, i))}
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
          {children.map((child, i) => renderNode(child, onAction, i))}
        </span>
      );
    }

    case 'Button': {
      const { modifiers, props } = node.value;
      const variant = props.variant === 'primary' ? 'default' : props.variant === 'secondary' ? 'secondary' : 'ghost';
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
  }
}

export const chatCustomRendererService = {
  renderNode,
};
