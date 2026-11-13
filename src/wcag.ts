// WCAG 2.2 success criteria the rules map to. EN 301 549 (the standard the
// European Accessibility Act points to) repeats each WCAG criterion for
// non-web software in clause 11, numbered "11." + the WCAG number. V3.2.1 is
// based on WCAG 2.1; V4.1.1 (September 2026) is based on WCAG 2.2 and adds
// the 2.2 criteria such as 2.5.8. Only level A and AA criteria are required.

export type Level = 'A' | 'AA' | 'AAA';

export interface Criterion {
  /** WCAG success criterion number, e.g. "4.1.2". */
  id: string;
  name: string;
  level: Level;
  /** WCAG version that introduced the criterion. */
  since: '2.0' | '2.1' | '2.2';
}

export const CRITERIA: Record<string, Criterion> = Object.fromEntries(
  ([
    ['1.1.1', 'Non-text Content', 'A', '2.0'],
    ['1.3.1', 'Info and Relationships', 'A', '2.0'],
    ['1.4.3', 'Contrast (Minimum)', 'AA', '2.0'],
    ['1.4.4', 'Resize Text', 'AA', '2.0'],
    ['2.1.1', 'Keyboard', 'A', '2.0'],
    ['2.4.3', 'Focus Order', 'A', '2.0'],
    ['2.5.8', 'Target Size (Minimum)', 'AA', '2.2'],
    ['3.3.2', 'Labels or Instructions', 'A', '2.0'],
    ['4.1.2', 'Name, Role, Value', 'A', '2.0'],
  ] as const).map(([id, name, level, since]) => [id, { id, name, level, since }]),
);

/** EN 301 549 clause for a WCAG criterion in non-web software (native apps). */
export function enClause(id: string): string | undefined {
  const c = CRITERIA[id];
  if (!c || c.level === 'AAA') return undefined;
  return `11.${id}`;
}

export function criterionUrl(id: string): string | undefined {
  const c = CRITERIA[id];
  if (!c) return undefined;
  const slug = c.name.toLowerCase().replace(/[(),]/g, '').replace(/\s+/g, '-');
  return `https://www.w3.org/WAI/WCAG22/Understanding/${slug}.html`;
}

/** "WCAG 4.1.2 Name, Role, Value (A), EN 301 549 11.4.1.2", or a best-practice note. */
export function describeCriteria(ids: readonly string[]): string {
  if (ids.length === 0) return 'Best practice (no specific WCAG criterion)';
  const wcag = ids.map((id) => {
    const c = CRITERIA[id];
    return c ? `${id} ${c.name} (${c.level})` : id;
  });
  const en = ids.map(enClause).filter((x): x is string => x !== undefined);
  return `WCAG ${wcag.join('; ')}${en.length ? ` · EN 301 549 ${en.join(', ')}` : ''}`;
}
