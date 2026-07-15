// Medicine Prescriptions data layer — now backed by Supabase
// (`medicine_prescriptions` + its `prescription_items` child table)
// instead of localStorage. Same rationale/pattern as utils/patients.js,
// utils/encounters.js, and utils/labOrders.js.

import { supabase } from "../lib/supabaseClient";
import { getPatientUuid } from "./patients";

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

function rowToRecord(row) {
  if (!row) return null;
  const p = row.patients || {};
  return {
    id: row.id,
    patientId: p.patient_id || "",
    encounterId: row.encounter_id || null,
    patient: {
      firstName: p.first_name || "",
      lastName: p.last_name || "",
      middleName: p.middle_name || "",
      sex: p.sex || "",
      dateOfBirth: p.date_of_birth || "",
      address: p.address || "",
    },
    prescribedBy: row.prescribed_by || "",
    items: (row.prescription_items || []).map((it) => ({
      medicineName: it.medicine_name,
      quantity: it.quantity ?? 0,
      instructions: it.instructions || "",
    })),
    dateCreated: row.date_created,
  };
}

const SELECT_WITH_JOINS = `
  *,
  patients ( patient_id, first_name, last_name, middle_name, sex, date_of_birth, address ),
  prescription_items ( * )
`;

export async function loadMedicinePrescriptions() {
  const { data, error } = await supabase
    .from("medicine_prescriptions")
    .select(SELECT_WITH_JOINS)
    .order("date_created", { ascending: false });
  if (error) {
    console.error("loadMedicinePrescriptions failed:", error.message);
    return [];
  }
  return (data || []).map(rowToRecord);
}

export async function findMedicinePrescriptionById(id) {
  const { data, error } = await supabase
    .from("medicine_prescriptions")
    .select(SELECT_WITH_JOINS)
    .eq("id", id)
    .single();
  if (error) return null;
  return rowToRecord(data);
}

// Used by the Encounters table's Medication column — every medicine name
// prescribed under this exact encounter/registration, across however many
// prescriptions were created for it.
export async function getMedicineNamesForEncounter(encounterId) {
  if (!encounterId) return [];
  const { data, error } = await supabase
    .from("medicine_prescriptions")
    .select("prescription_items ( medicine_name )")
    .eq("encounter_id", encounterId);
  if (error) {
    console.error("getMedicineNamesForEncounter failed:", error.message);
    return [];
  }
  const names = (data || []).flatMap((r) => (r.prescription_items || []).map((it) => it.medicine_name));
  return Array.from(new Set(names.filter(Boolean)));
}

// Creates a new prescription + its line items in one go. `record` is shaped
// exactly like AddMedicinePrescriptionPage.jsx already builds it (patientId,
// encounterId, prescribedBy, items: [{medicineName, quantity, instructions}]).
export async function createMedicinePrescription(record) {
  const patientUuid = await getPatientUuid(record.patientId);
  if (!patientUuid) throw new Error(`No patient found with patientId "${record.patientId}"`);

  const { data: rxRow, error } = await supabase
    .from("medicine_prescriptions")
    .insert({
      patient_id: patientUuid,
      encounter_id: record.encounterId || null,
      prescribed_by: record.prescribedBy,
      created_by: record.createdBy || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const itemRows = (record.items || []).map((it) => ({
    prescription_id: rxRow.id,
    medicine_name: it.medicineName,
    quantity: it.quantity || 1,
    instructions: it.instructions || "",
  }));
  const { error: itemsError } = await supabase.from("prescription_items").insert(itemRows);
  if (itemsError) throw new Error(itemsError.message);

  return findMedicinePrescriptionById(rxRow.id);
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