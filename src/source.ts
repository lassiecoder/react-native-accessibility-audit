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
}

const FRAME = /\(?([^\s()]+):(\d+):(\d+)\)?$/;

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
    for (let fiber = node.unstable_fiber as FiberLike | null | undefined; fiber; fiber = fiber.return) {
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
