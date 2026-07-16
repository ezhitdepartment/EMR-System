// Lab Orders data layer — now backed by Supabase (`lab_orders` +
// `lab_order_tests` + `lab_order_test_files`) instead of localStorage.
//
// The rest of the app keeps working against the same shape it always has:
//   order.diagnostics -> array of test names on this order
//   order.testDetails -> { [testName]: freeTextDetail }
//   order.tests        -> { [testName]: testRecord }
// testRecord shape is unchanged too (code, status, queueStatus, isReferred,
// performedBy, datePerformed, fee, results: { remarks }, files: [...]) —
// only `files` changed meaningfully: each file is now a Storage object
// (id, name, storagePath, uploadedAt) instead of a base64 dataUrl, since
// files live in Supabase Storage now, not inline in the JSON blob. See
// uploadLabOrderTestFile / deleteLabOrderTestFile / getLabOrderFileUrl
// below for the new file flow.

import { supabase } from "../lib/supabaseClient";
import { getPatientUuid } from "./patients";

export const DIAGNOSTIC_GROUPS = {
  Hematology: ["CBC", "CBC w/ PC", "ESR", "Platelet Count", "Differential Count", "PT", "aPTT"],
  "Blood Chemistry": [
    "Hgt", "FBS", "Lipid Profile", "SGPT", "SGOT", "Cholesterol", "Triglyceride",
    "HbA1c", "BUN", "Creatinine", "BUA",
  ],
  "Cardiac Markers": ["CK-MB", "CPK", "CPK-MM", "Troponin I", "Troponin T"],
  Electrolytes: [
    "Sodium Na+", "Potassium K+", "Chloride Cl-", "Ionized Calcium", "Lithium",
    "Inorganic Phosphorous", "Magnesium",
  ],
  Hepatitis: ["Anti HAV IgG", "Anti HAV IgM", "HBcAb", "HBcAb IgM", "HBsAb", "HBsAg"],
  Thyroid: ["T3", "T4", "TSH", "Free T3", "Free T4"],
  "Other Laboratory Tests": [
    "Urinalysis", "Fecalysis", "Occult Blood",
    "Drug Test - Methamphetamine/Marijuana", "Others (Laboratory)",
  ],
  "X-Ray": [
    "Chest PA (Adult)", "AP/LAT (Adult)", "AP/LAT (Pedia)", "Plain Abdomen",
    "Apico-Lordotic", "Thoracic Cage", "Skull X-Ray", "Lumbo-Sacral AP/LAT (Adult)",
    "Lumbo-Sacral AP/LAT (Pedia)", "Pelvic X-Ray", "Extremities", "Others (X-Ray)",
  ],
  "Ultrasound & Imaging": [
    "Whole Abdominal Ultrasound", "HBT Ultrasound", "KUB", "KUB w/ Prostate",
    "TransVaginal Ultrasound", "Pelvic Ultrasound", "Bio-Physical Score",
    "2D Echocardiogram", "CT Scan", "MRI", "Others (Ultrasound & Imaging)",
  ],
};

export const DIAGNOSTIC_OPTIONS = Object.values(DIAGNOSTIC_GROUPS).flat();

// Which request-slip formType each group belongs to — mirrors
// lab_test_catalog.form_type / current_user_can_access_form_type() in the
// SQL schema, so a Med Tech only ever sees Laboratory and an X-ray Tech
// only sees X-Ray/Ultrasound & Imaging.
export const FORM_TYPE_BY_GROUP = {
  Hematology: "Laboratory",
  "Blood Chemistry": "Laboratory",
  "Cardiac Markers": "Laboratory",
  Electrolytes: "Laboratory",
  Hepatitis: "Laboratory",
  Thyroid: "Laboratory",
  "Other Laboratory Tests": "Laboratory",
  "X-Ray": "X-Ray",
  "Ultrasound & Imaging": "Ultrasound & Imaging",
};

export const FORM_TYPE_BY_TEST = {};
Object.entries(DIAGNOSTIC_GROUPS).forEach(([group, tests]) => {
  tests.forEach((t) => (FORM_TYPE_BY_TEST[t] = FORM_TYPE_BY_GROUP[group]));
});

