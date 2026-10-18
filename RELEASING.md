# Releasing

How versions are chosen and how a release gets to npm. The user-facing policy is in [README → Versioning](README.md#versioning).

## Choosing the version

The package is in `0.x`. npm's `^` range only picks up patch releases on `0.x` (`^0.1.0` means `>=0.1.0 <0.2.0`), so:

| Change | Bump | Command |
| --- | --- | --- |
| Bug fix, fewer false positives, clearer message, docs | patch | `npm version patch` |
| New rule, stricter rule, changed default, API change, baseline fingerprint or report format change, dropped React / React Native / Jest / Node version | minor | `npm version minor` |
| Trying a release out before it becomes `latest` | prerelease | `npm version preminor --preid beta`, then `npm version prerelease` |

Anything that can make a passing test fail is at least a minor release. After 1.0.0, those become major releases.

## What `npm version` does

Run it on a clean `main`. The scripts in `package.json` make it:

1. **preversion:** check that `## Unreleased` in `CHANGELOG.md` has content, then typecheck, run the tests in CI mode and build. Any failure stops the release before anything changes.
2. Bump the version in `package.json` and `package-lock.json`.
3. **version:** `scripts/stamp-changelog.mjs` renames `## Unreleased` in `CHANGELOG.md` to `## <version> - <date>` and opens a new empty `## Unreleased`.
4. Commit (`0.1.1`) and create the tag (`v0.1.1`).

Write the changelog entry under `## Unreleased` as part of each change, not at release time.

## First release (by hand)

npm can't set up trusted publishing for a package that doesn't exist yet, so `0.1.0` is published from your machine:

1. Check the name is still free: `npm view react-native-accessibility-audit` should return a 404.
2. Check what will be published: `npm publish --dry-run` (expect `dist/`, `docs/`, `README.md`, `CHANGELOG.md`, `LICENSE`, `package.json`).
3. `npm version 0.1.0`
4. `npm login`. This gives a two-hour session, and npm asks for 2FA when publishing.
5. `npm publish`. `prepublishOnly` typechecks and tests once more.
6. Push the commit and the tag: `git push && git push --tags`.

## Later releases (from GitHub Actions)

`.github/workflows/release.yml` publishes when a `v*` tag is pushed, using npm trusted publishing: GitHub gives the job a short-lived credential, so no npm token is stored anywhere, and npm adds a provenance attestation that links the package to the commit and workflow.

One-time setup, right after the first release:

1. On GitHub: create an environment named `release` (Settings → Environments). Adding yourself as a required reviewer means every publish waits for your approval.
2. On npmjs.com: package Settings → Trusted publishing → GitHub Actions, with repository `lassiecoder/react-native-accessibility-audit` (or wherever the repo lives), workflow `release.yml`, environment `release`, and allow the publish action.
3. Release within 48 hours. npm expires trusted-publishing configurations that haven't been used to publish within 48 hours; the first publish validates it and binds it to the repository's ID.
4. Once a release has gone through the workflow, set Publishing access to "Require two-factor authentication and disallow tokens", so only the workflow can publish.

Each release after that:

```sh
npm version patch        # or minor; runs the checks, stamps the changelog, commits and tags
git push && git push --tags
```

The workflow checks that the tag matches `package.json`, installs, tests and publishes. Versions with a prerelease suffix (`0.2.0-beta.0`) are published under the `next` dist-tag, so `npm install` keeps getting the latest stable version and testers use `npm install react-native-accessibility-audit@next`.

## If something goes wrong

- **A bad version was published.** Don't unpublish; publish a fixed patch release. If needed, `npm deprecate react-native-accessibility-audit@<version> "<reason>"` warns anyone who installs it.
- **`latest` points at the wrong version.** `npm dist-tag add react-native-accessibility-audit@<version> latest`.
