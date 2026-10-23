# HIV workspace widget inventory

| Tab | Widget ID | Registered type | Source / form / actions |
|---|---|---|---|
| overview | `overview-art-status` | `static-callout` | Static configuration / explicit limitation |
| overview | `overview-current-regimen` | `static-callout` | Static configuration / explicit limitation |
| overview | `overview-latestViralLoad` | `metric` | latestViralLoad |
| overview | `overview-dsdmModel` | `metric` | dsdmModel |
| overview | `overview-vl-trend` | `trend-chart` | viralLoadHistory |
| overview | `overview-latestAdherence` | `metric` | latestAdherence |
| overview | `overview-whoClinicalStage` | `metric` | whoClinicalStage |
| overview | `overview-tbStatus` | `metric` | tbStatus |
| overview | `overview-artStartDate` | `metric` | artStartDate |
| overview | `overview-documentedRegimenLine` | `metric` | documentedRegimenLine |
| overview | `overview-art-encounters` | `clinical-table` | recentArtEncounters |
| overview | `overview-nextReturnDate` | `metric` | nextReturnDate |
| overview | `overview-quick-actions` | `action-panel` | hiv.recordArtVisit, hiv.requestViralLoad, hiv.recordHealthEducation, hiv.reviewSummary |
| art-regimens | `art-regimens-artStartDate` | `metric` | artStartDate |
| art-regimens | `art-regimens-initialRegimen` | `metric` | initialRegimen |
| art-regimens | `art-regimens-documentedRegimenLine` | `metric` | documentedRegimenLine |
| art-regimens | `art-regimens-documentedRegimen` | `metric` | documentedRegimen |
| art-regimens | `regimen-recorded-history` | `clinical-table` | regimenChanges |
| art-regimens | `art-regimens-regimenChangeType` | `metric` | regimenChangeType |
| art-regimens | `art-regimens-regimenSubstitutionReason` | `metric` | regimenSubstitutionReason |
| art-regimens | `art-regimens-regimenSwitchReason` | `metric` | regimenSwitchReason |
| art-regimens | `regimen-context-limit` | `static-callout` | Static configuration / explicit limitation |
| art-regimens | `regimen-encounter-history` | `timeline` | regimenChangeEncounters |
| art-regimens | `art-regimens-form-regimenChange` | `form-launcher` | hiv.regimenChange |
| viral-load-iac | `viral-load-iac-latestViralLoad` | `metric` | latestViralLoad |
| viral-load-iac | `viral-load-iac-viralLoadQualitative` | `metric` | viralLoadQualitative |
| viral-load-iac | `viral-load-iac-latestCd4` | `metric` | latestCd4 |
| viral-load-iac | `vl-history` | `trend-chart` | viralLoadHistory |
| viral-load-iac | `vl-observations` | `clinical-table` | viralLoadHistory |
| viral-load-iac | `vl-request-history` | `timeline` | viralLoadRequests |
| viral-load-iac | `iac-unavailable` | `static-callout` | Static configuration / explicit limitation |
| viral-load-iac | `viral-load-iac-form-viralLoadRequest` | `form-launcher` | hiv.viralLoadRequest |
| clinical-assessment | `clinical-assessment-whoClinicalStage` | `metric` | whoClinicalStage |
| clinical-assessment | `clinical-assessment-tbStatus` | `metric` | tbStatus |
| clinical-assessment | `clinical-assessment-tptStatus` | `metric` | tptStatus |
| clinical-assessment | `clinical-assessment-hypertensionStatus` | `metric` | hypertensionStatus |
| clinical-assessment | `clinical-assessment-diabetesStatus` | `metric` | diabetesStatus |
| clinical-assessment | `clinical-assessment-nutritionStatus` | `static-callout` | Static configuration / explicit limitation |
| clinical-assessment | `assessment-context-limit` | `static-callout` | Static configuration / explicit limitation |
| clinical-assessment | `clinical-assessment-form-artClinical` | `form-launcher` | hiv.artClinical |
| dsdm-psychosocial | `dsdm-psychosocial-dsdmModel` | `metric` | dsdmModel |
| dsdm-psychosocial | `dsdm-pair-required` | `static-callout` | Static configuration / explicit limitation |
| dsdm-psychosocial | `dsdm-encounters` | `clinical-table` | dsdmAssessment |
| dsdm-psychosocial | `psychosocial-summary-restricted` | `static-callout` | Static configuration / explicit limitation |
| dsdm-psychosocial | `dsdm-psychosocial-form-healthEducation` | `form-launcher` | hiv.healthEducation |
| clinical-history | `history-recentArtEncounters` | `timeline` | recentArtEncounters |
| clinical-history | `history-summaryEncounters` | `timeline` | summaryEncounters |
| clinical-history | `history-regimenChangeEncounters` | `timeline` | regimenChangeEncounters |
| clinical-history | `history-viralLoadRequests` | `timeline` | viralLoadRequests |
| clinical-history | `history-navigation` | `static-callout` | Static configuration / explicit limitation |
| forms-actions | `forms-heading-0` | `section-heading` | Static configuration / explicit limitation |
| forms-actions | `forms-actions-form-artClinical` | `form-launcher` | hiv.artClinical |
| forms-actions | `forms-actions-form-artSummary` | `form-launcher` | hiv.artSummary |
| forms-actions | `forms-actions-form-healthEducation` | `form-launcher` | hiv.healthEducation |
| forms-actions | `forms-heading-4` | `section-heading` | Static configuration / explicit limitation |
| forms-actions | `forms-actions-form-regimenChange` | `form-launcher` | hiv.regimenChange |
| forms-actions | `forms-heading-6` | `section-heading` | Static configuration / explicit limitation |
| forms-actions | `forms-actions-form-viralLoadRequest` | `form-launcher` | hiv.viralLoadRequest |
| forms-actions | `forms-heading-8` | `section-heading` | Static configuration / explicit limitation |
| forms-actions | `forms-actions-form-transferIn` | `form-launcher` | hiv.transferIn |
| forms-actions | `forms-actions-form-transferOut` | `form-launcher` | hiv.transferOut |
| forms-actions | `forms-actions-form-familyTracking` | `form-launcher` | hiv.familyTracking |
| forms-actions | `forms-availability` | `static-callout` | Static configuration / explicit limitation |
| care-plan | `care-plan-nextReturnDate` | `metric` | nextReturnDate |
| care-plan | `care-plan-runtime-unavailable` | `static-callout` | Static configuration / explicit limitation |
| care-plan | `care-plan-actions` | `action-panel` | hiv.recordArtVisit, hiv.recordHealthEducation, hiv.requestViralLoad |
