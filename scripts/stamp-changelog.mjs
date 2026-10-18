// Runs as the npm `version` lifecycle script: turns the "## Unreleased"
// section of CHANGELOG.md into "## <version> - <date>" and opens a new empty
// "## Unreleased" section above it, so the version commit and tag include the
// dated changelog. npm sets npm_new_version for version scripts.
// With --check (from `preversion`) it only validates, so a release with an
// empty changelog stops before package.json is bumped.
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.env.npm_new_version;
if (!version) {
  console.error('stamp-changelog: run this through `npm version`, which sets npm_new_version.');
  process.exit(1);
}

const file = new URL('../CHANGELOG.md', import.meta.url);
const changelog = readFileSync(file, 'utf8');
const heading = /^## Unreleased[^\n]*\n/m;
const match = heading.exec(changelog);
if (!match) {
  console.error('stamp-changelog: CHANGELOG.md has no "## Unreleased" section to release.');
  process.exit(1);
}

const body = changelog.slice(match.index + match[0].length);
const next = body.search(/^## /m);
const section = (next === -1 ? body : body.slice(0, next)).trim();
if (section === '') {
  console.error(`stamp-changelog: the "## Unreleased" section is empty; add the changes in ${version} first.`);
  process.exit(1);
}

if (process.argv.includes('--check')) process.exit(0);

const date = new Date().toISOString().slice(0, 10);
writeFileSync(file, changelog.replace(heading, `## Unreleased\n\n## ${version} - ${date}\n`));
console.log(`stamp-changelog: CHANGELOG.md section "${version} - ${date}" created.`);
