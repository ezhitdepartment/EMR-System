// Generic year + month filter — two dropdowns that narrow a list down to
// records whose date falls in a given year and/or month. Originally built
// as "DateOfBirthFilter" for the Patients page; generalized so every list
// page in the dashboard (Encounters, Lab Orders, Medicine Prescriptions,
// ...) can filter its own date field (appointment date, date created, etc.)
// the same way, with the same look and feel.
export default function YearMonthFilter({ label, year, month, years, onYearChange, onMonthChange }) {
  return (
    <div className="flex flex-col gap-1 min-w-60">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {label}
      </label>
      <div className="flex gap-2">
        <select
          value={year}
          onChange={(e) => onYearChange(e.target.value)}
          title={`Year — ${label}`}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
        >
          <option value="">All Years</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>

        <select
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
          title={`Month — ${label}`}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
        >
          <option value="">All Months</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={String(m)}>
              {new Date(0, m - 1).toLocaleString(undefined, { month: "long" })}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
