---
"reposets": patch
---

## Bug Fixes

### JSON Schema `$id` URLs

Updated `$id` values in generated JSON schemas to point to the actual hosting
location on GitHub rather than SchemaStore URLs that never resolve for
externally-hosted schemas.

- `reposets.config.schema.json` now uses its raw GitHub URL as `$id`
- `reposets.credentials.schema.json` now uses its raw GitHub URL as `$id`

### Schema Generation Pipeline

Replaced hand-rolled Ajv validation with xdg-effect's `JsonSchemaValidator`
service. The generation script now uses the standard
`generateMany` -> `validateMany` -> `writeMany` pipeline.

## Dependencies

- Upgraded `xdg-effect` from 0.3.1 to 0.3.3

## Maintenance

- Fixed invalid `x-tombi-table-keys-order` annotation on `RulesetSchema` union
  node (now only on the individual struct members where it is valid)
