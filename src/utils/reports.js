// Reports pulls from the data that actually exists today — patient records
// and each patient's (single, latest) consultation record. The Encounters
// and Yakap Tracker modules are still placeholders, and consultations are
// stored one-per-patient (overwritten on save, not a full visit history),
// so a couple of things are worth knowing about what these reports can
// and can't show:
//   - "Encounter Report" reflects each patient's most recent consultation,
//     not a full multi-visit history — that's the data available.
//   - "Diagnosis Report" parses the free-text Active Diagnoses field
//     (doctors write prose, not a coded list) by splitting on commas /
//     semicolons / line breaks — best-effort, not a precise clinical code.
//   - "ICD-10 Diagnosis Report" is the coded counterpart — it counts
//     distinct patients per ICD-10 code from the structured diagnosis
//     picker on the Consultation Form (form.icdDiagnoses), backed by
//     src/data/icd10Codes.js (the DOH Philippine ICD-10 Modifications
//     Handbook's common-diagnoses table). Only visits where the doctor
//     actually picked a code show up here — it won't backfill older
//     free-text-only diagnoses.
//   - "Yakap Report" approximates the DOH Yakap program's target
//     population (senior citizens, NCD risk factors) from the closest
//     existing fields, since there's no dedicated Yakap dataset yet.
const REPORTS_KEY = "generatedReports";
const PATIENTS_KEY = "patients";
const CONSULTATION_KEY = "patientConsultation";

export const REPORT_TYPES = [
  "Encounter Report",
  "Diagnosis Report",
  "ICD-10 Diagnosis Report",
  "Yakap Report",
];

export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function loadPatients() {
  try {
    return JSON.parse(localStorage.getItem(PATIENTS_KEY) || "[]");
  } catch {
    return [];
  }
}

// Flattens the patientId-keyed consultation object into an array, with the
// matching patient record merged in for name/DOB/etc.
function loadConsultations() {
  try {
    const all = JSON.parse(localStorage.getItem(CONSULTATION_KEY) || "{}");
    const patients = loadPatients();
    return Object.entries(all).map(([patientId, record]) => ({
      ...record,
      patientId,
      patient: patients.find((p) => p.patientId === patientId) || null,
    }));
  } catch {
    return [];
  }
}

function yearOf(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d.getFullYear();
}

function monthOf(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d.getMonth();
}

function patientName(patient, fallbackId) {
  if (!patient) return fallbackId || "—";
  return [patient.lastName, patient.firstName].filter(Boolean).join(", ") || fallbackId;
}

function ageOf(dateOfBirth) {
  if (!dateOfBirth) return null;
  const d = new Date(dateOfBirth);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

export function parseDiagnoses(text) {
  if (!text) return [];
  return text
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\s+/g, " "));
}

export function getAvailableYears() {
  const years = new Set([new Date().getFullYear()]);
  loadConsultations().forEach((c) => {
    const y = yearOf(c.updatedAt);
    if (y) years.add(y);
  });
  loadPatients().forEach((p) => {
    const y = yearOf(p.createdAt);
    if (y) years.add(y);
  });
  return Array.from(years).sort((a, b) => b - a);
}

function getEncountersForYear(year) {
  return loadConsultations().filter((c) => yearOf(c.updatedAt) === Number(year));
}

export function getMonthlyEncounterCounts(year) {
  const counts = Array(12).fill(0);
  getEncountersForYear(year).forEach((c) => {
    const m = monthOf(c.updatedAt);
    if (m !== null) counts[m] += 1;
  });
  return MONTH_LABELS.map((label, i) => ({ label, value: counts[i] }));
}

export function getYearlyEncounterCounts() {
  const counts = {};
  loadConsultations().forEach((c) => {
    const y = yearOf(c.updatedAt);
    if (y) counts[y] = (counts[y] || 0) + 1;
  });
  const years = Object.keys(counts).map(Number).sort((a, b) => a - b);
  return years.map((year) => ({ label: String(year), value: counts[year] }));
}

