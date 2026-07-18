import { useState } from "react";
import { X, Send } from "lucide-react";
import { fillBlanksFromShared } from "./sharedClinicalFields";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600";

const textareaClass = `${inputClass} resize-none`;

const labelClass = "text-xs font-semibold text-slate-600 mb-1 block";

function Field({ label, className = "", children }) {
  return (
    <div className={className}>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

function calcAge(dob) {
  if (!dob) return "";
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return String(age);
}

// Everything here already exists somewhere in the patient's record or EMR —
// pulled in automatically so staff only have to type the handful of fields
// that are genuinely new to this specific referral (marked NEW below).
function buildAutoFilled(patient, emr) {
  const fullName = [patient?.lastName, patient?.firstName, patient?.middleName]
    .filter(Boolean)
    .join(", ");
  const managementAtED = [emr?.treatmentLeft, emr?.treatmentRight].filter(Boolean).join("\n");

  return {
    referringHospitalName: "E. ZARATE HOSPITAL",
    referringHospitalAddress: "16 J. Aguilar Avenue, Talon I, Las Piñas City, Metro Manila, Philippines",
    attendingPhysician: emr?.physician || "",
    fullName,
    age: emr?.age || calcAge(patient?.dateOfBirth),
    sex: patient?.sex || emr?.gender || "",
    pin: emr?.philhealthPin || "",
    chiefComplaint: emr?.chiefComplaints || "",
    physicalExamination: emr?.objectiveFindings || "",
    initialImpression: emr?.physicianImpression || "",
    managementAtED,
    finalDiagnosis: emr?.activeDiagnoses || "",
    recommendations: emr?.followUpExamination || "",
  };
}

// Genuinely new to this referral — not tracked anywhere else in the app.
const emptyNewFields = {
  dateOfReferral: new Date().toISOString().slice(0, 10),
  accreditationNumber: "",
  historyOfPresentIllness: "",
  receivingKonsultaProvider: "",
  dateReceived: "",
};

export default function KonsultaReferralModal({ patient, emr, shared, initialValues, onSave, onClose }) {
  const [form, setForm] = useState(() => {
    const autoFilled = buildAutoFilled(patient, emr);
    // Anything buildAutoFilled left blank (EMR doesn't have it, or there's
    // no EMR yet) gets one more pass from the shared clinical store — a
    // value someone already typed into Discharge or the Medical
    // Certificate for the same concept.
    const { patched } = fillBlanksFromShared(autoFilled, "konsulta", shared || {});
    return {
      ...patched,
      ...emptyNewFields,
      ...(initialValues || {}),
    };
  });

  function handle(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave?.(form);
    onClose?.();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-50 text-teal-700">
              <Send size={16} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-800">
                Emergency Care Benefit Referral to KONSULTA / YAKAP
              </h2>
              <p className="text-xs text-slate-500">
                Most fields are filled in from the patient record — just add what's new.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
          {/* Referring Hospital */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Referring Hospital</p>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Name of Hospital">
                <input name="referringHospitalName" value={form.referringHospitalName} onChange={handle} className={inputClass} />
              </Field>
              <Field label="Accreditation Number">
                <input
                  name="accreditationNumber"
                  value={form.accreditationNumber}
                  onChange={handle}
                  placeholder="Not on file — add it here"
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Address of Hospital">
              <input name="referringHospitalAddress" value={form.referringHospitalAddress} onChange={handle} className={inputClass} />
            </Field>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Emergency Department Attending Physician">
                <input name="attendingPhysician" value={form.attendingPhysician} onChange={handle} className={inputClass} />
              </Field>
              <Field label="Date of Referral">
                <input type="date" name="dateOfReferral" value={form.dateOfReferral} onChange={handle} className={inputClass} />
              </Field>
            </div>
          </div>

          {/* Patient Data */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <p className="text-xs font-bold uppercase tracking-wide text-teal-700 pt-3">Patient Data</p>
            <Field label="Name">
              <input name="fullName" value={form.fullName} onChange={handle} className={inputClass} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Age">
                <input name="age" value={form.age} onChange={handle} className={inputClass} />
              </Field>
              <Field label="Sex">
                <input name="sex" value={form.sex} onChange={handle} className={inputClass} />
              </Field>
              <Field label="PIN">
                <input name="pin" value={form.pin} onChange={handle} className={inputClass} />
              </Field>
            </div>
          </div>

          {/* Clinical details */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <p className="text-xs font-bold uppercase tracking-wide text-teal-700 pt-3">Clinical Details</p>
            <Field label="Chief Complaint">
              <textarea name="chiefComplaint" value={form.chiefComplaint} onChange={handle} rows={2} className={textareaClass} />
            </Field>
            <Field label="History of Present Illness">
              <textarea
                name="historyOfPresentIllness"
                value={form.historyOfPresentIllness}
                onChange={handle}
                rows={3}
                placeholder="Not on file — add it here"
                className={textareaClass}
              />
            </Field>
            <Field label="Physical Examination">
              <textarea name="physicalExamination" value={form.physicalExamination} onChange={handle} rows={3} className={textareaClass} />
            </Field>
            <Field label="Initial Impression">
              <textarea name="initialImpression" value={form.initialImpression} onChange={handle} rows={2} className={textareaClass} />
            </Field>
            <Field label="Management at ED">
              <textarea name="managementAtED" value={form.managementAtED} onChange={handle} rows={2} className={textareaClass} />
            </Field>
            <Field label="Final Diagnosis">
              <textarea name="finalDiagnosis" value={form.finalDiagnosis} onChange={handle} rows={2} className={textareaClass} />
            </Field>
            <Field label="Recommendations">
              <textarea name="recommendations" value={form.recommendations} onChange={handle} rows={2} className={textareaClass} />
            </Field>
          </div>

          {/* Receiving provider */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <p className="text-xs font-bold uppercase tracking-wide text-teal-700 pt-3">
              Receiving Konsulta Provider
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Receiving Konsulta Provider">
                <input
                  name="receivingKonsultaProvider"
                  value={form.receivingKonsultaProvider}
                  onChange={handle}
                  placeholder="Not on file — add it here"
                  className={inputClass}
                />
              </Field>
              <Field label="Date Received">
                <input type="date" name="dateReceived" value={form.dateReceived} onChange={handle} className={inputClass} />
              </Field>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 -mx-6 px-6 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium shadow-sm transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}