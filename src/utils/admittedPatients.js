// Admitted Patients — read-only list, derived entirely from data that
// already exists (consultations.disposition, plus the patients/encounters
// tables it's joined against). No new table or column is needed for this
// feature.
//
// WHY THIS WORKS WITHOUT ANY NEW STATE: saveConsultationEntry() (see
// utils/consultations.js) upserts ONE row per (encounter_id, author_role)
// — a doctor's second save of the same registration UPDATES their
// existing row instead of adding a new one. So the instant a doctor
// changes a patient's Disposition from "Admitted" to "Discharged" (or
// anything else) and saves, that same consultations row's `disposition`
// column changes in place — which means this list, simply filtered to
// `disposition = 'Admitted'`, is always exactly "every registration whose
// most recent doctor consultation says Admitted" with zero extra
// bookkeeping. A patient falls off this list the moment their disposition
// is updated to something else; nothing needs to be "closed out" by hand.
//
// Only doctor-authored consultations are considered — Disposition is a
// DOCTOR_SECTIONS field on the Consultation Form (see ConsultationForm.jsx),
// so a nurse's own consultation row for the same registration never has a
// disposition value to begin with.

import { supabase } from "../lib/supabaseClient";

function rowToAdmittedPatient(row) {
  const p = row.patients || {};
  const e = row.encounters || {};
  // attendingPrintedName isn't one of the columns promoted out of
  // `details` (see PROMOTED_FIELDS in utils/consultations.js) — it's read
  // straight off the jsonb blob here instead of adding a new promoted
  // column just for this list.
  const details = row.details || {};

  return {
    consultationId: row.id,
    encounterId: row.encounter_id,
    hospitalNo: p.hospital_no || "",
    lastName: p.last_name || "",
    firstName: p.first_name || "",
    middleName: p.middle_name || "",
    fullName: [p.last_name, p.first_name, p.middle_name].filter(Boolean).join(", "),
    sex: p.sex || "",
    dateOfBirth: p.date_of_birth || "",
    patientType: e.patient_type || "",
    admittingDiagnosis: row.admitting_diagnosis || row.diagnosis || "",
    dateAdmitted: row.date_admitted || e.appointment_date || "",
    attendingPhysician: details.attendingPrintedName || e.doctor || "",
    dispositionNotes: row.disposition_notes || "",
    updatedAt: row.updated_at,
  };
}

// Fetches every currently-admitted patient (see the file banner above for
// why "currently" doesn't need its own separate tracking). Returns []
// on failure rather than throwing, same convention as loadEncounters()/
// loadPatients(), so a failed fetch degrades to an empty list instead of
// crashing the page.
export async function loadAdmittedPatients() {
  const { data, error } = await supabase
    .from("consultations")
    .select(
      `
        id, encounter_id, disposition, disposition_notes,
        admitting_diagnosis, diagnosis, date_admitted, details, updated_at,
        patients ( hospital_no, first_name, last_name, middle_name, sex, date_of_birth ),
        encounters ( doctor, appointment_date, patient_type, consultation_type )
      `
    )
    .eq("author_role", "doctor")
    .eq("disposition", "Admitted")
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("loadAdmittedPatients failed:", error.message);
    return [];
  }
  return (data || []).map(rowToAdmittedPatient);
}
