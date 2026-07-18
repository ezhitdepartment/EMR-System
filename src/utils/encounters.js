// Encounters data layer — now backed by Supabase (`encounters` table +
// its `encounter_triage` / `encounter_waivers` 1:1 child tables) instead of
// localStorage. Every screen that touches encounter data should import
// from HERE rather than keeping a private copy — same rationale as
// utils/patients.js.
//
// Column names in Postgres are snake_case; the rest of the app expects
// camelCase (hospitalNo, appointmentDate, nurseConsultationDone, etc.). The
// map functions below are the only place that translates between the two,
// so every component that reads/writes an encounter object keeps working
// exactly as it did against localStorage.

import { supabase } from "../lib/supabaseClient";
import { getPatientUuid } from "./patients";

export const STATUS = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

export const STATUS_STYLES = {
  [STATUS.PENDING]: "bg-amber-100 text-amber-700",
  [STATUS.COMPLETED]: "bg-emerald-100 text-emerald-700",
  [STATUS.CANCELLED]: "bg-red-100 text-red-700",
};

export const CONSULTATION_TYPES = [
  {
    code: "PCC",
    label: "PRIMARY CARE CONSULTATION",
    description:
      "Primary Care Consultation includes the First Patient Encounter (FPE), covering both initial profiling and diagnosis, treatment, and ongoing management of the patient's condition.",
    defaultFee: 600,
  },
  {
    code: "OPD",
    label: "OPD VISIT",
    description: "A standard outpatient department visit for follow-up or non-primary-care concerns.",
    defaultFee: 300,
  },
  {
    code: "ER",
    label: "ER VISIT",
    description: "An emergency room visit for urgent or acute concerns.",
    defaultFee: 500,
  },
  {
    code: "TELEMED",
    label: "TELEMEDICINE",
    description: "A remote consultation conducted online or by phone.",
    defaultFee: 250,
  },
];

// Flat list of labels — kept for the existing filter dropdowns that just
// need option strings, not the full description/fee.
export const CONSULTATION_TYPE_OPTIONS = CONSULTATION_TYPES.map((c) => c.label);

export const PAYMENT_TYPE_OPTIONS = ["PHIC PAY", "Cash", "HMO", "Company Sponsored"];

export const MIGRATED_STATUS_OPTIONS = ["Migrated", "Not Migrated"];

export const PCU_STATUS_OPTIONS = ["For PCU", "PCU Done", "N/A"];

// doctors_directory is now a live view over profiles (role = 'doctor') —
// see ADDENDUM C in the schema — so this is fetched, not hardcoded. Kept
// as an async function (not a constant) since it needs a round-trip; every
// call site already either awaits it inside an effect or calls it once and
// caches the result in state, same shape as loadPatients().
export async function loadDoctors() {
  const { data, error } = await supabase.from("doctors_directory").select("name").order("name");
  if (error) {
    console.error("loadDoctors failed:", error.message);
    return [];
  }
  return (data || []).map((r) => r.name);
}

// Which "Patient Type" gets stamped on a registration, based on the role
// of whoever's creating it. Any role not listed here (doctor, admin,
// med_tech, xray_tech, cashier, etc.) falls back to "OPD Patient" — the
// general, non-emergency case. Decided per-registration now, not once
// per-patient, since the same patient can be an ER case one visit and an
// OPD case the next.
export const PATIENT_TYPE_BY_ROLE = {
  er_nurse: "ER Patient",
  opd_nurse: "OPD Patient",
};

