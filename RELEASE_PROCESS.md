# Release Process

`dev` is the integration branch — every PR targets it. `main` is what has been released. A ruleset
protects `main`, so there are no direct pushes to it: a release goes through its own PR from `dev`.

1. Confirm `dev` is green: `npm run check`, `npm test`, `npm run build`.
2. In `CHANGELOG.md`, replace `Unreleased` on the top section with today's date. Each entry is one
   user-visible PR with its number; internal-only PRs (tests, CI) are left out. Medium / Large
   refactors can be included at the author's discretion.
3. Bump the version: `npm version X.Y.Z --no-git-tag-version`. That updates `package.json` and both
   `version` fields in `package-lock.json`, and nothing else. The flag matters — without it npm
   commits and tags on the spot, and the tag belongs on `main` in step 6.
4. Commit as `chore(release): vX.Y.Z` and merge that PR into `dev`.
5. Open a PR from `dev` into `main` titled `release: vX.Y.Z`, and merge it with **Create a merge
   commit**. Not squash, which would collapse the whole release into one new commit on `main` and
   leave the two histories permanently unrelated, and not rebase, which rewrites every commit with
   a fresh SHA. The ruleset asks for an approving review; you cannot approve your own PR, so
   merging your own release PR relies on your bypass entry in the ruleset.
6. Tag the merge commit and push the tag (the rulesets cover branches, not tags):

   ```bash
   git fetch origin
   git tag vX.Y.Z origin/main
   git push origin vX.Y.Z
   ```

7. Merge `main` back into `dev`. Step 5 leaves a merge commit on `main` that `dev` does not have,
   and the ruleset requires the head branch to be up to date with the base, so skipping this blocks
   the *next* release PR rather than this one.

Pre-1.0, breaking changes bump the minor (0.1.x → 0.2.0). A change is breaking if metadata saved by
the previous version no longer loads unchanged.

Every changelog section opens with the oae-data-protocol it was built against. Read both values
out of `src/schema/schema.bundled.json` — `version` and `x-protocol-git-hash` — and check the hash
against the protocol's tags:

```bash
cd ../oae-data-protocol && git describe --tags <x-protocol-git-hash>
```

If that returns a bare tag (`v0.2.0`), cite the version. If it returns a `-N-g` suffix
(`v0.1.0-6-ge48c48b9`), the schema was pulled mid-cycle and its `version` field is stale — cite the
commit instead, since the version alone would be wrong.

If a release depends on a new protocol version, pull the schema first with `make schema`; it
requires a clean protocol tree and records the source commit for you.
