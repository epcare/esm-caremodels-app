-- MySQL 8+ READ-ONLY verification for the EXISTING HIV model.
-- There is deliberately no INSERT/UPDATE/REPLACE of care_model.configuration.
-- Run the API setup tool to save a draft; the backend owns revisions/history/checksums.
-- Do not import the workspace update through the registry's create-only import operation.

SELECT CASE WHEN COUNT(*) = 1 THEN 'OK: existing HIV identity matches'
       ELSE 'STOP: expected HIV identity/status does not match' END AS identity_check
FROM care_model
WHERE care_model_id = 1 AND uuid = 'f33e4419-825f-4ce3-96c9-bc85f01cc2c2'
  AND code = 'HIV' AND name = 'HIV Patient Care'
  AND privilege = 'App: ugandaemr.artclinic' AND status = 'PUBLISHED' AND retired = 0;

SELECT care_model_id, uuid, code, name, privilege, status, revision,
       JSON_VALID(configuration) AS valid_json,
       JSON_UNQUOTE(JSON_EXTRACT(configuration, '$.storageSchemaVersion')) AS storage_schema,
       JSON_EXTRACT(configuration, '$.revision') AS envelope_revision,
       JSON_UNQUOTE(JSON_EXTRACT(configuration, '$.published.version')) AS published_version,
       JSON_LENGTH(JSON_EXTRACT(configuration, '$.history')) AS history_count
FROM care_model WHERE code = 'HIV';

SELECT privilege FROM privilege
WHERE privilege IN ('App: ugandaemr.artclinic', 'View Care Models',
                    'Task: caremodels.model.manage', 'Task: caremodels.model.publish');
-- Privilege existence is not proof of the current user's role grants.

-- Exact concepts references from inspected metadata; every row must exist and be non-retired.
SET @hiv_concepts = '[{"alias":"hiv.artStartDate","uuid":"ab505422-26d9-41f1-a079-c3d222000440"},{"alias":"hiv.initialRegimen","uuid":"c3332e8d-2548-4ad6-931d-6855692694a3"},{"alias":"hiv.documentedRegimen","uuid":"dd2b0b4d-30ab-102d-86b0-7a5022ba4115"},{"alias":"hiv.documentedRegimenLine","uuid":"80148344-ce80-42f7-9d4a-8c1935efe76e"},{"alias":"hiv.latestViralLoad","uuid":"dc8d83e3-30ab-102d-86b0-7a5022ba4115"},{"alias":"hiv.viralLoadQualitative","uuid":"dca12261-30ab-102d-86b0-7a5022ba4115"},{"alias":"hiv.latestCd4","uuid":"dcbcba2c-30ab-102d-86b0-7a5022ba4115"},{"alias":"hiv.latestAdherence","uuid":"dce03b2f-30ab-102d-86b0-7a5022ba4115"},{"alias":"hiv.whoClinicalStage","uuid":"dcdff274-30ab-102d-86b0-7a5022ba4115"},{"alias":"hiv.tbStatus","uuid":"dce02aa1-30ab-102d-86b0-7a5022ba4115"},{"alias":"hiv.tptStatus","uuid":"37d4ac43-b3b4-4445-b63b-e3acf47c8910"},{"alias":"hiv.hypertensionStatus","uuid":"c8f00db3-abb6-46a2-89a4-25acf95be863"},{"alias":"hiv.diabetesStatus","uuid":"126aecd6-c4de-4b1f-bfa2-8f68380f9329"},{"alias":"hiv.dsdmModel","uuid":"1e755463-df07-4f18-bc67-9e5527bc252f"},{"alias":"hiv.nextReturnDate","uuid":"dcac04cf-30ab-102d-86b0-7a5022ba4115"},{"alias":"hiv.regimenChangeType","uuid":"ca5a71aa-05f9-42a0-bf0d-65bcfd08036b"},{"alias":"hiv.regimenSubstitutionReason","uuid":"dce0c977-30ab-102d-86b0-7a5022ba4115"},{"alias":"hiv.regimenSwitchReason","uuid":"dce0cd97-30ab-102d-86b0-7a5022ba4115"}]';
SELECT expected.alias, expected.uuid, resource.uuid IS NOT NULL AS exists_locally, resource.retired, datatype.name AS actual_datatype
FROM JSON_TABLE(@hiv_concepts, '$[*]' COLUMNS(alias VARCHAR(100) PATH '$.alias', uuid VARCHAR(38) PATH '$.uuid')) AS expected
LEFT JOIN concept AS resource ON resource.uuid = expected.uuid
LEFT JOIN concept_datatype AS datatype ON datatype.concept_datatype_id = resource.datatype_id
ORDER BY expected.alias;

