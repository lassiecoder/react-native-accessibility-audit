import { rules } from '../rules';
import { CRITERIA, criterionUrl, describeCriteria, enClause } from '../wcag';

test('every rule maps to known criteria', () => {
  for (const rule of rules) for (const id of rule.wcag) expect(CRITERIA[id]).toBeDefined();
  expect(rules.find((r) => r.id === 'no-empty-text')!.wcag).toEqual([]);
});

test('describes criteria with EN 301 549 clauses', () => {
  expect(describeCriteria(['3.3.2', '4.1.2'])).toBe(
    'WCAG 3.3.2 Labels or Instructions (A); 4.1.2 Name, Role, Value (A) · EN 301 549 11.3.3.2, 11.4.1.2',
  );
  expect(describeCriteria(['2.5.8'])).toBe('WCAG 2.5.8 Target Size (Minimum) (AA) · EN 301 549 11.2.5.8');
  expect(describeCriteria([])).toBe('Best practice (no specific WCAG criterion)');
  expect(enClause('9.9.9')).toBeUndefined();
});

test('links to the WCAG 2.2 Understanding pages', () => {
  expect(criterionUrl('4.1.2')).toBe('https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html');
  expect(criterionUrl('1.4.3')).toBe('https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html');
  expect(criterionUrl('2.5.8')).toBe('https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html');
});
