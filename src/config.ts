import type { AuditOptions } from './types';

let globalOptions: AuditOptions = {};

/**
 * Set project-wide defaults, typically from a Jest setup file.
 * Options passed to toBeAccessible() / audit() override these per rule.
 */
export function configure(options: AuditOptions): void {
  globalOptions = {
    ...globalOptions,
    ...options,
    rules: { ...globalOptions.rules, ...options.rules },
  };
}

export function getGlobalOptions(): AuditOptions {
  return globalOptions;
}

export function resetConfig(): void {
  globalOptions = {};
}
