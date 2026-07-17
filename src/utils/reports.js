// Reports — now pulls from real Supabase data (patients + the full
// consultation history) instead of localStorage, via fetchReportSourceData()
// below. Same rationale as utils/patients.js, utils/encounters.js, and
// utils/consultations.js: the "Reports" feature never actually connected to
// real data before, so every report on this page has always been empty in
// practice, no matter how many patients/consultations existed.
//
// Design carried over unchanged from before:
//   - "Encounter Report" reflects each saved consultation record, one row
//     per save (not per registration) — that's the data available; a
//     patient with 3 consultation saves this year shows up 3 times.
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
//
// One thing that DID change along with the data source: consultation
// entries were previously (mis)matched by c.updatedAt, a field consultation
// saves never actually set (that's an EMR/Discharge/Konsulta/MedCert-only
// field) — so every date-filtered report silently returned zero rows
// before, regardless of how much real data existed. This version matches
// on c.createdAt, which every consultation row actually has.

import { supabase } from "../lib/supabaseClient";
import { loadPatients } from "./patients";
import { loadAllConsultations } from "./consultations";

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

// Fetches both source datasets once. Call this on mount and whenever the
// person hits Refresh, then pass the result into every function below
// instead of each one re-querying Supabase on its own — same reasoning as
// Encounters.jsx loading encounters/prescriptions once per refresh() and
// filtering/sorting them client-side from there.
export async function fetchReportSourceData() {
  const [patients, consultations] = await Promise.all([loadPatients(), loadAllConsultations()]);
  return { patients, consultations };
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

export function getAvailableYears({ patients, consultations }) {
  const years = new Set([new Date().getFullYear()]);
  consultations.forEach((c) => {
    const y = yearOf(c.createdAt);
    if (y) years.add(y);
  });
  patients.forEach((p) => {
    const y = yearOf(p.createdAt);
    if (y) years.add(y);
  });
  return Array.from(years).sort((a, b) => b - a);
}

function getEncountersForYear(consultations, year) {
  return consultations.filter((c) => yearOf(c.createdAt) === Number(year));
}

// Patients CREATED per month/year — distinct from encounters. A patient is
// only created once (via CreatePatientModal), so unlike consultations this
// reflects real, non-overwritten history — every patient ever registered
// shows up here, keyed by their record's createdAt.
export function getMonthlyPatientCounts(patients, year) {
  const counts = Array(12).fill(0);
  patients.forEach((p) => {
    if (yearOf(p.createdAt) === Number(year)) {
      const m = monthOf(p.createdAt);
      if (m !== null) counts[m] += 1;
    }
  });
  return MONTH_LABELS.map((label, i) => ({ label, value: counts[i] }));
}

export function getYearlyPatientCounts(patients) {
  const counts = {};
  patients.forEach((p) => {
    const y = yearOf(p.createdAt);
    if (y) counts[y] = (counts[y] || 0) + 1;
  });
  const years = Object.keys(counts).map(Number).sort((a, b) => a - b);
  return years.map((year) => ({ label: String(year), value: counts[year] }));
}

export function getDiagnosisBreakdown(consultations, year) {
  const counts = new Map();
  getEncountersForYear(consultations, year).forEach((c) => {
    parseDiagnoses(c.activeDiagnoses).forEach((dx) => {
      const key = dx.toLowerCase();
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { label: dx, count: 1 });
    });
  });
  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

export function getEncounterReportRows(consultations, year) {
  return getEncountersForYear(consultations, year).map((c) => ({
    patientId: c.patientId,
    patientName: patientName(c.patient, c.patientId),
    date: c.createdAt ? c.createdAt.slice(0, 10) : "",
    chiefComplaint: c.chiefComplaint || "",
    diagnosis: c.activeDiagnoses || "",
  }));
}

export function getYakapReportRows(consultations, year) {
  return getEncountersForYear(consultations, year)
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
      date: c.createdAt ? c.createdAt.slice(0, 10) : "",
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
export function getIcd10DiagnosisReportRows(consultations, year) {
  const byCode = new Map(); // code -> { code, name, patientIds: Set }
  getEncountersForYear(consultations, year).forEach((c) => {
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

export function getReportRows(reportType, year, { consultations }) {
  if (reportType === "Diagnosis Report") return getDiagnosisBreakdown(consultations, year);
  if (reportType === "ICD-10 Diagnosis Report") return getIcd10DiagnosisReportRows(consultations, year);
  if (reportType === "Yakap Report") return getYakapReportRows(consultations, year);
  return getEncounterReportRows(consultations, year);
}

// --- Generated-report ledger ("Recent Reports" table) ----------------------
// Backed by the `generated_reports` table (see reports-addendum.sql for the
// extra columns this needs — generated_by_name/row_count/status — on top
// of what the original schema already had).

function rowToReport(row) {
  if (!row) return null;
  return {
    id: row.id,
    reportType: row.report_type,
    year: row.year,
    generatedAt: row.generated_at,
    generatedBy: row.generated_by_name || "Unknown",
    status: row.status || "Completed",
    rowCount: row.row_count || 0,
  };
}

export async function loadReports() {
  const { data, error } = await supabase
    .from("generated_reports")
    .select("*")
    .order("generated_at", { ascending: false });
  if (error) {
    console.error("loadReports failed:", error.message);
    return [];
  }
  return (data || []).map(rowToReport);
}

export function generateReportId() {
  return `RPT-${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
}

// `report` is shaped exactly like Reports.jsx's handleGenerate already
// builds it (reportType, year, generatedBy, rowCount, status). generatedBy
// is the display name to denormalize onto the row; generatedById (the
// signed-in user's profile id) is separate so getUserActivityStats-style
// per-user stats elsewhere can still filter on it.
export async function addReport(report, generatedById = null) {
  const { data, error } = await supabase
    .from("generated_reports")
    .insert({
      id: report.id,
      report_type: report.reportType,
      year: Number(report.year),
      generated_by: generatedById,
      generated_by_name: report.generatedBy || null,
      row_count: report.rowCount || 0,
      status: report.status || "Completed",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToReport(data);
}