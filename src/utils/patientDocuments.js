// Clinical-document data-layer helpers — backed by Supabase's
// `patient_documents` table (see supabase_migration_clinical_documents.sql)
// instead of localStorage. Covers the four documents keyed off a single
// patient that used to live in `patientEMR` / `patientDischarge` /
// `patientKonsultaReferral` / `patientMedicalCertificate` localStorage
// blobs: the EMR (Visit-OPD Record), ER Discharge Instructions, the
// Konsulta/Yakap Referral, and the Medical Certificate.
//
// Every screen that reads/writes one of these four documents should import
// from HERE rather than talking to localStorage or Supabase directly.

import { supabase } from "../lib/supabaseClient";

export const DOC_TYPES = {
  EMR: "emr",
  DISCHARGE: "discharge",
  KONSULTA: "konsulta",
  MEDCERT: "medcert",
  MEDABSTRACT: "medabstract",
  ADMITDISCHARGE: "admitdischarge",
};

// Loads a single document for a patient, or null if it hasn't been saved
// yet (brand-new patient, or this particular form was never opened).
export async function loadPatientDocument(hospitalNo, docType) {
  if (!hospitalNo) return null;
  const { data, error } = await supabase
    .from("patient_documents")
    .select("data")
    .eq("hospital_no", hospitalNo)
    .eq("doc_type", docType)
    .maybeSingle();
  if (error) {
    console.error(`Loading ${docType} document failed:`, error.message);
    return null;
  }
  return data?.data ?? null;
}

// Loads all four documents for a patient in a single round trip — used by
// the Patient Profile's initial load and by Encounter Files, which both
// need every document at once rather than one at a time.
export async function loadAllPatientDocuments(hospitalNo) {
  const empty = {
    emr: null, discharge: null, konsulta: null, medcert: null, medabstract: null, admitdischarge: null,
  };
  if (!hospitalNo) return empty;

  const { data, error } = await supabase
    .from("patient_documents")
    .select("doc_type, data")
    .eq("hospital_no", hospitalNo);
  if (error) {
    console.error("Loading patient documents failed:", error.message);
    return empty;
  }

  const byType = { ...empty };
  for (const row of data || []) {
    byType[row.doc_type] = row.data;
  }
  return byType;
}

// Upserts one document for a patient and returns the saved value (with
// updatedAt stamped in, same shape the old localStorage version returned).
export async function savePatientDocument(hospitalNo, docType, formData, userId = null) {
  const updated = { ...formData, updatedAt: new Date().toISOString() };
  const { data, error } = await supabase
    .from("patient_documents")
    .upsert(
      {
        hospital_no: hospitalNo,
        doc_type: docType,
        data: updated,
        updated_by: userId,
      },
      { onConflict: "hospital_no,doc_type" }
    )
    .select("data")
    .single();
  if (error) {
    console.error(`Saving ${docType} document failed:`, error.message);
    throw new Error(error.message);
  }
  return data.data;
}

// Thin, named wrappers — kept so callers (Patient Profile, Encounter
// Files) can import the same familiar loadEmr/loadDischarge/... names
// they used against localStorage, just async now.
export const loadEmr = (hospitalNo) => loadPatientDocument(hospitalNo, DOC_TYPES.EMR);
export const loadDischarge = (hospitalNo) => loadPatientDocument(hospitalNo, DOC_TYPES.DISCHARGE);
export const loadKonsultaReferral = (hospitalNo) => loadPatientDocument(hospitalNo, DOC_TYPES.KONSULTA);
export const loadMedicalCertificate = (hospitalNo) => loadPatientDocument(hospitalNo, DOC_TYPES.MEDCERT);
export const loadMedicalAbstract = (hospitalNo) => loadPatientDocument(hospitalNo, DOC_TYPES.MEDABSTRACT);
export const loadAdmissionDischargeRecord = (hospitalNo) =>
  loadPatientDocument(hospitalNo, DOC_TYPES.ADMITDISCHARGE);

export const saveEmr = (hospitalNo, formData, userId) =>
  savePatientDocument(hospitalNo, DOC_TYPES.EMR, formData, userId);
export const saveDischarge = (hospitalNo, formData, userId) =>
  savePatientDocument(hospitalNo, DOC_TYPES.DISCHARGE, formData, userId);
export const saveKonsultaReferral = (hospitalNo, formData, userId) =>
  savePatientDocument(hospitalNo, DOC_TYPES.KONSULTA, formData, userId);
export const saveMedicalCertificate = (hospitalNo, formData, userId) =>
  savePatientDocument(hospitalNo, DOC_TYPES.MEDCERT, formData, userId);
export const saveMedicalAbstract = (hospitalNo, formData, userId) =>
  savePatientDocument(hospitalNo, DOC_TYPES.MEDABSTRACT, formData, userId);
export const saveAdmissionDischargeRecord = (hospitalNo, formData, userId) =>
  savePatientDocument(hospitalNo, DOC_TYPES.ADMITDISCHARGE, formData, userId);