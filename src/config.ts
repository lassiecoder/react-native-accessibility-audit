import type { AuditOptions } from './types';

let globalOptions: AuditOptions = {};

/**
 * Set project-wide defaults, typically from a Jest setup file.
 * Options passed to toBeAccessible() / audit() override rule severities per
 * rule; ignore lists are combined with the global ones.
 */
export function configure(options: AuditOptions): void {
  globalOptions = mergeOptions(globalOptions, options);
}

export function getGlobalOptions(): AuditOptions {
  return globalOptions;
}

export function resetConfig(): void {
  globalOptions = {};
}

export function mergeOptions(base: AuditOptions, override: AuditOptions): AuditOptions {
  const a = base.ignore ?? {};
  const b = override.ignore ?? {};
  const predicates = [a.elements, b.elements].filter((p) => p !== undefined);
  return {
    rules: { ...base.rules, ...override.rules },
    ignore: {
      testIDs: [...(a.testIDs ?? []), ...(b.testIDs ?? [])],
      components: [...(a.components ?? []), ...(b.components ?? [])],
      elements: predicates.length ? (node) => predicates.some((p) => p(node)) : undefined,
    },
  };
}
