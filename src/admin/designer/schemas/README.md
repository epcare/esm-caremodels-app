These five JSON Schemas are copied verbatim from:

`openmrs-module-caremodels/api/src/main/resources/schemas/`

They implement the backend's 1.0.0 definition contract using JSON Schema 2020-12. Keep these copies synchronized when that contract changes. They provide local structural checks only; POST `/caremodels/modeloperation` with `operation=validate` remains authoritative for registered clinical resolvers, terminology references and backend rule support. Database metadata (including model viewing privileges) is deliberately outside the definition.
