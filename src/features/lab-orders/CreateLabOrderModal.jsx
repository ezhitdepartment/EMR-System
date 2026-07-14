import { useMemo, useState } from "react";
import { X, FlaskConical } from "lucide-react";
import SearchableSelect from "../../components/common/SearchableSelect";
import DiagnosticTestChecklist from "../../components/common/DiagnosticTestChecklist";
import {
  generateLabOrderId,
  loadLabOrders,
  saveLabOrders,
} from "../../utils/labOrders";
import { emptyTestRecord, generateDiagnosticCode } from "../../utils/labOrderDiagnostics";

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

export default function CreateLabOrderModal({ onClose, onCreated, presetPatientId = null }) {
  const patients = useMemo(loadPatients, []);
  const [patientId, setPatientId] = useState(presetPatientId || "");
  const [diagnostics, setDiagnostics] = useState([]);
  const [testDetails, setTestDetails] = useState({});
  const [error, setError] = useState("");

  const selectedPatient = patients.find((p) => p.patientId === patientId) || null;
  const patientLocked = Boolean(presetPatientId);

  function toggleDiagnostic(name) {
    setDiagnostics((prev) =>
      prev.includes(name) ? prev.filter((d) => d !== name) : [...prev, name]
    );
  }

  function setTestDetail(name, value) {
    setTestDetails((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!patientId) {
      setError("Please select a patient.");
      return;
    }
    if (diagnostics.length === 0) {
      setError("Please select at least one diagnostic test.");
      return;
    }

    const existing = loadLabOrders();
    const order = {
      id: generateLabOrderId(existing),
      patientId,
      patient: {
        firstName: selectedPatient?.firstName || "",
        lastName: selectedPatient?.lastName || "",
        middleName: selectedPatient?.middleName || "",
        sex: selectedPatient?.sex || "",
        dateOfBirth: selectedPatient?.dateOfBirth || "",
      },
      diagnostics,
      testDetails,
      dateCreated: new Date().toISOString(),
    };

    // Create every diagnostic's test record right now instead of waiting
    // for ViewLabOrderPage to lazily create it on first open — otherwise a
    // brand-new pending order is invisible to the queue (and to anything
    // else that reads order.tests) until someone happens to click into it.
    const tests = {};
    diagnostics.forEach((name) => {
      tests[name] = emptyTestRecord(generateDiagnosticCode(existing, name));
    });
    order.tests = tests;

    saveLabOrders([order, ...existing]);
    onCreated(order);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-50 text-teal-700">
              <FlaskConical size={16} />
            </span>
            <h2 className="text-base font-semibold text-slate-800">Create Lab Order</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-4">
          {/* Patient */}
          <label className="block">
            <span className="block text-xs font-medium text-slate-500 mb-1">
              Patient <span className="text-red-500">*</span>
            </span>
            {patientLocked ? (
              <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {selectedPatient ? patientLabel(selectedPatient) : patientId}
              </div>
            ) : (
              <SearchableSelect
                value={patientId}
                onChange={setPatientId}
                options={patients}
                getValue={(p) => p.patientId}
                getLabel={patientLabel}
                placeholder={
                  patients.length === 0 ? "No patients yet — create one first" : "Select patient"
                }
                disabled={patients.length === 0}
                inputClass="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
              />
            )}
          </label>

          {/* Diagnostics */}
          <div>
            <span className="block text-xs font-medium text-slate-500 mb-1">
              Diagnostics <span className="text-red-500">*</span>
              {diagnostics.length > 0 && (
                <span className="ml-1 font-normal text-slate-400">
                  ({diagnostics.length} selected)
                </span>
              )}
            </span>

            <DiagnosticTestChecklist
              selected={diagnostics}
              onToggle={toggleDiagnostic}
              testDetails={testDetails}
              onDetailChange={setTestDetail}
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-teal-700 hover:bg-teal-800 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors"
            >
              Create Lab Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}