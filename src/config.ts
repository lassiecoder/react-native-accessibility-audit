import { rules } from './rules';
import type { AuditOptions, LegacyRuleId, RuleId, RuleSetting, RulesOption } from './types';

/** Options after rule IDs are resolved; what audit() works with. */
export interface ResolvedOptions extends Omit<AuditOptions, 'rules'> {
  rules: Partial<Record<RuleId, RuleSetting>>;
}

// react-native-accessibility-engine rule IDs and the rule that now covers
// them. null: no longer needed (React Native exposes disabled state itself);
// accepted so migrated configs don't throw.
const LEGACY_RULES: Record<LegacyRuleId, RuleId | null> = {
  'pressable-accessible-required': 'interactive-accessible-required',
  'pressable-role-required': 'interactive-role-required',
  'pressable-label-required': 'interactive-label-required',
  'link-role-required': 'interactive-role-required',
  'link-role-misused': 'link-role-misused',
  'adjustable-role-required': 'adjustable-role-required',
  'adjustable-value-required': 'state-required',
  'checked-state-required': 'state-required',
  'disabled-state-required': null,
  'no-empty-text': 'no-empty-text',
};

const ruleIds = new Set<string>(rules.map((r) => r.id));

function resolveRuleId(id: string): RuleId | null {
  if (ruleIds.has(id)) return id as RuleId;
  if (id in LEGACY_RULES) return LEGACY_RULES[id as LegacyRuleId];
  throw new Error(`Unknown accessibility rule "${id}". Available rules: ${[...ruleIds].join(', ')}.`);
}

export function resolveRules(option: RulesOption | undefined): Partial<Record<RuleId, RuleSetting>> {
  if (!option) return {};
  if (Array.isArray(option)) {
    // Array form: run only the listed rules, at their default severity.
    const enabled = new Set(option.map(resolveRuleId));
    return Object.fromEntries(rules.map((r) => [r.id, enabled.has(r.id) ? r.severity : 'off']));
  }
  const resolved: Partial<Record<RuleId, RuleSetting>> = {};
  for (const [id, setting] of Object.entries(option)) {
    const rule = resolveRuleId(id);
    if (rule && setting) resolved[rule] = setting;
  }
  return resolved;
}

let globalOptions: ResolvedOptions = { rules: {} };

/**
 * Set project-wide defaults, typically from a Jest setup file.
 * Options passed to toBeAccessible() / audit() override rule severities per
 * rule; ignore lists are combined with the global ones.
 */
export function configure(options: AuditOptions): void {
  globalOptions = mergeOptions(globalOptions, options);
}

export function getGlobalOptions(): ResolvedOptions {
  // react-native-accessibility-engine read rules from a Jest global.
  const legacy = (globalThis as { __A11Y_RULES__?: RulesOption }).__A11Y_RULES__;
  return legacy ? mergeOptions({ rules: resolveRules(legacy) }, globalOptions) : globalOptions;
}

export function resetConfig(): void {
  globalOptions = { rules: {} };
}

export function mergeOptions(base: ResolvedOptions | AuditOptions, override: AuditOptions): ResolvedOptions {
  const a = base.ignore ?? {};
  const b = override.ignore ?? {};
  const predicates = [a.elements, b.elements].filter((p) => p !== undefined);
  return {
    rules: { ...resolveRules(base.rules), ...resolveRules(override.rules) },
    minTouchTarget: override.minTouchTarget ?? base.minTouchTarget,
    ignore: {
      testIDs: [...(a.testIDs ?? []), ...(b.testIDs ?? [])],
      components: [...(a.components ?? []), ...(b.components ?? [])],
      packages: [...(a.packages ?? []), ...(b.packages ?? [])],
      elements: predicates.length ? (node) => predicates.some((p) => p(node)) : undefined,
    },
  };
}
