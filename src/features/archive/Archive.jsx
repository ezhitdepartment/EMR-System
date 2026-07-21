import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  FilterX,
  CalendarX,
  FlaskConical,
  Pill,
  Eye,
  MoreVertical,
  Download,
} from "lucide-react";
import YearMonthFilter from "../../components/common/YearMonthFilter";
import { formatAge } from "../../utils/age";
import { STATUS, loadEncounters, formatDateCreated as formatEncounterDate } from "../../utils/encounters";
import { loadLabOrders, formatDateCreated as formatOrderDate } from "../../utils/labOrders";
import { getOrderStatus } from "../../utils/labOrderDiagnostics";
import {
  STATUS as RX_STATUS,
  loadMedicinePrescriptions,
  formatDateCreated as formatRxDate,
} from "../../utils/medicinePrescriptions";
import ViewMedicinePrescriptionModal from "../medicine-prescriptions/ViewMedicinePrescriptionModal";

const PAGE_SIZE = 8;
const TABS = [
  { key: "registrations", label: "Cancelled Registrations" },
  { key: "labOrders", label: "Cancelled Lab Orders" },
  { key: "prescriptions", label: "Cancelled Prescriptions" },
];

function csvDownload(filename, header, rows) {
  const csv = [header, ...rows]
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Archive() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("registrations");

  const [encounters, setEncounters] = useState([]);
  const [labOrders, setLabOrders] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewRx, setViewRx] = useState(null);

  async function refresh() {
    setLoading(true);
    const [e, l, r] = await Promise.all([
      loadEncounters(),
      loadLabOrders(),
      loadMedicinePrescriptions(),
    ]);
    setEncounters(e);
    setLabOrders(l);
    setPrescriptions(r);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  useEffect(() => {
    setPage(1);
    setMenuOpen(false);
  }, [tab, search, year, month]);

  // Only ever the cancelled ones — this page has nothing to do with the
  // active Registration/Lab Orders/Prescriptions lists.
  const cancelledEncounters = useMemo(
    () => encounters.filter((e) => e.status === STATUS.CANCELLED),
    [encounters]
  );
  const cancelledLabOrders = useMemo(
    () => labOrders.filter((o) => getOrderStatus(o) === "CANCELLED"),
    [labOrders]
  );
  const cancelledPrescriptions = useMemo(
    () => prescriptions.filter((r) => r.status === RX_STATUS.CANCELLED),
    [prescriptions]
  );

  const hasActiveFilters = search.trim() !== "" || year !== "" || month !== "";
  function clearFilters() {
    setSearch("");
    setYear("");
    setMonth("");
    setPage(1);
  }

  function withinDate(dateCreated) {
    if (!year && !month) return true;
    const dt = dateCreated ? new Date(dateCreated) : null;
    if (!dt) return false;
    if (year && dt.getFullYear().toString() !== year) return false;
    if (month && dt.getMonth() + 1 !== Number(month)) return false;
    return true;
  }

  const filteredEncounters = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cancelledEncounters
      .map((e) => ({
        ...e,
        _fullName: [e.patient?.lastName, e.patient?.firstName, e.patient?.middleName]
          .filter(Boolean)
          .join(" "),
      }))
      .filter((e) => {
        if (!withinDate(e.dateCreated)) return false;
        if (!q) return true;
        return (
          e.id.toLowerCase().includes(q) ||
          (e.hospitalNo || "").toLowerCase().includes(q) ||
          e._fullName.toLowerCase().includes(q) ||
          (e.doctor || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
  }, [cancelledEncounters, search, year, month]);

  const filteredLabOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cancelledLabOrders
      .map((o) => ({
        ...o,
        _fullName: [o.patient?.lastName, o.patient?.firstName, o.patient?.middleName]
          .filter(Boolean)
          .join(" "),
      }))
      .filter((o) => {
        if (!withinDate(o.dateCreated)) return false;
        if (!q) return true;
        return o.id.toLowerCase().includes(q) || o._fullName.toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
  }, [cancelledLabOrders, search, year, month]);

  const filteredPrescriptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cancelledPrescriptions
      .map((r) => ({
        ...r,
        _fullName: [r.patient?.lastName, r.patient?.firstName, r.patient?.middleName]
          .filter(Boolean)
          .join(" "),
      }))
      .filter((r) => {
        if (!withinDate(r.dateCreated)) return false;
        if (!q) return true;
        return (
          r.id.toLowerCase().includes(q) ||
          r._fullName.toLowerCase().includes(q) ||
          (r.prescribedBy || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
  }, [cancelledPrescriptions, search, year, month]);

  const activeList =
    tab === "registrations"
      ? filteredEncounters
      : tab === "labOrders"
        ? filteredLabOrders
        : filteredPrescriptions;

  const cancelledSource =
    tab === "registrations"
      ? cancelledEncounters
      : tab === "labOrders"
        ? cancelledLabOrders
        : cancelledPrescriptions;

  const availableYears = useMemo(() => {
    const s = new Set();
    for (const item of cancelledSource) {
      if (item.dateCreated) {
        const y = new Date(item.dateCreated).getFullYear();
        if (!Number.isNaN(y)) s.add(y);
      }
    }
    return Array.from(s).sort((a, b) => b - a);
  }, [cancelledSource]);

  const pageCount = Math.max(1, Math.ceil(activeList.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = activeList.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = activeList.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, activeList.length);

  function exportCsv() {
    if (tab === "registrations") {
      csvDownload(
        "cancelled-registrations.csv",
        ["ID", "Hospital No.", "Patient", "Patient Type", "Type", "Doctor", "Date Created", "Created By"],
        filteredEncounters.map((e) => [
          e.id,
          e.hospitalNo || "",
          e._fullName,
          e.patientType || "",
          e.consultationType || "",
          e.doctor || "",
          formatEncounterDate(e.dateCreated),
          e.createdBy || "",
        ])
      );
    } else if (tab === "labOrders") {
      csvDownload(
        "cancelled-lab-orders.csv",
        ["ID", "Patient", "Diagnostics", "Payment Status", "Date Created", "Created By"],
        filteredLabOrders.map((o) => [
          o.id,
          o._fullName,
          (o.diagnostics || []).join("; "),
          o.paymentStatus === "paid" ? "Paid" : "Unpaid",
          formatOrderDate(o.dateCreated),
          o.createdBy || "",
        ])
      );
    } else {
      csvDownload(
        "cancelled-prescriptions.csv",
        ["ID", "Patient", "Medicine Count", "Prescribed By", "Date Created"],
        filteredPrescriptions.map((r) => [
          r.id,
          r._fullName,
          r.items?.length || 0,
          r.prescribedBy || "",
          formatRxDate(r.dateCreated),
        ])
      );
    }
    setMenuOpen(false);
  }

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 mb-1">Main</p>
          <h1 className="text-2xl font-semibold text-slate-800">Archive</h1>
          <p className="text-sm text-slate-500 mt-1">
            Cancelled registrations, lab orders, and prescriptions, kept for reference.
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
              tab === t.key ? "bg-teal-800 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            {t.label}
            <span
              className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${
                tab === t.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {t.key === "registrations"
                ? cancelledEncounters.length
                : t.key === "labOrders"
                  ? cancelledLabOrders.length
                  : cancelledPrescriptions.length}
            </span>
          </button>
        ))}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === "registrations"
                ? "Search by ID, Hospital No., Patient or Doctor"
                : tab === "labOrders"
                  ? "Search by ID or Patient"
                  : "Search by ID, Patient or Prescribed By"
            }
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
          />
        </div>

        <YearMonthFilter
          label="Date Created"
          year={year}
          month={month}
          years={availableYears}
          onYearChange={setYear}
          onMonthChange={setMonth}
        />

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
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            disabled={activeList.length === 0}
            title="More actions"
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-40 rounded-lg border border-slate-200 bg-white shadow-lg z-20 overflow-hidden">
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
        {activeList.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
            {tab === "registrations" ? (
              <CalendarX size={28} />
            ) : tab === "labOrders" ? (
              <FlaskConical size={28} />
            ) : (
              <Pill size={28} />
            )}
            <p className="text-sm font-medium">
              No cancelled{" "}
              {tab === "registrations" ? "registrations" : tab === "labOrders" ? "lab orders" : "prescriptions"}{" "}
              found
            </p>
            <p className="text-xs text-slate-400">
              {loading
                ? "Loading…"
                : tab === "registrations"
                  ? "Cancelled registrations will show up here."
                  : tab === "labOrders"
                    ? "Cancelled lab orders will show up here."
                    : "Cancelled prescriptions will show up here."}
            </p>
          </div>
        ) : tab === "registrations" ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">ID</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Hospital No.</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Patient</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Patient Type</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Type</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Doctor</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Date Created</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Created By</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap align-top">{e.id}</td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-slate-700">{e.hospitalNo || "—"}</td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <p className="font-semibold text-slate-800">{e._fullName || "—"}</p>
                        <p className="text-xs text-slate-500">{formatAge(e.patient?.dateOfBirth)}</p>
                        <p className="text-xs text-slate-500 uppercase">{e.patient?.sex || "—"}</p>
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        {e.patientType ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
                              e.patientType === "ER Patient"
                                ? "bg-red-50 text-red-700"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {e.patientType}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-slate-700">{e.consultationType || "—"}</td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-slate-700">{e.doctor || "—"}</td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-slate-600">
                        {formatEncounterDate(e.dateCreated)}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-slate-600">{e.createdBy || "—"}</td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-right">
                        <button
                          type="button"
                          title="View Patient"
                          onClick={() => navigate(`/patients/${e.hospitalNo}`)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ArchivePagination
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              total={activeList.length}
              noun="registrations"
              page={safePage}
              pageCount={pageCount}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
            />
          </>
        ) : tab === "labOrders" ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">ID</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Patient</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Diagnostics</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Payment Status</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Date Created</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Created By</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((o) => (
                    <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap align-top">{o.id}</td>
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
                              className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 uppercase whitespace-nowrap"
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            o.paymentStatus === "paid"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {o.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-slate-600">
                        {formatOrderDate(o.dateCreated)}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-slate-600">{o.createdBy || "—"}</td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-right">
                        <button
                          type="button"
                          title="View Lab Order"
                          onClick={() => navigate(`/lab-orders/${o.id}`)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ArchivePagination
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              total={activeList.length}
              noun="lab orders"
              page={safePage}
              pageCount={pageCount}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
            />
          </>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">ID</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Patient</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap text-center">Medicine Count</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Prescribed By</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Date Created</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap align-top">{r.id}</td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <p className="font-semibold text-slate-800">{r._fullName || "—"}</p>
                        <p className="text-xs text-slate-500">{formatAge(r.patient?.dateOfBirth)}</p>
                        <p className="text-xs text-slate-500 uppercase">{r.patient?.sex || "—"}</p>
                      </td>
                      <td className="px-4 py-3 align-top text-center text-slate-700">{r.items?.length || 0}</td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-slate-700">{r.prescribedBy || "—"}</td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-slate-600">
                        {formatRxDate(r.dateCreated)}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-right">
                        <button
                          type="button"
                          title="View Prescription"
                          onClick={() => setViewRx(r)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ArchivePagination
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              total={activeList.length}
              noun="prescriptions"
              page={safePage}
              pageCount={pageCount}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
            />
          </>
        )}
      </div>

      {viewRx && <ViewMedicinePrescriptionModal record={viewRx} onClose={() => setViewRx(null)} />}
    </div>
  );
}

function ArchivePagination({ rangeStart, rangeEnd, total, noun, page, pageCount, onPrev, onNext }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50">
      <p className="text-xs text-slate-500">
        Showing <span className="font-medium text-slate-700">{rangeStart}</span>–
        <span className="font-medium text-slate-700">{rangeEnd}</span> of{" "}
        <span className="font-medium text-slate-700">{total}</span> {noun}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={14} />
          Prev
        </button>
        <span className="text-xs text-slate-500">
          Page <span className="font-medium text-slate-700">{page}</span> of{" "}
          <span className="font-medium text-slate-700">{pageCount}</span>
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= pageCount}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}