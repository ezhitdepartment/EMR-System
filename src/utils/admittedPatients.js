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
import { loadConsultationHistory } from "./consultations";
import { findEncounterById } from "./encounters";

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
    address: p.address || "",
    patientType: e.patient_type || "",
    admittingDiagnosis: row.admitting_diagnosis || row.diagnosis || "",
    dischargeDiagnosis: row.discharge_diagnosis || "",
    dateAdmitted: row.date_admitted || e.appointment_date || "",
    dateDischarged: row.date_discharged || "",
    attendingPhysician: details.attendingPrintedName || e.doctor || "",
    chiefComplaint: row.chief_complaint || "",
    historyOfPresentIllness: row.history_of_present_illness || "",
    medicationOrders: row.medication_orders || "",
    outcomeOfTreatment: row.outcome_of_treatment || "",
    allergies: row.allergies || "",
    bloodType: row.blood_type || "",
    dispositionNotes: row.disposition_notes || "",
    updatedAt: row.updated_at,
  };
}

// Fetches every currently-admitted patient (see the file banner above for
// why "currently" doesn't need its own separate tracking), then keeps only
// ONE row per patient — the most recently updated one. Two admitted rows
// for the same hospitalNo can genuinely exist (e.g. an ER admission and,
// separately, an OPD one), but the list itself should read "one line per
// patient" rather than one line per registration, so anything older than
// a patient's latest is dropped here (it never gets thrown away — it's
// still on file under that registration's own Consultation entry).
// Returns [] on failure rather than throwing, same convention as
// loadEncounters()/loadPatients(), so a failed fetch degrades to an empty
// list instead of crashing the page.
export async function loadAdmittedPatients() {
  const { data, error } = await supabase
    .from("consultations")
    .select(
      `
        id, encounter_id, disposition, disposition_notes,
        admitting_diagnosis, discharge_diagnosis, diagnosis,
        date_admitted, date_discharged, outcome_of_treatment,
        chief_complaint, history_of_present_illness, medication_orders,
        allergies, blood_type, details, updated_at,
        patients ( hospital_no, first_name, last_name, middle_name, sex, date_of_birth, address ),
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

  const rows = (data || []).map(rowToAdmittedPatient);
  const seen = new Set();
  const onePerPatient = [];
  for (const r of rows) {
    const key = r.hospitalNo || r.consultationId;
    if (seen.has(key)) continue;
    seen.add(key);
    onePerPatient.push(r);
  }
  return onePerPatient;
}

// Resolves everything MedicalAbstractPDF needs beyond the flattened
// summary row this file already returns from loadAdmittedPatients() — the
// full doctor consultation entry (Signs & Symptoms, Physical Exam,
// Course in the Ward, etc.), the matching ER/OPD nurse entry (Past
// Medical History, OB/GYN History), that encounter's triage vitals, and
// any lab/x-ray/ultrasound tests ordered against the same admission (for
// "Ancillaries Done"). Same three-source resolution PatientProfile.jsx's
// resolveCF4Sources() already does for CF4 — a Medical Abstract summarizes
// the exact same admission, just laid out differently on paper.
export async function resolveMedicalAbstractSources(record) {
  const history = await loadConsultationHistory(record.hospitalNo);
  const doctorEntries = history.filter((e) => e.authorRole === "doctor" || e.authorRole === "admin");
  const nurseEntries = history.filter((e) => e.authorRole === "er_nurse" || e.authorRole === "opd_nurse");

  const doctorEntry =
    (record.encounterId && doctorEntries.find((e) => e.encounterId === record.encounterId)) ||
    doctorEntries.find((e) => e.id === record.consultationId) ||
    doctorEntries[0] ||
    {};

  const erEntry =
    (doctorEntry.encounterId && nurseEntries.find((e) => e.encounterId === doctorEntry.encounterId)) ||
    nurseEntries[0] ||
    {};

  const encounterId = doctorEntry.encounterId || record.encounterId || null;

  let triage = null;
  let ancillaries = [];
  if (encounterId) {
    const encounter = await findEncounterById(encounterId);
    triage = encounter?.triage || null;

    const { data, error } = await supabase
      .from("lab_orders")
      .select("lab_order_tests ( test_name, status, date_performed )")
      .eq("encounter_id", encounterId);
    if (error) {
      console.error("resolveMedicalAbstractSources: loading ancillaries failed:", error.message);
    } else {
      ancillaries = (data || []).flatMap((order) =>
        (order.lab_order_tests || []).map((t) => ({
          testName: t.test_name,
          status: t.status,
          datePerformed: t.date_performed,
        }))
      );
    }
  }

  return {
    patient: {
      hospitalNo: record.hospitalNo,
      lastName: record.lastName,
      firstName: record.firstName,
      middleName: record.middleName,
      sex: record.sex,
      dateOfBirth: record.dateOfBirth,
      address: record.address,
    },
    doctorEntry,
    erEntry,
    triage,
    ancillaries,
  };
}

// "Discharged" quick action from the Admitted Patients list itself — flips
// that patient's most recent doctor consultation Disposition away from
// "Admitted" without needing to open the full Consultation Form. Since
// this list is simply "every consultation row where disposition =
// 'Admitted'" (see the file banner above), updating that same row's
// disposition here is exactly what makes the patient drop off the list on
// the next refresh — nothing else needs to be touched.
export async function dischargeAdmittedPatient(consultationId) {
  const { error } = await supabase
    .from("consultations")
    .update({ disposition: "Discharged" })
    .eq("id", consultationId);
  if (error) {
    console.error("dischargeAdmittedPatient failed:", error.message);
    return { error: error.message };
  }
  return { error: null };
}