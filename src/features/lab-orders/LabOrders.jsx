import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  Search,
  Plus,
  RefreshCw,
  FlaskConical,
  ChevronRight,
  ChevronLeft,
  ChevronsUpDown,
  FilterX,
  MoreVertical,
  Download,
  ListOrdered,
  CreditCard,
  Lock,
} from "lucide-react";
import CreateLabOrderModal from "./CreateLabOrderModal";
import YearMonthFilter from "../../components/common/YearMonthFilter";
import { formatAge } from "../../utils/age";
import {
  DIAGNOSTIC_OPTIONS,
  formatDateCreated,
  loadLabOrders,
  updatePaymentStatus,
  FORM_TYPE_BY_TEST,
} from "../../utils/labOrders";
import { getOrderStatus, ORDER_STATUS_STYLES } from "../../utils/labOrderDiagnostics";
import { ROLE_QUEUE_TYPES } from "../../utils/labQueue";

const PAGE_SIZE = 8;

function SortHeader({ label, field, sortField, sortDir, onSort }) {
  const active = sortField === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`inline-flex items-center gap-1 font-semibold whitespace-nowrap ${
        active ? "text-teal-700" : ""
      }`}
    >
      {label}
      <ChevronsUpDown size={12} className={active ? "text-teal-700" : "text-slate-400"} />
      {active && <span className="sr-only">{sortDir}</span>}
    </button>
  );
}

