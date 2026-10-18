import { loadFromProject } from './project';
import type { HostNode } from './types';

// Lets tests write `expect(<Button />).toBeAccessible()`, as
// react-native-accessibility-engine allowed. Matchers must stay synchronous
// (an un-awaited async matcher passes silently), so instead of RNTL's async
// render() this drives test-renderer directly with React's synchronous act().

interface TestRendererRoot {
  render(element: unknown): void;
  unmount(): void;
  container: HostNode;
}

interface ReactModule {
  act(callback: () => void): unknown;
}

const ELEMENT_TYPES = new Set([Symbol.for('react.transitional.element'), Symbol.for('react.element')]);

export function isReactElement(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    ELEMENT_TYPES.has((value as { $$typeof?: symbol }).$$typeof as symbol)
  );
}

function withActEnvironment(run: () => void): void {
  const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = env.IS_REACT_ACT_ENVIRONMENT;
  env.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    run();
  } finally {
    env.IS_REACT_ACT_ENVIRONMENT = previous;
  }
}

export function renderElement(
  element: unknown,
  testPath: string | undefined,
): { container: HostNode; unmount: () => void } {
  let React: ReactModule;
  let createRoot: (options: object) => TestRendererRoot;
  try {
    React = loadFromProject<ReactModule>('react', testPath);
    ({ createRoot } = loadFromProject<{ createRoot: typeof createRoot }>('test-renderer', testPath));
  } catch {
    throw new Error(
      'Passing a React element to toBeAccessible() needs the "test-renderer" package, which @testing-library/react-native v14 installs. ' +
        'Alternatively render it yourself and pass screen.root.',
    );
  }

  // Same options RNTL v14 uses, so the tree matches what render() produces.
  const root = createRoot({ textComponentTypes: ['Text', 'RCTText'], publicTextComponentTypes: ['Text'] });
  withActEnvironment(() => {
    React.act(() => root.render(element));
  });
  return {
    container: root.container,
    unmount: () => withActEnvironment(() => React.act(() => root.unmount())),
  };
}
