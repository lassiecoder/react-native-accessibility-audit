import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { readRecords, REPORT_DIR_ENV } from './collector';
import { buildReport, formatMarkdown, summaryLine } from './report';

export interface ReporterOptions {
  /** JSON report path, relative to Jest's rootDir. Default "a11y-report.json". */
  outputFile?: string;
  /** Also write a Markdown to-do list, e.g. "a11y-report.md". */
  markdownFile?: string;
  /** Print a one-line summary after the run. Default true. */
  summary?: boolean;
}

/**
 * Jest reporter that collects every toBeAccessible() result from a run,
 * including passing, baselined and warning-only audits, into one report.
 *
 *   reporters: ['default', ['react-native-accessibility-audit/reporter', { outputFile: 'a11y-report.json' }]]
 */
export default class AccessibilityReporter {
  private readonly root: string;
  private readonly dir: string;

  constructor(globalConfig: { rootDir: string }, private readonly options: ReporterOptions = {}) {
    this.root = globalConfig.rootDir;
    this.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-a11y-audit-'));
    // Workers are started after reporters, so they inherit this.
    process.env[REPORT_DIR_ENV] = this.dir;
  }

  onRunStart(): void {
    // Watch mode reuses the reporter; start each run empty.
    this.clearRecords();
  }

  onRunComplete(): void {
    const report = buildReport(readRecords(this.dir), this.root);
    this.clearRecords();
    const outputFile = path.resolve(this.root, this.options.outputFile ?? 'a11y-report.json');
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`);
    if (this.options.markdownFile) {
      const markdownFile = path.resolve(this.root, this.options.markdownFile);
      fs.mkdirSync(path.dirname(markdownFile), { recursive: true });
      fs.writeFileSync(markdownFile, `${formatMarkdown(report)}\n`);
    }
    if (this.options.summary !== false) {
      process.stderr.write(`\n${summaryLine(report)} Report: ${path.relative(process.cwd(), outputFile)}\n`);
    }
  }

  private clearRecords(): void {
    for (const file of fs.readdirSync(this.dir)) fs.rmSync(path.join(this.dir, file), { force: true });
  }

  getLastError(): void {
    return undefined;
  }
}
