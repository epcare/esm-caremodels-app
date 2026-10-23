# Existing HIV model workspace update

This package targets **HIV / f33e4419-825f-4ce3-96c9-bc85f01cc2c2**, named **HIV Patient Care**, with viewing privilege **App: ugandaemr.artclinic**. It does not create a model or change identity/privilege. Revision 3 and published version 1.0.0 are the supplied baseline; operations always use the current revision returned by the server.

## Files

- `hiv-workspace-update.json`: schema-valid workspace update input, eight tabs and 66 widgets, with 26 supported source declarations. **Use the merge importer or setup tool below. Do not paste it as a complete replacement definition.** Its neutral enrollment/lifecycle placeholders are not a migration policy: the merge preserves those sections from the real existing definition.
- `source-evidence.json`: exact source form paths, file hashes, UUIDs, concept labels/renderings and DSDM parent/approach dependencies. These are metadata-repository candidates, not proof of installation availability.
- `verify-existing-hiv.mysql.sql`: read-only MySQL identity/resource checks. No INSERT or UPDATE of the storage envelope.
- `widget-inventory.md`: every generated widget, its tab, type and binding.
- `../../docs/hiv-care-implementation-status.md`: supported and blocked requirements.

## Import into the existing designer

1. Open **HIV Patient Care**, then **JSON Editor**.
2. Select **Import workspace update JSON**, choosing `hiv-workspace-update.json`.
3. Review the staged replacement and choose **Apply workspace update**. Existing aliases are reused by UUID. Missing associations may be added only after the exact form UUID is verified as published and non-retired in the installation’s OpenMRS form catalog, with the expected encounter type. Existing UUIDs are never replaced. Missing resources, alias conflicts, source/action/terminology collisions and schema errors stop the import.
4. Inspect all tabs in Visual Builder and Preview. The preview contains demonstration data only. Production widgets use authorized backend results or explicit unavailable states.
5. Validate against the backend and Save draft. Publish only after resolving installation gaps and reviewing the saved definition.

Import preserves the real enrollment policy, automation, lifecycle, existing forms/UUIDs, model identity and privilege. It replaces the workspace and adds declared sources/actions without silently overwriting conflicting references. Pathway execution stays disabled. Existing form aliases are remapped in widgets and actions. No envelope/checksum is imported into clinical definition state.

**Registry popup alternative:** choose Import, load or paste `hiv-workspace-update.json`, and enter `HIV` in **Existing model code** after the popup detects a workspace definition. Confirm validates and saves a revision-aware draft; it does not publish or change identity/privilege. Exported storage envelopes still use the create-only import path, which rejects existing code HIV.

## API setup tool

Run from the frontend repository. Node 20+ and the project's installed dependencies are required. Provide authentication in `OPENMRS_USER` / `OPENMRS_PASSWORD` or `OPENMRS_COOKIE` through your environment; the tool never logs credentials. Use the OpenMRS application root, not `/ws/rest/v1` or a duplicated `/openmrs/openmrs` path.

Prepare and validate, without changing the draft or publication:

```sh
node tools/caremodels/hiv-setup.mjs --base-url http://localhost:8087/openmrs --out /tmp/hiv-review-prepare
```

The tool retrieves current model metadata and `modeloperation/envelope`, verifies identity and matching revisions, extracts draft-or-published definition, merges the workspace, writes the original envelope and candidate to new local files, verifies actual form/concept/encounter-type resources, and calls `validate`. It requires actual concept datatypes to match source declarations. Form resources do not imply that the installed launcher is executable.

After reviewing that output, save a draft with a fresh output directory:

```sh
node tools/caremodels/hiv-setup.mjs --base-url http://localhost:8087/openmrs --out /tmp/hiv-review-save --save-draft
```

Publication is a separate explicit choice. Once the installation's blocked capabilities are resolved or the limited configuration has been consciously accepted, this command saves/revalidates the candidate and publishes a higher version using the save response revision:

```sh
node tools/caremodels/hiv-setup.mjs --base-url http://localhost:8087/openmrs --out /tmp/hiv-review-release --save-draft --publish-version 1.1.0 --approve-publish
```

No publication was performed by the agent. Use a fresh output directory each run: existing backup/candidate files are never overwritten. On conflict, stop and review/rebase the preserved candidate against a fresh envelope; there is no automatic overwrite/retry. A failed publication leaves the previous published snapshot under backend control. The tool never computes a checksum or calls create/import/duplicate.

For offline preparation from real exports:

```sh
node tools/caremodels/hiv-setup.mjs --envelope /path/to/current-hiv-envelope.json --model /path/to/current-hiv-metadata.json --out /tmp/hiv-review-offline
```

`--envelope` accepts the raw stored/exported envelope or the API response containing its JSON-string `envelope`. `--model` is the actual default metadata response for `/caremodels/model/HIV`. Offline output is not installation-validated and cannot save/publish.

## MySQL setup request

There is intentionally **no care_model INSERT statement**. The record already exists, and the task explicitly prohibits directly updating `configuration`. An INSERT would conflict with the unique code/UUID or create an unauthorized second model; an upsert would bypass revisions, validation, snapshot history and backend-owned checksums.

Use the supplied read-only database script to check the existing installation:

```sh
mysql --default-character-set=utf8mb4 --user YOUR_DB_USER --password YOUR_OPENMRS_DATABASE < configuration/hiv/verify-existing-hiv.mysql.sql
```

Then use the API setup command to apply the configuration to that database through OpenMRS. No new tables, privilege changes, patient memberships or clinical records are created. The SQL script has not been run against your database here.

## Known clinical and installation gates

- Current ART status and verified current regimen have no registered resolver. Recorded regimen observations are labeled as historical documentation, not asserted current treatment.
- DSDM approach is not displayed independently: the resolver cannot enforce same-assessment/parent pairing. The dependency map is retained in evidence for backend implementation, not executable model JSON.
- Real nutrition UUID `165050AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` is 36 compact characters. The backend currently allows dashed UUIDs or 32 compact hex characters, so this exact form concept is blocked rather than shortened or replaced.
- IAC observation groups, paired VL/sample dates, current interruptions, clinical reminders and sensitive psychosocial/mental-health summaries remain blocked where required semantics/access policies are absent.
- Form/action descriptors currently report unavailable. Buttons remain disabled even though the form UUIDs and actions are configured. No arbitrary navigation or custom form API is used.
- The backend contains a `ClinicalChangeEnrollmentProcessor` and trigger matcher. Event-driven enrollment requires a declared typed trigger alias and at least one matching rule with an enrollment action; a trigger alone does not enroll patients.
- The source server was unreachable during this work. Actual current envelope, resource verification, authenticated save/publish/patient testing and screenshots remain pending.

## Verification in this delivery

`yarn verify` passed lint, TypeScript and 179 frontend tests. `node --test tools/caremodels/hiv-setup.node-test.mjs` passed 10 setup tests. Production build passed with asset-size warnings. No live validation, database write or publication was performed.
