import * as fs from 'fs';
import * as path from 'path';

import { describeOwners } from './fiber';
import { describeElement } from './format';
import { sourceLocation, type SourceLocation } from './source';
import type { RuleId, Severity, Violation } from './types';

// Jest runs test files in worker processes, and reporters can't receive custom
// data from them. The reporter creates a directory and passes it to workers
// through this environment variable; each worker appends one JSON line per
// toBeAccessible() call.
export const REPORT_DIR_ENV = 'RN_A11Y_AUDIT_REPORT_DIR';

export interface RecordedViolation {
  ruleId: RuleId;
  severity: Severity;
  message: string;
  help: string;
  wcag?: readonly string[];
  element: string;
  component?: string;
  source?: SourceLocation;
  /** Covered by the test's baseline, so it didn't fail the test. */
  baselined: boolean;
}

export interface AuditRecord {
  testFile?: string;
  testName?: string;
  baseline?: string;
  passed: boolean;
  violations: RecordedViolation[];
  /** Source files that rendered the audited tree (React 19.1+). */
  files?: string[];
}

export function isRecording(): boolean {
  return Boolean(process.env[REPORT_DIR_ENV]);
}

export function toRecorded(violation: Violation, baselined: boolean): RecordedViolation {
  return {
    ruleId: violation.ruleId,
    severity: violation.severity,
    message: violation.message,
    help: violation.help,
    wcag: violation.wcag,
    element: describeElement(violation.element),
    component: owner(violation.element),
    source: sourceLocation(violation.element),
    baselined,
  };
}

function owner(node: Violation['element']): string | undefined {
  const { user, library } = describeOwners(node);
  return user ?? library?.package;
}

export function recordAudit(record: AuditRecord): void {
  const dir = process.env[REPORT_DIR_ENV];
  if (!dir) return;
  try {
    fs.appendFileSync(path.join(dir, `${process.pid}.jsonl`), `${JSON.stringify(record)}\n`);
  } catch {
    // Reporting must never fail a test.
  }
}

export function readRecords(dir: string): AuditRecord[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .flatMap((f) => fs.readFileSync(path.join(dir, f), 'utf8').split('\n'))
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as AuditRecord);
}
