import * as fs from 'fs';
import * as path from 'path';

import { describeElement } from './format';
import type { Violation } from './types';

// Baselines live next to the test file, like Jest snapshots, so they show up
// in code review:  __a11y_baselines__/LoginScreen.test.tsx.json
//
//   { "login": { "image-label-required: <Image> in LoginScreen": 1 } }
//
// Entries are counted fingerprints rather than tree positions, so unrelated
// layout changes don't invalidate a baseline.

export type BaselineEntries = Record<string, number>;
type BaselineFile = Record<string, BaselineEntries>;

export function baselinePath(testPath: string): string {
  return path.join(path.dirname(testPath), '__a11y_baselines__', `${path.basename(testPath)}.json`);
}

function readFile(file: string): BaselineFile {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as BaselineFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw new Error(`Could not read accessibility baseline ${file}: ${(error as Error).message}`);
  }
}

export function readBaseline(file: string, name: string): BaselineEntries | undefined {
  return readFile(file)[name];
}

export function writeBaseline(file: string, name: string, entries: BaselineEntries): void {
  const data = readFile(file);
  data[name] = sortKeys(entries);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(sortKeys(data), null, 2)}\n`);
}

function sortKeys<T>(obj: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}

export function fingerprint(violation: Violation): string {
  return `${violation.ruleId}: ${describeElement(violation.element)}`;
}

export function countFingerprints(violations: Violation[]): BaselineEntries {
  const counts: BaselineEntries = {};
  for (const v of violations) {
    const key = fingerprint(v);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export interface BaselineComparison {
  /** Violations beyond what the baseline allows. */
  added: Violation[];
  /** Violations covered by the baseline. */
  known: number;
  /** Baselined violations that no longer occur. */
  fixed: number;
  /** The baseline with fixed entries removed; never grows. */
  tightened: BaselineEntries;
}

export function compareToBaseline(baseline: BaselineEntries, violations: Violation[]): BaselineComparison {
  const groups = new Map<string, Violation[]>();
  for (const v of violations) {
    const key = fingerprint(v);
    groups.set(key, [...(groups.get(key) ?? []), v]);
  }

  const added: Violation[] = [];
  const tightened: BaselineEntries = {};
  let known = 0;
  for (const [key, group] of groups) {
    const allowed = baseline[key] ?? 0;
    added.push(...group.slice(allowed));
    const kept = Math.min(group.length, allowed);
    known += kept;
    if (kept > 0) tightened[key] = kept;
  }

  const total = (entries: BaselineEntries) => Object.values(entries).reduce((a, b) => a + b, 0);
  return { added, known, fixed: total(baseline) - total(tightened), tightened };
}
