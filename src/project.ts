import * as path from 'path';

/**
 * Loads a package the way the test file would, so we share its module
 * instances (one React, the same react-native exports and mocks). Resolving
 * from this library's own location can pick up a second copy in linked or
 * monorepo setups, which breaks hooks and identity checks.
 */
export function loadFromProject<T>(name: string, testPath?: string): T {
  const paths = [testPath ? path.dirname(testPath) : undefined, process.cwd()].filter(
    (p): p is string => p !== undefined,
  );
  try {
    return require(require.resolve(name, { paths })) as T;
  } catch {
    return require(name) as T;
  }
}
