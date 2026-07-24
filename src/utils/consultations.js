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
// One thing that's genuinely different from a typical Supabase-backed
// list: saveConsultationEntry() below upserts per (encounter_id,
// author_role) instead of always inserting. That's what gives Patient
// Files "one consultation history entry per registration, per author
// role" instead of a new entry stacking up every time the same nurse or
// doctor re-saves the same registration's Consultation Form. See that
// function's own comment for the full rationale. (An entry saved with no
// encounter_id — the standalone Patient Profile "Add/Update consultation"
// shortcut — still always inserts a fresh row, since there's no
// registration to key an update on.)

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

// Loads every consultation entry for this patient — one row per
// registration per author role now (see saveConsultationEntry), plus any
// standalone entries saved with no encounter_id. Entries are tagged with
// who authored them (authorRole) so each Patient Files folder can filter
// to just its own kind, and with encounterId so a specific registration
// can be matched back to the diagnosis recorded against it (see
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

// One consultation record per (registration, author role) — re-saving the
// same registration's consultation (as either the nurse or the doctor)
// overwrites that role's existing entry instead of stacking a new one in
// Patient Files' history. A nurse's entry and a doctor's entry for the
// SAME registration are still two separate rows (that's the "one history
// per registration for doctor AND Nurse" the feature is meant to give
// you) — it's only a second save by the SAME role on the SAME
// registration that now overwrites instead of appending.
//
// Entries with no encounterId (the standalone "Add/Update consultation"
// shortcut on the general Patient Profile page, not opened from any one
// registration) are NOT deduplicated this way — there's no registration
// to key an update on, so those keep the old "always insert a fresh row"
// behavior, same as before.
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

  if (encounterId) {
    const { data: existing, error: findError } = await supabase
      .from("consultations")
      .select("id")
      .eq("encounter_id", encounterId)
      .eq("author_role", authorRole)
      .maybeSingle();
    if (findError) throw new Error(findError.message);

    if (existing) {
      // Keep the original row's id (and therefore its created_at) — only
      // the content changes on a re-save.
      const { id, ...updates } = row;
      const { data, error } = await supabase
        .from("consultations")
        .update(updates)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return rowToEntry(data);
    }
  }

  const { data, error } = await supabase.from("consultations").insert(row).select().single();
  if (error) throw new Error(error.message);

  return rowToEntry(data);
}