// Which formTypes a role is allowed to work on — mirrors
// current_user_can_access_form_type() in the SQL schema exactly. Admin and
// nurses aren't restricted (nurses only ever create orders, never touch
// results), only the two tech roles are scoped.
export const ROLE_TEST_TYPES = {
  med_tech: ["Laboratory"],
  xray_tech: ["X-Ray", "Ultrasound & Imaging"],
};

export const STATUS_OPTIONS = ["PENDING", "DONE", "CANCELLED"];

export const STATUS_STYLES = {
  PENDING: "bg-amber-100 text-amber-700",
  DONE: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};

function rowToTestRecord(t) {
  return {
    id: t.id, // uuid — needed for file upload/delete against this exact test
    code: t.code || "",
    status: t.status || "PENDING",
    queueStatus: t.queue_status || "WAITING",
    isReferred: t.is_referred || "",
    performedBy: t.performed_by || "",
    datePerformed: t.date_performed || "",
    fee: t.fee ?? "",
    testDetail: t.test_detail || "",
    results: { remarks: t.remarks || "" },
    files: (t.lab_order_test_files || []).map((f) => ({
      id: f.id,
      name: f.file_name,
      storagePath: f.storage_path,
      uploadedAt: f.uploaded_at,
    })),
  };
}

// Only the columns that live directly on a lab_order_tests row — files are
// their own table, handled by the dedicated upload/delete functions below,
// never through this generic mapper.
function testRecordToRow(orderId, testName, rec) {
  return {
    order_id: orderId,
    test_name: testName,
    code: rec.code || null,
    status: rec.status || "PENDING",
    queue_status: rec.queueStatus || "WAITING",
    is_referred: rec.isReferred || null,
    performed_by: rec.performedBy || null,
    date_performed: rec.datePerformed || null,
    fee: rec.fee === "" || rec.fee == null ? null : Number(rec.fee),
    remarks: rec.results?.remarks || null,
    test_detail: rec.testDetail || null,
  };
}

function rowToOrder(row) {
  if (!row) return null;
  const p = row.patients || {};
  const tests = {};
  const diagnostics = [];
  const testDetails = {};
  (row.lab_order_tests || []).forEach((t) => {
    diagnostics.push(t.test_name);
    tests[t.test_name] = rowToTestRecord(t);
    if (t.test_detail) testDetails[t.test_name] = t.test_detail;
  });

  return {
    id: row.id,
    patientId: p.patient_id || "",
    patient: {
      firstName: p.first_name || "",
      lastName: p.last_name || "",
      middleName: p.middle_name || "",
      sex: p.sex || "",
      dateOfBirth: p.date_of_birth || "",
    },
    diagnostics,
    testDetails,
    tests,
    paymentStatus: row.payment_status || "unpaid",
    createdBy: row.profiles?.username || row.created_by || "—",
    dateCreated: row.date_created,
  };
}

const SELECT_WITH_JOINS = `
  *,
  patients ( patient_id, first_name, last_name, middle_name, sex, date_of_birth ),
  profiles!lab_orders_created_by_fkey ( username ),
  lab_order_tests ( *, lab_order_test_files ( * ) )
`;

export async function loadLabOrders() {
  const { data, error } = await supabase
    .from("lab_orders")
    .select(SELECT_WITH_JOINS)
    .order("date_created", { ascending: false });
  if (error) {
    console.error("loadLabOrders failed:", error.message);
    return [];
  }
  return (data || []).map(rowToOrder);
}

export async function findLabOrderById(orderId) {
  const { data, error } = await supabase
    .from("lab_orders")
    .select(SELECT_WITH_JOINS)
    .eq("id", orderId)
    .single();
  if (error) return null;
  return rowToOrder(data);
}

// Creates a new order plus one lab_order_tests row per selected diagnostic.
// `tests` is keyed by test name and only needs `code` at creation time
// (CreateLabOrderModal.jsx pre-generates each code via
// generateDiagnosticCode before calling this) — everything else defaults
// on the DB side (status PENDING, queueStatus WAITING).
export async function createLabOrder({ patientId, diagnostics, testDetails, tests, createdBy }) {
  const patientUuid = await getPatientUuid(patientId);
  if (!patientUuid) throw new Error(`No patient found with patientId "${patientId}"`);

  const { data: orderRow, error } = await supabase
    .from("lab_orders")
    .insert({ patient_id: patientUuid, created_by: createdBy || null })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const testRows = diagnostics.map((name) => ({
    order_id: orderRow.id,
    test_name: name,
    code: tests?.[name]?.code || null,
    test_detail: testDetails?.[name] || null,
  }));
  const { error: testsError } = await supabase.from("lab_order_tests").insert(testRows);
  if (testsError) throw new Error(testsError.message);

  return findLabOrderById(orderRow.id);
}

