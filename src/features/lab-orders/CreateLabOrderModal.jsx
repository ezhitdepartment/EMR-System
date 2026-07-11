import { useMemo, useState } from "react";
import { X, FlaskConical, Search } from "lucide-react";
import SearchableSelect from "../../components/common/SearchableSelect";
import {
  LAB_ORDER_CATALOG,
  TESTS_WITH_DETAIL,
  generateLabOrderId,
  loadLabOrders,
  saveLabOrders,
} from "../../utils/labOrders";

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
  const [diagnosticQuery, setDiagnosticQuery] = useState("");
  const [error, setError] = useState("");

  const selectedPatient = patients.find((p) => p.patientId === patientId) || null;
  const patientLocked = Boolean(presetPatientId);

  // Same grouping as the paper forms (form type -> category -> tests),
  // with the search query narrowing which tests/categories/forms show.
  const filteredCatalog = useMemo(() => {
    const q = diagnosticQuery.trim().toLowerCase();
    if (!q) return LAB_ORDER_CATALOG;
    return LAB_ORDER_CATALOG.map((form) => ({
      ...form,
      categories: form.categories
        .map((cat) => ({ ...cat, tests: cat.tests.filter((t) => t.toLowerCase().includes(q)) }))
        .filter((cat) => cat.tests.length > 0),
    })).filter((form) => form.categories.length > 0);
  }, [diagnosticQuery]);

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

            <div className="relative mb-2">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={diagnosticQuery}
                onChange={(e) => setDiagnosticQuery(e.target.value)}
                placeholder="Search diagnostic tests…"
                className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
              />
            </div>

            <div className="rounded-lg border border-slate-200 p-3 max-h-72 overflow-y-auto space-y-4">
              {filteredCatalog.length === 0 ? (
                <p className="py-2 text-center text-xs text-slate-400">
                  No diagnostic tests match "{diagnosticQuery}"
                </p>
              ) : (
                filteredCatalog.map((form) => (
                  <div key={form.formType}>
                    <p className="text-xs font-bold uppercase tracking-wide text-teal-700 mb-2">
                      {form.formType}
                    </p>
                    <div className="space-y-3">
                      {form.categories.map((cat) => (
                        <div key={cat.category}>
                          {form.categories.length > 1 && (
                            <p className="text-[11px] font-semibold text-slate-500 mb-1">{cat.category}</p>
                          )}
                          <div className="grid grid-cols-2 gap-1.5">
                            {cat.tests.map((name) => (
                              <div key={name} className={TESTS_WITH_DETAIL.has(name) ? "col-span-2" : ""}>
                                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={diagnostics.includes(name)}
                                    onChange={() => toggleDiagnostic(name)}
                                    className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                                  />
                                  {name}
                                </label>
                                {TESTS_WITH_DETAIL.has(name) && diagnostics.includes(name) && (
                                  <input
                                    type="text"
                                    value={testDetails[name] || ""}
                                    onChange={(e) => setTestDetail(name, e.target.value)}
                                    placeholder={name.startsWith("Others") ? "Please specify…" : "Indicate type/site…"}
                                    className="mt-1 ml-6 w-[calc(100%-1.5rem)] rounded-md border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-600"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
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