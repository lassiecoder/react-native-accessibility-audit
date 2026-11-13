import * as fs from 'fs';
import * as path from 'path';

import { parse } from '@babel/parser';

import type { ReportIssue } from './report';
import { ACCESSIBILITY_ROLES, ARIA_ROLES } from './roles';
import { rules } from './rules';
import type { RuleId } from './types';

// Static scan of source files, without running tests. It finds the mistakes
// that are visible in JSX alone (a Pressable with no role, an Image with no
// label) and, given a report from the Jest reporter, the component files no
// toBeAccessible() test renders. It is deliberately conservative: anything it
// can't see statically (spread props, children computed at runtime, custom
// components) is skipped, never guessed. Tests remain the source of truth.

type Node = { type: string; loc?: { start: { line: number; column: number } }; [key: string]: any };

const IGNORE_COMMENT = 'a11y-audit-ignore-next-line';

// Components checked, by the module they're imported from.
const MODULES: Record<string, Record<string, Kind>> = {
  'react-native': {
    Pressable: 'pressable',
    TouchableOpacity: 'pressable',
    TouchableHighlight: 'pressable',
    TouchableWithoutFeedback: 'pressable',
    TouchableNativeFeedback: 'pressable',
    Text: 'text',
    Image: 'image',
    TextInput: 'input',
  },
  'react-native-gesture-handler': {
    Pressable: 'pressable',
    RectButton: 'pressable',
    BorderlessButton: 'pressable',
    BaseButton: 'pressable',
  },
  'expo-image': { Image: 'image' },
  'expo-symbols': { SymbolView: 'image' },
};

type Kind = 'pressable' | 'text' | 'image' | 'input';

// Children from icon packages, or named like icons, render no text.
const ICON_MODULE = /vector-icons|lucide|react-native-svg|heroicons|phosphor|@tabler\/|feather|ionicons/i;
const ICON_NAME = /(^Icon|Icon$|^Svg|Svg$)/;

const LABEL_PROPS = ['accessibilityLabel', 'aria-label'];

export interface ScanOptions {
  /** Report from the Jest reporter, for the list of files no test audits. */
  coverage?: string[];
}

export interface ScanResult {
  /** Files scanned. */
  files: number;
  issues: ReportIssue[];
  /** Files that could not be parsed. */
  skipped: Array<{ file: string; error: string }>;
  /** Component files no audit rendered; undefined without a report. */
  untested?: string[];
}

interface Imported {
  module: string;
  name: string; // imported name, or '*' for a namespace import
}

interface ElementInfo {
  node: Node;
  name: string;
  kind?: Kind;
  attrs: Map<string, Node | null>;
  spread: boolean;
}

const ruleById = new Map(rules.map((r) => [r.id, r]));

function jsxName(name: Node): string {
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXMemberExpression') return `${jsxName(name.object)}.${name.property.name}`;
  if (name.type === 'JSXNamespacedName') return `${name.namespace.name}:${name.name.name}`;
  return '';
}

/** Literal value of an attribute, `true` for a bare attribute, undefined if dynamic. */
function literal(value: Node | null | undefined): unknown {
  if (value === null) return true; // <Image accessible />
  if (!value) return undefined;
  if (value.type === 'StringLiteral') return value.value;
  if (value.type === 'JSXExpressionContainer') {
    const e = value.expression;
    if (e.type === 'StringLiteral' || e.type === 'NumericLiteral' || e.type === 'BooleanLiteral') return e.value;
    if (e.type === 'TemplateLiteral' && e.expressions.length === 0) return e.quasis[0].value.cooked;
    if (e.type === 'Identifier' && e.name === 'undefined') return null;
    if (e.type === 'NullLiteral') return null;
  }
  return undefined;
}

const DYNAMIC = Symbol('dynamic');

/** The attribute's value: literal, DYNAMIC, or undefined when absent / empty. */
function attr(el: ElementInfo, name: string): unknown {
  if (!el.attrs.has(name)) return undefined;
  const value = literal(el.attrs.get(name));
  if (value === undefined) return DYNAMIC;
  if (value === null || value === '') return undefined;
  return value;
}

