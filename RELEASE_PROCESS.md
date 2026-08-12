# Release Process

`dev` is the integration branch — every PR targets it. `main` is what has been released, and is
always an ancestor of `dev`, so a release fast-forwards `main` to `dev`.

1. Confirm `dev` is green: `npm run check`, `npm test`, `npm run build`.
2. In `CHANGELOG.md`, replace `Unreleased` on the top section with today's date. Each entry is one
   user-visible PR with its number; internal-only PRs (tests, CI) are left out. Medium / Large
   refactors can be included at the author's discretion.
3. Set the matching `version` in `package.json`.
4. Commit as `chore(release): vX.Y.Z` and merge the PR into `dev`.
5. Fast-forward and tag:

   ```bash
   git checkout main && git merge --ff-only origin/dev
   git push origin main
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```

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
