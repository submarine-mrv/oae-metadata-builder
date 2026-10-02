# OAE Metadata Builder

A web app for writing metadata for Ocean Alkalinity Enhancement (OAE) projects, experiments and
datasets. It follows the [OAE Data Management Protocol](https://www.carbontosea.org/oae-data-protocol/1-0-0/)
and exports JSON files that validate against the protocol's schema.

**Use it at [metadata.oaedata.org](https://metadata.oaedata.org).**
Schema documentation is at [schema.oaedata.org](https://schema.oaedata.org).

[![main deployment status](https://api.netlify.com/api/v1/badges/025da03c-7c7e-440c-a9b4-25f9bc50b17b/deploy-status?branch=main)](https://app.netlify.com/projects/oae-mb/deploys?branch=main)

## What it does

- Builds the project, experiment and dataset forms from the protocol's JSON Schema, so a schema
  release changes the forms without UI code changes for most fields.
- Holds several projects. Your work is saved in your browser's local storage; export a project to
  keep a copy or move it to another machine.
- Imports exported files, as a new project or merged into the current one.
- Validates when you ask it to, with errors on each field and a summary list.
- Provides map pickers for spatial coverage, ISO 8601 date ranges, controlled vocabularies (NERC sea
  names, platform types, units) and a CF standard name picker for variables.

## Schema

The schema lives in [submarine-mrv/oae-data-protocol](https://github.com/submarine-mrv/oae-data-protocol),
written in LinkML and generated to JSON Schema. This repo keeps a bundled copy in
`src/schema/schema.bundled.json`; the protocol version it was built against is in its `version` and
`x-protocol-git-hash` fields. [CHANGELOG.md](CHANGELOG.md) notes the protocol version for each
release.

## Development

Requires Node 26 (see `.mise.toml`).

```bash
git clone https://github.com/submarine-mrv/oae-metadata-builder.git
cd oae-metadata-builder
npm install
npm run dev        # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on port 3000 |
| `npm run build` | Route tree, type-check (`tsc -b`) and production build |
| `npm run preview` | Serve the production build |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run check` / `check:fix` | Biome lint and format; CI runs `check` |

Stack: React 19, Vite, TanStack Router, [RJSF](https://rjsf-team.github.io/react-jsonschema-form/)
with Mantine v8, AJV (JSON Schema 2019-09) and Biome.

### Updating the schema

With `oae-data-protocol` checked out next to this repo:

```bash
cd ../oae-data-protocol && just gen-all   # regenerate JSON Schema, then commit
cd ../oae-metadata-builder && make schema # copy and bundle; needs a clean protocol tree
```

`make schema` records the protocol commit in the bundled schema. Set `SCHEMA_REPO_PATH` if the
protocol repo lives elsewhere. `scripts/bundle-schema.mjs` does the bundling: it resolves refs,
labels vocabulary enums and reshapes conditional rules so RJSF renders them.

### Build configuration

Set at build time, in `.env` locally or in the deploy environment:

| Variable | Effect |
|---|---|
| `VITE_AUTH_ENABLED` | `true` turns on login. Unset or `false`: no account menu, `/auth/*` and `/profile` redirect to `/overview`, no Supabase code loads |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase project, needed when auth is on |
| `VITE_AUTH_PROVIDER` | `memory` swaps Supabase for an in-browser fake login, for e2e tests and demos |
| `VITE_GA_MEASUREMENT_ID` | Google Analytics ID; analytics stay off without it |

Playwright runs `e2e/auth.spec.ts` against a dev server with the memory provider (port 3000) and
the other specs against a second server with auth off (port 3001).

### Architecture notes

- [docs/schema-architecture.md](docs/schema-architecture.md): schema pipeline, validation, variable polymorphism
- [docs/conditional-fields.md](docs/conditional-fields.md): conditional fields and how RJSF renders them
- [docs/multi-project.md](docs/multi-project.md): workspace, persistence and import
- [docs/experiment-type-multi-select.md](docs/experiment-type-multi-select.md): experiment type rules
- [docs/cf-standard-names.md](docs/cf-standard-names.md): CF standard name picker and vocabulary

Releases follow [RELEASE_PROCESS.md](RELEASE_PROCESS.md). PRs target `dev`.

## Credits

Developed by [Submarine Scientific](https://www.submarine.earth) with support from the
[Carbon to Sea Initiative](https://www.carbontosea.org). Questions: [data@carbontosea.org](mailto:data@carbontosea.org).

## License

[Apache 2.0](LICENSE)
