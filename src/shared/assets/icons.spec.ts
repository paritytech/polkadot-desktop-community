// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

type Point = [number, number];

type Segment = {
  from: Point;
  to: Point;
  controls: Point[];
};

type Geometry = {
  anchors: Point[];
  controls: Point[];
  segments: Segment[];
};

const ROOT_ATTRIBUTES: Record<string, string> = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: '16',
  height: '16',
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '1.5',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
};

const ELEMENT_ATTRIBUTES: Record<string, string[]> = {
  path: ['d'],
  line: ['x1', 'y1', 'x2', 'y2'],
  polyline: ['points'],
  polygon: ['points'],
  circle: ['cx', 'cy', 'r'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
  rect: ['x', 'y', 'width', 'height', 'rx'],
};

const COMMAND_ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

const FILE_NAME = /^[a-z0-9]+(-[a-z0-9]+)*\.svg$/;
const PATH_COMMAND = /([A-Za-z])([^A-Za-z]*)/g;
const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)/g;
const SINGLE_NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
const SEPARATORS = /[\s,]/g;

const EPSILON = 1e-6;
const DOT_LENGTH = 0.01;
const DOT_RADIUS = 0.75;
const LIVE_AREA_START = 1.75;
const LIVE_AREA_END = 14.25;

function isWhole(value: number): boolean {
  return Math.abs(value - Math.round(value)) < EPSILON;
}

function isOnLattice(value: number): boolean {
  return isWhole((value - 0.25) * 2);
}

function isOnQuarterPixel(value: number): boolean {
  return isWhole(value * 4);
}

function isInLiveArea(value: number): boolean {
  return value >= LIVE_AREA_START - EPSILON && value <= LIVE_AREA_END + EPSILON;
}

function isSamePoint(a: Point, b: Point): boolean {
  return Math.abs(a[0] - b[0]) < EPSILON && Math.abs(a[1] - b[1]) < EPSILON;
}

function isZeroLength(segment: Segment): boolean {
  return [segment.to, ...segment.controls].every(point => isSamePoint(point, segment.from));
}

// Rule 7: lucide's dot is a 0.01 segment, because svgo drops a zero-length one. Its end is off the lattice by design.
function isDot(segment: Segment): boolean {
  const length = Math.hypot(segment.to[0] - segment.from[0], segment.to[1] - segment.from[1]);

  return segment.controls.length === 0 && Math.abs(length - DOT_LENGTH) < EPSILON;
}

function hasOnlyNumbers(text: string): boolean {
  return text.replace(NUMBER, '').replace(SEPARATORS, '') === '';
}

function readNumbers(text: string): number[] {
  return (text.match(NUMBER) ?? []).map(Number);
}

function pointAt(values: number[], index: number): Point {
  return [values[index] ?? Number.NaN, values[index + 1] ?? Number.NaN];
}

function readPath(d: string, report: (message: string) => void): Geometry {
  const geometry: Geometry = { anchors: [], controls: [], segments: [] };
  let current: Nullable<Point> = null;
  let subpathStart: Nullable<Point> = null;

  if (!/^\s*[Mm]/.test(d)) {
    report('path does not start with M');
  }

  for (const match of d.matchAll(PATH_COMMAND)) {
    const command = match[1] ?? '';
    const argumentText = match[2] ?? '';
    const absoluteCommand = command.toUpperCase();
    const arity = COMMAND_ARITY[absoluteCommand];

    if (command !== absoluteCommand) {
      report(`path relative command ${command}`);
    }
    if (arity === undefined) {
      report(`path unknown command ${command}`);
      continue;
    }

    const values = readNumbers(argumentText);
    const hasValidArguments =
      hasOnlyNumbers(argumentText) && (arity === 0 ? values.length === 0 : values.length > 0 && values.length % arity === 0);

    if (!hasValidArguments) {
      report(`path malformed data at ${command}${argumentText.trim()}`);
      continue;
    }
    if (arity === 0) {
      current = subpathStart;
      continue;
    }

    for (let index = 0; index < values.length; index += arity) {
      const group = values.slice(index, index + arity);
      const step = absoluteCommand === 'M' && index > 0 ? 'L' : absoluteCommand;

      if (step === 'M') {
        const point = pointAt(group, 0);
        geometry.anchors.push(point);
        current = point;
        subpathStart = point;
        continue;
      }
      if (!current) {
        report(`path draws ${command} before M`);
        break;
      }

      const from: Point = current;
      const to: Point =
        step === 'H'
          ? [group[0] ?? Number.NaN, from[1]]
          : step === 'V'
            ? [from[0], group[0] ?? Number.NaN]
            : pointAt(group, arity - 2);
      const controls =
        step === 'C' ? [pointAt(group, 0), pointAt(group, 2)] : step === 'S' || step === 'Q' ? [pointAt(group, 0)] : [];

      geometry.anchors.push(to);
      geometry.controls.push(...controls);
      geometry.segments.push({ from, to, controls });
      current = to;
    }
  }

  return geometry;
}

