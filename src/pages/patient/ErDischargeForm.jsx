import { useState } from "react";
import { X } from "lucide-react";

// One row per numbered line on the paper form (1–9 under Take Home Medications).
const MED_ROWS = 9;

const ANCILLARY_ITEMS = [
  { key: "cbc", label: "CBC w/ PC" },
  { key: "na", label: "Na+" },
  { key: "k", label: "K+" },
  { key: "cl", label: "Cl-" },
  { key: "ua", label: "UA" },
  { key: "fa", label: "FA" },
  { key: "hgt", label: "HGT" },
  { key: "hba1c", label: "HbA1c" },
  { key: "crea", label: "Crea" },
  { key: "sgot", label: "SGOT" },
  { key: "sgpt", label: "SGPT" },
  { key: "bun", label: "BUN" },
  { key: "bua", label: "BUA" },
  { key: "ecg12L", label: "12-L ECG" },
];

function emptyMedRows() {
  return Array.from({ length: MED_ROWS }, () => ({ medicine: "", dosage: "", time: "" }));
}

export const emptyDischargeForm = {
  hospitalNo: "",
  patientName: "",
  address: "",
  age: "",
  sex: "",
  dob: "",
  dateTimeAttended: "",
  nurseOnDuty: "",
  chiefComplaints: "",
  ancillaries: ANCILLARY_ITEMS.reduce((acc, item) => ({ ...acc, [item.key]: false }), {}),
  xray: false,
  xrayNote: "",
  others: false,
  othersNote: "",
  finalDiagnosis: "",
  treatmentGiven: "",
  dateTimeDischarge: "",
  conditionUponDischarge: "",
  disposition: "",
  medications: emptyMedRows(),
  followUpExamination: "",
  erPhysician: "",
  physicianDate: "",
};

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600";
const textareaClass = `${inputClass} resize-none`;

function Field({ label, children, full }) {
  return (
    <label className={`block ${full ? "col-span-full" : ""}`}>
      <span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

export default function ErDischargeForm({ initialValues, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    ...emptyDischargeForm,
    physicianDate: new Date().toISOString().slice(0, 10),
    ...(initialValues || {}),
    ancillaries: {
      ...emptyDischargeForm.ancillaries,
      ...((initialValues && initialValues.ancillaries) || {}),
    },
    medications:
      initialValues && Array.isArray(initialValues.medications) && initialValues.medications.length
        ? initialValues.medications
        : emptyMedRows(),
  }));

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  function toggleAncillary(key) {
    setForm((f) => ({ ...f, ancillaries: { ...f.ancillaries, [key]: !f.ancillaries[key] } }));
  }
  function setMedRow(index, field, value) {
    setForm((f) => {
      const medications = [...f.medications];
      medications[index] = { ...medications[index], [field]: value };
      return { ...f, medications };
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave?.(form);
    onClose?.();
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-teal-700 text-white sticky top-0 rounded-t-2xl z-10">
          <div>
            <h1 className="text-base font-semibold">E. ZARATE HOSPITAL</h1>
            <p className="text-teal-200 text-xs">Emergency Room Discharge Instruction Form</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium hover:bg-white/10 transition-colors"
          >
            <X size={14} />
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
          {/* Patient info */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-700">Patient Information</p>
              <Field label="Hospital No.">
                <input
                  value={form.hospitalNo}
                  onChange={(e) => set("hospitalNo", e.target.value)}
                  className={`${inputClass} w-40`}
                />
              </Field>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Patient's Name">
                <input
                  value={form.patientName}
                  onChange={(e) => set("patientName", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Address">
                <input
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Age">
                <input value={form.age} onChange={(e) => set("age", e.target.value)} className={inputClass} />
              </Field>
              <Field label="Sex">
                <select value={form.sex} onChange={(e) => set("sex", e.target.value)} className={inputClass}>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </Field>
              <Field label="Date of Birth">
                <input
                  type="date"
                  value={form.dob}
                  onChange={(e) => set("dob", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Nurse on Duty">
                <input
                  value={form.nurseOnDuty}
                  onChange={(e) => set("nurseOnDuty", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Date/Time Attended" full>
                <input
                  value={form.dateTimeAttended}
                  onChange={(e) => set("dateTimeAttended", e.target.value)}
                  placeholder="e.g. 07/03/2026 3:45 PM"
                  className={inputClass}
                />
              </Field>
            </div>
          </div>

          {/* Chief complaints */}
          <div>
            <Field label="Chief Complaint/s">
              <textarea
                rows={2}
                value={form.chiefComplaints}
                onChange={(e) => set("chiefComplaints", e.target.value)}
                className={textareaClass}
              />
            </Field>
          </div>

          {/* Ancillaries done */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Ancillaries Done</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {ANCILLARY_ITEMS.map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={form.ancillaries[item.key]}
                    onChange={() => toggleAncillary(item.key)}
                    className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  />
                  {item.label}
                </label>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={form.xray}
                  onChange={() => set("xray", !form.xray)}
                  className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                Xray:
                <input
                  value={form.xrayNote}
                  onChange={(e) => set("xrayNote", e.target.value)}
                  className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={form.others}
                  onChange={() => set("others", !form.others)}
                  className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                Others:
                <input
                  value={form.othersNote}
                  onChange={(e) => set("othersNote", e.target.value)}
                  className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </label>
            </div>
          </div>

          {/* Final diagnosis / Treatment given */}
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Final Diagnosis">
              <textarea
                rows={5}
                value={form.finalDiagnosis}
                onChange={(e) => set("finalDiagnosis", e.target.value)}
                className={textareaClass}
              />
            </Field>
            <Field label="Treatment / Medication Given">
              <textarea
                rows={5}
                value={form.treatmentGiven}
                onChange={(e) => set("treatmentGiven", e.target.value)}
                className={textareaClass}
              />
            </Field>
          </div>

          {/* Discharge details */}
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Date and Time of Discharge">
              <input
                value={form.dateTimeDischarge}
                onChange={(e) => set("dateTimeDischarge", e.target.value)}
                placeholder="e.g. 07/03/2026 5:30 PM"
                className={inputClass}
              />
            </Field>
            <Field label="Condition Upon Discharge">
              <input
                value={form.conditionUponDischarge}
                onChange={(e) => set("conditionUponDischarge", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Disposition">
              <input
                value={form.disposition}
                onChange={(e) => set("disposition", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          {/* Take home medications */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Take Home Medications</p>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase tracking-wide">
                    <th className="w-8 px-2 py-2 text-left">#</th>
                    <th className="px-2 py-2 text-left">Medicine</th>
                    <th className="px-2 py-2 text-left">Dosage</th>
                    <th className="px-2 py-2 text-left">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {form.medications.map((row, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-2 py-1.5 text-slate-400">{i + 1}</td>
                      <td className="px-2 py-1.5">
                        <input
                          value={row.medicine}
                          onChange={(e) => setMedRow(i, "medicine", e.target.value)}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-600"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={row.dosage}
                          onChange={(e) => setMedRow(i, "dosage", e.target.value)}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-600"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={row.time}
                          onChange={(e) => setMedRow(i, "time", e.target.value)}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-600"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Follow-up + Physician */}
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Follow-up Examination" full>
              <input
                value={form.followUpExamination}
                onChange={(e) => set("followUpExamination", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="E.R. Physician on Duty">
              <input
                value={form.erPhysician}
                onChange={(e) => set("erPhysician", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={form.physicianDate}
                onChange={(e) => set("physicianDate", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          {/* Submit */}
          <div className="flex gap-4 justify-end pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-8 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}