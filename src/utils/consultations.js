// Consultation history — now backed by Supabase (`consultations`) instead
// of localStorage. Same rationale/pattern as utils/patients.js,
// utils/encounters.js, and utils/medicinePrescriptions.js.
//
// The `consultations` table splits each save into two parts:
//   - a handful of "promoted" columns (chief_complaint, diagnosis, etc.)
//     that reports/lists/joins actually need to filter or display
//   - everything else in the 100+-field Consultation Form, stored as-is in
//     a `details` jsonb column
// On the way out, PROMOTED_FIELDS + details are merged back into one flat
// object so the rest of the app (PatientProfile.jsx, the PDF renderers,
// etc.) can keep reading e.g. `entry.diagnosis` or `entry.pastMedicalHistory`
// exactly like it did when everything was one flat localStorage blob.
//
// One thing that's genuinely different now, not just relocated: the table
// only has an INSERT policy, no UPDATE (see the SQL schema) — every save
// is a brand-new row, on purpose, so a doctor's or nurse's signed
// consultation record can never be silently rewritten later. That's why
// PatientProfile.jsx's cross-form "fill in my blanks from a sibling form"
// sync no longer tries to patch values back into a consultation entry —
// only patch other forms.

import { supabase } from "../lib/supabaseClient";
import { getPatientUuid } from "./patients";

// consultation_author_role enum in the DB — anyone else (cashier, staff,
// med_tech, xray_tech) should never actually reach a save action, but this
// keeps a bad save from failing silently as a confusing RLS/constraint
// error deep in Supabase instead of a clear one here.
const VALID_AUTHOR_ROLES = ["er_nurse", "opd_nurse", "doctor", "admin"];

// camelCase form field -> db column, for the fields promoted out of
// `details` (see the file banner above).
const PROMOTED_FIELDS = {
  chiefComplaint: "chief_complaint",
  historyOfPresentIllness: "history_of_present_illness",
  diagnosis: "diagnosis",
  medicationOrders: "medication_orders",
  disposition: "disposition",
  dispositionNotes: "disposition_notes",
  allergies: "allergies",
  bloodType: "blood_type",

  // PhilHealth CF4 — see cf4-fields-addendum.sql for why these seven (and
  // only these seven) of the new CF4 fields are promoted out of `details`.
  admittingDiagnosis: "admitting_diagnosis",
  dischargeDiagnosis: "discharge_diagnosis",
  caseRateCode1: "case_rate_code_1",
  caseRateCode2: "case_rate_code_2",
  dateAdmitted: "date_admitted",
  dateDischarged: "date_discharged",
  outcomeOfTreatment: "outcome_of_treatment",
};

function rowToEntry(row) {
  if (!row) return null;
  const entry = { ...(row.details || {}) };
  for (const [formField, column] of Object.entries(PROMOTED_FIELDS)) {
    entry[formField] = row[column] || "";
  }
  entry.id = row.id;
  entry.encounterId = row.encounter_id || null;
  entry.authorRole = row.author_role;
  entry.createdAt = row.created_at;
  return entry;
}

