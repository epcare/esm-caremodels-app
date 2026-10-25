# Care Models microfrontend

`@epcare/esm-caremodels-app` is the [OpenMRS 3 (O3)](https://o3-docs.openmrs.org/) microfrontend
that renders **care model** content on the patient chart and provides the admin **registry and
widget designer** for authoring care models. It is distribution-agnostic: it works in any
OpenMRS 3 frontend that provides the expected extension slots and runs the
`openmrs-module-caremodels` backend.

Care models are *configuration-defined* patient dashboards: an administrator composes tabs of
widgets (metrics, trend charts, observation sets, form launchers, …) in the designer, publishes
the definition, and enrolled patients see those tabs on their chart. All clinical data is served
by the backend module — this app contains **no** HIV-specific or disease-specific React code.

## Backend pairing

This frontend requires the `openmrs-module-caremodels` backend module
(REST namespace `/ws/rest/v1/caremodels`) and **must change together with it**:

- `src/types/caremodels.ts` mirrors the backend contract (JSON Schemas bundled in the module,
  `schemaVersion` `1.0.0`). Update both sides in the same change; keep the version in sync.
- `src/api/contract.ts` validates and normalizes every REST payload and **fails closed** on
  malformed data — do not bypass it with raw `openmrsFetch` responses in components.
- Designer schema copies in `src/admin/designer/schemas/` must match the backend's schemas.
- `patches/` holds in-flight backend patches that accompany unmerged frontend changes.

## Features

- **Patient chart** — a `patient-chart-dashboard-slot` dashboard with enrolled-only outer tabs
  per care model, inner tab sections, per-widget data loading, and a manual enrollment
  workspace (`care-model-enrollment` window in the `patient-chart` workspace group).
- **Admin registry** — `/care-models-admin` lists models with search, status filtering,
  duplicate, import, activate/deactivate.
- **Designer** — `/care-models-admin/:modelCode` wizard for identity, enrollment rules, data
  sources, workspace layout (widget palette, inspector, JSON editor, validation, draft/publish
  with revision conflict detection).

## Privileges

| Constant (`src/constants.ts`) | Value | Gates |
|---|---|---|
| `masterPrivilege` | `View Care Models` | The whole feature: patient summary, registry |
| `enrollmentPrivilege` | `Task: caremodels.member.transition` | Manual enrollment state changes |
| `manageModelPrivilege` | `Task: caremodels.model.manage` | Registry and designer access |
| `publishModelPrivilege` | `Task: caremodels.model.publish` | Publishing definitions |

The server enforces all of these independently; client-side checks exist only to decide what
not to request. Privileges registered in `src/routes.json` hide extensions before their code
even loads.

## Getting started

Prerequisites: Node.js 20, Corepack (for Yarn 4), and a running OpenMRS instance with
`openmrs-module-caremodels` installed.

```sh
corepack enable
yarn install
yarn start          # openmrs develop — dev server against a local backend
```

Useful scripts:

| Script | Purpose |
|---|---|
| `yarn verify` | Lint + typecheck + unit tests (what CI runs) |
| `yarn test:watch` | Vitest in watch mode |
| `yarn build` | Production bundle to `dist/` |
| `yarn analyze` | Bundle size analysis |
| `yarn extract-translations` | Regenerate `translations/en.json` from `t()` calls |

## Project layout

```
src/
├── index.ts               # Lifecycle registration: pages, extensions, workspaces
├── routes.json            # O3 routing/extension manifest (schema'd, privilege-gated)
├── config-schema.ts       # Config schema (config.json key: @epcare/esm-caremodels-app)
├── constants.ts           # Module name, REST base URL, privilege names
├── api/                   # REST client: fetchers + SWR hooks + fail-closed contract parsing
├── types/                 # TypeScript mirror of the backend contract
├── patient-summary/       # Patient-facing chart dashboard + enrollment workspace
├── widgets/               # Widget renderer, per-type widgets, widget registry/manifests
├── admin/                 # Registry pages and the designer wizard
│   └── designer/
│       ├── model/         # Canonical definition model, validation, JSON Schemas
│       ├── builders/      # Data source, record source, and rule builders
│       ├── editors/       # Step editors (configuration, JSON, imports, status mappings)
│       └── workspace/     # Workspace canvas: editor, widget inspector, previews
├── configuration/         # Workspace definition merge tooling (schema-version gated)
└── utils/                 # Navigation helpers, hooks
```

Conventions: colocated `*.component.tsx` + `*.test.tsx` + `*.scss` per feature; Vitest +
Testing Library; `@openmrs/eslint-config` and `prettier`.

## Configuration

Runtime configuration lives in the shell's `config.json` under the `@epcare/esm-caremodels-app`
key. Currently supported: `maxInnerTabs` (default `10`) — see `src/config-schema.ts` for the
typed schema with defaults and descriptions.

## Deployment

The app is published to npm as `@epcare/esm-caremodels-app` and loaded through the frontend
import map. CI (`.github/workflows/ci.yml`) builds on every push, publishes `next` prereleases
from `main`, and publishes releases on GitHub release events. `routes.json` declares
`webservices.rest >=2.24.0 <4.0.0` as a backend dependency.

## Further documentation

See [`docs/README.md`](docs/README.md) for implementation status reports, the HIV care model configuration
walkthrough, and backend capability audits.
