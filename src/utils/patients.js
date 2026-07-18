// Shared patients data-layer helpers — now backed by Supabase (`patients`
// table) instead of localStorage. Every screen that touches patient data
// should import from HERE rather than keeping a private copy, so there's
// one place that knows how to talk to the database and one place to fix
// if the schema changes.
//
// Column names in Postgres are snake_case (see supabase_schema.sql); the
// rest of the app expects camelCase (hospitalNo, firstName, lastName,
// etc.), matching how CreatePatientModal.jsx's `emptyForm` is shaped. The
// map functions below are the ONLY place that translates between the two,
// so every component that reads/writes a patient object keeps working
// exactly as it did against localStorage.

import { supabase } from "../lib/supabaseClient";

// patient_guardians is a separate 1:1 table (PK = FK = patients.id), not a
// column on `patients` — see rowToGuardian/guardianToRow below. Supabase
// returns it embedded as `row.patient_guardians` (an object, since the FK
// column is also that table's primary key, making the relation to-one)
// whenever the caller's .select() asks for it.
function rowToGuardian(row) {
  if (!row) return {};
  return {
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    middleName: row.middle_name || "",
    suffix: row.suffix || "",
    sex: row.sex || "",
    dateOfBirth: row.date_of_birth || "",
    pin: row.pin || "",
    landline: row.landline || "",
    mobile: row.mobile || "",
  };
}

function guardianToRow(patientUuid, guardian) {
  return {
    patient_id: patientUuid,
    first_name: guardian.firstName || "",
    last_name: guardian.lastName || "",
    middle_name: guardian.middleName || "",
    suffix: guardian.suffix || "",
    // enum column — send null instead of "" or Postgres rejects it with a
    // 400 ("invalid input value for enum patient_sex").
    sex: guardian.sex || null,
    date_of_birth: guardian.dateOfBirth || null,
    pin: guardian.pin || "",
    landline: guardian.landline || "",
    mobile: guardian.mobile || "",
  };
}

// Upserts (or clears) the guardian row for one patient. Kept out of
// patientToRow/rowToPatient entirely — those two only ever touch actual
// `patients` columns now, so a stray extra key can never trigger a
// PostgREST "column not found" 400 again.
async function upsertGuardian(patientUuid, guardian) {
  const { data, error } = await supabase
    .from("patient_guardians")
    .upsert(guardianToRow(patientUuid, guardian))
    .select()
    .single();
  if (error) {
    console.error("Saving guardian failed:", error.message);
    return {};
  }
  return rowToGuardian(data);
}

async function deleteGuardian(patientUuid) {
  const { error } = await supabase.from("patient_guardians").delete().eq("patient_id", patientUuid);
  if (error) console.error("Removing guardian failed:", error.message);
}

