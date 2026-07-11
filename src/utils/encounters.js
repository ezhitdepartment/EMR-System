// Encounters data layer.
//
// Storage is localStorage for now — same pattern as Lab Orders and
// Patients. When Supabase is wired up, replace loadEncounters/
// saveEncounters with `supabase.from("encounters").select("*")` /
// `.insert(...)` and everything that imports from this file keeps working
// unchanged.

const STORAGE_KEY = "encounters";

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

// Standing in for a real physicians directory until one exists — swap for
// a `doctors` table (or a filter on the users table) once Supabase is wired up.
export const DOCTORS = [
  "Edgar Zarate",
  "Ralph Edward Gascon",
  "Cliford Vincent C. Gamit",
];

export function loadEncounters() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveEncounters(encounters) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(encounters));
}

// IDs look like E-20260706-0018 — date the encounter was created plus a
// per-day sequence number, matching the reference screen.
export function generateEncounterId(existingEncounters) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const prefix = `E-${y}${m}${d}-`;

  const todaysCount = existingEncounters.filter((e) => (e.id || "").startsWith(prefix)).length;
  const seq = String(todaysCount + 1).padStart(4, "0");
  return `${prefix}${seq}`;
}

export function findEncounterById(encounterId) {
  return loadEncounters().find((e) => e.id === encounterId) || null;
}

// Replaces one encounter in the stored list (matched by id) and persists.
// Always read-modify-write the whole encounter so nothing else in it
// (triage, waiver, etc.) gets clobbered.
export function updateEncounter(encounterId, updater) {
  const encounters = loadEncounters();
  const idx = encounters.findIndex((e) => e.id === encounterId);
  if (idx === -1) return null;

  const updated = updater({ ...encounters[idx] });
  encounters[idx] = updated;
  saveEncounters(encounters);
  return updated;
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