function hasLabel(el: ElementInfo): boolean {
  return LABEL_PROPS.some((p) => {
    const v = attr(el, p);
    return v === DYNAMIC || (typeof v === 'string' && v.trim() !== '');
  });
}

class FileScanner {
  readonly issues: ReportIssue[] = [];
  /** Whether the file contains JSX, i.e. renders something worth testing. */
  sawJsx = false;
  private readonly imports = new Map<string, Imported>();
  private readonly ignoredLines = new Set<number>();
  private component?: string;

  constructor(private readonly file: string) {}

  run(ast: Node) {
    for (const c of ast.comments ?? []) {
      if (String(c.value).includes(IGNORE_COMMENT)) this.ignoredLines.add(c.loc.end.line + 1);
    }
    for (const stmt of ast.program.body) {
      if (stmt.type !== 'ImportDeclaration' || stmt.importKind === 'type') continue;
      for (const s of stmt.specifiers) {
        const name = s.type === 'ImportSpecifier' ? (s.imported.name ?? s.imported.value) : s.type === 'ImportNamespaceSpecifier' ? '*' : 'default';
        this.imports.set(s.local.name, { module: stmt.source.value, name });
      }
    }
    this.visit(ast.program, []);
  }

  private resolve(name: string): { kind?: Kind; icon: boolean; known: boolean } {
    const [head, member] = name.split('.');
    const imported = this.imports.get(head);
    if (imported) {
      const exported = imported.name === '*' ? member : imported.name;
      const kind = MODULES[imported.module]?.[exported ?? ''];
      // Any export of these modules is a primitive whose children we can see.
      return { kind, icon: ICON_MODULE.test(imported.module) || ICON_NAME.test(member ?? head), known: imported.module in MODULES };
    }
    return { icon: ICON_NAME.test(member ?? head), known: false };
  }

  private info(node: Node): ElementInfo {
    const opening = node.openingElement;
    const name = jsxName(opening.name);
    const attrs = new Map<string, Node | null>();
    let spread = false;
    for (const a of opening.attributes) {
      if (a.type === 'JSXSpreadAttribute') spread = true;
      else attrs.set(jsxName(a.name), a.value ?? null);
    }
    return { node, name, kind: this.resolve(name).kind, attrs, spread };
  }

  private visit(node: Node | null | undefined, ancestors: ElementInfo[]) {
    if (!node || typeof node.type !== 'string') return;
    const previous = this.component;
    const named = componentName(node);
    if (named) this.component = named;

    if (node.type === 'JSXElement') {
      this.sawJsx = true;
      const el = this.info(node);
      this.check(el, ancestors);
      for (const child of node.children) this.visit(child, [...ancestors, el]);
      for (const a of node.openingElement.attributes) this.visit(a, ancestors);
    } else {
      for (const key of Object.keys(node)) {
        if (key === 'loc' || key === 'start' || key === 'end' || key === 'leadingComments' || key === 'trailingComments') continue;
        const value = node[key];
        if (Array.isArray(value)) for (const v of value) this.visit(v, ancestors);
        else if (value && typeof value === 'object' && typeof value.type === 'string') this.visit(value, ancestors);
      }
    }
    this.component = previous;
  }

  /** 'text' if the children render text, 'none' if they can't, 'unknown' otherwise. */
  private childText(node: Node): 'text' | 'none' | 'unknown' {
    let result: 'text' | 'none' | 'unknown' = 'none';
    for (const child of node.children ?? []) {
      if (child.type === 'JSXText') {
        if (child.value.trim() !== '') return 'text';
      } else if (child.type === 'JSXExpressionContainer') {
        if (child.expression.type === 'JSXEmptyExpression') continue;
        const v = literal(child);
        if (typeof v === 'string' && v.trim() !== '') return 'text';
        if (typeof v === 'number') return 'text';
        if (v === undefined) result = 'unknown';
      } else if (child.type === 'JSXElement') {
        const el = this.info(child);
        if (hasLabel(el) || (el.kind === 'image' && typeof attr(el, 'alt') === 'string')) return 'text';
        const resolved = this.resolve(el.name);
        if (el.spread && !resolved.icon) result = 'unknown';
        else if (resolved.icon || el.kind === 'image') continue;
        else if (resolved.known || /^[a-z]/.test(el.name)) {
          const inner = this.childText(child);
          if (inner === 'text') return 'text';
          if (inner === 'unknown') result = 'unknown';
        } else {
          result = 'unknown'; // a custom component may render text
        }
      } else if (child.type === 'JSXFragment') {
        const inner = this.childText(child);
        if (inner === 'text') return 'text';
        if (inner === 'unknown') result = 'unknown';
      }
    }
    return result;
  }

