import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { hasFeatureAccess } from "../../data/roles";
import {
  ArrowLeft,
  User,
  FileEdit,
  Phone,
  MapPin,
  ShieldCheck,
  Users,
  HeartPulse,
  Activity,
  Siren,
  IdCard,
  ClipboardCheck,
  Camera,
  X,
  FlaskConical,
  Pill,
  Folder,
  FolderOpen,
  Home,
  LayoutGrid,
  List,
  Table2,
  Share2,
  ChevronDown,
  ChevronLeft,
  MoreVertical,
  Plus,
  Copy,
  Pencil,
  FileQuestion,
  Cigarette,
  Armchair,
  Beer,
  Syringe,
  Heart,
} from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import PatientRegistration from "./PatientRegistration";
import PatientEncountersPanel from "../../features/encounters/PatientEncountersPanel";
import PatientRecordPDF from "./PatientRecordPDF";
import ErDischargeForm from "./ErDischargeForm";
import ErDischargePDF from "./ErDischargePDF";
import KonsultaReferralModal from "./KonsultaReferralModal";
import KonsultaReferralPDF from "./KonsultaReferralPDF";
import MedicalCertificateForm from "./MedicalCertificateForm";
import MedicalCertificatePDF from "./MedicalCertificatePDF";
import ConsultationForm, { NURSE_ROLES } from "./ConsultationForm";
import CreateLabOrderModal from "../../features/lab-orders/CreateLabOrderModal";
import ViewMedicinePrescriptionModal from "../../features/medicine-prescriptions/ViewMedicinePrescriptionModal";
import { findEncounterById, updateEncounter, STATUS as ENCOUNTER_STATUS } from "../../utils/encounters";
import { loadLabOrders, formatDateCreated } from "../../utils/labOrders";
import { getOrderStatus, ORDER_STATUS_STYLES } from "../../utils/labOrderDiagnostics";
import {
  loadMedicinePrescriptions,
  STATUS_STYLES as PRESCRIPTION_STATUS_STYLES,
} from "../../utils/medicinePrescriptions";
import {
  loadSharedClinical,
  saveSharedClinical,
  extractSharedFields,
  fillBlanksFromShared,
} from "./sharedClinicalFields";
import { loadPatients, savePatients, savePatientPhoto } from "../../utils/patients";

export function loadEmr(patientId) {
  try {
    const all = JSON.parse(localStorage.getItem("patientEMR") || "{}");
    return all[patientId] || null;
  } catch {
    return null;
  }
}

export function loadDischarge(patientId) {
  try {
    const all = JSON.parse(localStorage.getItem("patientDischarge") || "{}");
    return all[patientId] || null;
  } catch {
    return null;
  }
}

export function loadKonsultaReferral(patientId) {
  try {
    const all = JSON.parse(localStorage.getItem("patientKonsultaReferral") || "{}");
    return all[patientId] || null;
  } catch {
    return null;
  }
}

export function loadMedicalCertificate(patientId) {
  try {
    const all = JSON.parse(localStorage.getItem("patientMedicalCertificate") || "{}");
    return all[patientId] || null;
  } catch {
    return null;
  }
}

function loadConsultation(patientId) {
  try {
    const all = JSON.parse(localStorage.getItem("patientConsultation") || "{}");
    return all[patientId] || null;
  } catch {
    return null;
  }
}

// "DIMAS, ROBETH O." — used to name downloaded files after the patient.
function patientFileLabel(patient) {
  const last = (patient.lastName || "").trim().toUpperCase();
  const first = (patient.firstName || "").trim().toUpperCase();
  const mi = patient.middleName ? `${patient.middleName.trim().charAt(0).toUpperCase()}.` : "";
  const firstPart = [first, mi].filter(Boolean).join(" ");
  return [last, firstPart].filter(Boolean).join(", ") || patient.patientId;
}

function calculateAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// "19 YR(S) 5 MO(S) 11 DAY(S)" — years/months/days breakdown for the
// profile header, rather than just a plain year count.
function formatDetailedAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();

  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  let days = today.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    const daysInPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    days += daysInPrevMonth;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return null;

  return `${years} YR(S) ${months} MO(S) ${days} DAY(S)`;
}

// Seed the EMR / Visit-OPD Record form with what we already know about the
// patient the first time it's opened — just identity, for the read-only
// header. Personal Details / Health Coverage / Emergency Contact now live
// in the Consultation Form. Anything still blank in the Clinical Notes
// fields gets one more pass from the shared clinical store.
function patientToEmrSeed(patient, shared = {}) {
  const seed = {
    lastName: patient.lastName || "",
    firstName: patient.firstName || "",
    middleName: patient.middleName || "",
    dateOfBirth: patient.dateOfBirth || "",
    gender: patient.sex || "",
    chiefComplaints: "",
    objectiveFindings: "",
    physicianImpression: "",
    followUpExamination: "",
  };
  return fillBlanksFromShared(seed, "emr", shared).patched;
}

// Seed the Consultation Form with what we already know about the patient —
// Personal Details / Health Coverage / Emergency Contact were captured once
// in Create Patient, so there's no reason to retype them here. Anything
// still blank afterward gets one more pass from the shared clinical store.
function patientToConsultationSeed(patient, shared = {}) {
  const age = calculateAge(patient.dateOfBirth);
  const seed = {
    lastName: patient.lastName || "",
    firstName: patient.firstName || "",
    middleName: patient.middleName || "",
    dateOfBirth: patient.dateOfBirth || "",
    gender: patient.sex || "",
    age: age !== null ? String(age) : "",
    residentialAddress: patient.address || "",
    email: patient.email || "",
    phoneCell: patient.mobile || "",
    phoneHome: patient.landline || "",
    philhealthPin: "",
    motherName: patient.motherName || "",
    motherContact: patient.motherContact || "",
    fatherName: patient.fatherName || "",
    fatherContact: patient.fatherContact || "",
    nationality: patient.nationality || "",
    religion: patient.religion || "",
    maritalStatus: patient.maritalStatus || "",
    emergencyName: patient.emergencyName || "",
    emergencyRelationship: patient.emergencyRelationship || "",
    emergencyAddress: patient.emergencyAddress || "",
    emergencyPhoneHome: patient.emergencyPhoneHome || "",
    emergencyPhoneCell: patient.emergencyPhoneCell || "",
  };
  return fillBlanksFromShared(seed, "consultation", shared).patched;
}

// Seed the ER Discharge form from the patient's profile and, if it exists,
// their EMR — so the "matched" fields don't need to be retyped. Anything
// still blank after that gets one more pass from the shared clinical store
// (Final Diagnosis, in particular, now comes from the Consultation Form's
// Active Diagnoses via the shared store, since the EMR no longer carries
// that field itself).
function buildDischargeSeed(patient, emr, shared = {}) {
  const fullAddress = [patient.address, patient.barangay, patient.city, patient.province]
    .filter(Boolean)
    .join(", ");
  const age = calculateAge(patient.dateOfBirth);
  const seed = {
    hospitalNo: emr?.hospitalRecordNo || "",
    patientName: [patient.firstName, patient.middleName, patient.lastName, patient.suffix]
      .filter(Boolean)
      .join(" "),
    address: fullAddress,
    age: age !== null ? String(age) : "",
    sex: patient.sex || "",
    dob: patient.dateOfBirth || "",
    dateTimeAttended: emr?.dateOfVisit
      ? `${emr.dateOfVisit}${emr.timeOfVisit ? " " + emr.timeOfVisit : ""}`
      : "",
    nurseOnDuty: emr?.nurseOnDuty || "",
    chiefComplaints: emr?.chiefComplaints || "",
    disposition: emr?.disposition || "",
    followUpExamination: emr?.followUpExamination || "",
    erPhysician: emr?.physician || "",
  };
  return fillBlanksFromShared(seed, "discharge", shared).patched;
}

