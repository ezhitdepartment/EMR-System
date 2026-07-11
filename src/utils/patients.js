// Shared patients data-layer helpers.
//
// Both CreateEncounterPage.jsx (the "Registration" module's create flow)
// and PatientProfile.jsx read/update the same `patients` localStorage
// table. Previously each file kept its own private copy of loadPatients()/
// savePatientPhoto(), and only PatientProfile.jsx's copy actually wrote the
// photo back onto the patient record — so a photo captured in Create
// Registration only ever got saved onto that one encounter, never onto the
// patient, and the two screens drifted out of sync. Pulling these into one
// shared module and having both screens call the same savePatientPhoto()
// is what keeps a photo taken in either place instantly reflected in the
// other.

const STORAGE_KEY = "patients";

export function loadPatients() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function savePatients(patients) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
}

// Updates just the `photo` field for one patient and returns the updated
// record (or null if the patient no longer exists).
export function savePatientPhoto(patientId, photoDataUrl) {
  const patients = loadPatients();
  const idx = patients.findIndex((p) => p.patientId === patientId);
  if (idx === -1) return null;

  const updated = { ...patients[idx], photo: photoDataUrl };
  patients[idx] = updated;
  savePatients(patients);
  return updated;
}

// Auto-generates the next Hospital No., in the pattern:
//   {3-digit sequence}{4-digit year}{2-digit month}
// e.g. the 1st patient registered in July 2026 -> "001202607"
//
// The sequence keeps climbing (001, 002, 003, ...) across the whole patient
// list — it does NOT reset each month/year — so two patients registered in
// the same month can never collide. It's derived from the highest sequence
// number already in use rather than just `patients.length`, so it stays
// correct (no duplicates, no reused numbers) even if a patient record is
// ever deleted.
export function generateHospitalNo(existingPatients) {
  const patients = existingPatients || loadPatients();
  const pattern = /^(\d{3})\d{4}\d{2}$/;

  let maxSeq = 0;
  patients.forEach((p) => {
    const match = pattern.exec(p.hospitalNo || "");
    if (match) {
      const seq = parseInt(match[1], 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  });

  const nextSeq = String(maxSeq + 1).padStart(3, "0");
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${nextSeq}${year}${month}`;
}
