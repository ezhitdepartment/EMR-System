// Several clinical concepts show up, under different labels, across five
// different forms: the EMR / Visit-OPD Record (PatientRegistration), the
// Consultation Form (Encounter), ER Discharge Instructions, the
// Konsulta/Yakap Referral, and the Medical Certificate. Filling one of them
// in should fill the others in too — but only where the destination field
// is still BLANK. A value someone deliberately typed into one specific
// document is never silently overwritten by an older value carried over
// from another; these are separate legal/clinical documents, not copies of
// each other.
//
//   Shared key    | What it is                         | EMR field(s)          | Consultation field  | Discharge field     | Konsulta field      | Medical Certificate field
//   chiefComplaint| Chief Complaint                    | chiefComplaints        | chiefComplaint      | chiefComplaints      | chiefComplaint       | subjectiveComplaints
//   physicalExam  | Physical Exam / Objective Findings | objectiveFindings      | —                   | —                    | physicalExamination | pertinentPhysicalExaminationFindings
//   impression    | Initial / Physician's Impression   | physicianImpression    | —                   | —                    | initialImpression    | —
//   management    | Management at ED / Treatment given | treatmentLeft + treatmentRight (read-only source — split per eye, so a combined value never writes back into it) | medicationOrders | treatmentGiven | managementAtED | treatmentDoneMedicationGiven
//   diagnosis     | Final / Active / Clinical Diagnosis| —                      | activeDiagnoses     | finalDiagnosis       | finalDiagnosis       | clinicalDiagnosis
//   disposition   | Disposition                        | disposition            | disposition         | disposition          | —                    | disposition
//   followUp      | Follow-up / Recommendations        | followUpExamination    | —                   | followUpExamination  | recommendations      | —
//
// The Consultation Form is the richest single source of what actually
// happened during a visit (chief complaint, active diagnoses, medication
// orders, and — now that a doctor's Disposition select was added there —
// the final disposition too), so it now contributes chiefComplaint,
// management, and disposition here in addition to diagnosis. That means:
// the moment a nurse/doctor saves a Consultation, ER Discharge (and,
// where applicable, Konsulta/Medical Certificate) gets those blanks
// filled in immediately via PatientProfile.jsx's syncSharedClinical() —
// no need to retype anything already captured during the consultation.
export const SHARED_FIELD_MAP = {
  emr: {
    chiefComplaint: "chiefComplaints",
    physicalExam: "objectiveFindings",
    impression: "physicianImpression",
    disposition: "disposition",
    followUp: "followUpExamination",
  },
  consultation: {
    chiefComplaint: "chiefComplaint",
    diagnosis: "activeDiagnoses",
    management: "medicationOrders",
    disposition: "disposition",
  },
  discharge: {
    chiefComplaint: "chiefComplaints",
    management: "treatmentGiven",
    diagnosis: "finalDiagnosis",
    disposition: "disposition",
    followUp: "followUpExamination",
  },
  konsulta: {
    chiefComplaint: "chiefComplaint",
    physicalExam: "physicalExamination",
    impression: "initialImpression",
    management: "managementAtED",
    diagnosis: "finalDiagnosis",
    followUp: "recommendations",
  },
  medcert: {
    chiefComplaint: "subjectiveComplaints",
    physicalExam: "pertinentPhysicalExaminationFindings",
    management: "treatmentDoneMedicationGiven",
    diagnosis: "clinicalDiagnosis",
    disposition: "disposition",
  },
};

// Backed by Supabase's `patients.shared_clinical` jsonb column (see
// supabase_migration_clinical_documents.sql) instead of the old
// `patientSharedClinical` localStorage blob — genuinely 1:1 with a
// patient, so it rides along on the same row rather than its own table.
import { supabase } from "../../lib/supabaseClient";

export async function loadSharedClinical(hospitalNo) {
  if (!hospitalNo) return {};
  const { data, error } = await supabase
    .from("patients")
    .select("shared_clinical")
    .eq("hospital_no", hospitalNo)
    .maybeSingle();
  if (error) {
    console.error("Loading shared clinical fields failed:", error.message);
    return {};
  }
  return data?.shared_clinical || {};
}

export async function saveSharedClinical(hospitalNo, patch) {
  const current = await loadSharedClinical(hospitalNo);
  const merged = { ...current, ...patch };
  const { error } = await supabase
    .from("patients")
    .update({ shared_clinical: merged })
    .eq("hospital_no", hospitalNo);
  if (error) {
    console.error("Saving shared clinical fields failed:", error.message);
  }
  return merged;
}

// Pulls this form's mapped fields OUT into the shared-value shape. Blank
// fields are skipped so an empty field in one form never erases a value
// another form already contributed.
export function extractSharedFields(formData, formKey) {
  const map = SHARED_FIELD_MAP[formKey] || {};
  const out = {};
  for (const [sharedKey, fieldName] of Object.entries(map)) {
    const value = formData?.[fieldName];
    if (value && String(value).trim()) out[sharedKey] = value;
  }
  return out;
}

// Fills any still-BLANK mapped fields in formData from the shared store.
// `changed` is false when nothing needed filling, so callers can skip a
// write entirely.
export function fillBlanksFromShared(formData, formKey, shared) {
  const map = SHARED_FIELD_MAP[formKey] || {};
  const patched = { ...formData };
  let changed = false;
  for (const [sharedKey, fieldName] of Object.entries(map)) {
    const current = patched[fieldName];
    const sharedValue = shared?.[sharedKey];
    if ((!current || !String(current).trim()) && sharedValue) {
      patched[fieldName] = sharedValue;
      changed = true;
    }
  }
  return { patched, changed };
}