function readPoints(text: string, tag: string, report: (message: string) => void): Point[] {
  const values = readNumbers(text);

  if (!hasOnlyNumbers(text) || values.length === 0 || values.length % 2 !== 0) {
    report(`${tag} malformed points`);
    return [];
  }

  const points: Point[] = [];
  for (let index = 0; index < values.length; index += 2) {
    points.push(pointAt(values, index));
  }

  return points;
}

function connect(points: Point[]): Segment[] {
  return points.slice(1).map((to, index): Segment => ({ from: points[index] ?? to, to, controls: [] }));
}

function readGeometry(element: Element, report: (message: string) => void): Geometry {
  const tag = element.tagName;
  const attributes = Object.fromEntries(Array.from(element.attributes, attribute => [attribute.name, attribute.value]));

  function readNumber(name: string): number {
    const value = attributes[name];
    if (value === undefined || !SINGLE_NUMBER.test(value.trim())) {
      report(`${tag} attribute ${name} is not a number`);
      return Number.NaN;
    }

    return Number(value);
  }

  switch (tag) {
    case 'path':
      return readPath(attributes['d'] ?? '', report);
    case 'line': {
      const points: Point[] = [
        [readNumber('x1'), readNumber('y1')],
        [readNumber('x2'), readNumber('y2')],
      ];
      return { anchors: points, controls: [], segments: connect(points) };
    }
    case 'polyline':
    case 'polygon': {
      const points = readPoints(attributes['points'] ?? '', tag, report);
      return { anchors: points, controls: [], segments: connect(points) };
    }
    case 'rect': {
      const x = readNumber('x');
      const y = readNumber('y');
      const width = readNumber('width');
      const height = readNumber('height');
      const rx = attributes['rx'];
      const expected = Math.min(width, height) >= 6 ? 1.25 : 0.75;

      if (rx === undefined) {
        report(`rect rx missing, want ${expected}`);
      } else if (readNumber('rx') !== expected) {
        report(`rect rx ${rx}, want ${expected}`);
      }

      return {
        anchors: [
          [x, y],
          [x + width, y + height],
        ],
        controls: [],
        segments: [],
      };
    }
    case 'circle':
    case 'ellipse': {
      const cx = readNumber('cx');
      const cy = readNumber('cy');
      const rx = readNumber(tag === 'circle' ? 'r' : 'rx');
      const ry = readNumber(tag === 'circle' ? 'r' : 'ry');

      if (tag === 'circle') {
        const isDotCircle = rx === DOT_RADIUS;
        const isCentred = isDotCircle ? [cx, cy].every(value => isWhole(value * 2)) : [cx, cy].every(isOnLattice);

        if (rx < DOT_RADIUS - EPSILON) {
          report(`circle r ${rx}, want ${DOT_RADIUS} or more`);
        }
        if (!isCentred) {
          report(`circle centre ${cx},${cy} off its grid`);
        }
        if (!isWhole(rx * 2) && !isDotCircle) {
          report(`circle r ${rx} is not a multiple of 0.5`);
        }
      }

      return {
        anchors: [
          [cx - rx, cy - ry],
          [cx + rx, cy + ry],
        ],
        controls: [],
        segments: [],
      };
    }
    default:
      return { anchors: [], controls: [], segments: [] };
  }
}

