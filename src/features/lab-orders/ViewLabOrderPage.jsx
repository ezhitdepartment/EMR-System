import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  XCircle,
  FlaskConical,
  Save,
  Upload,
  FileText,
  Eye,
  X,
  Check,
  CreditCard,
} from "lucide-react";
import {
  findLabOrderById,
  updateLabOrder,
  updatePaymentStatus,
  formatDateCreated,
  FORM_TYPE_BY_TEST,
  uploadLabOrderTestFile,
  deleteLabOrderTestFile,
  getLabOrderFileUrl,
} from "../../utils/labOrders";
import { ROLE_QUEUE_TYPES } from "../../utils/labQueue";
import { useAuth } from "../../context/AuthContext";
import { formatAge } from "../../utils/age";
import {
  getResultSchema,
  generateDiagnosticCode,
  emptyTestRecord,
  TEST_STATUS_OPTIONS,
  IS_REFERRED_OPTIONS,
  getOrderStatus,
  ORDER_STATUS_STYLES,
} from "../../utils/labOrderDiagnostics";

// Nurses can create orders and see results, but not edit them. Techs can
// edit results, but only for tests that belong to their own specialty
// (Laboratory for med_tech; X-Ray/Ultrasound & Imaging for xray_tech) — not
// create orders. Cashier is billing-only: never edits results, only ever
// touches payment status. Doctors and admins keep full access, same as
// before.
const NURSE_ROLES = ["er_nurse", "opd_nurse"];
const TECH_ROLES = ["med_tech", "xray_tech"];
const VIEW_ONLY_RESULTS_ROLES = [...NURSE_ROLES, "cashier"];

// "1957-03-31" -> "03/31/1957" (matches the reference screen's Date of Birth column).
function formatDob(dob) {
  if (!dob) return "—";
  const dt = new Date(dob);
  if (Number.isNaN(dt.getTime())) return "—";
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  const y = dt.getFullYear();
  return `${m}/${d}/${y}`;
}

// Makes sure every diagnostic on the order has a per-test record (code +
// blank Laboratory Details/Results/Files) before the page renders. Only
// writes anything if something was actually missing.
async function ensureTestRecords(order) {
  const diagnostics = order.diagnostics || [];
  const tests = { ...(order.tests || {}) };
  let changed = false;

  for (const name of diagnostics) {
    if (!tests[name]) {
      tests[name] = emptyTestRecord(await generateDiagnosticCode(name));
      changed = true;
    }
  }

  return changed ? { ...order, tests } : order;
}

function CollapsibleSection({ title, badge, open, onToggle, headerRight, children }) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-indigo-100 text-indigo-900"
      >
        <span className="flex items-center gap-2 text-xs font-bold tracking-wide uppercase">
          {title}
          {badge}
        </span>
        <span className="flex items-center gap-2">
          {headerRight}
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

function Field({ field, value, onChange }) {
  const isTextarea = field.type === "textarea";
  const isText = field.type === "text";
  return (
    <label className={`block ${isTextarea ? "col-span-full" : ""}`}>
      <span className="block text-xs font-medium text-slate-500 mb-1">{field.label}</span>
      {isTextarea ? (
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
        />
      ) : (
        <input
          type={isText ? "text" : "number"}
          step="any"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
        />
      )}
    </label>
  );
}

