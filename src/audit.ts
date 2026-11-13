import { getGlobalOptions, mergeOptions } from './config';
import { ownComponentNames } from './fiber';
import { rules } from './rules';
import { libraryOrigin } from './source';
import { isHostNode, walk } from './tree';
import type { AuditOptions, HostNode, IgnoreOptions, Matcher, Severity, Violation } from './types';

const TEST_JSON = Symbol.for('react.test.json');

interface JsonNode {
  type: string;
  props?: Record<string, any> | null;
  children?: Array<JsonNode | string> | null;
}

function isJsonNode(value: unknown): value is JsonNode {
  return typeof value === 'object' && value !== null && (value as { $$typeof?: unknown }).$$typeof === TEST_JSON;
}

/**
 * Rebuilds a `toJSON()` snapshot as host nodes with parent links, which the
 * rules need. JSON has no fibers, so messages can't name components.
 */
function fromJson(roots: JsonNode[]): HostNode {
  const container: HostNode = { type: '', props: {}, children: [], parent: null };
  const convert = (json: JsonNode, parent: HostNode): HostNode => {
    const node: HostNode = { type: json.type, props: json.props ?? {}, children: [], parent };
    node.children = (json.children ?? []).map((c) => (typeof c === 'string' ? c : convert(c, node)));
    return node;
  };
  container.children = roots.map((r) => convert(r, container));
  return container;
}

/**
 * Accepts what tests usually have at hand: `screen.root`, `screen.container`,
 * any element returned by a query, the object returned by `render()`, or its
 * `toJSON()` output (as react-native-accessibility-engine did).
 */
export function resolveRoot(target: unknown): HostNode | null {
  // Checked first: JSON nodes also have props and children, but no parents.
  if (isJsonNode(target)) {
    // RNTL v14 returns the container itself (type '') when there are several roots.
    if (target.type === '') return fromJson((target.children ?? []).filter(isJsonNode));
    return fromJson([target]);
  }
  if (Array.isArray(target) && target.length > 0 && target.every(isJsonNode)) return fromJson(target);
  if (isHostNode(target)) return target;
  if (typeof target === 'object' && target !== null && 'container' in target) {
    const { container } = target as { container: unknown };
    if (isHostNode(container)) return container;
  }
  return null;
}

function matches(value: unknown, matchers: Matcher[]): boolean {
  if (typeof value !== 'string') return false;
  return matchers.some((m) => (typeof m === 'string' ? m === value : m.test(value)));
}

function isIgnored(node: HostNode, ignore: IgnoreOptions): boolean {
  if (ignore.testIDs?.length && matches(node.props.testID, ignore.testIDs)) return true;
  if (ignore.components?.length) {
    const components = ignore.components;
    if (ownComponentNames(node).some((name) => matches(name, components))) return true;
  }
  return ignore.elements?.(node) === true;
}

export function audit(target: unknown, options: AuditOptions = {}): Violation[] {
  const root = resolveRoot(target);
  if (!root) {
    throw new TypeError(
      'audit() expects a rendered element, such as screen.root or screen.container from @testing-library/react-native.',
    );
  }
  if (typeof root.type !== 'string') {
    // react-test-renderer instances include composite components, which the
    // host-element rules would misread (e.g. Pressable and its View as nested).
    throw new TypeError(
      'Received a tree with composite components, probably from react-test-renderer. ' +
        'Render with @testing-library/react-native v14 and pass screen.root, or pass the React element itself.',
    );
  }

  const { rules: settings, ignore = {}, minTouchTarget = 44 } = mergeOptions(getGlobalOptions(), options);
  const context = { minTouchTarget };
  const active: Array<{ rule: (typeof rules)[number]; severity: Severity }> = [];
  for (const rule of rules) {
    const severity = settings[rule.id] ?? rule.severity;
    if (severity !== 'off') active.push({ rule, severity });
  }

  const packages = ignore.packages ?? [];
  const violations: Violation[] = [];
  walk(
    root,
    (node) => {
      if (packages.length && libraryOrigin(node).packages.some((p) => matches(p, packages))) return;
      for (const { rule, severity } of active) {
        const message = rule.check(node, context);
        if (message) {
          violations.push({ ruleId: rule.id, severity, message, help: rule.help, wcag: rule.wcag, element: node });
        }
      }
    },
    (node) => isIgnored(node, ignore),
  );
  return violations;
}