// Seed the Medical Certificate from the patient's profile and, if it
// exists, their EMR — same "matched fields don't need to be retyped"
// approach as the ER Discharge seed above, plus a shared-clinical-store
// pass for anything still blank (Clinical Diagnosis comes from the
// Consultation Form's Active Diagnoses via the shared store).
function buildMedicalCertificateSeed(patient, emr, shared = {}) {
  const fullAddress = [patient.address, patient.barangay, patient.city, patient.province]
    .filter(Boolean)
    .join(", ");
  const age = calculateAge(patient.dateOfBirth);
  const seed = {
    patientName: [patient.firstName, patient.middleName, patient.lastName, patient.suffix]
      .filter(Boolean)
      .join(" "),
    age: age !== null ? String(age) : "",
    date: new Date().toISOString().slice(0, 10),
    address: fullAddress,
    classification: emr?.classification || "",
    inclusiveDatesOfTreatment: emr?.dateOfVisit || "",
    subjectiveComplaints: emr?.chiefComplaints || "",
    disposition: emr?.disposition || "",
    attendingPhysician: emr?.physician || "",
  };
  return fillBlanksFromShared(seed, "medcert", shared).patched;
}

function Card({ title, icon, children, action }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-teal-700">{icon}</span>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</p>
        </div>
        {action}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm overflow-y-auto">{children}</dl>
    </div>
  );
}

function Row({ label, value, full }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <dt className="text-[11px] text-slate-400 uppercase tracking-wide">{label}</dt>
      <dd className="text-slate-800 font-medium leading-snug wrap-break-word">{value || "—"}</dd>
    </div>
  );
}

// Side panel navigation — "Profile" renders the existing info-card body;
// the rest are placeholders ready for their respective features later.
// `feature` matches the keys in data/roles.js' ROLE_FEATURE_ACCESS so a
// role that can't reach a feature from the dashboard doesn't see (or get
// silently redirected out of) its tab here either. `null` = always visible.
const PROFILE_NAV_ITEMS = [
  { id: "profile", label: "Profile", icon: User, feature: null },
  { id: "registration", label: "Registration", icon: ClipboardCheck, feature: "registration" },
  { id: "lab-orders", label: "Lab Orders", icon: FlaskConical, feature: "labOrders" },
  {
    id: "medicine-prescription",
    label: "Medicine Prescriptions",
    icon: Pill,
    feature: "medicinePrescriptions",
  },
  { id: "patient-files", label: "Patient Files", icon: Folder, feature: null },
];

function ComingSoonPanel({ label, icon }) {
  return (
    <div className="h-full min-h-[240px] bg-white border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-center gap-2 p-8">
      <span className="text-slate-300">{icon}</span>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="text-xs text-slate-400">This section isn't set up yet. Coming soon.</p>
    </div>
  );
}