// Toggles an order's billing status between "paid" and "unpaid". RLS
// restricts this to Cashier/Admin server-side (see
// current_user_can_manage_billing() in the SQL) — a nurse/tech calling
// this will get a permission error back from Supabase, not a silent
// no-op, so callers should surface that rather than swallow it.
export async function updatePaymentStatus(orderId, paymentStatus) {
  if (!["paid", "unpaid"].includes(paymentStatus)) {
    throw new Error(`Invalid payment status "${paymentStatus}"`);
  }
  const { error } = await supabase
    .from("lab_orders")
    .update({ payment_status: paymentStatus })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  return findLabOrderById(orderId);
}

// Read-modify-write a single order by id — same call shape as before
// (`updater` receives the current order, returns the patch). Every
// existing call site only ever replaces ONE test's entry inside
// `order.tests` with a new object (spreading the rest), so — same pattern
// as updateEncounter — a test is only written back to the DB if its
// reference actually changed. Order-level fields (diagnostics/testDetails)
// aren't mutated after creation by anything currently in the app, so
// there's nothing else to diff here.
export async function updateLabOrder(orderId, updater) {
  const current = await findLabOrderById(orderId);
  if (!current) return null;

  const next = updater({ ...current });
  const nextTests = next.tests || {};
  const prevTests = current.tests || {};

  for (const testName of Object.keys(nextTests)) {
    if (nextTests[testName] !== prevTests[testName]) {
      // A plain UPDATE, not an upsert: the row for this test already
      // exists (createLabOrder() inserts one per test up front), and
      // Postgres/RLS treats "INSERT ... ON CONFLICT DO UPDATE" as
      // requiring the INSERT policy's WITH CHECK to pass for every row —
      // even ones that only ever take the DO UPDATE path. Med Tech/X-ray
      // Tech are allowed to update lab_order_tests but not create a lab
      // order, so upserting here was silently blocked by the INSERT
      // policy the moment they tried to change a status or save results.
      const { error } = await supabase
        .from("lab_order_tests")
        .update(testRecordToRow(orderId, testName, nextTests[testName]))
        .eq("order_id", orderId)
        .eq("test_name", testName);
      if (error) console.error("updateLabOrder failed:", error.message);
    }
  }

  return findLabOrderById(orderId);
}

// ---------------------------------------------------------------------
// Result files — real Supabase Storage now ("lab-order-files" bucket,
// private), not base64 blobs inline in the order. Each test's `id` (the
// lab_order_tests row uuid, present on every testRecord above) scopes the
// storage path so files from different tests/orders never collide.
// ---------------------------------------------------------------------

export async function uploadLabOrderTestFile(testId, file, uploadedBy) {
  const path = `${testId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("lab-order-files").upload(path, file);
  if (uploadError) throw new Error(uploadError.message);

  const { error: rowError } = await supabase.from("lab_order_test_files").insert({
    test_id: testId,
    file_name: file.name,
    storage_path: path,
    uploaded_by: uploadedBy || null,
  });
  if (rowError) throw new Error(rowError.message);
}

export async function deleteLabOrderTestFile(fileId, storagePath) {
  const { error: storageError } = await supabase.storage.from("lab-order-files").remove([storagePath]);
  if (storageError) console.error("deleteLabOrderTestFile (storage) failed:", storageError.message);

  const { error } = await supabase.from("lab_order_test_files").delete().eq("id", fileId);
  if (error) throw new Error(error.message);
}

// The bucket is private, so viewing/downloading a file needs a short-lived
// signed URL rather than a public one — call this right before opening/
// downloading, not ahead of time (it expires in an hour).
export async function getLabOrderFileUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from("lab-order-files")
    .createSignedUrl(storagePath, 3600);
  if (error) {
    console.error("getLabOrderFileUrl failed:", error.message);
    return null;
  }
  return data.signedUrl;
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