import { useMemo, useState } from "react";
import { X, CalendarPlus } from "lucide-react";
import SearchableSelect from "../../components/common/SearchableSelect";
import { useAuth } from "../../context/AuthContext";
import {
  CONSULTATION_TYPE_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
  DOCTORS,
  STATUS,
  generateEncounterId,
  loadEncounters,
  saveEncounters,
} from "../../utils/encounters";

function loadPatients() {
  try {
    const raw = JSON.parse(localStorage.getItem("patients") || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function patientLabel(p) {
  const name = [p.lastName, p.firstName].filter(Boolean).join(", ");
  const idLine = p.hospitalNo || p.pin || p.patientId || "";
  return idLine ? `${name} — ${idLine}` : name || p.patientId;
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600";

export default function CreateEncounterModal({ onClose, onCreated, presetPatientId = null }) {
  const { user } = useAuth();
  const patients = useMemo(loadPatients, []);
  const [patientId, setPatientId] = useState(presetPatientId || "");
  const [doctor, setDoctor] = useState("");
  const [consultationType, setConsultationType] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");

  const selectedPatient = patients.find((p) => p.patientId === patientId) || null;
  const patientLocked = Boolean(presetPatientId);

  function handleSubmit(e) {
    e.preventDefault();
    if (!patientId) {
      setError("Please select a patient.");
      return;
    }
    if (!doctor) {
      setError("Please select a doctor.");
      return;
    }
    if (!consultationType || !paymentType) {
      setError("Please fill in the consultation and payment type.");
      return;
    }

    const existing = loadEncounters();
    const encounter = {
      id: generateEncounterId(existing),
      patientId,
      patient: {
        firstName: selectedPatient?.firstName || "",
        lastName: selectedPatient?.lastName || "",
        middleName: selectedPatient?.middleName || "",
        sex: selectedPatient?.sex || "",
        dateOfBirth: selectedPatient?.dateOfBirth || "",
      },
      appointmentDate,
      doctor,
      paymentType,
      consultationType,
      createdBy: user?.username || "—",
      status: STATUS.PENDING,
      migratedStatus: "Not Migrated",
      pcuStatus: "N/A",
      triage: null,
      waiver: null,
      dateCreated: new Date().toISOString(),
    };

    saveEncounters([encounter, ...existing]);
    onCreated(encounter);
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <CalendarPlus size={18} className="text-teal-700" />
            <h2 className="text-sm font-semibold text-slate-800">Create Registration</h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1 block">
              Patient
            </label>
            <SearchableSelect
              value={patientId}
              onChange={setPatientId}
              options={patients}
              getValue={(p) => p.patientId}
              getLabel={patientLabel}
              placeholder="Select a patient"
              disabled={patientLocked}
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1 block">
              Doctor
            </label>
            <SearchableSelect
              value={doctor}
              onChange={setDoctor}
              options={DOCTORS}
              getValue={(d) => d}
              getLabel={(d) => d}
              placeholder="Select a doctor"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1 block">
                Appointment Date
              </label>
              <input
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1 block">
                Payment Type
              </label>
              <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className={inputClass} required>
                <option value="">Select</option>
                {PAYMENT_TYPE_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1 block">
              Consultation Type
            </label>
            <select
              value={consultationType}
              onChange={(e) => setConsultationType(e.target.value)}
              className={inputClass}
              required
            >
              <option value="">Select</option>
              {CONSULTATION_TYPE_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium shadow-sm transition-colors"
            >
              Create Registration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}