function findViolations(fileName: string, svg: string): string[] {
  const violations: string[] = [];
  const report = (message: string) => violations.push(message);

  if (!FILE_NAME.test(fileName)) {
    report(`file name ${fileName} is not kebab-case`);
  }

  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = document.documentElement;

  if (root.tagName !== 'svg' || document.getElementsByTagName('parsererror').length > 0) {
    report('malformed svg');
    return violations;
  }

  const rootAttributes = Object.fromEntries(Array.from(root.attributes, attribute => [attribute.name, attribute.value]));
  const hasRootAttributes =
    Object.keys(rootAttributes).length === Object.keys(ROOT_ATTRIBUTES).length &&
    Object.entries(ROOT_ATTRIBUTES).every(([name, value]) => rootAttributes[name] === value);

  if (!hasRootAttributes) {
    report(`root attributes ${JSON.stringify(rootAttributes)}`);
  }

  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.COMMENT_NODE) {
      report('comment');
    } else if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '') {
      report('text');
    }
  }

  for (const element of Array.from(root.children)) {
    const tag = element.tagName;
    const allowed = ELEMENT_ATTRIBUTES[tag];

    if (!allowed) {
      report(`element ${tag}`);
      continue;
    }
    if (element.children.length > 0) {
      report(`${tag} has child elements`);
    }
    for (const attribute of Array.from(element.attributes)) {
      if (!allowed.includes(attribute.name)) {
        report(`${tag} attribute ${attribute.name}`);
      }
    }

    const geometry = readGeometry(element, report);

    if (geometry.segments.length === 0 && tag === 'path') {
      report('path draws nothing');
    }
    const dotEnds = new Set(geometry.segments.filter(isDot).map(segment => segment.to));

    for (const anchor of geometry.anchors) {
      const [x, y] = anchor;
      if (!dotEnds.has(anchor) && !anchor.every(isOnLattice)) {
        report(`${tag} point ${x},${y} off lattice`);
      }
      if (!anchor.every(isInLiveArea)) {
        report(`${tag} point ${x},${y} outside live area`);
      }
    }
    for (const control of geometry.controls) {
      if (!control.every(isOnQuarterPixel)) {
        report(`${tag} control ${control[0]},${control[1]} off quarter pixel`);
      }
    }
    for (const segment of geometry.segments) {
      if (isZeroLength(segment)) {
        report(`${tag} zero-length segment at ${segment.from[0]},${segment.from[1]}`);
      }
    }
  }

  return violations;
}

const icons = import.meta.glob<string>('./images/icons/*.svg', { query: '?raw', import: 'default', eager: true });

const entries = Object.entries(icons).map(([path, svg]): [string, string] => [path.split('/').at(-1) ?? path, svg]);

function iconOf(children: string): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">`,
    children,
    '</svg>',
  ].join('\n');
}

it('holds icons', () => {
  expect(entries.length).toBeGreaterThan(0);
});

it.each(entries)('%s follows the spec', (fileName, svg) => {
  expect(findViolations(fileName, svg)).toEqual([]);
});

