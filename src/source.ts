import type { HostNode } from './types';

// React 19.1+ records where each element was created (`_debugStack`, an Error
// captured at the JSX call) on its fiber in development builds, and Jest
// source-maps it. The first frame outside node_modules is the line in the
// user's code that rendered the element, e.g. <Pressable> in LoginScreen.tsx.
// Like the rest of the fiber access this is best-effort: no location is
// reported rather than a wrong one.

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
}

interface FiberLike {
  return: FiberLike | null;
  _debugStack?: { stack?: string };
  _debugOwner?: FiberLike | null;
}

/**
 * The fiber and the components that created it, innermost first: each
 * element was created in its owner's render. Follows `_debugOwner` (React
 * development builds) so wrappers that merely contain the element, such as a
 * navigator's screen container, are skipped; falls back to parents.
 */
function* creators(start: unknown): Generator<FiberLike> {
  let fiber = start as FiberLike | null | undefined;
  const byOwner = !!fiber && '_debugOwner' in fiber;
  for (let depth = 0; fiber && depth < 500; depth++) {
    yield fiber;
    fiber = byOwner ? fiber._debugOwner : fiber.return;
  }
}

interface TreeNode {
  children: Array<TreeNode | string>;
  unstable_fiber?: unknown;
}

const FRAME = /\(?([^\s()]+):(\d+):(\d+)\)?$/;

/** The file of the first frame below React's jsx/createElement frame. */
function creationFile(stack: string): string | undefined {
  for (const line of stack.split('\n').slice(2)) {
    const match = FRAME.exec(line.trim());
    if (match) return match[1];
  }
  return undefined;
}

/** "@scope/name" or "name" for a file inside node_modules. */
export function packageOf(file: string): string | undefined {
  const normalized = file.split('\\').join('/');
  const index = normalized.lastIndexOf('/node_modules/');
  if (index === -1) return undefined;
  const [first, second] = normalized.slice(index + '/node_modules/'.length).split('/');
  return first.startsWith('@') ? `${first}/${second}` : first;
}

// React and React Native render host elements for every component; they are
// never "the library that rendered this", so the search continues upwards.
function isPlatformPackage(name: string): boolean {
  return name === 'react' || name === 'react-native' || name.startsWith('@react-native/');
}

export interface LibraryOrigin {
  /** Packages whose JSX created the element, innermost first, up to the app's code. */
  packages: string[];
  /** The package the app's code used directly: the one just below `entry`. */
  outer?: string;
  /** The fiber of the library element the app's code created, e.g. <Dropdown>. */
  entry?: unknown;
}

/**
 * Which npm packages created `node`, e.g. ["@react-navigation/elements",
 * "@react-navigation/bottom-tabs"] for a tab label. Empty when the element
 * comes from the app's own code, or without React 19.1+ owner stacks.
 */
export function libraryOrigin(node: TreeNode): LibraryOrigin {
  const packages: string[] = [];
  let outer: string | undefined;
  try {
    for (const fiber of creators(node.unstable_fiber)) {
      const stack = fiber._debugStack?.stack;
      const file = stack ? creationFile(stack) : undefined;
      if (!file) continue;
      const pkg = packageOf(file);
      // Created in the app's code: this is where the app used the library.
      if (!pkg) return packages.length ? { packages, outer, entry: fiber } : { packages };
      if (isPlatformPackage(pkg)) continue;
      outer = pkg;
      if (!packages.includes(pkg)) packages.push(pkg);
    }
  } catch {
    // React internals; see above.
  }
  return { packages, outer };
}

/** The innermost package that created `node`; see libraryOrigin(). */
export function renderingPackage(node: TreeNode): string | undefined {
  return libraryOrigin(node).packages[0];
}

function userFrame(stack: string): SourceLocation | undefined {
  // Skip the "Error: react-stack-top-frame" line and React's jsx/createElement frame.
  for (const line of stack.split('\n').slice(2)) {
    const match = FRAME.exec(line.trim());
    if (!match) continue;
    const [, file, row, column] = match;
    if (file.includes('/node_modules/') || file.startsWith('node:')) return undefined;
    return { file, line: Number(row), column: Number(column) };
  }
  return undefined;
}

export function sourceLocation(node: HostNode): SourceLocation | undefined {
  try {
    for (const fiber of creators(node.unstable_fiber)) {
      const stack = fiber._debugStack?.stack;
      if (!stack) continue;
      const location = userFrame(stack);
      if (location) return location;
    }
  } catch {
    // unstable_fiber and _debugStack are React internals.
  }
  return undefined;
}

/**
 * Source files whose JSX took part in rendering the tree: every user frame on
 * the way from each host element up to the root. Used to show which component
 * files an audit covered. Empty without React 19.1+ owner stacks.
 */
export function renderedFiles(root: TreeNode): string[] {
  const files = new Set<string>();
  const seen = new Set<FiberLike>();
  const visit = (node: TreeNode) => {
    try {
      for (let fiber = node.unstable_fiber as FiberLike | null | undefined; fiber && !seen.has(fiber); fiber = fiber.return) {
        seen.add(fiber);
        const stack = fiber._debugStack?.stack;
        const location = stack ? userFrame(stack) : undefined;
        if (location) files.add(location.file);
      }
    } catch {
      // React internals; see above.
    }
    for (const child of node.children) if (typeof child !== 'string') visit(child);
  };
  visit(root);
  return [...files].sort();
}