export default function LabOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Techs work results, not create orders — that's the requesting nurse's
  // job. Cashier is billing-only, same reasoning. Doctors/admins/nurses
  // keep the ability to create. Matches
  // current_user_can_create_lab_order() in the SQL exactly, so the button
  // never appears for a role that would get rejected on submit anyway.
  const canCreateOrder = !["med_tech", "xray_tech", "cashier"].includes(user?.role);
  // Only Cashier/Admin can flip payment status — matches
  // current_user_can_manage_billing() in the SQL, which is what actually
  // enforces this; the role check here just keeps the badge non-clickable
  // for everyone else instead of letting them click and hit a permission
  // error.
  const canManageBilling = ["admin", "cashier"].includes(user?.role);
  // Med Tech/X-ray Tech can see an unpaid order in this list (RLS doesn't
  // hide the row itself) but can't open it — matches
  // current_user_lab_order_payment_ok() in the SQL, which is what
  // actually blocks the underlying test/result data once they're in
  // there. This just stops the click before it happens, with a clear
  // reason, instead of sending them to a page that would come back empty.
  const isTechRole = ["med_tech", "xray_tech"].includes(user?.role);
  // Med Tech / X-ray Tech only work one type of test each — don't clutter
  // their list with orders that are 100% the other specialty. A mixed
  // order (e.g. a CBC + a Chest X-Ray on the same slip) still shows up for
  // both, since each tech has their own test to handle on it.
  const allowedFormTypes = ROLE_QUEUE_TYPES[user?.role] || null; // null = unrestricted (nurse/doctor/admin)
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [diagnosticFilter, setDiagnosticFilter] = useState("All");
  const [dateYear, setDateYear] = useState("");
  const [dateMonth, setDateMonth] = useState("");
  const [sortField, setSortField] = useState("dateCreated");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busyPaymentId, setBusyPaymentId] = useState("");

  async function refresh() {
    const all = await loadLabOrders();
    const scoped = allowedFormTypes
      ? all.filter((o) => (o.diagnostics || []).some((d) => allowedFormTypes.includes(FORM_TYPE_BY_TEST[d])))
      : all;
    setOrders(scoped);
  }

  async function handleTogglePayment(e, order) {
    e.stopPropagation(); // don't trigger the row's onClick (navigate to order detail)
    if (!canManageBilling || busyPaymentId) return;

    const nextStatus = order.paymentStatus === "paid" ? "unpaid" : "paid";
    setBusyPaymentId(order.id);
    try {
      const updated = await updatePaymentStatus(order.id, nextStatus);
      setOrders((list) => list.map((o) => (o.id === order.id ? updated : o)));
    } catch (err) {
      alert(err.message || "Couldn't update payment status.");
    } finally {
      setBusyPaymentId("");
    }
  }

  useEffect(() => {
    refresh();
    // No more "storage" event — lab orders live in Supabase now, not
    // localStorage. "focus" still catches "came back to this tab".
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, diagnosticFilter, dateYear, dateMonth]);

  const hasActiveFilters =
    search.trim() !== "" || diagnosticFilter !== "All" || dateYear !== "" || dateMonth !== "";

  function clearFilters() {
    setSearch("");
    setDiagnosticFilter("All");
    setDateYear("");
    setDateMonth("");
    setPage(1);
  }

  function handleSort(field) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const withDerived = orders.map((o) => ({
      ...o,
      _fullName: [o.patient?.lastName, o.patient?.firstName, o.patient?.middleName]
        .filter(Boolean)
        .join(" "),
    }));

    const q = search.trim().toLowerCase();

    const result = withDerived.filter((o) => {
      if (diagnosticFilter !== "All" && !(o.diagnostics || []).includes(diagnosticFilter))
        return false;
      if (dateYear || dateMonth) {
        const created = o.dateCreated ? new Date(o.dateCreated) : null;
        if (!created) return false;
        if (dateYear && created.getFullYear().toString() !== dateYear) return false;
        if (dateMonth && created.getMonth() + 1 !== Number(dateMonth)) return false;
      }
      if (!q) return true;
      return o.id.toLowerCase().includes(q) || o._fullName.toLowerCase().includes(q);
    });

    result.sort((a, b) => {
      let av, bv;
      switch (sortField) {
        case "id":
          av = a.id;
          bv = b.id;
          break;
        case "diagnosticCount":
          av = a.diagnostics?.length || 0;
          bv = b.diagnostics?.length || 0;
          break;
        default:
          av = a.dateCreated ? new Date(a.dateCreated).getTime() : 0;
          bv = b.dateCreated ? new Date(b.dateCreated).getTime() : 0;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [orders, search, diagnosticFilter, dateYear, dateMonth, sortField, sortDir]);

  const availableYears = useMemo(() => {
    const s = new Set();
    for (const o of orders) {
      if (o.dateCreated) {
        const y = new Date(o.dateCreated).getFullYear();
        if (!Number.isNaN(y)) s.add(y);
      }
    }
    return Array.from(s).sort((a, b) => b - a);
  }, [orders]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length);

  function exportCsv() {
    const header = ["ID", "Patient", "Diagnostics", "Diagnostic Count", "Payment Status", "Date Created"];
    const rows = filtered.map((o) => [
      o.id,
      o._fullName,
      (o.diagnostics || []).join("; "),
      o.diagnostics?.length || 0,
      o.paymentStatus === "paid" ? "Paid" : "Unpaid",
      formatDateCreated(o.dateCreated),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lab-orders.csv";
    a.click();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  }

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 mb-1">Main</p>
          <h1 className="text-2xl font-semibold text-slate-800">Lab Orders</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your lab orders and results</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigate("/lab-orders/queue")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            <ListOrdered size={16} />
            Queue
          </button>
          {canCreateOrder && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors whitespace-nowrap"
            >
              <Plus size={16} />
              Create Lab Order
            </button>
          )}
        </div>
      </div>

      {/* Filter dropdowns */}
      <div className="flex flex-wrap items-end justify-end gap-2 mb-3">
        <select
          value={diagnosticFilter}
          onChange={(e) => setDiagnosticFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
        >
          <option value="All">Diagnostics</option>
          {DIAGNOSTIC_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <YearMonthFilter
          label="Date Created"
          year={dateYear}
          month={dateMonth}
          years={availableYears}
          onYearChange={setDateYear}
          onMonthChange={setDateMonth}
        />
      </div>

      {/* Search + toolbar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID or Patient"
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
          />
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onClick={clearFilters}
          disabled={!hasActiveFilters}
          title="Clear filters"
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-300 text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <FilterX size={16} />
        </button>
        <button
          type="button"
          onClick={refresh}
          title="Refresh list"
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <RefreshCw size={16} />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            title="More actions"
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-40 rounded-lg border border-slate-200 bg-white shadow-lg z-10 overflow-hidden">
              <button
                type="button"
                onClick={exportCsv}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Download size={13} />
                Export CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
            <FlaskConical size={28} />
            <p className="text-sm font-medium">No lab orders found</p>
            <p className="text-xs text-slate-400">
              {orders.length === 0
                ? "Lab orders you create will show up here."
                : "Try a different search or filter."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">
                      <SortHeader
                        label="ID"
                        field="id"
                        sortField={sortField}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Patient</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Diagnostics</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Payment Status</th>
                    <th className="px-4 py-3">
                      <SortHeader
                        label="Diagnostic Count"
                        field="diagnosticCount"
                        sortField={sortField}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-4 py-3">
                      <SortHeader
                        label="Date Created"
                        field="dateCreated"
                        sortField={sortField}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((o) => {
                    const locked = isTechRole && o.paymentStatus !== "paid";
                    return (
                      <tr
                        key={o.id}
                        onClick={() => {
                          if (locked) return;
                          navigate(`/lab-orders/${o.id}`);
                        }}
                        title={locked ? "This order hasn't been paid yet — ask Cashier/Admin to mark it Paid first." : undefined}
                        className={`border-b border-slate-100 transition-colors ${
                          locked
                            ? "opacity-60 cursor-not-allowed"
                            : "hover:bg-teal-50/60 cursor-pointer"
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-teal-700 whitespace-nowrap align-top">
                          <span className="inline-flex items-center gap-1.5">
                            {locked && <Lock size={12} className="text-slate-400" />}
                            {o.id}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top whitespace-nowrap">
                          <p className="font-semibold text-slate-800">{o._fullName || "—"}</p>
                          <p className="text-xs text-slate-500">{formatAge(o.patient?.dateOfBirth)}</p>
                          <p className="text-xs text-slate-500 uppercase">{o.patient?.sex || "—"}</p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
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
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            ORDER_STATUS_STYLES[getOrderStatus(o)]
                          }`}
                        >
                          {getOrderStatus(o)}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => handleTogglePayment(e, o)}
                          disabled={!canManageBilling || busyPaymentId === o.id}
                          title={
                            canManageBilling
                              ? `Mark as ${o.paymentStatus === "paid" ? "Unpaid" : "Paid"}`
                              : "Only Cashier/Admin can change this"
                          }
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                            o.paymentStatus === "paid"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          } ${
                            canManageBilling
                              ? "cursor-pointer hover:opacity-75"
                              : "cursor-default"
                          } ${busyPaymentId === o.id ? "opacity-50" : ""}`}
                        >
                          <CreditCard size={11} />
                          {busyPaymentId === o.id
                            ? "Updating…"
                            : o.paymentStatus === "paid"
                              ? "Paid"
                              : "Unpaid"}
                        </button>
                      </td>
                      <td className="px-4 py-3 align-top text-center text-slate-700">
                        {o.diagnostics?.length || 0}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-slate-600">
                        {formatDateCreated(o.dateCreated)}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50">
              <p className="text-xs text-slate-500">
                Showing <span className="font-medium text-slate-700">{rangeStart}</span>–
                <span className="font-medium text-slate-700">{rangeEnd}</span> of{" "}
                <span className="font-medium text-slate-700">{filtered.length}</span> lab orders
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={14} />
                  Prev
                </button>
                <span className="text-xs text-slate-500">
                  Page <span className="font-medium text-slate-700">{safePage}</span> of{" "}
                  <span className="font-medium text-slate-700">{pageCount}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={safePage >= pageCount}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {showCreate && (
        <CreateLabOrderModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            refresh();
          }}
        />
      )}

    </div>
  );
}