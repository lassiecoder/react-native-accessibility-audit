import * as path from 'path';

import type { AuditRecord } from './collector';
import type { RuleId, Severity } from './types';

// Turns the per-audit records from a test run into a deduplicated, prioritized
// list of issues: what react-native-accessibility-engine#255 asked for, a
// project-wide to-do list with controls first.

export const REPORT_VERSION = 1;

export interface ReportIssue {
  ruleId: RuleId;
  severity: Severity;
  message: string;
  help: string;
  element: string;
  component?: string;
  /** Relative to the project root. */
  file?: string;
  line?: number;
  column?: number;
  /** Every test that hit this issue had it in its baseline. */
  baselined: boolean;
  /** Tests that hit this issue: test file (relative) and test name. */
  tests: Array<{ file?: string; name?: string }>;
}

export interface Report {
  version: number;
  tool: 'react-native-accessibility-audit';
  generatedAt: string;
  summary: {
    /** toBeAccessible() calls recorded. */
    audits: number;
    failedAudits: number;
    /** Distinct issues. */
    issues: number;
    /** Errors that fail tests (not covered by a baseline). */
    errors: number;
    /** Errors covered by a baseline. */
    baselined: number;
    warnings: number;
  };
  byRule: Partial<Record<RuleId, number>>;
  issues: ReportIssue[];
}

// Rules about controls come first: an unusable button blocks a task, while a
// missing image label loses information.
const CONTROL_RULES = new Set<RuleId>([
  'interactive-label-required', 'interactive-role-required', 'input-label-required',
  'interactive-accessible-required', 'no-nested-interactive', 'state-required',
  'adjustable-role-required', 'accessibility-actions-valid', 'modal-hides-background',
]);

function relative(root: string, file: string | undefined): string | undefined {
  if (!file) return undefined;
  const rel = path.relative(root, file);
  return rel.startsWith('..') ? file : rel.split(path.sep).join('/');
}

function rank(issue: ReportIssue): number[] {
  const severity = issue.severity === 'error' ? (issue.baselined ? 1 : 0) : 2;
  return [severity, CONTROL_RULES.has(issue.ruleId) ? 0 : 1];
}

function compare(a: ReportIssue, b: ReportIssue): number {
  const [ra, rb] = [rank(a), rank(b)];
  for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
  return (
    (a.file ?? '￿').localeCompare(b.file ?? '￿') ||
    (a.line ?? 0) - (b.line ?? 0) ||
    a.ruleId.localeCompare(b.ruleId)
  );
}

