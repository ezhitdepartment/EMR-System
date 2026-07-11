// Medicine Prescriptions data layer.
//
// Storage is localStorage for now — same pattern as utils/labOrders.js.
// When Supabase is wired up, swap loadMedicinePrescriptions/saveMedicinePrescriptions
// for `supabase.from("prescribed_medicines").select("*")` / `.insert(...)` and
// everything that imports from this file keeps working unchanged.

const STORAGE_KEY = "medicinePrescriptions";

// Starter formulary used for the medicine picker in AddMedicinePrescriptionPage.
// admin/Medicines.jsx (the real formulary/inventory catalog) is still a stub —
// once that's built, replace MEDICINE_CATALOG with a read from that instead
// and every consumer here (the modal's medicine picker) keeps working unchanged.
//
// There's no free, public, CORS-enabled API for the Philippine FDA drug
// registry — the FDA Verification Portal (verification.fda.gov.ph) is a
// server-rendered page with an Excel export button, not a JSON API, so it
// isn't something a browser-based app can call directly. This list is a
// curated mix of generics and common Philippine brand names instead, wide
// enough to make the search/select picker genuinely useful without a
// network dependency.
export const MEDICINE_CATALOG = [
  // Pain / fever
  "Paracetamol 500mg (Biogesic)",
  "Paracetamol 500mg (Tempra)",
  "Paracetamol 250mg/5mL Syrup (Calpol)",
  "Mefenamic Acid 500mg (Ponstan)",
  "Ibuprofen 400mg (Advil)",
  "Ibuprofen 200mg (Medicol)",
  "Naproxen 500mg",
  "Celecoxib 200mg",
  "Tramadol 50mg",
  "Aspirin 80mg (Low-Dose)",

  // Cough, cold, and flu
  "Bioflu (Paracetamol + Phenylephrine + Chlorphenamine)",
  "Neozep Forte (Phenylephrine + Chlorphenamine + Paracetamol)",
  "Decolgen Forte (Phenylephrine + Paracetamol + Chlorphenamine)",
  "Sinutab (Paracetamol + Phenylephrine)",
  "Solmux (Carbocisteine 500mg)",
  "Ambroxol 30mg (Mucosolvan)",
  "Robitussin DM (Dextromethorphan + Guaifenesin)",
  "Tuseran Forte (Dextromethorphan + Phenylephrine)",
  "Salbutamol 2mg/5mL Syrup",
  "Salbutamol Nebule 2.5mg/2.5mL (Ventolin)",
  "Ipratropium + Salbutamol Nebule (Berodual)",

  // GI
  "Kremil-S (Antacid)",
  "Omeprazole 20mg",
  "Ranitidine 150mg",
  "Domperidone 10mg",
  "Buscopan (Hyoscine-N-Butylbromide) 10mg",
  "Loperamide 2mg (Imodium)",
  "Diatabs (Attapulgite)",
  "Dulcolax (Bisacodyl) 5mg",
  "Oral Rehydration Salts (Hydrite)",
  "Lactulose Syrup",

  // Allergy / dermatologic
  "Cetirizine 10mg",
  "Loratadine 10mg (Allerta)",
  "Diphenhydramine 25mg (Benadryl)",
  "Betamethasone Cream",
  "Mupirocin Ointment",
  "Calamine Lotion",

  // Antibiotics
  "Amoxicillin 500mg",
  "Co-Amoxiclav 625mg (Augmentin)",
  "Cefalexin 500mg",
  "Cefuroxime 500mg (Zinnat)",
  "Azithromycin 500mg (Zithromax)",
  "Ciprofloxacin 500mg",
  "Metronidazole 500mg",
  "Clindamycin 300mg",

  // Cardiovascular / metabolic
  "Losartan 50mg",
  "Amlodipine 5mg",
  "Metoprolol 50mg",
  "Metformin 500mg (Glucophage)",
  "Gliclazide 80mg",
  "Simvastatin 20mg",
  "Atorvastatin 20mg",
  "Clopidogrel 75mg",

  // Vitamins / supplements
  "Ascorbic Acid 500mg (Poten-Cee)",
  "Multivitamins (Enervon)",
  "Multivitamins (Centrum)",
  "Ferrous Sulfate + Folic Acid",
  "Cherifer (Growth Formula)",
  "Zinc Sulfate 20mg",

  // Respiratory / misc
  "Prednisone 20mg",
  "Diphenhydramine + Dextromethorphan (Robitussin)",
  "Insulin Regular (Humulin R)",
  "Insulin Glargine (Lantus)",
];

export const STATUS_OPTIONS = ["Pending", "Completed"];

export const STATUS_STYLES = {
  Completed: "bg-emerald-100 text-emerald-700",
  Pending: "bg-amber-100 text-amber-700",
};

export function loadMedicinePrescriptions() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveMedicinePrescriptions(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function findMedicinePrescriptionById(id) {
  return loadMedicinePrescriptions().find((r) => r.id === id) || null;
}

// Used by the Encounters table's Medication column — every medicine name
// prescribed under this exact encounter/registration, across however many
// prescriptions were created for it.
export function getMedicineNamesForEncounter(encounterId) {
  if (!encounterId) return [];
  const names = loadMedicinePrescriptions()
    .filter((r) => r.encounterId === encounterId)
    .flatMap((r) => (r.items || []).map((item) => item.medicineName))
    .filter(Boolean);
  return Array.from(new Set(names));
}

// Read-modify-write helper for a single record, matching updateLabOrder's
// pattern in utils/labOrders.js.
export function updateMedicinePrescription(id, updater) {
  const records = loadMedicinePrescriptions();
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) return null;

  const updated = updater({ ...records[idx] });
  records[idx] = updated;
  saveMedicinePrescriptions(records);
  return updated;
}

// IDs look like MED-20260706-0012 — date created plus a per-day sequence
// number, matching the reference screen and generateLabOrderId's pattern.
export function generateMedicinePrescriptionId(existingRecords) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const prefix = `MED-${y}${m}${d}-`;

  const todaysCount = existingRecords.filter((r) => (r.id || "").startsWith(prefix)).length;
  const seq = String(todaysCount + 1).padStart(4, "0");
  return `${prefix}${seq}`;
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