export default function ViewLabOrderPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [order, setOrder] = useState(undefined); // undefined = loading, null = not found
  const [selectedDiagnostic, setSelectedDiagnostic] = useState("");
  const [draft, setDraft] = useState(null);
  const [savedTick, setSavedTick] = useState(false);
  const [filesBusy, setFilesBusy] = useState(false);
  const [busyPayment, setBusyPayment] = useState(false);

  const [summaryOpen, setSummaryOpen] = useState(true);
  const [labDetailsOpen, setLabDetailsOpen] = useState(true);
  const [resultsOpen, setResultsOpen] = useState(true);
  const [filesOpen, setFilesOpen] = useState(true);

  // Load the order and backfill any missing per-test records.
  useEffect(() => {
    async function load() {
      const found = await findLabOrderById(orderId);
      if (!found) {
        setOrder(null);
        return;
      }
      const withTests = await ensureTestRecords(found);
      if (withTests !== found) {
        setOrder(await updateLabOrder(orderId, () => withTests));
      } else {
        setOrder(found);
      }
    }
    load();
  }, [orderId]);

  // Default to the first diagnostic once the order is loaded — for a tech,
  // the first one *they're* actually responsible for, not just position 0
  // (which might be the other specialty's test on a mixed order).
  useEffect(() => {
    if (order && !selectedDiagnostic && order.diagnostics?.length) {
      const myTypes = TECH_ROLES.includes(user?.role) ? ROLE_QUEUE_TYPES[user.role] || [] : null;
      const mine = myTypes ? order.diagnostics.filter((d) => myTypes.includes(FORM_TYPE_BY_TEST[d])) : null;
      setSelectedDiagnostic((mine && mine[0]) || order.diagnostics[0]);
    }
  }, [order, selectedDiagnostic]);

  const currentTest = order?.tests?.[selectedDiagnostic] || null;

  // Reset the editable draft whenever the selected test changes.
  useEffect(() => {
    setDraft(currentTest ? { ...currentTest, results: { ...(currentTest.results || {}) } } : null);
  }, [selectedDiagnostic, order?.id]);

  const schema = useMemo(
    () => (selectedDiagnostic ? getResultSchema(selectedDiagnostic) : null),
    [selectedDiagnostic]
  );

  // Nurses/Cashier: view-only, full stop. Techs: can only edit tests that
  // belong to their own specialty (e.g. an X-ray Tech can see a CBC on a
  // mixed order but can't touch it — that's the Med Tech's queue).
  // Everyone else (doctor, admin) keeps unrestricted access, same as
  // before this change.
  const testFormType = selectedDiagnostic ? FORM_TYPE_BY_TEST[selectedDiagnostic] : null;
  const isNurse = NURSE_ROLES.includes(user?.role);
  const isCashier = user?.role === "cashier";
  const isTech = TECH_ROLES.includes(user?.role);
  const canEditResults = VIEW_ONLY_RESULTS_ROLES.includes(user?.role)
    ? false
    : isTech
    ? (ROLE_QUEUE_TYPES[user.role] || []).includes(testFormType)
    : true;
  const readOnlyReason = isCashier
    ? "Cashier accounts can only update payment status here — lab results are view-only."
    : isNurse
    ? "Your role has view-only access to lab results."
    : isTech && !canEditResults
    ? "This test belongs to a different specialty — only the assigned tech can edit it."
    : null;

  // Only Cashier/Admin can change payment status — matches
  // current_user_can_manage_billing() in the SQL, which is what actually
  // enforces this.
  const canManageBilling = ["admin", "cashier"].includes(user?.role);

  async function handleTogglePayment() {
    if (!canManageBilling || busyPayment || !order) return;
    const nextStatus = order.paymentStatus === "paid" ? "unpaid" : "paid";
    setBusyPayment(true);
    try {
      const updated = await updatePaymentStatus(order.id, nextStatus);
      if (updated) setOrder(updated);
    } catch (err) {
      window.alert(err.message || "Couldn't update payment status.");
    } finally {
      setBusyPayment(false);
    }
  }

  async function persistCurrentTest(nextTestRecord) {
    const updated = await updateLabOrder(orderId, (o) => ({
      ...o,
      tests: { ...o.tests, [selectedDiagnostic]: nextTestRecord },
    }));
    if (updated) setOrder(updated);
    return updated;
  }

  async function handleSaveResults() {
    if (!draft || !canEditResults) return;
    await persistCurrentTest(draft);
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 2000);
  }

  function handleLabField(key, value) {
    setDraft((d) => {
      const next = { ...d, [key]: value };
      // Persist status immediately so the order-level badge updates
      // (e.g. when marking a single-test order as DONE it should show COMPLETED).
      if (key === "status") {
        persistCurrentTest(next);
      }
      return next;
    });
  }

  function handleResultField(fieldId, value) {
    setDraft((d) => ({ ...d, results: { ...d.results, [fieldId]: value } }));
  }

  async function handleFilesSelected(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    const testId = (draft || currentTest)?.id;
    if (!testId) return;

    setFilesBusy(true);
    try {
      for (const file of files) {
        await uploadLabOrderTestFile(testId, file, user?.id || null);
      }
      const refreshed = await findLabOrderById(orderId);
      if (refreshed) {
        setOrder(refreshed);
        const refreshedTest = refreshed.tests?.[selectedDiagnostic];
        if (refreshedTest) setDraft({ ...refreshedTest, results: { ...(refreshedTest.results || {}) } });
      }
    } catch (err) {
      window.alert("Could not upload file(s): " + err.message);
    } finally {
      setFilesBusy(false);
    }
  }

  async function handleDeleteFile(file) {
    setFilesBusy(true);
    try {
      await deleteLabOrderTestFile(file.id, file.storagePath);
      const refreshed = await findLabOrderById(orderId);
      if (refreshed) {
        setOrder(refreshed);
        const refreshedTest = refreshed.tests?.[selectedDiagnostic];
        if (refreshedTest) setDraft({ ...refreshedTest, results: { ...(refreshedTest.results || {}) } });
      }
    } catch (err) {
      window.alert("Could not remove file: " + err.message);
    } finally {
      setFilesBusy(false);
    }
  }

  async function handleViewFile(file) {
    const url = await getLabOrderFileUrl(file.storagePath);
    if (url) window.open(url, "_blank");
    else window.alert("Could not open this file — it may have been removed.");
  }

  // Loading
  if (order === undefined) {
    return <div className="min-h-[50vh]" />;
  }

  // Not found
  if (order === null) {
    return (
      <div className="max-w-lg mx-auto mt-16 bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
        <FlaskConical size={24} className="mx-auto text-slate-300 mb-2" />
        <p className="text-sm font-semibold text-slate-800 mb-1">Lab order not found</p>
        <p className="text-xs text-slate-500 mb-4">
          We couldn't find a lab order with ID "{orderId}". It may have been removed.
        </p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 text-sm font-medium transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Lab Orders
        </button>
      </div>
    );
  }

  const p = order.patient || {};
  const fullName = [p.lastName, p.firstName, p.middleName].filter(Boolean).join(", ").toUpperCase();
  const orderStatus = getOrderStatus(order);
  const diagnostics = order.diagnostics || [];

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <button
            type="button"
            onClick={() => navigate("/lab-orders")}
            className="text-xs font-semibold uppercase tracking-wide text-teal-700 hover:text-teal-800 mb-1"
          >
            Lab Orders
          </button>
          <h1 className="text-2xl font-semibold text-slate-800">{order.id}</h1>
          <p className="text-sm text-slate-500 mt-1">View and manage lab order details</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors whitespace-nowrap"
        >
          <ArrowLeft size={14} />
          Back
        </button>
      </div>

      {/* Lab Order Details summary card */}
      <div className="border border-slate-200 rounded-xl bg-white shadow-sm mb-4 overflow-hidden">
        <button
          type="button"
          onClick={() => setSummaryOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3"
        >
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold text-teal-700">Lab Order Details</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ORDER_STATUS_STYLES[orderStatus]}`}
            >
              {orderStatus}
            </span>
            <span
              role={canManageBilling ? "button" : undefined}
              onClick={(e) => {
                e.stopPropagation(); // don't collapse/expand the summary card
                handleTogglePayment();
              }}
              title={
                canManageBilling
                  ? `Mark as ${order.paymentStatus === "paid" ? "Unpaid" : "Paid"}`
                  : "Only Cashier/Admin can change this"
              }
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                order.paymentStatus === "paid"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              } ${canManageBilling ? "cursor-pointer hover:opacity-75" : "cursor-default"} ${
                busyPayment ? "opacity-50" : ""
              }`}
            >
              <CreditCard size={11} />
              {busyPayment ? "Updating…" : order.paymentStatus === "paid" ? "Paid" : "Unpaid"}
            </span>
          </span>
          {summaryOpen ? (
            <ChevronUp size={16} className="text-slate-400" />
          ) : (
            <ChevronDown size={16} className="text-slate-400" />
          )}
        </button>

        {summaryOpen && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4 pb-4 border-t border-slate-100 pt-3">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Date Requested</p>
              <p className="text-sm font-medium text-slate-800">
                {formatDateCreated(order.dateCreated)}
              </p>
            </div>
            <div className="col-span-2 md:col-span-1">
              <p className="text-xs text-slate-400 mb-0.5">Name</p>
              <p className="text-sm font-medium text-slate-800">{fullName || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Age</p>
              <p className="text-sm font-medium text-slate-800">{formatAge(p.dateOfBirth)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Date of Birth</p>
              <p className="text-sm font-medium text-slate-800">{formatDob(p.dateOfBirth)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Diagnostics list + test detail */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        {/* Sidebar */}
        <div className="flex flex-col gap-1.5">
          {diagnostics.map((name) => {
            const test = order.tests?.[name];
            const status = test?.status || "PENDING";
            const active = name === selectedDiagnostic;
            const StatusIcon =
              status === "DONE" ? CheckCircle2 : status === "CANCELLED" ? XCircle : Circle;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setSelectedDiagnostic(name)}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                  active
                    ? "bg-teal-700 border-teal-700 text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="uppercase truncate">{name}</span>
                <StatusIcon
                  size={16}
                  className={
                    active
                      ? "text-white shrink-0"
                      : status === "DONE"
                      ? "text-emerald-500 shrink-0"
                      : status === "CANCELLED"
                      ? "text-red-400 shrink-0"
                      : "text-slate-300 shrink-0"
                  }
                />
              </button>
            );
          })}
        </div>

        {/* Detail panel */}
        <div className="flex flex-col gap-3">
          {!draft ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
              Select a diagnostic to view its details.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
                <div>
                  <h2 className="text-sm font-bold uppercase text-slate-800">
                    {selectedDiagnostic}
                  </h2>
                  <p className="text-xs text-slate-400">{draft.code}</p>
                </div>
                {canEditResults && (
                  <button
                    type="button"
                    onClick={handleSaveResults}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors whitespace-nowrap"
                  >
                    {savedTick ? <Check size={15} /> : <Save size={15} />}
                    {savedTick ? "Saved" : "Save Results"}
                  </button>
                )}
              </div>

              {readOnlyReason && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
                  {readOnlyReason}
                </div>
              )}

              <fieldset disabled={!canEditResults} className="contents">

              {/* Laboratory Details */}
              <CollapsibleSection
                title="Laboratory Details"
                open={labDetailsOpen}
                onToggle={() => setLabDetailsOpen((o) => !o)}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="block text-xs font-medium text-slate-500 mb-1">Status</span>
                    <select
                      value={draft.status}
                      onChange={(e) => handleLabField("status", e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                    >
                      {TEST_STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="block text-xs font-medium text-slate-500 mb-1">
                      Is Referred
                    </span>
                    <select
                      value={draft.isReferred}
                      onChange={(e) => handleLabField("isReferred", e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                    >
                      <option value="">—</option>
                      {IS_REFERRED_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="block text-xs font-medium text-slate-500 mb-1">
                      Performed By
                    </span>
                    <input
                      type="text"
                      value={draft.performedBy}
                      onChange={(e) => handleLabField("performedBy", e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-xs font-medium text-slate-500 mb-1">
                      Date Performed
                    </span>
                    <input
                      type="date"
                      value={draft.datePerformed}
                      onChange={(e) => handleLabField("datePerformed", e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-xs font-medium text-slate-500 mb-1">
                      Laboratory Fee
                    </span>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                        ₱
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={draft.fee}
                        onChange={(e) => handleLabField("fee", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 pl-7 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                      />
                    </div>
                  </label>
                </div>
              </CollapsibleSection>

              {/* Results */}
              <CollapsibleSection
                title="Results"
                open={resultsOpen}
                onToggle={() => setResultsOpen((o) => !o)}
              >
                <div className="flex flex-col gap-4">
                  {schema.groups.map((group, gi) => (
                    <div
                      key={gi}
                      className={`grid grid-cols-1 gap-4 ${
                        group.columns === 4
                          ? "sm:grid-cols-2 lg:grid-cols-4"
                          : group.columns === 2
                          ? "sm:grid-cols-2"
                          : ""
                      }`}
                    >
                      {group.fields.map((f) => (
                        <Field
                          key={f.id}
                          field={f}
                          value={draft.results?.[f.id]}
                          onChange={(v) => handleResultField(f.id, v)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
              </fieldset>

              {/* Files */}
              <CollapsibleSection
                title="Files"
                open={filesOpen}
                onToggle={() => setFilesOpen((o) => !o)}
              >
                <p className="text-xs text-slate-500 mb-3">
                  Upload relevant documents and images for this diagnostic test
                </p>

                {canEditResults && (
                  <div className="flex justify-center mb-4">
                    <label
                      className={`inline-flex items-center gap-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors ${
                        filesBusy ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                      }`}
                    >
                      <Upload size={15} />
                      {filesBusy ? "Working…" : "Upload Files"}
                      <input
                        type="file"
                        multiple
                        disabled={filesBusy}
                        className="hidden"
                        onChange={(e) => {
                          handleFilesSelected(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                )}

                <div className="border border-slate-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-slate-600 mb-2">
                    Uploaded Files ({draft.files?.length || 0})
                  </p>
                  {(!draft.files || draft.files.length === 0) ? (
                    <p className="text-xs text-slate-400 py-2 text-center">No files uploaded yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {draft.files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2"
                        >
                          <span className="flex items-center gap-2 text-sm text-slate-700 truncate">
                            <FileText size={15} className="text-red-500 shrink-0" />
                            <span className="truncate">{file.name}</span>
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleViewFile(file)}
                              title="View file"
                              className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              <Eye size={15} />
                            </button>
                            {canEditResults && (
                              <button
                                type="button"
                                onClick={() => handleDeleteFile(file)}
                                disabled={filesBusy}
                                title="Remove file"
                                className="text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors"
                              >
                                <X size={15} />
                              </button>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            </>
          )}
        </div>
      </div>
    </div>
  );
}