-- Exact forms references from inspected metadata; every row must exist and be non-retired.
SET @hiv_forms = '[{"alias":"hiv.artClinical","uuid":"12de5bc5-352e-4faf-9961-a2125085a75c"},{"alias":"hiv.artSummary","uuid":"52653a60-8300-4c13-be4d-4b746da06fee"},{"alias":"hiv.healthEducation","uuid":"b8224534-7df0-4c00-ba8e-6b1f291087eb"},{"alias":"hiv.regimenChange","uuid":"53a3850c-855a-11eb-8dcd-0242ac130003"},{"alias":"hiv.viralLoadRequest","uuid":"c0ba84af-d2b3-485f-bede-9c008fbc0d03"},{"alias":"hiv.transferIn","uuid":"1306e612-3d25-4daa-b1f1-648e20804695"},{"alias":"hiv.transferOut","uuid":"37be0b17-c62c-4033-90ef-3cbedb7fe0a0"},{"alias":"hiv.familyTracking","uuid":"f2722150-5c5f-11ee-8c99-0242ac120002"}]';
SELECT expected.alias, expected.uuid, resource.uuid IS NOT NULL AS exists_locally, resource.retired, resource.name, resource.published
FROM JSON_TABLE(@hiv_forms, '$[*]' COLUMNS(alias VARCHAR(100) PATH '$.alias', uuid VARCHAR(38) PATH '$.uuid')) AS expected
LEFT JOIN form AS resource ON resource.uuid = expected.uuid
ORDER BY expected.alias;

-- Publication, form resources, encounter types and engine capability are additionally checked by the API tool.

-- Exact encounter_types references from inspected metadata; every row must exist and be non-retired.
SET @hiv_encounter_types = '[{"alias":"hiv.artClinical","uuid":"8d5b2be0-c2cc-11de-8d13-0010c6dffd0f"},{"alias":"hiv.artSummary","uuid":"8d5b27bc-c2cc-11de-8d13-0010c6dffd0f"},{"alias":"hiv.healthEducation","uuid":"6d88e370-f2ba-476b-bf1b-d8eaf3b1b67e"},{"alias":"hiv.regimenChange","uuid":"c11774c1-3b4a-4bdb-a847-6060895e006d"},{"alias":"hiv.viralLoadRequest","uuid":"cbf01392-ca29-11e9-a32f-2a2ae2dbcce4"},{"alias":"hiv.transferIn","uuid":"3e8354f7-31b3-4862-a52e-ff41a1ee60af"},{"alias":"hiv.transferOut","uuid":"e305d98a-d6a2-45ba-ba2a-682b497ce27c"},{"alias":"hiv.familyTracking","uuid":"591cba6a-5c5f-11ee-8c99-0242ac120002"}]';
SELECT expected.alias, expected.uuid, resource.uuid IS NOT NULL AS exists_locally, resource.retired, resource.name
FROM JSON_TABLE(@hiv_encounter_types, '$[*]' COLUMNS(alias VARCHAR(100) PATH '$.alias', uuid VARCHAR(38) PATH '$.uuid')) AS expected
LEFT JOIN encounter_type AS resource ON resource.uuid = expected.uuid
ORDER BY expected.alias;