describe('findViolations', () => {
  it('accepts an icon that follows the spec', () => {
    const svg = iconOf(
      [
        '<circle cx="8.25" cy="8.25" r="6"/>',
        '<path d="M8.25 10.75L8.26 10.75"/>',
        '<circle cx="5.5" cy="8.5" r="0.75"/>',
        '<path d="M4.25 5.75H12.25V10.25"/>',
        '<rect x="2.25" y="3.75" width="11.5" height="8.5" rx="1.25"/>',
        '<path d="M4.25 12.75C5.5 11.25 7 11.25 8.25 12.75"/>',
      ].join('\n'),
    );

    expect(findViolations('valid.svg', svg)).toEqual([]);
  });

  it.each([
    {
      label: 'a relative command',
      fileName: 'icon.svg',
      svg: iconOf('<path d="m4.25 5.75 4 4"/>'),
      fragment: 'relative command',
    },
    {
      label: 'a line end off the lattice',
      fileName: 'icon.svg',
      svg: iconOf('<line x1="8" y1="4.25" x2="8.25" y2="10.25"/>'),
      fragment: 'off lattice',
    },
    { label: 'an H off the lattice', fileName: 'icon.svg', svg: iconOf('<path d="M4.25 5.75H8"/>'), fragment: 'off lattice' },
    {
      label: 'a circle extent off the lattice',
      fileName: 'icon.svg',
      svg: iconOf('<circle cx="8" cy="8" r="6"/>'),
      fragment: 'off lattice',
    },
    {
      label: 'a colour on a child',
      fileName: 'icon.svg',
      svg: iconOf('<path d="M4.25 5.75H12.25" fill="red"/>'),
      fragment: 'attribute fill',
    },
    {
      label: 'a group',
      fileName: 'icon.svg',
      svg: iconOf('<g><path d="M4.25 5.75H12.25"/></g>'),
      fragment: 'element g',
    },
    {
      label: 'a root stroke width other than 1.5',
      fileName: 'icon.svg',
      svg: iconOf('<path d="M4.25 5.75H12.25"/>').replace('stroke-width="1.5"', 'stroke-width="2"'),
      fragment: 'root attributes',
    },
    {
      label: 'a point outside the live area',
      fileName: 'icon.svg',
      svg: iconOf('<path d="M0.75 5.75L4.25 5.75"/>'),
      fragment: 'outside live area',
    },
    {
      label: 'a rect corner that does not match its size',
      fileName: 'icon.svg',
      svg: iconOf('<rect x="2.25" y="3.75" width="11.5" height="8.5" rx="0.75"/>'),
      fragment: 'rx 0.75, want 1.25',
    },
    {
      label: 'a control point off the quarter pixel',
      fileName: 'icon.svg',
      svg: iconOf('<path d="M4.25 12.75C5.1 11.25 7 11.25 8.25 12.75"/>'),
      fragment: 'control',
    },
    {
      label: 'a zero-length segment',
      fileName: 'icon.svg',
      svg: iconOf('<path d="M8.25 10.75L8.25 10.75"/>'),
      fragment: 'zero-length segment',
    },
    { label: 'text that is not svg', fileName: 'icon.svg', svg: 'not svg <', fragment: 'malformed svg' },
    {
      label: 'a truncated document',
      fileName: 'icon.svg',
      svg: iconOf('<path d="M1.75 1.75"/>').replace('\n</svg>', ''),
      fragment: 'malformed svg',
    },
    {
      label: 'a rect without rx',
      fileName: 'icon.svg',
      svg: iconOf('<rect x="2.25" y="3.75" width="11.5" height="8.5"/>'),
      fragment: 'rx missing',
    },
    {
      label: 'a circle smaller than a dot',
      fileName: 'icon.svg',
      svg: iconOf('<circle cx="8.25" cy="8.25" r="0.5"/>'),
      fragment: 'circle r 0.5',
    },
    {
      label: 'a circle centre off the lattice',
      fileName: 'icon.svg',
      svg: iconOf('<circle cx="8.25" cy="8.5" r="2"/>'),
      fragment: 'off its grid',
    },
    {
      label: 'a comment',
      fileName: 'icon.svg',
      svg: iconOf('<!-- hi -->\n<path d="M4.25 5.75H12.25"/>'),
      fragment: 'comment',
    },
    {
      label: 'stray text',
      fileName: 'icon.svg',
      svg: iconOf('stray text\n<path d="M4.25 5.75H12.25"/>'),
      fragment: 'text',
    },
    {
      label: 'a path with no segment',
      fileName: 'icon.svg',
      svg: iconOf('<path d="M4.25 5.75"/>'),
      fragment: 'draws nothing',
    },
    {
      label: 'a file name that is not kebab-case',
      fileName: 'Bad_Name.svg',
      svg: iconOf('<path d="M4.25 5.75H12.25"/>'),
      fragment: 'file name',
    },
  ])('rejects $label', ({ fileName, svg, fragment }) => {
    expect(findViolations(fileName, svg)).toEqual(expect.arrayContaining([expect.stringContaining(fragment)]));
  });
});