function rowToEncounter(row) {
  if (!row) return null;
  const p = row.patients || {};
  const triageRow = Array.isArray(row.encounter_triage) ? row.encounter_triage[0] : row.encounter_triage;
  const waiverRow = Array.isArray(row.encounter_waivers) ? row.encounter_waivers[0] : row.encounter_waivers;

  return {
    id: row.id,
    // Assigned by a DB trigger the moment nurse_consultation_done flips to
    // true (see the "Census No." addendum in supabase_schema.sql) — null
    // until then. Never set from the client; encounterToRow() below
    // intentionally omits it so a plain updateEncounter() call can never
    // clobber it.
    censusNo: row.census_no || null,
    hospitalNo: p.hospital_no || row._hospitalNoFallback || "",
    patient: {
      firstName: p.first_name || "",
      lastName: p.last_name || "",
      middleName: p.middle_name || "",
      sex: p.sex || "",
      dateOfBirth: p.date_of_birth || "",
      hospitalNo: p.hospital_no || "",
    },
    patientType: row.patient_type || "OPD Patient",
    appointmentDate: row.appointment_date,
    consultationType: row.consultation_type,
    reasonForVisiting: row.reason_for_visiting || "",
    doctor: row.doctor || "",
    fee: row.fee ?? 0,
    paymentType: row.payment_type || "",
    photo: row.photo_url || null,
    createdBy: row.profiles?.username || row.created_by || "—",
    status: row.status,
    nurseConsultationDone: row.nurse_consultation_done || false,
    doctorConsultationDone: row.doctor_consultation_done || false,
    migratedStatus: row.migrated_status || "Not Migrated",
    pcuStatus: row.pcu_status || "N/A",
    triage: triageRow ? rowToTriage(triageRow) : null,
    waiver: waiverRow ? rowToWaiver(waiverRow) : null,
    dateCreated: row.date_created,
  };
}