export function buildReport(records: AuditRecord[], root: string, now = new Date()): Report {
  const issues = new Map<string, ReportIssue>();
  for (const record of records) {
    const test = { file: relative(root, record.testFile), name: record.testName };
    for (const v of record.violations) {
      const file = relative(root, v.source?.file);
      // The same element can be rendered by many tests; report it once.
      const key = [v.ruleId, v.element, file, v.source?.line, v.source?.column, v.message].join('|');
      const existing = issues.get(key);
      if (existing) {
        existing.baselined &&= v.baselined;
        if (!existing.tests.some((t) => t.file === test.file && t.name === test.name)) existing.tests.push(test);
        continue;
      }
      issues.set(key, {
        ruleId: v.ruleId,
        severity: v.severity,
        message: v.message,
        help: v.help,
        element: v.element,
        component: v.component,
        file,
        line: v.source?.line,
        column: v.source?.column,
        baselined: v.severity === 'error' && v.baselined,
        tests: [test],
      });
    }
  }

  const list = [...issues.values()].sort(compare);
  const byRule: Partial<Record<RuleId, number>> = {};
  for (const issue of list) byRule[issue.ruleId] = (byRule[issue.ruleId] ?? 0) + 1;

  return {
    version: REPORT_VERSION,
    tool: 'react-native-accessibility-audit',
    generatedAt: now.toISOString(),
    summary: {
      audits: records.length,
      failedAudits: records.filter((r) => !r.passed).length,
      issues: list.length,
      errors: list.filter((i) => i.severity === 'error' && !i.baselined).length,
      baselined: list.filter((i) => i.baselined).length,
      warnings: list.filter((i) => i.severity === 'warn').length,
    },
    byRule: Object.fromEntries(Object.entries(byRule).sort(([, a], [, b]) => b - a)),
    issues: list,
  };
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function location(issue: ReportIssue): string {
  if (!issue.file) return issue.component ? `in ${issue.component}` : 'unknown location';
  return `${issue.file}:${issue.line}:${issue.column}`;
}

function label(issue: ReportIssue): string {
  if (issue.severity === 'warn') return 'warning';
  return issue.baselined ? 'baselined' : 'error';
}

export function summaryLine(report: Report): string {
  const { summary } = report;
  if (summary.issues === 0) return `Accessibility: no issues in ${plural(summary.audits, 'audit')}.`;
  const parts = [plural(summary.errors, 'error')];
  if (summary.baselined) parts.push(`${summary.baselined} baselined`);
  parts.push(plural(summary.warnings, 'warning'));
  return `Accessibility: ${parts.join(', ')} in ${plural(summary.audits, 'audit')}.`;
}

/** Groups issues by source file, keeping the priority order. */
function byFile(issues: ReportIssue[]): Array<[string, ReportIssue[]]> {
  const groups = new Map<string, ReportIssue[]>();
  for (const issue of issues) {
    const key = issue.file ?? (issue.component ? `${issue.component} (no source location)` : 'No source location');
    groups.set(key, [...(groups.get(key) ?? []), issue]);
  }
  return [...groups.entries()];
}

export function formatText(report: Report): string {
  const lines = [summaryLine(report)];
  for (const [file, issues] of byFile(report.issues)) {
    lines.push('', file);
    for (const issue of issues) {
      const at = issue.line ? `${issue.line}:${issue.column}` : '';
      lines.push(`  ${at.padEnd(8)}${label(issue).padEnd(10)}${issue.ruleId}  ${issue.message}`);
      lines.push(`  ${''.padEnd(18)}${issue.element}`);
    }
  }
  return lines.join('\n');
}

export function formatMarkdown(report: Report): string {
  const lines = ['# Accessibility report', '', summaryLine(report)];
  if (report.issues.length === 0) return lines.join('\n');
  lines.push('', '| Rule | Issues |', '| --- | --- |');
  for (const [rule, count] of Object.entries(report.byRule)) lines.push(`| \`${rule}\` | ${count} |`);
  for (const [file, issues] of byFile(report.issues)) {
    lines.push('', `## ${file}`, '');
    for (const issue of issues) {
      const at = issue.line ? `line ${issue.line}: ` : '';
      lines.push(`- [ ] ${at}**${issue.ruleId}** (${label(issue)}): ${issue.message} \`${issue.element}\``);
    }
  }
  return lines.join('\n');
}

function escapeData(value: string): string {
  return value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function escapeProperty(value: string): string {
  return escapeData(value).replace(/:/g, '%3A').replace(/,/g, '%2C');
}

/** GitHub Actions workflow commands, which show up as annotations on pull requests. */
export function formatGithub(report: Report, { includeBaselined = false } = {}): string {
  return report.issues
    .filter((issue) => includeBaselined || !issue.baselined)
    .map((issue) => {
      const command = issue.severity === 'error' && !issue.baselined ? 'error' : issue.baselined ? 'notice' : 'warning';
      const props = [
        issue.file && `file=${escapeProperty(issue.file)}`,
        issue.line && `line=${issue.line}`,
        issue.column && `col=${issue.column}`,
        `title=${escapeProperty(issue.ruleId)}`,
      ].filter(Boolean);
      return `::${command} ${props.join(',')}::${escapeData(`${issue.message} ${issue.element}. Fix: ${issue.help}`)}`;
    })
    .join('\n');
}