function rowToPatient(row) {
  if (!row) return null;
  const guardianRow = Array.isArray(row.patient_guardians) ? row.patient_guardians[0] : row.patient_guardians;
  return {
    hospitalNo: row.hospital_no || "",
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
    guardian: rowToGuardian(guardianRow),

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

// Column map shared by patientPatchToRow below. camelCase key -> snake_case
// column name, for every column a caller might patch.
const PATIENT_FIELD_COLUMNS = {
  hospitalNo: "hospital_no",
  firstName: "first_name",
  lastName: "last_name",
  middleName: "middle_name",
  suffix: "suffix",
  sex: "sex",
  dateOfBirth: "date_of_birth",
  email: "email",
  landline: "landline",
  mobile: "mobile",
  photo: "photo",
  hasGuardian: "has_guardian",
  address: "address",
  region: "region",
  regionCode: "region_code",
  province: "province",
  provinceCode: "province_code",
  city: "city",
  cityCode: "city_code",
  barangay: "barangay",
  zipCode: "zip_code",
  motherName: "mother_name",
  motherContact: "mother_contact",
  fatherName: "father_name",
  fatherContact: "father_contact",
  nationality: "nationality",
  religion: "religion",
  maritalStatus: "marital_status",
  emergencyName: "emergency_name",
  emergencyAddress: "emergency_address",
  emergencyRelationship: "emergency_relationship",
  emergencyPhoneHome: "emergency_phone_home",
  emergencyPhoneCell: "emergency_phone_cell",
  konsultaEligibility: "konsulta_eligibility",
};

// Unlike patientToRow (used for inserts, where every column needs *some*
// value), this only includes columns the caller actually passed in
// `updates` — so a partial patch (e.g. the Consultation Form only sending
// name/DOB/address/contacts) can never silently null out hospital_no
// (NOT NULL — that's what was throwing the 23502 error), wipe
// region/province/city, reset has_guardian to false, or blank the photo,
// just because those fields happened to be absent from *this* patch.
function patientPatchToRow(updates) {
  const row = {};
  for (const [camelKey, column] of Object.entries(PATIENT_FIELD_COLUMNS)) {
    if (!Object.prototype.hasOwnProperty.call(updates, camelKey)) continue;
    let value = updates[camelKey];
    // date_of_birth is NOT NULL — never let an accidentally-cleared form
    // field ("") turn into a real NULL and trip the constraint.
    if (camelKey === "dateOfBirth" && !value) continue;
    if (camelKey === "hasGuardian") value = !!value;
    row[column] = value;
  }
  return row;
}

// Inverse of rowToPatient — only includes columns that exist in the table
// (drops any UI-only fields like the "emergencySameAsX" checkboxes, which
// CreatePatientModal.jsx resolves into plain values before saving). Used
// for INSERTS ONLY, where every column needs a real value/default — see
// patientPatchToRow above for updates.
function patientToRow(p) {
  const row = {
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
    // patient_type is intentionally not set here anymore — it's now
    // decided per-registration (encounters.patient_type), not once at
    // patient creation. See PATIENT_TYPE_BY_ROLE in utils/encounters.js.
  };

  // hospital_no is intentionally OMITTED unless the caller explicitly
  // supplied one (e.g. an import/migration script backfilling old data).
  // Leaving the key out entirely — rather than sending `null` — lets
  // Postgres fall back to the column's own DEFAULT generate_hospital_no(),
  // which is what actually assigns the next "00001", "00002", ... number
  // at the moment of insert. That's also why CreatePatientModal.jsx no
  // longer pre-computes a hospitalNo before the user clicks Save: there's
  // nothing left for it to compute — the database is the only source of
  // truth for the next number now, so two nurses registering a patient at
  // the same moment can never collide.
  if (p.hospitalNo) row.hospital_no = p.hospitalNo;
  return row;
}

// Fetches every patient. Returns [] on failure (network hiccup, RLS
// rejection, etc.) rather than throwing, so a failed fetch degrades to an
// empty list instead of crashing the page — same "never throw" contract
// the old localStorage version had.
// Every other table (encounters, lab_orders, medicine_prescriptions) FKs to
// patients.id (the internal uuid), but the rest of the app only ever deals
// in hospitalNo (the human-readable Hospital No., e.g. "00001") — this
// is the one place that bridges the two, so every other data-layer file
// can resolve "which patient row do I attach this to" without duplicating
// the query.
export async function getPatientUuid(hospitalNo) {
  const { data, error } = await supabase
    .from("patients")
    .select("id")
    .eq("hospital_no", hospitalNo)
    .single();
  if (error) return null;
  return data.id;
}

export async function loadPatients() {
  const { data, error } = await supabase
    .from("patients")
    .select("*, patient_guardians(*)")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("loadPatients failed:", error.message);
    return [];
  }
  return (data || []).map(rowToPatient);
}

// "By id" here means by Hospital No. — the sole patient identifier the
// app uses (routes, search, lookups). Kept the name findPatientById since
// every screen already calls it that; only what counts as "the id" changed.
export async function findPatientById(hospitalNo) {
  const { data, error } = await supabase
    .from("patients")
    .select("*, patient_guardians(*)")
    .eq("hospital_no", hospitalNo)
    .single();
  if (error) return null;
  return rowToPatient(data);
}

// Inserts a brand-new patient record. hospitalNo is intentionally NOT
// expected on `patient` — the database assigns it automatically (see
// patients.hospital_no's DEFAULT generate_hospital_no() in
// supabase_schema.sql), simply "00001", "00002", "00003", ... climbing
// forever. The assigned value comes back on the returned row below.
export async function createPatient(patient) {
  const { data, error } = await supabase
    .from("patients")
    .insert(patientToRow(patient))
    .select()
    .single();
  if (error) throw new Error(error.message);

  // patients.id (the uuid PK) only exists once the insert above returns —
  // that's why guardian is written as a second, separate statement rather
  // than folded into the same insert.
  const result = rowToPatient(data);
  if (patient.hasGuardian && patient.guardian) {
    result.guardian = await upsertGuardian(data.id, patient.guardian);
  }
  return result;
}

// Read-modify-write a single patient by id. `updater` receives the current
// patient (camelCase) and returns the patch to apply — same pattern as
// updateEncounter()/updateLabOrder() elsewhere in the app.
export async function updatePatient(hospitalNo, updates) {
  const { data, error } = await supabase
    .from("patients")
    .update(patientPatchToRow(updates))
    .eq("hospital_no", hospitalNo)
    .select("*, patient_guardians(*)")
    .single();
  if (error) throw new Error(error.message);

  const result = rowToPatient(data);
  // Most callers (e.g. the Consultation Form's patient-sync patch) never
  // mention guardian at all — leave whatever's already in patient_guardians
  // untouched in that case (rowToPatient above already reflects it via the
  // embedded select). Only write/clear it when this patch explicitly says to.
  if (updates.hasGuardian === false) {
    await deleteGuardian(data.id);
    result.guardian = {};
  } else if (updates.hasGuardian && updates.guardian) {
    result.guardian = await upsertGuardian(data.id, updates.guardian);
  }
  return result;
}

// Updates just the `photo` field for one patient and returns the updated
// record (or null if the patient no longer exists). Kept as its own
// function (rather than making every caller build a full patient object)
// since Create Registration and the Patient Profile page both call this
// directly whenever a photo is captured, and neither has the rest of the
// patient record loaded at that point.
export async function savePatientPhoto(hospitalNo, photoDataUrl) {
  const { data, error } = await supabase
    .from("patients")
    .update({ photo: photoDataUrl })
    .eq("hospital_no", hospitalNo)
    .select()
    .single();
  if (error) return null;
  return rowToPatient(data);
}