  private report(el: ElementInfo, ruleId: RuleId, message: string) {
    const loc = el.node.loc!.start;
    if (this.ignoredLines.has(loc.line)) return;
    const rule = ruleById.get(ruleId)!;
    this.issues.push({
      ruleId,
      severity: rule.severity,
      message,
      help: rule.help,
      wcag: [...rule.wcag],
      element: `<${el.name}>${this.component ? ` in ${this.component}` : ''}`,
      component: this.component,
      file: this.file,
      line: loc.line,
      column: loc.column + 1,
      baselined: false,
      tests: [],
    });
  }

  private check(el: ElementInfo, ancestors: ElementInfo[]) {
    if (!el.kind) return;
    const hidden = (e: ElementInfo) => attr(e, 'aria-hidden') === true || (attr(e, 'accessibilityElementsHidden') === true && attr(e, 'importantForAccessibility') === 'no-hide-descendants');
    if (hidden(el) || ancestors.some(hidden)) return;

    // role-valid and no-disabled-font-scaling need no knowledge of children.
    const accessibilityRole = attr(el, 'accessibilityRole');
    const role = attr(el, 'role');
    if (typeof accessibilityRole === 'string' && !ACCESSIBILITY_ROLES.has(accessibilityRole)) {
      this.report(el, 'role-valid', `accessibilityRole="${accessibilityRole}" is not a role React Native supports.${ARIA_ROLES.has(accessibilityRole) ? ` Use role="${accessibilityRole}" instead.` : ''}`);
    }
    if (typeof role === 'string' && !ARIA_ROLES.has(role)) {
      this.report(el, 'role-valid', `role="${role}" is not a role React Native supports.${ACCESSIBILITY_ROLES.has(role) ? ` Use accessibilityRole="${role}" instead.` : ''}`);
    }
    if ((el.kind === 'text' || el.kind === 'input') && attr(el, 'allowFontScaling') === false) {
      this.report(el, 'no-disabled-font-scaling', `${el.kind === 'text' ? 'Text' : 'Text input'} has allowFontScaling={false}, so it ignores the user's text size setting.`);
    }
    const maxScale = attr(el, 'maxFontSizeMultiplier');
    if ((el.kind === 'text' || el.kind === 'input') && typeof maxScale === 'number' && maxScale > 0 && maxScale <= 1) {
      this.report(el, 'no-disabled-font-scaling', `${el.kind === 'text' ? 'Text' : 'Text input'} has maxFontSizeMultiplier={${maxScale}}, so it can't grow beyond its base size.`);
    }

    // Everything below depends on props a spread could supply.
    if (el.spread) return;

    const pressable = el.kind === 'pressable' || (el.kind === 'text' && (attr(el, 'onPress') !== undefined || attr(el, 'onLongPress') !== undefined));
    if (pressable) {
      if (role === undefined && accessibilityRole === undefined) {
        this.report(el, 'interactive-role-required', 'Interactive element has no role.');
      }
      if (!hasLabel(el) && this.childText(el.node) === 'none') {
        this.report(el, 'interactive-label-required', 'Interactive element has no label or text, so screen readers can only announce its role.');
      }
    }

    if (el.kind === 'image') {
      const decorative = el.attrs.has('alt') || attr(el, 'accessible') === false || attr(el, 'accessible') === DYNAMIC || role === 'none' || role === 'presentation';
      const inGroup = ancestors.some((a) => a.kind === 'pressable' || attr(a, 'accessible') === true || attr(a, 'onPress') !== undefined);
      if (!hasLabel(el) && !decorative && !inGroup && attr(el, 'importantForAccessibility') !== DYNAMIC) {
        this.report(el, 'image-label-required', 'Image has no label and is not marked as decorative.');
      }
    }

    if (el.kind === 'text' && !hasLabel(el) && el.node.children.every((c: Node) => c.type === 'JSXText' && c.value.trim() === '')) {
      this.report(el, 'no-empty-text', 'Text element has no content.');
    }

    if (el.kind === 'input' && !hasLabel(el)) {
      const placeholder = attr(el, 'placeholder');
      this.report(
        el,
        'input-label-required',
        typeof placeholder === 'string' && placeholder.trim()
          ? `Text input has only a placeholder ("${placeholder.trim()}"). Placeholders disappear once someone types, so they aren't a reliable label.`
          : "Text input has no label, so screen readers can't say what it is for.",
      );
    }
  }
}

