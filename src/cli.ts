#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';

import { formatGithub, formatMarkdown, formatText, type Report } from './report';

const USAGE = `Usage: react-native-accessibility-audit <command> [options]

Commands:
  report [file]      Print the report written by the Jest reporter (default: a11y-report.json)
    --format <f>     text (default), markdown, github or json
    --fail-on <s>    Exit with 1 if there are errors (error) or errors or warnings (warn). Default: none
    --include-baselined  With --format github, also annotate baselined issues as notices

  baselines [dir]    List the violations recorded in baseline files under dir (default: .)
    --format <f>     text (default), markdown or json

  help               Show this message
`;

interface Args {
  positional: string[];
  flags: Record<string, string | true>;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { positional: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      args.positional.push(arg);
      continue;
    }
    const [name, inline] = arg.slice(2).split('=', 2);
    if (inline !== undefined) args.flags[name] = inline;
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') && name !== 'include-baselined') args.flags[name] = argv[++i];
    else args.flags[name] = true;
  }
  return args;
}

function choice(flags: Args['flags'], name: string, allowed: string[], fallback: string): string {
  const value = flags[name] ?? fallback;
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new UsageError(`--${name} must be one of: ${allowed.join(', ')}`);
  }
  return value;
}

class UsageError extends Error {}

function report({ positional, flags }: Args, out: (s: string) => void): number {
  const file = path.resolve(positional[0] ?? 'a11y-report.json');
  if (!fs.existsSync(file)) {
    throw new UsageError(
      `No report at ${path.relative(process.cwd(), file)}. Add the reporter to your Jest config and run your tests first:\n` +
        "  reporters: ['default', 'react-native-accessibility-audit/reporter']",
    );
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as Report;
  if (data.tool !== 'react-native-accessibility-audit' || typeof data.version !== 'number') {
    throw new UsageError(`${file} is not a react-native-accessibility-audit report.`);
  }

  const format = choice(flags, 'format', ['text', 'markdown', 'github', 'json'], 'text');
  const failOn = choice(flags, 'fail-on', ['error', 'warn', 'none'], 'none');
  if (format === 'json') out(JSON.stringify(data, null, 2));
  else if (format === 'markdown') out(formatMarkdown(data));
  else if (format === 'github') out(formatGithub(data, { includeBaselined: flags['include-baselined'] === true }));
  else out(formatText(data));

  const { errors, warnings } = data.summary;
  if (failOn === 'error' && errors > 0) return 1;
  if (failOn === 'warn' && errors + warnings > 0) return 1;
  return 0;
}

interface BaselineGroup {
  testFile: string;
  name: string;
  entries: Array<{ key: string; count: number }>;
}

function findBaselineFiles(dir: string): string[] {
  const found: string[] = [];
  const visit = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(current, entry.name);
      if (entry.name === '__a11y_baselines__') {
        for (const file of fs.readdirSync(full)) if (file.endsWith('.json')) found.push(path.join(full, file));
      } else {
        visit(full);
      }
    }
  };
  visit(dir);
  return found.sort();
}

function baselines({ positional, flags }: Args, out: (s: string) => void): number {
  const root = path.resolve(positional[0] ?? '.');
  const format = choice(flags, 'format', ['text', 'markdown', 'json'], 'text');
  const groups: BaselineGroup[] = [];
  for (const file of findBaselineFiles(root)) {
    // __a11y_baselines__/Login.test.tsx.json belongs to ../Login.test.tsx
    const testFile = path.relative(root, path.join(path.dirname(file), '..', path.basename(file, '.json'))).split(path.sep).join('/');
    const data = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, Record<string, number>>;
    for (const [name, entries] of Object.entries(data)) {
      groups.push({ testFile, name, entries: Object.entries(entries).map(([key, count]) => ({ key, count })) });
    }
  }

  const total = groups.reduce((sum, g) => sum + g.entries.reduce((s, e) => s + e.count, 0), 0);
  const files = new Set(groups.map((g) => g.testFile)).size;
  if (format === 'json') {
    out(JSON.stringify({ total, baselines: groups }, null, 2));
    return 0;
  }

  const summary = `${total} baselined accessibility violation${total === 1 ? '' : 's'} in ${groups.length} baseline${groups.length === 1 ? '' : 's'} (${files} test file${files === 1 ? '' : 's'}).`;
  const lines = format === 'markdown' ? ['# Baselined accessibility violations', '', summary] : [summary];
  let currentFile: string | undefined;
  for (const group of groups) {
    const count = group.entries.reduce((s, e) => s + e.count, 0);
    if (format === 'markdown') {
      if (group.testFile !== currentFile) lines.push('', `## ${group.testFile}`);
      lines.push('', `### ${group.name} (${count})`, '');
      for (const e of group.entries) lines.push(`- [ ] ${e.count > 1 ? `${e.count}× ` : ''}\`${e.key}\``);
    } else {
      if (group.testFile !== currentFile) lines.push('', group.testFile);
      lines.push(`  ${group.name} (${count})`);
      for (const e of group.entries) lines.push(`    ${e.count}× ${e.key}`);
    }
    currentFile = group.testFile;
  }
  out(lines.join('\n'));
  return 0;
}

export function main(argv: string[], out: (s: string) => void = (s) => process.stdout.write(`${s}\n`)): number {
  const [command, ...rest] = argv;
  try {
    if (command === 'report') return report(parseArgs(rest), out);
    if (command === 'baselines') return baselines(parseArgs(rest), out);
    if (command === undefined || command === 'help' || command === '--help' || command === '-h') {
      out(USAGE);
      return command === undefined ? 1 : 0;
    }
    throw new UsageError(`Unknown command "${command}".\n\n${USAGE}`);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    process.stderr.write(`${error.message}\n`);
    return 2;
  }
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
