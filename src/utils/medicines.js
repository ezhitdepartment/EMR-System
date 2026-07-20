// Medicines (formulary catalog) data layer — backed by Supabase's
// `medicine_catalog` table (see Section 6 of the SQL schema: just a
// `name text primary key`). Same pattern as utils/medicinePrescriptions.js /
// utils/patients.js: thin wrappers around supabase-js, snake_case in the
// DB, camelCase (well, plain strings here) out to the UI.
//
// RLS: every authenticated user can read this table (it's referenced by
// MedicineAutocomplete-style pickers elsewhere), but only Admin and
// Pharmacist can insert/delete — see the "medicine_catalog: insert" /
// "medicine_catalog: delete" policies in the SQL addendum. If those
// policies haven't been run yet, addMedicine()/deleteMedicine() will fail
// with a permission error for anyone, including Admin/Pharmacist.

import { supabase } from "../lib/supabaseClient";

// Loads every medicine in the catalog, alphabetically.
export async function loadMedicines() {
  const { data, error } = await supabase
    .from("medicine_catalog")
    .select("name")
    .order("name", { ascending: true });
  if (error) {
    console.error("loadMedicines failed:", error.message);
    return [];
  }
  return (data || []).map((row) => row.name);
}

// Adds a new medicine to the catalog. Trims whitespace and checks for a
// case-insensitive duplicate before hitting the DB (medicine_catalog.name
// is the primary key and is case-sensitive, so "Paracetamol" and
// "paracetamol" wouldn't collide at the DB level on their own — this stops
// that from happening silently). Throws a friendly Error on failure so the
// modal can just show err.message.
export async function addMedicine(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) {
    throw new Error("Enter a medicine name.");
  }

  const existing = await loadMedicines();
  const alreadyExists = existing.some((n) => n.toLowerCase() === trimmed.toLowerCase());
  if (alreadyExists) {
    throw new Error(`"${trimmed}" is already in the formulary.`);
  }

  const { error } = await supabase.from("medicine_catalog").insert({ name: trimmed });
  if (error) {
    // 23505 = unique_violation — covers the rare race where two people add
    // the exact same (case-sensitive) name at the same instant.
    if (error.code === "23505") {
      throw new Error(`"${trimmed}" is already in the formulary.`);
    }
    throw new Error(error.message);
  }

  return trimmed;
}

// Removes a medicine from the catalog by its exact name.
export async function deleteMedicine(name) {
  const { error } = await supabase.from("medicine_catalog").delete().eq("name", name);
  if (error) {
    throw new Error(error.message);
  }
}