function formDataToRow({ patientUuid, encounterId, authorRole, authorId, formData }) {
  const rest = { ...formData };
  const row = {
    id: `CONS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    patient_id: patientUuid,
    encounter_id: encounterId || null,
    author_role: authorRole,
    author_id: authorId || null,
    details: {},
  };
  for (const [formField, column] of Object.entries(PROMOTED_FIELDS)) {
    row[column] = rest[formField] || null;
    delete rest[formField];
  }
  row.details = rest;
  return row;
}

// Every save appends a new row instead of overwriting — that's what lets
// Patient Files show a real history (ER Consultation / OPD Consultation /
// Medical Record) instead of just the single latest save. Entries are
// tagged with who authored them (authorRole) so each folder can filter to
// just its own kind, and with encounterId so a specific registration can
// be matched back to the diagnosis recorded against it (see
// loadDiagnosesByEncounter below).
export async function loadConsultationHistory(hospitalNo) {
  const patientUuid = await getPatientUuid(hospitalNo);
  if (!patientUuid) return [];

  const { data, error } = await supabase
    .from("consultations")
    .select("*")
    .eq("patient_id", patientUuid)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("loadConsultationHistory failed:", error.message);
    return [];
  }
  return (data || []).map(rowToEntry);
}

export async function saveConsultationEntry(hospitalNo, formData, authorRole, encounterId = null, authorId = null) {
  if (!VALID_AUTHOR_ROLES.includes(authorRole)) {
    throw new Error(
      `Can't save a consultation authored by role "${authorRole}" — only ${VALID_AUTHOR_ROLES.join(
        ", "
      )} can author one.`
    );
  }

  const patientUuid = await getPatientUuid(hospitalNo);
  if (!patientUuid) throw new Error(`No patient found with Hospital No. "${hospitalNo}"`);

  const row = formDataToRow({ patientUuid, encounterId, authorRole, authorId, formData });
  const { data, error } = await supabase.from("consultations").insert(row).select().single();
  if (error) throw new Error(error.message);

  return rowToEntry(data);
}

// "Common cold (J00)" — the free-text diagnosis with whatever ICD-10
// code(s) the doctor picked appended in parentheses. If only one of the
// two was filled in, that one alone is returned (no dangling "()" or
// stray comma). Whichever the doctor actually filled in on the
// Consultation Form's Diagnosis section.
export function formatDiagnosisText(entry) {
  if (!entry) return "";

  const text = (entry.diagnosis || "").trim();
  const codes = Array.isArray(entry.icdDiagnoses)
    ? entry.icdDiagnoses.map((d) => d.code).filter(Boolean)
    : [];

  if (text && codes.length > 0) return `${text} (${codes.join(", ")})`;
  if (text) return text;
  if (codes.length > 0) {
    // No free text at all — fall back to the fuller "code — name" form
    // so the column still reads clearly on its own.
    return entry.icdDiagnoses.map((d) => (d.name ? `${d.code} — ${d.name}` : d.code)).join(", ");
  }
  return "";
}

// "10060, 11040 — Incision and drainage of abscess. Debridement; skin,
// partial thickness." — the doctor's ED Management entry: whichever RVS
// code(s) were picked/typed into surgicalProcedureRvsCode, plus whatever
// ended up in surgicalProcedureNotes (auto-stacked, one sentence per code
// picked from the RVS list, but just as often edited/typed by hand). Same
// "single source of truth" role formatDiagnosisText plays for Diagnosis —
// used by the Consultation Form's own reference panel, the Patient
// Profile consultation summary, and (for the code/notes split, not this
// combined string) the CF4 PDF.
export function formatEdManagementText(entry) {
  if (!entry) return "";

  const code = (entry.surgicalProcedureRvsCode || "").trim();
  const notes = (entry.surgicalProcedureNotes || "").trim();

  if (code && notes) return `${code} — ${notes}`;
  return code || notes || "";
}

// Every consultation ever saved, across every patient, with just enough
// patient info attached (name, date of birth) for reports to compute
// names/ages without a second round-trip per row. Used by utils/reports.js
// — the single-patient loadConsultationHistory() above is for the Patient
// Profile page instead.
export async function loadAllConsultations() {
  const { data, error } = await supabase
    .from("consultations")
    .select("*, patients ( hospital_no, first_name, last_name, date_of_birth )")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("loadAllConsultations failed:", error.message);
    return [];
  }
  return (data || []).map((row) => {
    const entry = rowToEntry(row);
    const p = row.patients || {};
    entry.hospitalNo = p.hospital_no || null;
    entry.patient = {
      firstName: p.first_name || "",
      lastName: p.last_name || "",
      dateOfBirth: p.date_of_birth || "",
    };
    return entry;
  });
}

// One diagnosis per encounter, keyed by encounterId — for the Registration
// table's Diagnosis column. Same shape/usage pattern as
// medicinePrescriptions.js's loadMedicinePrescriptions(), which the
// Medication column already reads the same way.
//
// Only rows with an encounter_id are considered — a Consultation Form
// opened from the general Patient Profile "Add/Update consultation"
// shortcut isn't tied to any one registration, so it has nothing to show
// up against in this table (same rule handleSaveConsultation already uses
// for auto-completing a registration's status). If a registration has more
// than one save against it (e.g. nurse's part, then the doctor's), the
// most recent save that actually has a diagnosis wins.
export async function loadDiagnosesByEncounter() {
  const { data, error } = await supabase
    .from("consultations")
    .select("encounter_id, diagnosis, details, created_at")
    .not("encounter_id", "is", null)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("loadDiagnosesByEncounter failed:", error.message);
    return {};
  }

  // Rows come back newest-first, so the first non-empty diagnosis seen for
  // a given encounter is already the most recent one.
  const byEncounter = {};
  for (const row of data || []) {
    if (byEncounter[row.encounter_id]) continue;
    const text = formatDiagnosisText({ diagnosis: row.diagnosis, icdDiagnoses: row.details?.icdDiagnoses });
    if (text) byEncounter[row.encounter_id] = text;
  }
  return byEncounter;
}