// Lab Order tab — this patient's own lab order history, same look as the
// main Lab Orders table but scoped to just their orders, plus a "Create
// Lab Order" button that opens the create modal with the patient locked in.
function PatientLabOrdersPanel({ orders, onCreate, onOpenOrder, canCreate }) {
  return (
    <div className="h-full min-h-[240px] flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">Lab Orders</p>
          <p className="text-xs text-slate-400">This patient's lab order history</p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors whitespace-nowrap"
          >
            <Plus size={14} />
            Create Lab Order
          </button>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="flex-1 bg-white border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-center gap-2 p-8">
          <FlaskConical size={28} className="text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">No lab orders yet</p>
          <p className="text-xs text-slate-400">
            Lab orders created for this patient will show up here.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">ID</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Diagnostics</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Status</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Date Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => onOpenOrder(o.id)}
                    className="border-b border-slate-100 hover:bg-teal-50/60 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium text-teal-700 whitespace-nowrap align-top">
                      {o.id}
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <div className="flex flex-wrap gap-1.5 max-w-md">
                        {(o.diagnostics || []).map((d) => (
                          <span
                            key={d}
                            className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 uppercase whitespace-nowrap"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 align-top whitespace-nowrap">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          ORDER_STATUS_STYLES[getOrderStatus(o)]
                        }`}
                      >
                        {getOrderStatus(o)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 align-top whitespace-nowrap text-slate-600">
                      {formatDateCreated(o.dateCreated)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Medicine Prescriptions tab — this patient's own medicine-prescription history,
// same look/columns as the main Medicine Prescriptions table but scoped to
// just their records, plus an "Add Prescription" button that jumps to the
// prescription flow with this patient already selected.
function PatientMedicinePrescriptionsPanel({ records, onCreate, onOpenRecord }) {
  return (
    <div className="h-full min-h-[240px] flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">Medicine Prescriptions</p>
          <p className="text-xs text-slate-400">This patient's prescribed medicine history</p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors whitespace-nowrap"
        >
          <Plus size={14} />
          Add Prescription
        </button>
      </div>

      {records.length === 0 ? (
        <div className="flex-1 bg-white border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-center gap-2 p-8">
          <Pill size={28} className="text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">No prescribed medicines yet</p>
          <p className="text-xs text-slate-400">
            Medicines prescribed to this patient will show up here.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">ID</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Status</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Medicine Count</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Prescribed By</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Date Created</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => onOpenRecord(r)}
                    className="border-b border-slate-100 hover:bg-teal-50/60 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium text-teal-700 whitespace-nowrap align-top">
                      {r.id}
                    </td>
                    <td className="px-4 py-2.5 align-top whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
                          PRESCRIPTION_STATUS_STYLES[r.status] || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 align-top text-center text-slate-700">
                      {r.items?.length || 0}
                    </td>
                    <td className="px-4 py-2.5 align-top whitespace-nowrap text-slate-700">
                      {r.prescribedBy || "—"}
                    </td>
                    <td className="px-4 py-2.5 align-top whitespace-nowrap text-slate-600">
                      {formatDateCreated(r.dateCreated)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Patient Files tab — folder browser matching the reference design.
// Each folder maps to a document type; folders with no form/data yet show
// "0 file(s)" and are ready to be wired up once that form exists.
const VIEW_MODES = [
  { id: "grid", icon: LayoutGrid, label: "Grid view" },
  { id: "list", icon: List, label: "List view" },
  { id: "table", icon: Table2, label: "Table view (coming soon)", disabled: true },
];

function FileFolderCard({ folder, selected, checked, onToggleCheck, onSelect }) {
  return (
    <div
      onClick={() => onSelect(folder.id)}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-3 cursor-pointer border transition-colors ${
        selected ? "bg-teal-50 border-teal-300" : "bg-slate-50/60 border-transparent hover:bg-slate-100"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onClick={(e) => e.stopPropagation()}
        onChange={() => onToggleCheck(folder.id)}
        className="shrink-0 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
      />
      <Folder size={18} className="shrink-0 text-teal-700" />
      <span className="flex-1 min-w-0 truncate text-sm font-medium text-slate-700">{folder.label}</span>
      <span
        className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
          folder.count > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-400"
        }`}
      >
        {folder.count} file(s)
      </span>
      <button
        type="button"
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 text-slate-400 hover:text-slate-600"
        aria-label="More options"
      >
        <MoreVertical size={16} />
      </button>
    </div>
  );
}

function PatientFilesPanel({
  emr,
  discharge,
  konsultaReferral,
  medicalCertificate,
  downloadingPdf,
  downloadingDischargePdf,
  downloadingKonsultaPdf,
  downloadingMedCertPdf,
  onEditEmr,
  onEditDischarge,
  onDownloadEmr,
  onDownloadDischarge,
  onOpenKonsultaReferral,
  onDownloadKonsultaReferral,
  onOpenMedicalCertificate,
  onDownloadMedicalCertificate,
}) {
  const [viewMode, setViewMode] = useState("grid");
  const [checkedIds, setCheckedIds] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const year = new Date().getFullYear();

  const folders = [
    {
      id: "opd-record",
      label: "OPD Record",
      count: emr ? 1 : 0,
      description: "The patient's Outpatient Department / Electronic Medical Record.",
      actions: emr
        ? [
            { label: "View / Edit", onClick: onEditEmr },
            { label: downloadingPdf ? "Preparing…" : "Download PDF", onClick: onDownloadEmr, disabled: downloadingPdf },
          ]
        : [{ label: "Add OPD Record", onClick: onEditEmr }],
    },
    {
      id: "medical-certificate",
      label: "Medical Certificate",
      count: medicalCertificate ? 1 : 0,
      description: "Medical certificate for this patient's diagnosis and treatment.",
      actions: medicalCertificate
        ? [
            { label: "View / Edit", onClick: onOpenMedicalCertificate },
            {
              label: downloadingMedCertPdf ? "Preparing…" : "Download PDF",
              onClick: onDownloadMedicalCertificate,
              disabled: downloadingMedCertPdf,
            },
          ]
        : [{ label: "Add Medical Certificate", onClick: onOpenMedicalCertificate }],
    },
    {
      id: "er-discharge",
      label: "Emergency Room Discharged Instruction Form",
      count: discharge ? 1 : 0,
      description: "Discharge summary and follow-up instructions for this ER visit.",
      actions: discharge
        ? [
            { label: "View / Edit", onClick: onEditDischarge },
            {
              label: downloadingDischargePdf ? "Preparing…" : "Download PDF",
              onClick: onDownloadDischarge,
              disabled: downloadingDischargePdf,
            },
          ]
        : [{ label: "Add Discharge Instructions", onClick: onEditDischarge }],
    },
    {
      id: "konsulta-referral",
      label: "Emergency Care Benefit Referral to Konsulta/Yakap",
      count: konsultaReferral ? 1 : 0,
      description: "Referral form for the Emergency Care Benefit under Konsulta/Yakap.",
      actions: konsultaReferral
        ? [
            { label: "View / Edit", onClick: onOpenKonsultaReferral },
            {
              label: downloadingKonsultaPdf ? "Preparing…" : "Download PDF",
              onClick: onDownloadKonsultaReferral,
              disabled: downloadingKonsultaPdf,
            },
          ]
        : [{ label: "Create Referral", onClick: onOpenKonsultaReferral }],
    },
  ];

  const selectedFolder = folders.find((f) => f.id === selectedId) || null;
  const allChecked = checkedIds.length === folders.length;

  function toggleCheck(id) {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAll() {
    setCheckedIds(allChecked ? [] : folders.map((f) => f.id));
  }

  return (
    <div className="flex flex-col xl:flex-row gap-4 items-start">
      <div className="flex-1 w-full min-w-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Breadcrumb / header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Home size={15} className="text-slate-400" />
            <span>Files</span>
          </div>
          <div className="flex items-center gap-1">
            {VIEW_MODES.map(({ id, icon: Icon, label, disabled }) => (
              <button
                key={id}
                type="button"
                title={label}
                disabled={disabled}
                onClick={() => setViewMode(id)}
                className={`p-1.5 rounded-md border transition-colors ${
                  viewMode === id
                    ? "bg-teal-700 border-teal-700 text-white"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
          <button
            type="button"
            title="Share (coming soon)"
            disabled
            className="p-2 rounded-lg bg-teal-700/40 text-white cursor-not-allowed"
          >
            <Share2 size={14} />
          </button>
          <button
            type="button"
            title="Filter by year (coming soon)"
            disabled
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 opacity-70 cursor-not-allowed"
          >
            {year}
            <ChevronDown size={13} />
          </button>
        </div>

        {/* Select all + folder list/grid */}
        <div className="p-4">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-600"
            />
            Select all
          </label>

          <div className={viewMode === "list" ? "flex flex-col gap-2" : "grid grid-cols-1 sm:grid-cols-2 gap-2"}>
            {folders.map((folder) => (
              <FileFolderCard
                key={folder.id}
                folder={folder}
                selected={selectedId === folder.id}
                checked={checkedIds.includes(folder.id)}
                onToggleCheck={toggleCheck}
                onSelect={setSelectedId}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Details panel */}
      <div className="w-full xl:w-80 shrink-0 bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex flex-col items-center justify-center text-center min-h-[220px]">
        {selectedFolder ? (
          <>
            <FolderOpen size={30} className="text-teal-700 mb-2" />
            <p className="text-sm font-semibold text-slate-800">{selectedFolder.label}</p>
            <p className="text-xs text-slate-400 mt-1">{selectedFolder.description}</p>
            <p className="text-[11px] font-semibold text-slate-500 mt-2">{selectedFolder.count} file(s)</p>

            {selectedFolder.comingSoon ? (
              <p className="mt-4 text-xs text-slate-400 italic">Coming soon.</p>
            ) : (
              <div className="mt-4 w-full space-y-2">
                {selectedFolder.actions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    disabled={action.disabled}
                    onClick={action.onClick}
                    className="w-full rounded-lg bg-teal-700 text-white text-xs font-semibold px-3 py-2 hover:bg-teal-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <Folder size={30} className="text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-500">Select a file or folder to view details.</p>
            <p className="text-xs text-slate-400 mt-1">
              Choose a category from the left pane to start browsing files.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function PatientProfile() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const visibleNavItems = PROFILE_NAV_ITEMS.filter(
    (item) => !item.feature || hasFeatureAccess(user?.role, item.feature)
  );
  const [patient, setPatient] = useState(undefined); // undefined = loading, null = not found
  const [emr, setEmr] = useState(null);
  const [discharge, setDischarge] = useState(null);
  const [konsultaReferral, setKonsultaReferral] = useState(null);
  const [showKonsultaReferral, setShowKonsultaReferral] = useState(false);
  const [medicalCertificate, setMedicalCertificate] = useState(null);
  const [showMedicalCertificate, setShowMedicalCertificate] = useState(false);
  const [consultation, setConsultation] = useState(null);
  const [showConsultation, setShowConsultation] = useState(false);
  const [consultationReturnTo, setConsultationReturnTo] = useState(null);
  const [consultationReadOnly, setConsultationReadOnly] = useState(false);
  const [consultationEncounter, setConsultationEncounter] = useState(null);
  const [sharedClinical, setSharedClinical] = useState({});
  const [showEmr, setShowEmr] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [zoomPhotoOpen, setZoomPhotoOpen] = useState(false);
  const [showDischarge, setShowDischarge] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingDischargePdf, setDownloadingDischargePdf] = useState(false);
  const [downloadingKonsultaPdf, setDownloadingKonsultaPdf] = useState(false);
  const [downloadingMedCertPdf, setDownloadingMedCertPdf] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const fromUrl = searchParams.get("tab");
    const fromState = location.state?.initialTab;
    const requested = fromUrl || fromState;
    const isValid = visibleNavItems.some((item) => item.id === requested);
    return isValid ? requested : "profile";
  });

  // Belt-and-suspenders: if the ?tab= param changes while this page is
  // already mounted (e.g. clicking "Registration Files" for the same
  // patient a second time, or a browser back/forward), react to it instead
  // of only reading it once at mount.
  useEffect(() => {
    const fromUrl = searchParams.get("tab");
    if (fromUrl && visibleNavItems.some((item) => item.id === fromUrl)) {
      setActiveTab(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Arriving here via Registration's "Start Consultation" button — open the
  // Consultation Form directly (it's a modal, so it opens on top of
  // whatever tab is already active). Consumes the navigation state once so
  // a page refresh doesn't reopen it.
  useEffect(() => {
    if (location.state?.openConsultation) {
      setShowConsultation(true);
      setConsultationReadOnly(!!location.state?.consultationReadOnly);
      setConsultationReturnTo(location.state?.returnTo || null);
      const encId = location.state?.consultationEncounterId;
      setConsultationEncounter(encId ? findEncounterById(encId) : null);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [historyTab, setHistoryTab] = useState("past");
  const [copiedField, setCopiedField] = useState("");
  const [labOrders, setLabOrders] = useState([]);
  const [showCreateLabOrder, setShowCreateLabOrder] = useState(false);
  const [medicinePrescriptions, setMedicinePrescriptions] = useState([]);
  const [viewPrescribedRecord, setViewPrescribedRecord] = useState(null);

  function refreshLabOrders(pid) {
    setLabOrders(loadLabOrders().filter((o) => o.patientId === pid));
  }

  function refreshMedicinePrescriptions(pid) {
    setMedicinePrescriptions(loadMedicinePrescriptions().filter((r) => r.patientId === pid));
  }

  useEffect(() => {
    const found = loadPatients().find((p) => p.patientId === patientId) || null;
    setPatient(found);
    setEmr(found ? loadEmr(patientId) : null);
    setDischarge(found ? loadDischarge(patientId) : null);
    setKonsultaReferral(found ? loadKonsultaReferral(patientId) : null);
    setMedicalCertificate(found ? loadMedicalCertificate(patientId) : null);
    setConsultation(found ? loadConsultation(patientId) : null);
    setSharedClinical(found ? loadSharedClinical(patientId) : {});
    setLabOrders(found ? loadLabOrders().filter((o) => o.patientId === patientId) : []);
    setMedicinePrescriptions(found ? loadMedicinePrescriptions().filter((r) => r.patientId === patientId) : []);
  }, [patientId]);

  // "Add Prescription" navigates to the standalone add-prescription page
  // (unlike Lab Orders, which uses an in-page modal) — so pick up any new
  // records when the person returns to this tab/window.
  useEffect(() => {
    function onFocus() {
      refreshMedicinePrescriptions(patientId);
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [patientId]);

  useEffect(() => {
    if (!cameraStream || !videoRef.current) return;

    videoRef.current.srcObject = cameraStream;
    videoRef.current.play().catch((err) => console.error("Error playing camera stream:", err));

    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  // After saving any one of the four clinical forms, pull its shared-concept
  // fields into the shared store, then immediately patch any BLANK fields
  // in the other forms' already-saved records — so filling one form in
  // fills the others in right away, without waiting for someone to reopen
  // them. A field some other form already has a value for is left alone.
  function syncSharedClinical(formKey, formData) {
    const contributed = extractSharedFields(formData, formKey);
    if (Object.keys(contributed).length === 0) return;
    const merged = saveSharedClinical(patientId, contributed);
    setSharedClinical(merged);

    const siblings = [
      ["emr", emr, setEmr, "patientEMR"],
      ["consultation", consultation, setConsultation, "patientConsultation"],
      ["discharge", discharge, setDischarge, "patientDischarge"],
      ["konsulta", konsultaReferral, setKonsultaReferral, "patientKonsultaReferral"],
      ["medcert", medicalCertificate, setMedicalCertificate, "patientMedicalCertificate"],
    ];
    for (const [key, record, setter, storageKey] of siblings) {
      if (key === formKey || !record) continue;
      const { patched, changed } = fillBlanksFromShared(record, key, merged);
      if (!changed) continue;
      let all = {};
      try {
        all = JSON.parse(localStorage.getItem(storageKey) || "{}");
      } catch {
        all = {};
      }
      all[patientId] = patched;
      localStorage.setItem(storageKey, JSON.stringify(all));
      setter(patched);
    }
  }

  function handleSaveEmr(formData) {
    const updatedEmr = { ...formData, updatedAt: new Date().toISOString() };
    let allEmr = {};
    try {
      allEmr = JSON.parse(localStorage.getItem("patientEMR") || "{}");
    } catch {
      allEmr = {};
    }
    allEmr[patientId] = updatedEmr;
    localStorage.setItem("patientEMR", JSON.stringify(allEmr));
    setEmr(updatedEmr);
    syncSharedClinical("emr", formData);
  }

  function handleSaveConsultation(formData) {
    const updated = { ...formData, updatedAt: new Date().toISOString() };
    let all = {};
    try {
      all = JSON.parse(localStorage.getItem("patientConsultation") || "{}");
    } catch {
      all = {};
    }
    all[patientId] = updated;
    localStorage.setItem("patientConsultation", JSON.stringify(all));

    // Personal Details / Health Coverage / Emergency Contact live here now
    // (moved from the EMR) — keep the patient master record's overlapping
    // fields in sync so the rest of the profile updates immediately too.
    const allPatients = loadPatients();
    const idx = allPatients.findIndex((p) => p.patientId === patientId);
    let updatedPatient = patient;
    if (idx !== -1) {
      updatedPatient = {
        ...allPatients[idx],
        firstName: formData.firstName || allPatients[idx].firstName,
        lastName: formData.lastName || allPatients[idx].lastName,
        middleName: formData.middleName,
        dateOfBirth: formData.dateOfBirth || allPatients[idx].dateOfBirth,
        sex: formData.gender || allPatients[idx].sex,
        address: formData.residentialAddress || allPatients[idx].address,
        email: formData.email,
        mobile: formData.phoneCell,
        landline: formData.phoneHome,
        motherName: formData.motherName,
        motherContact: formData.motherContact,
        fatherName: formData.fatherName,
        fatherContact: formData.fatherContact,
        nationality: formData.nationality,
        religion: formData.religion,
        maritalStatus: formData.maritalStatus,
        emergencyName: formData.emergencyName,
        emergencyRelationship: formData.emergencyRelationship,
        emergencyAddress: formData.emergencyAddress,
        emergencyPhoneHome: formData.emergencyPhoneHome,
        emergencyPhoneCell: formData.emergencyPhoneCell,
      };
      allPatients[idx] = updatedPatient;
      savePatients(allPatients);
    }

    setPatient(updatedPatient);
    setConsultation(updated);
    syncSharedClinical("consultation", formData);

    // Registration auto-completion: once both a nurse and a doctor have
    // saved their part of this encounter's Consultation Form, flip its
    // status to Completed. Only applies when the form was opened for a
    // specific registration (via "Start Consultation" from the
    // Registration list/table) — consultationEncounter is null when opened
    // from the general Patient Profile "Add/Update consultation" shortcuts,
    // which aren't tied to any one registration.
    if (consultationEncounter) {
      const isNurse = NURSE_ROLES.includes(user?.role);
      const isDoctor = user?.role === "doctor";

      if (isNurse || isDoctor) {
        const updatedEncounter = updateEncounter(consultationEncounter.id, (e) => {
          const next = { ...e };
          if (isNurse) next.nurseConsultationDone = true;
          if (isDoctor) next.doctorConsultationDone = true;
          if (
            next.nurseConsultationDone &&
            next.doctorConsultationDone &&
            next.status !== ENCOUNTER_STATUS.CANCELLED
          ) {
            next.status = ENCOUNTER_STATUS.COMPLETED;
          }
          return next;
        });
        if (updatedEncounter) setConsultationEncounter(updatedEncounter);
      }
    }
  }

  function handleSaveDischarge(formData) {
    const updated = { ...formData, updatedAt: new Date().toISOString() };
    let all = {};
    try {
      all = JSON.parse(localStorage.getItem("patientDischarge") || "{}");
    } catch {
      all = {};
    }
    all[patientId] = updated;
    localStorage.setItem("patientDischarge", JSON.stringify(all));
    setDischarge(updated);
    syncSharedClinical("discharge", formData);
  }

  function handleSaveKonsultaReferral(formData) {
    const updated = { ...formData, updatedAt: new Date().toISOString() };
    let all = {};
    try {
      all = JSON.parse(localStorage.getItem("patientKonsultaReferral") || "{}");
    } catch {
      all = {};
    }
    all[patientId] = updated;
    localStorage.setItem("patientKonsultaReferral", JSON.stringify(all));
    setKonsultaReferral(updated);
    syncSharedClinical("konsulta", formData);
  }

  function handleSaveMedicalCertificate(formData) {
    const updated = { ...formData, updatedAt: new Date().toISOString() };
    let all = {};
    try {
      all = JSON.parse(localStorage.getItem("patientMedicalCertificate") || "{}");
    } catch {
      all = {};
    }
    all[patientId] = updated;
    localStorage.setItem("patientMedicalCertificate", JSON.stringify(all));
    setMedicalCertificate(updated);
    syncSharedClinical("medcert", formData);
  }

  async function startCamera() {
    setIsCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setCameraStream(stream);
      setIsCameraActive(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please check permissions.");
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
    setIsCameraReady(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  async function capturePhoto() {
    if (!videoRef.current) {
      alert("Video reference not found");
      return;
    }
    if (!isCameraReady) {
      alert("Camera is still warming up. Please wait a moment and try again.");
      return;
    }

    const video = videoRef.current;
    const context = canvasRef.current.getContext("2d");

    if (typeof video.requestVideoFrameCallback === "function") {
      await new Promise((resolve) => video.requestVideoFrameCallback(() => resolve()));
    }

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (width === 0 || height === 0 || video.readyState < 2) {
      alert("Camera is still loading. Please wait a moment and try again.");
      return;
    }

    try {
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      context.drawImage(video, 0, 0, width, height);
      const photoDataUrl = canvasRef.current.toDataURL("image/jpeg", 0.95);

      if (!photoDataUrl || photoDataUrl === "data:,") {
        alert("Failed to capture photo. Please try again.");
        return;
      }

      const updatedPatient = savePatientPhoto(patientId, photoDataUrl);
      if (updatedPatient) {
        setPatient(updatedPatient);
      }
      stopCamera();
    } catch (err) {
      console.error("Error capturing photo:", err);
      alert("Error capturing photo: " + err.message);
    }
  }

  async function startCamera() {
    setIsCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setCameraStream(stream);
      setIsCameraActive(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please check permissions.");
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
    setIsCameraReady(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  async function capturePhoto() {
    if (!videoRef.current) {
      alert("Video reference not found");
      return;
    }
    if (!isCameraReady) {
      alert("Camera is still warming up. Please wait a moment and try again.");
      return;
    }

    const video = videoRef.current;
    const context = canvasRef.current.getContext("2d");

    if (typeof video.requestVideoFrameCallback === "function") {
      await new Promise((resolve) => video.requestVideoFrameCallback(() => resolve()));
    }

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (width === 0 || height === 0 || video.readyState < 2) {
      alert("Camera is still loading. Please wait a moment and try again.");
      return;
    }

    try {
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      context.drawImage(video, 0, 0, width, height);
      const photoDataUrl = canvasRef.current.toDataURL("image/jpeg", 0.95);

      if (!photoDataUrl || photoDataUrl === "data:,") {
        alert("Failed to capture photo. Please try again.");
        return;
      }

      const updatedPatient = savePatientPhoto(patientId, photoDataUrl);
      if (updatedPatient) {
        setPatient(updatedPatient);
      }
      stopCamera();
    } catch (err) {
      console.error("Error capturing photo:", err);
      alert("Error capturing photo: " + err.message);
    }
  }

  async function handleDownloadEmr() {
    if (!emr) return;
    setDownloadingPdf(true);
    try {
      const blob = await pdf(<PatientRecordPDF form={emr} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${patientFileLabel(patient)} EMR.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function handleDownloadDischarge() {
    if (!discharge) return;
    setDownloadingDischargePdf(true);
    try {
      const blob = await pdf(<ErDischargePDF form={discharge} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${patientFileLabel(patient)} ER Discharge Instructions.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingDischargePdf(false);
    }
  }

  async function handleDownloadKonsultaReferral() {
    if (!konsultaReferral) return;
    setDownloadingKonsultaPdf(true);
    try {
      const blob = await pdf(<KonsultaReferralPDF form={konsultaReferral} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${patientFileLabel(patient)} Konsulta-Yakap Referral.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingKonsultaPdf(false);
    }
  }

  async function handleDownloadMedicalCertificate() {
    if (!medicalCertificate) return;
    setDownloadingMedCertPdf(true);
    try {
      const blob = await pdf(<MedicalCertificatePDF form={medicalCertificate} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${patientFileLabel(patient)} Medical Certificate.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingMedCertPdf(false);
    }
  }

  function handleCopy(field, value) {
    if (!value) return;
    navigator.clipboard?.writeText(String(value)).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(""), 1500);
    });
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const photoDataUrl = reader.result;
      if (!photoDataUrl) return;

      const updatedPatient = savePatientPhoto(patientId, photoDataUrl);
      if (updatedPatient) {
        setPatient(updatedPatient);
      }
    };
    reader.readAsDataURL(file);
  }

  // Loading
  if (patient === undefined) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  // Not found — still a standalone page, still only one way out
  if (patient === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center max-w-sm">
          <p className="text-sm font-semibold text-slate-800 mb-1">Patient not found</p>
          <p className="text-xs text-slate-500 mb-4">
            We couldn't find a patient with ID "{patientId}". It may have been removed.
          </p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 text-sm font-medium transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Patients
          </button>
        </div>
      </div>
    );
  }

  const fullName = [patient.firstName, patient.middleName, patient.lastName, patient.suffix]
    .filter(Boolean)
    .join(" ");
  const age = calculateAge(patient.dateOfBirth);
  const detailedAge = formatDetailedAge(patient.dateOfBirth);

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Slim top bar — this page has no dashboard chrome by design */}
      <div className="shrink-0 bg-teal-700 text-white px-4 md:px-6 py-3 flex items-center justify-between shadow">
        <div>
          <p className="text-sm font-semibold leading-tight">E. ZARATE HOSPITAL</p>
          <p className="text-teal-200 text-[11px]">Patient Profile</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold leading-tight">{fullName || "Unnamed Patient"}</p>
          <p className="text-teal-200 text-[11px]">{patient.patientId}</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 p-3 md:p-4">
        <div
          className={`grid grid-cols-1 gap-3 md:gap-4 h-full min-h-0 transition-[grid-template-columns] duration-200 ${
            sidebarCollapsed ? "md:grid-cols-[64px_1fr]" : "md:grid-cols-[260px_1fr]"
          }`}
        >
          {/* Side panel */}
          <div
            className={`bg-teal-800 text-white rounded-xl shadow-sm flex flex-col overflow-hidden transition-all duration-200 ${
              sidebarCollapsed ? "w-16" : ""
            }`}
          >
            <div className="p-4 border-b border-teal-700/60 relative">
              {!sidebarCollapsed && (
                <>
                  <p className="text-sm font-bold uppercase leading-snug pr-6 break-words">
                    {fullName || "Unnamed Patient"}
                  </p>
                  <p className="text-[11px] text-teal-200 mt-1.5">{detailedAge || "—"}</p>
                  <p className="text-[11px] text-teal-200 uppercase">{patient.sex || "—"}</p>
                  <p className="text-[11px] text-teal-200">PIN: {patient.hospitalNo || patient.pin || "—"}</p>
                </>
              )}
              <button
                type="button"
                onClick={() => setSidebarCollapsed((c) => !c)}
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className={`absolute top-4 w-6 h-6 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors ${
                  sidebarCollapsed ? "left-1/2 -translate-x-1/2" : "right-3"
                }`}
              >
                <ChevronLeft
                  size={14}
                  className={`transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`}
                />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {!sidebarCollapsed && (
                <p className="text-[10px] font-bold uppercase tracking-wide text-teal-300 px-3 mb-1.5">
                  Menu
                </p>
              )}
              <nav className="space-y-1">
                {visibleNavItems.map(({ id, label, icon: Icon }) => {
                  const active = activeTab === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActiveTab(id)}
                      title={label}
                      className={`w-full inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                        sidebarCollapsed ? "justify-center" : ""
                      } ${active ? "bg-white text-teal-800 shadow-sm" : "text-teal-100 hover:bg-teal-700/60"}`}
                    >
                      <Icon size={16} />
                      {!sidebarCollapsed && label}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="p-3 border-t border-teal-700/60">
              <button
                type="button"
                onClick={() => navigate(-1)}
                title="Back to Portal"
                className={`w-full inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-teal-100 hover:bg-teal-700/60 transition-colors ${
                  sidebarCollapsed ? "justify-center" : ""
                }`}
              >
                <ArrowLeft size={14} />
                {!sidebarCollapsed && "Back to Portal"}
              </button>
            </div>
          </div>

          {/* Info cards */}
          {activeTab === "profile" ? (
            <div className="flex flex-col gap-3 md:gap-4 overflow-y-auto pr-0.5">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-bold text-slate-800">Profile</h1>
                  <p className="text-xs text-slate-500 mt-0.5">Detailed patient record and clinical summary</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEmr(true)}
                  title="Edit patient record"
                  className="w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-500 hover:text-teal-700 hover:border-teal-300 flex items-center justify-center transition-colors shrink-0"
                >
                  <Pencil size={14} />
                </button>
              </div>

              {/* Info card */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 md:p-5">
                <div className="flex flex-col sm:flex-row gap-5">
                  <div className="flex flex-col items-center text-center shrink-0">
                    <button
                      type="button"
                      onClick={() => patient.photo && setZoomPhotoOpen(true)}
                      className="relative w-20 h-20 rounded-full overflow-hidden border border-slate-200 shadow-sm bg-slate-100 hover:opacity-80 transition-opacity"
                    >
                      {patient.photo ? (
                        <img src={patient.photo} alt={`${fullName} profile`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <User size={28} />
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="mt-2 inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <Camera size={11} />
                      Capture
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="user"
                      className="hidden"
                      onChange={handlePhotoChange}
                    />
                  </div>

                  <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="col-span-2 sm:col-span-2">
                      <p className="text-[11px] text-slate-400 uppercase tracking-wide">Full Name</p>
                      <p className="text-sm font-semibold text-slate-800">{fullName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 uppercase tracking-wide">Age</p>
                      <p className="text-sm font-semibold text-slate-800">{detailedAge || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 uppercase tracking-wide">Hospital No.</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-slate-800 truncate">{patient.pin || "—"}</p>
                        <button
                          type="button"
                          onClick={() => handleCopy("pin", patient.pin)}
                          title="Copy Hospital No."
                          className="text-slate-300 hover:text-teal-700 shrink-0"
                        >
                          <Copy size={12} />
                        </button>
                        {copiedField === "pin" && <span className="text-[10px] text-teal-600">Copied</span>}
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] text-slate-400 uppercase tracking-wide">Sex</p>
                      <p className="text-sm font-semibold text-pink-600">{(patient.sex || "—").toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">Risk Factors</p>
                      <div className="flex items-center gap-1.5">
                        {[
                          {
                            key: "Senior Citizen",
                            icon: Armchair,
                            active: age !== null && age >= 60,
                          },
                          {
                            key: "With History of NCD",
                            icon: HeartPulse,
                            // Any diagnosed non-communicable disease from the Consultation Form's
                            // NCD High-Risk Assessment counts — diabetes, angina/heart attack, or stroke/TIA.
                            active:
                              consultation?.diagnosedDiabetes === "YES" ||
                              consultation?.anginaOrHeartAttack === "YES" ||
                              consultation?.strokeOrTIA === "YES",
                          },
                          {
                            key: "Smoker",
                            icon: Cigarette,
                            // Current or former smoker both count as a smoking-related risk history.
                            active: consultation?.isSmoker === "YES" || consultation?.isSmoker === "USED TO SMOKE",
                          },
                          {
                            key: "Drinker",
                            icon: Beer,
                            active: consultation?.isDrinker === "YES" || consultation?.isDrinker === "USED TO DRINK",
                          },
                          {
                            key: "Illegal Drug User",
                            icon: Syringe,
                            active: consultation?.isDrugUser === "YES",
                          },
                          {
                            key: "Sexually Active",
                            icon: Heart,
                            active: consultation?.isSexuallyActive === "YES",
                          },
                        ].map(({ key, icon: Icon, active }) => (
                          <span
                            key={key}
                            className={active ? "text-red-500" : "text-slate-300"}
                            title={key}
                          >
                            <Icon size={14} />
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 uppercase tracking-wide">PIN</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {patient.hospitalNo || patient.pin || "—"}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleCopy("pin", patient.hospitalNo || patient.pin)}
                          title="Copy PIN"
                          className="text-slate-300 hover:text-teal-700 shrink-0"
                        >
                          <Copy size={12} />
                        </button>
                        {copiedField === "pin" && <span className="text-[10px] text-teal-600">Copied</span>}
                      </div>
                    </div>

                    <div className="col-span-2 sm:col-span-4">
                      <p className="text-[11px] text-slate-400 uppercase tracking-wide">Address</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {[patient.address, patient.barangay, patient.city, patient.region]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {zoomPhotoOpen && patient.photo && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
                  onClick={() => setZoomPhotoOpen(false)}
                >
                  <img
                    src={patient.photo}
                    alt={`${fullName} zoomed profile`}
                    className="max-h-full max-w-full rounded-3xl shadow-2xl border border-white"
                  />
                </div>
              )}

              {/* Full Medical Record */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Full Medical Record</h2>
                  <p className="text-xs text-slate-500">
                    Latest Consultation Date:{" "}
                    <span className="font-semibold text-teal-700">
                      {consultation?.dateOfVisit || emr?.dateOfVisit || "No consultation yet"}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setConsultationReadOnly(false);
                    setConsultationReturnTo(null);
                    setConsultationEncounter(null);
                    setShowConsultation(true);
                  }}
                  title="Add consultation"
                  className="w-9 h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center shadow-sm transition-colors shrink-0"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
                {/* Vital Signs */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-3 flex items-center gap-1.5">
                    <HeartPulse size={14} className="text-teal-700" />
                    Vital Signs
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-[10px] text-slate-400 uppercase">BP</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {emr?.bloodPressure ? `${emr.bloodPressure} mmHg` : "—"}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-[10px] text-slate-400 uppercase">Heart Rate</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {emr?.cardiacRate ? `${emr.cardiacRate} bpm` : "—"}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-[10px] text-slate-400 uppercase">Resp Rate</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {emr?.respiratoryRate ? `${emr.respiratoryRate} rpm` : "—"}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-[10px] text-slate-400 uppercase">Temp</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {emr?.temperature ? `${emr.temperature}°C` : "—"}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-[10px] text-slate-400 uppercase">Vision</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {emr?.leftVision || emr?.rightVision
                          ? `${emr?.leftVision || "—"} / ${emr?.rightVision || "—"}`
                          : "— / —"}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-[10px] text-slate-400 uppercase">Height / Weight / BMI</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {[
                          emr?.height ? `${emr.height} cm` : null,
                          emr?.weight ? `${emr.weight} kg` : null,
                          emr?.bmi || null,
                        ]
                          .filter(Boolean)
                          .join(" / ") || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Medical History tabs — pulled straight from this patient's
                    Consultation Form record (Past/Family Medical History,
                    Surgical History, Immunizations), so filling those in
                    during a consultation shows up here automatically. */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col">
                  <div className="flex items-center gap-4 border-b border-slate-100 mb-3 overflow-x-auto">
                    {[
                      { id: "past", label: "Past Medical History" },
                      { id: "family", label: "Family Medical History" },
                      { id: "surgical", label: "Surgical History" },
                      { id: "immunizations", label: "Immunizations" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setHistoryTab(tab.id)}
                        className={`pb-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                          historyTab === tab.id
                            ? "text-teal-700 border-teal-700"
                            : "text-slate-400 border-transparent hover:text-slate-600"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  {(() => {
                    const emptyCopy = {
                      past: "past medical history",
                      family: "family medical history",
                      surgical: "surgical history",
                      immunizations: "immunizations",
                    }[historyTab];

                    let listItems = null;
                    let detailsText = null;

                    if (historyTab === "past") {
                      listItems = consultation?.pastMedicalHistory || [];
                    } else if (historyTab === "family") {
                      listItems = consultation?.familyMedicalHistory || [];
                    } else if (historyTab === "surgical") {
                      detailsText = consultation?.surgicalHistoryEnabled
                        ? consultation.surgicalHistoryDetails
                        : "";
                    } else if (historyTab === "immunizations") {
                      detailsText = consultation?.immunizationsEnabled
                        ? consultation.immunizationsDetails
                        : "";
                    }

                    const isEmpty = listItems ? listItems.length === 0 : !detailsText?.trim();

                    if (isEmpty) {
                      return (
                        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-6">
                          <FileQuestion size={28} className="text-slate-300" />
                          <p className="text-xs text-slate-400">No {emptyCopy} recorded.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setConsultationReadOnly(false);
                              setConsultationReturnTo(null);
                              setConsultationEncounter(null);
                              setShowConsultation(true);
                            }}
                            className="text-xs font-semibold text-teal-700 hover:text-teal-800"
                          >
                            {consultation ? "Update in Consultation Form" : "Record in Consultation Form"}
                          </button>
                        </div>
                      );
                    }

                    if (listItems) {
                      return (
                        <ul className="divide-y divide-slate-100">
                          {listItems.map((item) => (
                            <li key={item.id} className="py-2 text-sm text-slate-700">
                              {item.text}
                            </li>
                          ))}
                        </ul>
                      );
                    }

                    return (
                      <p className="text-sm text-slate-700 whitespace-pre-wrap py-2">{detailsText}</p>
                    );
                  })()}
                </div>
              </div>

              {/* Additional information */}
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mt-2">
                Additional Information
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4 auto-rows-fr">
              <Card title="Contact" icon={<Phone size={15} />}>
                <Row label="Email" value={patient.email} full />
                <Row label="Landline" value={patient.landline} />
                <Row label="Mobile" value={patient.mobile ? `+63 ${patient.mobile}` : ""} />
              </Card>

              <Card title="Address" icon={<MapPin size={15} />}>
                <Row label="Address" value={patient.address} full />
                <Row label="Barangay" value={patient.barangay} />
                <Row label="City" value={patient.city} />
                <Row label="Province" value={patient.province} />
                <Row label="Region" value={patient.region} full />
              </Card>

              <Card title="Guardian" icon={<ShieldCheck size={15} />}>
                {patient.hasGuardian && patient.guardian ? (
                  <>
                    <Row
                      label="Name"
                      value={[patient.guardian.firstName, patient.guardian.lastName]
                        .filter(Boolean)
                        .join(" ")}
                      full
                    />
                    <Row label="Sex" value={patient.guardian.sex} />
                    <Row label="DOB" value={patient.guardian.dateOfBirth} />
                    <Row label="PIN" value={patient.guardian.pin} />
                    <Row
                      label="Mobile"
                      value={patient.guardian.mobile ? `+63 ${patient.guardian.mobile}` : ""}
                    />
                  </>
                ) : (
                  <p className="col-span-2 text-xs text-slate-400">No guardian on file.</p>
                )}
              </Card>

              <Card title="Family Background" icon={<Users size={15} />}>
                <Row label="Name of Mother" value={patient.motherName} />
                <Row label="Contact No." value={patient.motherContact} />
                <Row label="Name of Father" value={patient.fatherName} />
                <Row label="Contact No." value={patient.fatherContact} />
                <Row label="Nationality" value={patient.nationality} />
                <Row label="Religion" value={patient.religion} />
                <Row label="Marital Status" value={patient.maritalStatus} />
              </Card>

              <Card title="Emergency Contact" icon={<Siren size={15} />}>
                <Row label="Name" value={patient.emergencyName} />
                <Row label="Relationship to Patient" value={patient.emergencyRelationship} />
                <Row label="Address" value={patient.emergencyAddress} full />
                <Row label="Phone (Home)" value={patient.emergencyPhoneHome} />
                <Row label="Phone (Cell)" value={patient.emergencyPhoneCell} />
              </Card>

              {emr ? (
                <>
                  <Card title="Health Coverage" icon={<IdCard size={15} />}>
                    <Row label="PhilHealth Member" value={emr.philhealthMember} />
                    <Row label="PhilHealth PIN" value={emr.philhealthPin} />
                    <Row label="HMO" value={emr.hmo} />
                    <Row label="HMO Type / Cert." value={[emr.hmoType, emr.certNo].filter(Boolean).join(" / ")} />
                  </Card>

                  <Card title="Emergency Contact" icon={<Siren size={15} />}>
                    <Row label="Name" value={emr.emergencyName} />
                    <Row label="Relationship" value={emr.emergencyRelationship} />
                    <Row
                      label="Phone"
                      value={[emr.emergencyPhoneHome, emr.emergencyPhoneCell].filter(Boolean).join(" / ")}
                      full
                    />
                  </Card>
                </>
              ) : (
                <div className="bg-white border border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 sm:col-span-2 xl:col-span-1">
                  <FileEdit size={20} className="text-slate-300" />
                  <p className="text-xs font-medium text-slate-500">No EMR on file yet</p>
                  <button
                    type="button"
                    onClick={() => setShowEmr(true)}
                    className="text-xs font-semibold text-teal-700 hover:text-teal-800"
                  >
                    Add EMR details
                  </button>
                </div>
              )}
              </div>
            </div>
          ) : activeTab === "patient-files" ? (
            <div className="h-full min-h-0 overflow-y-auto pr-0.5">
              <PatientFilesPanel
                emr={emr}
                discharge={discharge}
                konsultaReferral={konsultaReferral}
                medicalCertificate={medicalCertificate}
                downloadingPdf={downloadingPdf}
                downloadingDischargePdf={downloadingDischargePdf}
                downloadingKonsultaPdf={downloadingKonsultaPdf}
                downloadingMedCertPdf={downloadingMedCertPdf}
                onEditEmr={() => setShowEmr(true)}
                onEditDischarge={() => setShowDischarge(true)}
                onDownloadEmr={handleDownloadEmr}
                onDownloadDischarge={handleDownloadDischarge}
                onOpenKonsultaReferral={() => setShowKonsultaReferral(true)}
                onDownloadKonsultaReferral={handleDownloadKonsultaReferral}
                onOpenMedicalCertificate={() => setShowMedicalCertificate(true)}
                onDownloadMedicalCertificate={handleDownloadMedicalCertificate}
              />
            </div>
          ) : activeTab === "registration" ? (
            <div className="h-full min-h-0 overflow-y-auto pr-0.5">
              <PatientEncountersPanel
                patientId={patientId}
                onOpenPatientFiles={() => setActiveTab("patient-files")}
              />
            </div>
          ) : activeTab === "lab-orders" ? (
            <div className="h-full min-h-0 overflow-y-auto pr-0.5">
              <PatientLabOrdersPanel
                orders={labOrders}
                onCreate={() => setShowCreateLabOrder(true)}
                onOpenOrder={(orderId) => navigate(`/lab-orders/${orderId}`)}
                canCreate={!["med_tech", "xray_tech"].includes(user?.role)}
              />
            </div>
          ) : activeTab === "medicine-prescription" ? (
            <div className="h-full min-h-0 overflow-y-auto pr-0.5">
              <PatientMedicinePrescriptionsPanel
                records={medicinePrescriptions}
                onCreate={() =>
                  navigate("/medicine-prescriptions/create", { state: { presetPatientId: patientId } })
                }
                onOpenRecord={(record) => setViewPrescribedRecord(record)}
              />
            </div>
          ) : (
            <div className="h-full min-h-0 overflow-y-auto pr-0.5">
              {(() => {
                const navItem = PROFILE_NAV_ITEMS.find((item) => item.id === activeTab);
                const Icon = navItem?.icon ?? Folder;
                return <ComingSoonPanel label={navItem?.label ?? ""} icon={<Icon size={28} />} />;
              })()}
            </div>
          )}
        </div>
      </div>

      {/* EMR editor — same PatientRegistration form, pre-filled, save overwrites */}
      {showEmr && (
        <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto">
          <PatientRegistration
            embedded
            mode="edit"
            initialValues={emr || patientToEmrSeed(patient, sharedClinical)}
            onSave={handleSaveEmr}
            onClose={() => setShowEmr(false)}
          />
        </div>
      )}

      {/* Consultation Form (Encounter) — Patient Information through Consent,
          plus history-taking and NCD risk assessment. Save overwrites. */}
      {showConsultation && (
        <ConsultationForm
          initialValues={consultation || patientToConsultationSeed(patient, sharedClinical)}
          readOnly={consultationReadOnly}
          onSave={handleSaveConsultation}
          onClose={() => {
            setShowConsultation(false);
            if (consultationReturnTo) {
              navigate(consultationReturnTo);
            }
          }}
          patient={patient}
          encounter={consultationEncounter}
        />
      )}

      {/* Create Lab Order — same modal the main Lab Orders page uses, but
          with the patient locked in since we're already on their profile. */}
      {showCreateLabOrder && (
        <CreateLabOrderModal
          presetPatientId={patientId}
          onClose={() => setShowCreateLabOrder(false)}
          onCreated={() => {
            setShowCreateLabOrder(false);
            refreshLabOrders(patientId);
          }}
        />
      )}

      {/* View Medicine Prescription — same modal the main Medicine Prescriptions
          page uses, opened from a row in this patient's history. */}
      {viewPrescribedRecord && (
        <ViewMedicinePrescriptionModal
          record={viewPrescribedRecord}
          onClose={() => setViewPrescribedRecord(null)}
        />
      )}

      {/* ER Discharge Instructions editor — pre-filled from patient + EMR, save overwrites */}
      {showDischarge && (
        <ErDischargeForm
          initialValues={discharge || buildDischargeSeed(patient, emr, sharedClinical)}
          onSave={handleSaveDischarge}
          onClose={() => setShowDischarge(false)}
        />
      )}

      {/* Emergency Care Benefit Referral to Konsulta/Yakap — Save Changes here; PDF download lives in the folder panel */}
      {showKonsultaReferral && (
        <KonsultaReferralModal
          patient={patient}
          emr={emr}
          shared={sharedClinical}
          initialValues={konsultaReferral || undefined}
          onSave={handleSaveKonsultaReferral}
          onClose={() => setShowKonsultaReferral(false)}
        />
      )}

      {/* Medical Certificate editor — pre-filled from patient + EMR, save overwrites */}
      {showMedicalCertificate && (
        <MedicalCertificateForm
          initialValues={medicalCertificate || buildMedicalCertificateSeed(patient, emr, sharedClinical)}
          onSave={handleSaveMedicalCertificate}
          onClose={() => setShowMedicalCertificate(false)}
        />
      )}

      {/* Camera modal for live photo capture */}
      {isCameraActive && (
        <div className="fixed inset-0 z-50 bg-slate-900 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full overflow-hidden">
            <div className="bg-teal-700 text-white px-4 py-3 flex items-center justify-between">
              <p className="font-semibold">Take Photo</p>
              <button
                type="button"
                onClick={stopCamera}
                className="text-white hover:opacity-80 transition-opacity"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 flex flex-col items-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => {
                  setIsCameraReady(true);
                  if (videoRef.current) {
                    videoRef.current.play().catch((err) => console.error("Error playing video:", err));
                  }
                }}
                width={400}
                height={400}
                style={{
                  display: "block",
                  backgroundColor: "#000",
                  borderRadius: "0.5rem",
                  width: "100%",
                  height: "auto",
                }}
              />

              <div className="mt-4 flex gap-2 w-full">
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={!isCameraReady}
                  className="flex-1 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-lg font-medium transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Camera size={16} />
                  {isCameraReady ? "Capture Photo" : "Preparing…"}
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="flex-1 border border-slate-300 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden canvas for capturing photos */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}