// Patients CREATED per month/year — distinct from encounters. A patient is
// only created once (via CreatePatientModal), so unlike consultations this
// reflects real, non-overwritten history — every patient ever registered
// shows up here, keyed by their record's createdAt.
export function getMonthlyPatientCounts(year) {
  const counts = Array(12).fill(0);
  loadPatients().forEach((p) => {
    if (yearOf(p.createdAt) === Number(year)) {
      const m = monthOf(p.createdAt);
      if (m !== null) counts[m] += 1;
    }
  });
  return MONTH_LABELS.map((label, i) => ({ label, value: counts[i] }));
}

export function getYearlyPatientCounts() {
  const counts = {};
  loadPatients().forEach((p) => {
    const y = yearOf(p.createdAt);
    if (y) counts[y] = (counts[y] || 0) + 1;
  });
  const years = Object.keys(counts).map(Number).sort((a, b) => a - b);
  return years.map((year) => ({ label: String(year), value: counts[year] }));
}

export function getDiagnosisBreakdown(year) {
  const counts = new Map();
  getEncountersForYear(year).forEach((c) => {
    parseDiagnoses(c.activeDiagnoses).forEach((dx) => {
      const key = dx.toLowerCase();
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { label: dx, count: 1 });
    });
  });
  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

export function getEncounterReportRows(year) {
  return getEncountersForYear(year).map((c) => ({
    patientId: c.patientId,
    patientName: patientName(c.patient, c.patientId),
    date: c.updatedAt ? c.updatedAt.slice(0, 10) : "",
    chiefComplaint: c.chiefComplaint || "",
    diagnosis: c.activeDiagnoses || "",
  }));
}

export function getYakapReportRows(year) {
  return getEncountersForYear(year)
    .filter((c) => {
      const age = ageOf(c.patient?.dateOfBirth);
      return (
        (age !== null && age >= 60) ||
        c.diagnosedDiabetes === "YES" ||
        c.anginaOrHeartAttack === "YES" ||
        c.strokeOrTIA === "YES"
      );
    })
    .map((c) => ({
      patientId: c.patientId,
      patientName: patientName(c.patient, c.patientId),
      date: c.updatedAt ? c.updatedAt.slice(0, 10) : "",
      age: ageOf(c.patient?.dateOfBirth) ?? "",
      riskLevel: c.riskLevel || "",
      diabetes: c.diagnosedDiabetes || "",
      cardiac: c.anginaOrHeartAttack || "",
      stroke: c.strokeOrTIA || "",
    }));
}

// One row per ICD-10 code that's actually been assigned this year, with
// how many distinct patients carry it — "how many patients have that
// disease", not a raw count of every time it was picked.
export function getIcd10DiagnosisReportRows(year) {
  const byCode = new Map(); // code -> { code, name, patientIds: Set }
  getEncountersForYear(year).forEach((c) => {
    (c.icdDiagnoses || []).forEach((dx) => {
      if (!dx?.code) return;
      const entry = byCode.get(dx.code) || { code: dx.code, name: dx.name || "", patientIds: new Set() };
      if (!entry.name && dx.name) entry.name = dx.name;
      entry.patientIds.add(c.patientId);
      byCode.set(dx.code, entry);
    });
  });
  return Array.from(byCode.values())
    .map((e) => ({ code: e.code, name: e.name, patientCount: e.patientIds.size }))
    .sort((a, b) => b.patientCount - a.patientCount);
}

export function getReportRows(reportType, year) {
  if (reportType === "Diagnosis Report") return getDiagnosisBreakdown(year);
  if (reportType === "ICD-10 Diagnosis Report") return getIcd10DiagnosisReportRows(year);
  if (reportType === "Yakap Report") return getYakapReportRows(year);
  return getEncounterReportRows(year);
}

// --- Generated-report ledger ("Recent Reports" table) ---------------------

export function loadReports() {
  try {
    return JSON.parse(localStorage.getItem(REPORTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveReports(list) {
  localStorage.setItem(REPORTS_KEY, JSON.stringify(list));
}

export function generateReportId() {
  return `RPT-${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
}

export function addReport(report) {
  const list = [report, ...loadReports()];
  saveReports(list);
  return list;
}