// Picks the right consultation entry to seed the Consultation Form with,
// given the specific registration (encounter) it was opened from and the
// role of whoever's opening it.
//
// Before this existed, PatientProfile.jsx just used `history[0]` — the
// single most-recently-created row across every registration AND every
// author role for this patient. That's what made doctor-only fields like
// Time of Visit / Medicine Given at ER (CF4's Drugs/Medicines table) look
// like they'd been wiped: the row saveConsultationEntry() upserts on is
// keyed per (encounter_id, author_role), so as soon as a SECOND
// registration existed for the patient, or the nurse saved after the
// doctor did, `history[0]` pointed at a completely different row than the
// one you were actually editing — the doctor's real data was still safely
// in the database, the form was just seeded from the wrong row.
//
// - Same registration + same author role already has a row -> that's the
//   one to edit (this is the normal "reopen and keep editing" case).
// - Same registration, but this role hasn't saved yet -> seed from
//   whichever role DID save for this registration, so shared
//   identification/context fields aren't blank (harmless even for
//   sections this role can't see, since canEdit() hides them anyway).
// - No registration in context at all (the standalone Patient Profile
//   "Add/Update consultation" shortcut) -> falls back to the single most
//   recent entry on file, same as the old behavior.
export function resolveConsultationInitialValues(historyList, encounterId, authorRole) {
  const list = historyList || [];
  if (encounterId) {
    const own = list.find((e) => e.encounterId === encounterId && e.authorRole === authorRole);
    if (own) return own;
    const sibling = list.find((e) => e.encounterId === encounterId);
    if (sibling) return sibling;
    return null;
  }
  return list[0] || null;
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

// PhilHealth CF4, item 5 — Physical Examination on Admission. Mirrors the
// six PE_SYSTEMS entries in ConsultationForm.jsx (label/key/othersKey only
// — the actual checkbox OPTIONS lists stay owned by the form itself; this
// util only needs to know which fields to read, not what's selectable).
// Kept in sync manually since the checklist rarely changes; if a system is
// ever added/renamed there, add it here too.
const PE_SYSTEM_LABELS = [
  { key: "peChestLungs", othersKey: "peChestLungsOthers", label: "Chest/Lungs" },
  { key: "peCvs", othersKey: "peCvsOthers", label: "CVS" },
  { key: "peAbdomen", othersKey: "peAbdomenOthers", label: "Abdomen" },
  { key: "peGuOb", othersKey: "peGuObOthers", label: "GU/OB" },
  { key: "peSkinExtremities", othersKey: "peSkinExtremitiesOthers", label: "Skin/Extremities" },
  { key: "peNeuroExam", othersKey: "peNeuroExamOthers", label: "Neuro Exam" },
];

// "General Survey: Awake and alert\nHEENT: Essentially normal\nChest/Lungs:
// Wheezes, Lump/s over Breast(s) (left, 2cm)\n..." — turns the doctor's
// structured CF4 "Pertinent Physical Examination on Admission" checklist
// (eight checkbox groups, each with its own free-text "specify"/"Others"
// field) into one readable narrative block. A system with nothing checked
// and no specify/Others text is left out entirely, so a mostly-blank exam
// doesn't produce a wall of empty headers. This is what feeds the
// Konsulta/Yakap Referral's "Physical Examination" field — that field is
// free narrative text, not a checklist, so there's no single form field to
// point a shared-clinical-fields mapping at (same reason the ED
// Management field pulls straight from source in KonsultaReferralModal.jsx
// instead of going through SHARED_FIELD_MAP — see sharedClinicalFields.js).
export function formatPhysicalExamText(entry) {
  if (!entry) return "";
  const lines = [];

  const generalSurvey = [...(entry.peGeneralSurvey || [])];
  const alteredIdx = generalSurvey.indexOf("Altered sensorium");
  if (alteredIdx !== -1 && entry.peGeneralSurveyAlteredSensoriumSpecify?.trim()) {
    generalSurvey[alteredIdx] = `Altered sensorium (${entry.peGeneralSurveyAlteredSensoriumSpecify.trim()})`;
  }
  if (generalSurvey.length) lines.push(`General Survey: ${generalSurvey.join(", ")}`);

  const heent = [...(entry.peHeent || [])];
  if (entry.peHeentOthers?.trim()) heent.push(entry.peHeentOthers.trim());
  if (heent.length) lines.push(`HEENT: ${heent.join(", ")}`);

  for (const { key, othersKey, label } of PE_SYSTEM_LABELS) {
    const findings = [...(entry[key] || [])];
    if (entry[othersKey]?.trim()) findings.push(entry[othersKey].trim());
    if (findings.length) lines.push(`${label}: ${findings.join(", ")}`);
  }

  return lines.join("\n");
}

// "07/06/2026 — Started IV fluids, ordered CBC" — the doctor's CF4
// "Course in the Ward" log (a running list of dated Doctor's Order/Action
// entries, see courseInWardEntries in ConsultationForm.jsx), one line per
// entry in the order they were added. An entry missing a date still shows
// (just without the leading date), rather than being silently dropped —
// better to see an undated note than lose it.
export function formatCourseInWardText(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return "";
  return entries
    .filter((e) => e?.date?.trim() || e?.orderAction?.trim())
    .map((e) => (e.date?.trim() ? `${e.date} — ${e.orderAction || ""}`.trim() : (e.orderAction || "").trim()))
    .filter(Boolean)
    .join("\n");
}

// "Management at ED" for the Konsulta/Yakap Referral — combines every
// doctor-entered management/intervention concept from the Consultation
// Form's CF4 section into one narrative block, under its own subheading:
// Course in the Ward (the dated order/action log above), ED Management
// (edManagement — free-text notes), and Surgical Procedure/RVS Code
// (formatEdManagementText above). Any piece that's empty is left out
// entirely, and the whole thing is blank only if all three are. This is
// what KonsultaReferralModal.jsx's buildAutoFilled() feeds "Management at
// ED" from, and what PatientProfile.jsx's handleSaveConsultation() uses to
// push a fresh value into an already-saved referral the instant the
// doctor saves — same "read straight from the doctor's latest entry"
// precedent as formatPhysicalExamText, since none of these three concepts
// is a single plain field a SHARED_FIELD_MAP entry could point at.
export function formatManagementAtEdText(entry) {
  if (!entry) return "";
  const parts = [];

  const courseInWard = formatCourseInWardText(entry.courseInWardEntries);
  if (courseInWard) parts.push(`Course in the Ward:\n${courseInWard}`);

  if (entry.edManagement?.trim()) parts.push(`ED Management:\n${entry.edManagement.trim()}`);

  const surgicalProcedure = formatEdManagementText(entry);
  if (surgicalProcedure) parts.push(`Surgical Procedure/RVS Code:\n${surgicalProcedure}`);

  return parts.join("\n\n");
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