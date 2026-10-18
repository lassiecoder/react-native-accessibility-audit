import normalizeColor from '@react-native/normalize-colors';

import { flattenStyle, isText } from './tree';
import type { HostNode } from './types';

export interface RGBA {
  r: number;
  g: number;
  b: number;
  /** 0–1 */
  a: number;
}

/** Parses any color React Native accepts. PlatformColor and other opaque values return null. */
export function parseColor(value: unknown): RGBA | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const int = normalizeColor(value);
  if (int === null || int === undefined) return null;
  return {
    r: (int >>> 24) & 255,
    g: (int >>> 16) & 255,
    b: (int >>> 8) & 255,
    a: (int & 255) / 255,
  };
}

function blend(top: RGBA, bottom: RGBA): RGBA {
  const mix = (t: number, b: number) => t * top.a + b * (1 - top.a);
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

function luminance({ r, g, b }: RGBA): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio between two opaque colors, 1–21. */
export function contrastRatio(a: RGBA, b: RGBA): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** A style value set on the node or inherited from enclosing Text elements. */
export function inheritedTextStyle(node: HostNode, key: string): unknown {
  for (let n: HostNode | null = node; n && isText(n); n = n.parent) {
    const value = flattenStyle(n.props.style)[key];
    if (value !== undefined) return value;
  }
  return undefined;
}

/**
 * The opaque color painted behind `node`, compositing semi-transparent
 * ancestor backgrounds. Null when no opaque background is set anywhere above,
 * since the real background (window, image, native view) is unknown.
 */
export function backgroundBehind(node: HostNode): RGBA | null {
  const layers: RGBA[] = [];
  for (let n: HostNode | null = node; n; n = n.parent) {
    const bg = parseColor(flattenStyle(n.props.style).backgroundColor);
    if (!bg || bg.a === 0) continue;
    layers.push(bg);
    if (bg.a === 1) {
      return layers.reduceRight<RGBA | null>((below, layer) => (below ? blend(layer, below) : layer), null);
    }
  }
  return null;
}

export function toHex({ r, g, b }: RGBA): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

export { blend };
