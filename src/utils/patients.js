// Shared patients data-layer helpers — now backed by Supabase (`patients`
// table) instead of localStorage. Every screen that touches patient data
// should import from HERE rather than keeping a private copy, so there's
// one place that knows how to talk to the database and one place to fix
// if the schema changes.
//
// Column names in Postgres are snake_case (see supabase_schema.sql); the
// rest of the app expects camelCase (patientId, firstName, hospitalNo,
// etc.), matching how CreatePatientModal.jsx's `emptyForm` is shaped. The
// map functions below are the ONLY place that translates between the two,
// so every component that reads/writes a patient object keeps working
// exactly as it did against localStorage.

import { supabase } from "../lib/supabaseClient";

function rowToPatient(row) {
  if (!row) return null;
  return {
    patientId: row.patient_id,
    hospitalNo: row.hospital_no || "",
    pin: row.pin || "",
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    middleName: row.middle_name || "",
    suffix: row.suffix || "",
    sex: row.sex || "",
    dateOfBirth: row.date_of_birth || "",
    email: row.email || "",
    landline: row.landline || "",
    mobile: row.mobile || "",
    photo: row.photo || "",

    hasGuardian: row.has_guardian || false,
    guardian: row.guardian || {},

    address: row.address || "",
    region: row.region || "",
    regionCode: row.region_code || "",
    province: row.province || "",
    provinceCode: row.province_code || "",
    city: row.city || "",
    cityCode: row.city_code || "",
    barangay: row.barangay || "",
    zipCode: row.zip_code || "",

    motherName: row.mother_name || "",
    motherContact: row.mother_contact || "",
    fatherName: row.father_name || "",
    fatherContact: row.father_contact || "",
    nationality: row.nationality || "",
    religion: row.religion || "",
    maritalStatus: row.marital_status || "",

    emergencyName: row.emergency_name || "",
    emergencyAddress: row.emergency_address || "",
    emergencyRelationship: row.emergency_relationship || "",
    emergencyPhoneHome: row.emergency_phone_home || "",
    emergencyPhoneCell: row.emergency_phone_cell || "",

    konsultaEligibility: row.konsulta_eligibility || "Not Set",
    patientType: row.patient_type || "",
    createdAt: row.created_at,
  };
}

// Inverse of rowToPatient — only includes columns that exist in the table
// (drops any UI-only fields like the "emergencySameAsX" checkboxes, which
// CreatePatientModal.jsx resolves into plain values before saving).
function patientToRow(p) {
  return {
    patient_id: p.patientId,
    hospital_no: p.hospitalNo || null,
    pin: p.pin || "",
    first_name: p.firstName,
    last_name: p.lastName,
    middle_name: p.middleName || "",
    suffix: p.suffix || "",
    sex: p.sex || "",
    date_of_birth: p.dateOfBirth || null,
    email: p.email || "",
    landline: p.landline || "",
    mobile: p.mobile || "",
    photo: p.photo || null,

    has_guardian: !!p.hasGuardian,
    guardian: p.guardian || {},

    address: p.address || "",
    region: p.region || "",
    region_code: p.regionCode || "",
    province: p.province || "",
    province_code: p.provinceCode || "",
    city: p.city || "",
    city_code: p.cityCode || "",
    barangay: p.barangay || "",
    zip_code: p.zipCode || "",

    mother_name: p.motherName || "",
    mother_contact: p.motherContact || "",
    father_name: p.fatherName || "",
    father_contact: p.fatherContact || "",
    nationality: p.nationality || "",
    religion: p.religion || "",
    marital_status: p.maritalStatus || "",

    emergency_name: p.emergencyName || "",
    emergency_address: p.emergencyAddress || "",
    emergency_relationship: p.emergencyRelationship || "",
    emergency_phone_home: p.emergencyPhoneHome || "",
    emergency_phone_cell: p.emergencyPhoneCell || "",

    konsulta_eligibility: p.konsultaEligibility || "Not Set",
    patient_type: p.patientType || "",
  };
}

// Fetches every patient. Returns [] on failure (network hiccup, RLS
// rejection, etc.) rather than throwing, so a failed fetch degrades to an
// empty list instead of crashing the page — same "never throw" contract
// the old localStorage version had.
export async function loadPatients() {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("loadPatients failed:", error.message);
    return [];
  }
  return (data || []).map(rowToPatient);
}

export async function findPatientById(patientId) {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("patient_id", patientId)
    .single();
  if (error) return null;
  return rowToPatient(data);
}

// Inserts a brand-new patient record. `patient` must already include
// patientId (see generatePatientId() in CreatePatientModal.jsx) and
// hospitalNo (see generateHospitalNo() below).
export async function createPatient(patient) {
  const { data, error } = await supabase
    .from("patients")
    .insert(patientToRow(patient))
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToPatient(data);
}

// Read-modify-write a single patient by id. `updater` receives the current
// patient (camelCase) and returns the patch to apply — same pattern as
// updateEncounter()/updateLabOrder() elsewhere in the app.
export async function updatePatient(patientId, updates) {
  const { data, error } = await supabase
    .from("patients")
    .update(patientToRow({ patientId, ...updates }))
    .eq("patient_id", patientId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToPatient(data);
}

// Updates just the `photo` field for one patient and returns the updated
// record (or null if the patient no longer exists). Kept as its own
// function (rather than making every caller build a full patient object)
// since Create Registration and the Patient Profile page both call this
// directly whenever a photo is captured, and neither has the rest of the
// patient record loaded at that point.
export async function savePatientPhoto(patientId, photoDataUrl) {
  const { data, error } = await supabase
    .from("patients")
    .update({ photo: photoDataUrl })
    .eq("patient_id", patientId)
    .select()
    .single();
  if (error) return null;
  return rowToPatient(data);
}

// Auto-generates the next Hospital No., in the pattern:
//   {3-digit sequence}{4-digit year}{2-digit month}
// e.g. the 1st patient registered in July 2026 -> "001202607"
//
// The sequence keeps climbing (001, 002, 003, ...) across the whole patient
// list — it does NOT reset each month/year — so two patients registered in
// the same month can never collide. It's derived from the highest sequence
// number already in use rather than just `patients.length`, so it stays
// correct (no duplicates, no reused numbers) even if a patient record is
// ever deleted.
//
// Needs the current patient list already loaded (pass the array you just
// fetched with loadPatients()) rather than fetching it itself, since every
// caller already has that list in hand right before generating the next
// number and a second round-trip would just be wasted latency.
export function generateHospitalNo(existingPatients) {
  const patients = existingPatients || [];
  const pattern = /^(\d{3})\d{4}\d{2}$/;

  let maxSeq = 0;
  patients.forEach((p) => {
    const match = pattern.exec(p.hospitalNo || "");
    if (match) {
      const seq = parseInt(match[1], 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  });

  const nextSeq = String(maxSeq + 1).padStart(3, "0");
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${nextSeq}${year}${month}`;
}