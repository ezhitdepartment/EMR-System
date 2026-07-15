// Per-diagnostic metadata for the Lab Order detail view (ViewLabOrderPage).
//
// Each diagnostic in DIAGNOSTIC_OPTIONS (utils/labOrders.js) gets:
//   - a short CODE prefix, used to build a per-test tracking number like
//     "CBC-202607-0036" (prefix + year/month + a per-month sequence)
//   - a `groups` layout describing the fields shown in the RESULTS panel
//
// To add real fields for another test, just fill in its `groups` array
// below — the ViewLabOrderPage renders whatever schema it finds here.
// Anything without a specific schema falls back to GENERIC_SCHEMA so the
// page still works, just with plainer fields.

export const DIAGNOSTIC_CODES = {
  // Hematology
  CBC: "CBC",
  "CBC w/ PC": "CBCPC",
  ESR: "ESR",
  "Platelet Count": "PLT",
  "Differential Count": "DIFF",
  PT: "PT",
  aPTT: "APTT",
  // Blood Chemistry
  Hgt: "HGT",
  FBS: "FBS",
  "Lipid Profile": "LIPID",
  SGPT: "SGPT",
  SGOT: "SGOT",
  Cholesterol: "CHOL",
  Triglyceride: "TRIG",
  HbA1c: "HBA1C",
  BUN: "BUN",
  Creatinine: "CREA",
  BUA: "BUA",
  // Cardiac Markers
  "CK-MB": "CKMB",
  CPK: "CPK",
  "CPK-MM": "CPKMM",
  "Troponin I": "TROPI",
  "Troponin T": "TROPT",
  // Electrolytes
  "Sodium Na+": "NA",
  "Potassium K+": "K",
  "Chloride Cl-": "CL",
  "Ionized Calcium": "ICA",
  Lithium: "LI",
  "Inorganic Phosphorous": "PHOS",
  Magnesium: "MG",
  // Hepatitis
  "Anti HAV IgG": "HAVIGG",
  "Anti HAV IgM": "HAVIGM",
  HBcAb: "HBCAB",
  "HBcAb IgM": "HBCABM",
  HBsAb: "HBSAB",
  HBsAg: "HBSAG",
  // Thyroid
  T3: "T3",
  T4: "T4",
  TSH: "TSH",
  "Free T3": "FT3",
  "Free T4": "FT4",
  // Other Laboratory Tests
  Urinalysis: "UA",
  Fecalysis: "FECA",
  "Occult Blood": "FOB",
  "Drug Test - Methamphetamine/Marijuana": "DRUG",
  "Others (Laboratory)": "LABOTH",
  // X-Ray
  "Chest PA (Adult)": "CXRPA",
  "AP/LAT (Adult)": "APLATA",
  "AP/LAT (Pedia)": "APLATP",
  "Plain Abdomen": "PABD",
  "Apico-Lordotic": "APICO",
  "Thoracic Cage": "TCAGE",
  "Skull X-Ray": "SKULL",
  "Lumbo-Sacral AP/LAT (Adult)": "LSA",
  "Lumbo-Sacral AP/LAT (Pedia)": "LSP",
  "Pelvic X-Ray": "PXR",
  Extremities: "EXT",
  "Others (X-Ray)": "XROTH",
  // Ultrasound & Imaging
  "Whole Abdominal Ultrasound": "WAUS",
  "HBT Ultrasound": "HBTUS",
  KUB: "KUB",
  "KUB w/ Prostate": "KUBP",
  "TransVaginal Ultrasound": "TVUS",
  "Pelvic Ultrasound": "PUS",
  "Bio-Physical Score": "BPS",
  "2D Echocardiogram": "2DECHO",
  "CT Scan": "CT",
  MRI: "MRI",
  "Others (Ultrasound & Imaging)": "USOTH",
};

function field(id, label, type = "number") {
  return { id, label, type };
}

// The Results panel used to show a different set of clinical fields per
// diagnostic (CBC breakdown, FBS glucose, etc.). That's been simplified
// down to a single Remarks field for every diagnostic — the file
// upload/viewing in the Files section is what actually matters here now.

import { supabase } from "../lib/supabaseClient";

const REMARKS_ONLY_SCHEMA = {
  groups: [
    {
      columns: 1,
      fields: [field("remarks", "Remarks", "textarea")],
    },
  ],
};

export function getResultSchema() {
  return REMARKS_ONLY_SCHEMA;
}

export function getDiagnosticCodePrefix(diagnosticName) {
  return DIAGNOSTIC_CODES[diagnosticName] || "LAB";
}

export const TEST_STATUS_OPTIONS = ["PENDING", "DONE", "CANCELLED"];
export const IS_REFERRED_OPTIONS = ["Yes", "No"];

// Builds a fresh, empty per-test record — the shape stored at
// order.tests[diagnosticName] in localStorage.
export function emptyTestRecord(code) {
  return {
    code,
    status: "PENDING",
    queueStatus: "WAITING", // "WAITING" | "SERVING" — see utils/labQueue.js
    isReferred: "",
    performedBy: "",
    datePerformed: "",
    fee: "",
    results: {},
    files: [],
  };
}

// "CBC-202607-0036" — prefix, then the current year+month, then a
// per-month sequence counted across every test of this type already in
// the DB. Mirrors generate_lab_order_id()'s date-based numbering, just
// computed client-side against a live count instead of a Postgres
// sequence — fine here since codes are advisory tracking numbers, not
// primary keys, so a rare collision under simultaneous submissions isn't
// destructive the way a duplicate id would be.
export async function generateDiagnosticCode(diagnosticName, when = new Date()) {
  const prefix = getDiagnosticCodePrefix(diagnosticName);
  const y = when.getFullYear();
  const m = String(when.getMonth() + 1).padStart(2, "0");
  const codePrefix = `${prefix}-${y}${m}-`;

  const { count, error } = await supabase
    .from("lab_order_tests")
    .select("id", { count: "exact", head: true })
    .eq("test_name", diagnosticName)
    .like("code", `${codePrefix}%`);
  if (error) console.error("generateDiagnosticCode failed:", error.message);

  const seq = String((count || 0) + 1).padStart(4, "0");
  return `${codePrefix}${seq}`;
}

// Overall order status derived from its per-test statuses — drives the
// badge shown on the lab order list and on the detail page header.
export function getOrderStatus(order) {
  const diagnostics = order?.diagnostics || [];
  if (diagnostics.length === 0) return "PENDING";

  const statuses = diagnostics.map((d) => order.tests?.[d]?.status || "PENDING");
  if (statuses.every((s) => s === "DONE")) return "COMPLETED";
  if (statuses.every((s) => s === "CANCELLED")) return "CANCELLED";
  if (statuses.some((s) => s === "DONE")) return "IN PROGRESS";
  return "PENDING";
}

export const ORDER_STATUS_STYLES = {
  COMPLETED: "bg-emerald-100 text-emerald-700",
  "IN PROGRESS": "bg-amber-100 text-amber-700",
  PENDING: "bg-slate-100 text-slate-600",
  CANCELLED: "bg-red-100 text-red-700",
};

export const TEST_STATUS_STYLES = {
  DONE: "text-emerald-600",
  PENDING: "text-slate-300",
  CANCELLED: "text-red-500",
};