/** The component a declaration defines, if it looks like one (capitalized). */
function componentName(node: Node): string | undefined {
  const isComponent = (name: unknown): name is string => typeof name === 'string' && /^[A-Z]/.test(name);
  if (node.type === 'FunctionDeclaration' && isComponent(node.id?.name)) return node.id.name;
  if (node.type === 'VariableDeclarator' && isComponent(node.id?.name)) {
    const init = node.init;
    if (init && /Function|Arrow|CallExpression/.test(init.type)) return node.id.name;
  }
  if (node.type === 'ClassDeclaration' && isComponent(node.id?.name)) return node.id.name;
  return undefined;
}

function parseFile(code: string, file: string): Node {
  const ts = /\.(c|m)?tsx?$/.test(file);
  return parse(code, {
    sourceType: 'unambiguous',
    errorRecovery: true,
    plugins: ts ? ['jsx', 'typescript', 'decorators-legacy'] : ['jsx', 'flow', 'decorators-legacy'],
  }) as unknown as Node;
}

/** Issues in one file's source code. `file` is used in the results and to pick a parser. */
export function scanSource(code: string, file: string): ReportIssue[] {
  return scanFile(code, file).issues;
}

function scanFile(code: string, file: string): FileScanner {
  const scanner = new FileScanner(file);
  scanner.run(parseFile(code, file));
  return scanner;
}

const SKIP_DIRS = new Set(['node_modules', 'ios', 'android', 'dist', 'build', 'coverage', 'web-build', '__tests__', '__mocks__', '__fixtures__', '__a11y_baselines__', 'vendor', 'Pods']);
const SOURCE = /\.(jsx?|tsx?)$/;
const NOT_COMPONENT = /\.(test|spec|stories|story|d)\.[jt]sx?$|\.d\.ts$/;

export function findSourceFiles(root: string): string[] {
  const found: string[] = [];
  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) visit(full);
      } else if (SOURCE.test(entry.name) && !NOT_COMPONENT.test(entry.name)) {
        found.push(full);
      }
    }
  };
  visit(root);
  return found.sort();
}

export function scanProject(root: string, options: ScanOptions = {}): ScanResult {
  const issues: ReportIssue[] = [];
  const skipped: ScanResult['skipped'] = [];
  const componentFiles: string[] = [];
  const files = findSourceFiles(root);
  for (const full of files) {
    const rel = path.relative(root, full).split(path.sep).join('/');
    const code = fs.readFileSync(full, 'utf8');
    try {
      const scanner = scanFile(code, rel);
      issues.push(...scanner.issues);
      if (scanner.sawJsx) componentFiles.push(rel);
    } catch (error) {
      skipped.push({ file: rel, error: (error as Error).message.split('\n')[0] });
    }
  }
  const covered = options.coverage ? new Set(options.coverage) : undefined;
  return {
    files: files.length,
    issues,
    skipped,
    untested: covered ? componentFiles.filter((f) => !covered.has(f)) : undefined,
  };
}