function rowToTriage(row) {
  return {
    systolic: row.systolic ?? "",
    diastolic: row.diastolic ?? "",
    heartRate: row.heart_rate ?? "",
    respiratoryRate: row.respiratory_rate ?? "",
    temperature: row.temperature ?? "",
    height: row.height ?? "",
    weight: row.weight ?? "",
    bmi: row.bmi ?? "",
    leftVision: row.left_vision || "",
    rightVision: row.right_vision || "",
    labImagingEnabled: row.lab_imaging_enabled ?? true,
    fbsGlucoseMgDl: row.fbs_glucose_mg_dl ?? "",
    fbsGlucoseMmolL: row.fbs_glucose_mmol_l ?? "",
    fbsDatePerformed: row.fbs_date_performed || "",
    createdByUuid: row.created_by || null,
    createdBy: row.profiles?.username || row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function triageToRow(encounterId, t) {
  return {
    encounter_id: encounterId,
    systolic: t.systolic === "" ? null : Number(t.systolic),
    diastolic: t.diastolic === "" ? null : Number(t.diastolic),
    heart_rate: t.heartRate === "" ? null : Number(t.heartRate),
    respiratory_rate: t.respiratoryRate === "" ? null : Number(t.respiratoryRate),
    temperature: t.temperature === "" ? null : Number(t.temperature),
    height: t.height === "" ? null : Number(t.height),
    weight: t.weight === "" ? null : Number(t.weight),
    bmi: t.bmi === "" ? null : Number(t.bmi),
    left_vision: t.leftVision || "",
    right_vision: t.rightVision || "",
    lab_imaging_enabled: t.labImagingEnabled ?? true,
    fbs_glucose_mg_dl: t.fbsGlucoseMgDl === "" ? null : Number(t.fbsGlucoseMgDl),
    fbs_glucose_mmol_l: t.fbsGlucoseMmolL === "" ? null : Number(t.fbsGlucoseMmolL),
    fbs_date_performed: t.fbsDatePerformed || null,
    // createdByUuid (not createdBy — that's the joined display name, which
    // would blow up as an invalid uuid if it ever got written back here).
    created_by: t.createdByUuid || null,
    // created_at/updated_at are DB-managed (default now() / the
    // set_updated_at trigger) — not sent from the client.
  };
}

function rowToWaiver(row) {
  return {
    signed: row.signed || false,
    signedBy: row.signed_by || "",
    relationship: row.relationship || "",
    date: row.waiver_date || "",
    reason: row.reason || "",
  };
}

function waiverToRow(encounterId, w) {
  return {
    encounter_id: encounterId,
    signed: !!w.signed,
    signed_by: w.signedBy || "",
    relationship: w.relationship || "",
    waiver_date: w.date || null,
    reason: w.reason || "",
  };
}

// Only the columns that live directly on the encounters row — triage/waiver
// are handled separately since they're their own tables. census_no is
// deliberately NOT included here: it's DB-generated (see rowToEncounter's
// comment), and every UPDATE call goes through this function, so leaving
// it out guarantees the client can never overwrite what the trigger
// assigned.
function encounterToRow(e) {
  return {
    appointment_date: e.appointmentDate || null,
    consultation_type: e.consultationType,
    reason_for_visiting: e.reasonForVisiting || "",
    doctor: e.doctor || "",
    fee: e.fee || 0,
    payment_type: e.paymentType || "",
    photo_url: e.photo || null,
    status: e.status,
    patient_type: e.patientType || "OPD Patient",
    nurse_consultation_done: !!e.nurseConsultationDone,
    doctor_consultation_done: !!e.doctorConsultationDone,
    migrated_status: e.migratedStatus || "Not Migrated",
    pcu_status: e.pcuStatus || "N/A",
  };
}

const SELECT_WITH_JOINS = `
  *,
  patients ( hospital_no, first_name, last_name, middle_name, sex, date_of_birth ),
  profiles!encounters_created_by_fkey ( username ),
  encounter_triage ( *, profiles ( username ) ),
  encounter_waivers ( * )
`;

// Fetches every encounter. Returns [] on failure rather than throwing, so
// a failed fetch degrades to an empty list instead of crashing the page.
export async function loadEncounters() {
  const { data, error } = await supabase
    .from("encounters")
    .select(SELECT_WITH_JOINS)
    .order("date_created", { ascending: false });
  if (error) {
    console.error("loadEncounters failed:", error.message);
    return [];
  }
  return (data || []).map(rowToEncounter);
}

export async function findEncounterById(encounterId) {
  const { data, error } = await supabase
    .from("encounters")
    .select(SELECT_WITH_JOINS)
    .eq("id", encounterId)
    .single();
  if (error) return null;
  return rowToEncounter(data);
}

// "E-20260706-0018" — date the encounter was created plus a per-day
// sequence. The DB generates this itself (encounters.id defaults to
// generate_encounter_id()), so createEncounter() below doesn't need to
// compute or pass one — just insert and read back whatever id the DB
// assigned. No client-side equivalent of this function anymore; it's
// listed here only as a comment so anyone hunting for
// "where does E-20260706-0018 come from" finds the answer.

// Creates a brand-new encounter. `encounter` is shaped exactly like
// CreateEncounterPage.jsx already builds it (hospitalNo, patient snapshot,
// appointmentDate, ..., createdBy = the current user's uuid). Resolves
// hospitalNo -> the internal uuid FK, lets the DB generate the id, and
// returns the fully-joined encounter the rest of the app expects.
export async function createEncounter(encounter) {
  const patientUuid = await getPatientUuid(encounter.hospitalNo);
  if (!patientUuid) throw new Error(`No patient found with Hospital No. "${encounter.hospitalNo}"`);

  const { data, error } = await supabase
    .from("encounters")
    .insert({
      ...encounterToRow(encounter),
      patient_id: patientUuid,
      created_by: encounter.createdBy || null,
    })
    .select(SELECT_WITH_JOINS)
    .single();
  if (error) throw new Error(error.message);
  return rowToEncounter(data);
}

// Read-modify-write a single encounter by id — same call shape as before
// (`updater` receives the current encounter and returns the patch), so
// every existing call site (status flips, doctor reassignment, triage
// save, waiver save, consultation-done flags) keeps working unchanged.
// Triage/waiver are detected by reference change (the same pattern the
// callers already use — they always spread the rest and replace only the
// piece that changed) and routed to their own tables; everything else on
// the row is written as a normal update.
export async function updateEncounter(encounterId, updater) {
  const current = await findEncounterById(encounterId);
  if (!current) return null;

  const next = updater({ ...current });

  if (next.triage && next.triage !== current.triage) {
    const { error } = await supabase
      .from("encounter_triage")
      .upsert(triageToRow(encounterId, next.triage), { onConflict: "encounter_id" });
    if (error) console.error("updateEncounter (triage) failed:", error.message);
  }

  if (next.waiver && next.waiver !== current.waiver) {
    const { error } = await supabase
      .from("encounter_waivers")
      .upsert(waiverToRow(encounterId, next.waiver), { onConflict: "encounter_id" });
    if (error) console.error("updateEncounter (waiver) failed:", error.message);
  }

  const { error: rowError } = await supabase
    .from("encounters")
    .update(encounterToRow(next))
    .eq("id", encounterId);
  if (rowError) {
    console.error("updateEncounter failed:", rowError.message);
    return null;
  }

  return findEncounterById(encounterId);
}

// "2026-07-06T09:15:00.000Z" -> "07/06/2026" (matches the reference screen).
export function formatDateCreated(iso) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  const y = dt.getFullYear();
  return `${m}/${d}/${y}`;
}