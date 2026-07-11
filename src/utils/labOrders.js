// Lab Orders data layer.
//
// Storage is localStorage for now — same pattern Patients.jsx uses for
// patient records. When Supabase is wired up, replace loadLabOrders/
// saveLabOrders with `supabase.from("lab_orders").select("*")` /
// `.insert(...)` and everything that imports from this file (LabOrders.jsx,
// CreateLabOrderModal.jsx, ViewLabOrderModal.jsx) keeps working unchanged.

const STORAGE_KEY = "labOrders";

// Matches the hospital's 3 actual paper request slips exactly: the
// Laboratory Request Form (Hematology / Blood Chemistry / Cardiac Markers /
// Electrolytes / Hepatitis / Thyroid / other standalone tests), the X-Ray
// Request Form, and the Ultrasound and Imaging Request Form. Grouped by
// which physical slip and category each test belongs to, so the create-order
// checklist can be organized the same way the paper forms are instead of one
// long flat list.
export const LAB_ORDER_CATALOG = [
  {
    formType: "Laboratory",
    categories: [
      {
        category: "Hematology",
        tests: ["CBC", "CBC w/ PC", "ESR", "Platelet Count", "Differential Count", "PT", "aPTT"],
      },
      {
        category: "Blood Chemistry",
        tests: [
          "Hgt",
          "FBS",
          "Lipid Profile",
          "SGPT",
          "SGOT",
          "Cholesterol",
          "Triglyceride",
          "HbA1c",
          "BUN",
          "Creatinine",
          "BUA",
        ],
      },
      {
        category: "Cardiac Markers",
        tests: ["CK-MB", "CPK", "CPK-MM", "Troponin I", "Troponin T"],
      },
      {
        category: "Electrolytes",
        tests: [
          "Sodium Na+",
          "Potassium K+",
          "Chloride Cl-",
          "Ionized Calcium",
          "Lithium",
          "Inorganic Phosphorous",
          "Magnesium",
        ],
      },
      {
        category: "Hepatitis",
        tests: ["Anti HAV IgG", "Anti HAV IgM", "HBcAb", "HBcAb IgM", "HBsAb", "HBsAg"],
      },
      {
        category: "Thyroid",
        tests: ["T3", "T4", "TSH", "Free T3", "Free T4"],
      },
      {
        category: "Other Laboratory Tests",
        tests: [
          "Urinalysis",
          "Fecalysis",
          "Occult Blood",
          "Drug Test - Methamphetamine/Marijuana",
          "Others (Laboratory)",
        ],
      },
    ],
  },
  {
    formType: "X-Ray",
    categories: [
      {
        category: "X-Ray",
        tests: [
          "Chest PA (Adult)",
          "AP/LAT (Adult)",
          "AP/LAT (Pedia)",
          "Plain Abdomen",
          "Apico-Lordotic",
          "Thoracic Cage",
          "Skull X-Ray",
          "Lumbo-Sacral AP/LAT (Adult)",
          "Lumbo-Sacral AP/LAT (Pedia)",
          "Pelvic X-Ray",
          "Extremities",
          "Others (X-Ray)",
        ],
      },
    ],
  },
  {
    formType: "Ultrasound & Imaging",
    categories: [
      {
        category: "Ultrasound & Imaging",
        tests: [
          "Whole Abdominal Ultrasound",
          "HBT Ultrasound",
          "KUB",
          "KUB w/ Prostate",
          "TransVaginal Ultrasound",
          "Pelvic Ultrasound",
          "Bio-Physical Score",
          "2D Echocardiogram",
          "CT Scan",
          "MRI",
          "Others (Ultrasound & Imaging)",
        ],
      },
    ],
  },
];

// Flat list every existing consumer (search/filter, status derivation, code
// generation) already expects — just generated from the catalog above so
// there's one source of truth.
export const DIAGNOSTIC_OPTIONS = LAB_ORDER_CATALOG.flatMap((form) =>
  form.categories.flatMap((cat) => cat.tests)
);

// Which physical request slip (and category within it) each test belongs
// to — drives the grouped checklist UI in CreateLabOrderModal.
export const FORM_TYPE_BY_TEST = {};
export const CATEGORY_BY_TEST = {};
for (const form of LAB_ORDER_CATALOG) {
  for (const cat of form.categories) {
    for (const test of cat.tests) {
      FORM_TYPE_BY_TEST[test] = form.formType;
      CATEGORY_BY_TEST[test] = cat.category;
    }
  }
}

// Tests that have a blank line on the paper form for further detail (e.g.
// "CT Scan, indicate type/s: ___", "Extremities ___"). The create-order
// checklist shows a small text input next to these when checked.
export const TESTS_WITH_DETAIL = new Set([
  "Extremities",
  "CT Scan",
  "MRI",
  "Others (Laboratory)",
  "Others (X-Ray)",
  "Others (Ultrasound & Imaging)",
]);

export function loadLabOrders() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveLabOrders(orders) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

// IDs look like LAB-20260703-0020 — date the order was created plus a
// per-day sequence number, matching the reference screen.
export function generateLabOrderId(existingOrders) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const prefix = `LAB-${y}${m}${d}-`;

  const todaysCount = existingOrders.filter((o) => (o.id || "").startsWith(prefix)).length;
  const seq = String(todaysCount + 1).padStart(4, "0");
  return `${prefix}${seq}`;
}

export function findLabOrderById(orderId) {
  return loadLabOrders().find((o) => o.id === orderId) || null;
}

// Replaces one order in the stored list (matched by id) and persists.
// Used by the lab order detail page whenever a per-test record changes
// (status, results, files, etc.) — always read-modify-write the whole
// order so nothing else in it gets clobbered.
export function updateLabOrder(orderId, updater) {
  const orders = loadLabOrders();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return null;

  const updated = updater({ ...orders[idx] });
  orders[idx] = updated;
  saveLabOrders(orders);
  return updated;
}

// "2026-07-03T09:15:00.000Z" -> "07/03/2026" (matches the reference screen).
export function formatDateCreated(iso) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  const y = dt.getFullYear();
  return `${m}/${d}/${y}`;
}