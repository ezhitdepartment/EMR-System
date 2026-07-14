import { useState, useEffect } from "react";
import { X } from "lucide-react";
import AddressFields, { emptyAddressValue } from "../../components/common/AddressFields";
import { ageInYears } from "../../utils/age";
import { useAuth } from "../../context/AuthContext";
import { loadPatients, createPatient, generateHospitalNo } from "../../utils/patients";

const SUFFIX_OPTIONS = ["", "Jr.", "Sr.", "II", "III", "IV"];

// Which "Patient Type" gets stamped on a new patient record, based on the
// role of whoever registered them. Any role not listed here (doctor, admin,
// med_tech, xray_tech, etc.) falls back to "OPD Patient" — the general,
// non-emergency case.
const PATIENT_TYPE_BY_ROLE = {
  er_nurse: "ER Patient",
  opd_nurse: "OPD Patient",
};

function generatePatientId() {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `P-${year}${rand}`;
}

const emptyGuardian = {
  firstName: "",
  lastName: "",
  middleName: "",
  suffix: "",
  sex: "",
  dateOfBirth: "",
  pin: "",
  landline: "",
  mobile: "",
};

const emptyForm = {
  firstName: "",
  lastName: "",
  middleName: "",
  suffix: "",
  sex: "",
  dateOfBirth: "",
  email: "",
  landline: "",
  mobile: "",
  hasGuardian: false,
  guardian: emptyGuardian,
  address: "",
  ...emptyAddressValue,

  // Family background
  motherName: "",
  motherContact: "",
  fatherName: "",
  fatherContact: "",
  nationality: "",
  religion: "",
  maritalStatus: "",

  // Emergency contact
  emergencyName: "",
  emergencyAddress: "",
  emergencySameAsPatientAddress: false,
  emergencyRelationship: "",
  emergencyPhoneHome: "",
  emergencyPhoneCell: "",
  emergencySameAsMotherContact: false,
  emergencySameAsFatherContact: false,
  emergencySameAsGuardian: false,
};

const MARITAL_STATUS_OPTIONS = ["", "Single", "Married", "Widowed", "Separated", "Divorced"];

// Same composition used everywhere else in the app (Discharge/Medical
// Certificate seeds) so "same as patient's address" produces an identical
// string to what shows up on those documents.
function composedPatientAddress(form) {
  return [form.address, form.barangay, form.city, form.province].filter(Boolean).join(", ");
}

function guardianFullName(guardian) {
  return [guardian.firstName, guardian.middleName, guardian.lastName, guardian.suffix]
    .filter(Boolean)
    .join(" ");
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 disabled:bg-slate-50 disabled:text-slate-400";

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function MobileField({ value, onChange }) {
  return (
    <div className="flex">
      <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 text-sm text-slate-500">
        +63
      </span>
      <input
        value={value}
        onChange={onChange}
        className="w-full rounded-r-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
      />
    </div>
  );
}

export default function CreatePatientModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Generated once when the modal opens so what's shown on screen is
  // exactly what gets saved — see generateHospitalNo() in utils/patients.js
  // for the {seq}{year}{month} pattern and duplicate-safety guarantee.
  // Loaded asynchronously now that patients live in Supabase instead of
  // localStorage; re-derived fresh from the database again at submit time
  // (see handleSubmit) in case another registration happened in the
  // meantime, now that this is a real shared multi-user database.
  const [hospitalNo, setHospitalNo] = useState("");

  useEffect(() => {
    let active = true;
    loadPatients().then((existing) => {
      if (active) setHospitalNo(generateHospitalNo(existing));
    });
    return () => {
      active = false;
    };
  }, []);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  function setGuardian(field, value) {
    setForm((f) => ({ ...f, guardian: { ...f.guardian, [field]: value } }));
  }

  function handleAddressChange(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  // Keep Emergency Contact's address mirroring the patient's address for
  // as long as the checkbox is checked — so editing the patient's address
  // (or picking region/province/city/barangay) keeps it in sync live,
  // not just at the moment the box was ticked.
  useEffect(() => {
    if (!form.emergencySameAsPatientAddress) return;
    const composed = composedPatientAddress(form);
    if (form.emergencyAddress !== composed) {
      setForm((f) => ({ ...f, emergencyAddress: composed }));
    }
  }, [
    form.emergencySameAsPatientAddress,
    form.address,
    form.barangay,
    form.city,
    form.province,
  ]);

  // Same idea for the Cell No. — mirrors Mother's, Father's, or the
  // Guardian's contact number, whichever box is checked. The three are
  // mutually exclusive (checking one unchecks the others via the onChange
  // handlers below).
  useEffect(() => {
    if (form.emergencySameAsMotherContact && form.emergencyPhoneCell !== form.motherContact) {
      setForm((f) => ({ ...f, emergencyPhoneCell: f.motherContact }));
    } else if (form.emergencySameAsFatherContact && form.emergencyPhoneCell !== form.fatherContact) {
      setForm((f) => ({ ...f, emergencyPhoneCell: f.fatherContact }));
    } else if (form.emergencySameAsGuardian && form.emergencyPhoneCell !== form.guardian.mobile) {
      setForm((f) => ({ ...f, emergencyPhoneCell: f.guardian.mobile }));
    }
  }, [
    form.emergencySameAsMotherContact,
    form.emergencySameAsFatherContact,
    form.emergencySameAsGuardian,
    form.motherContact,
    form.fatherContact,
    form.guardian.mobile,
  ]);

  // "Same as Guardian" also carries over Name, Relationship, and Home
  // phone — a guardian who's also the emergency contact shouldn't have to
  // be typed in twice.
  useEffect(() => {
    if (!form.emergencySameAsGuardian) return;
    const name = guardianFullName(form.guardian);
    const patch = {};
    if (form.emergencyName !== name) patch.emergencyName = name;
    if (form.emergencyRelationship !== "Guardian") patch.emergencyRelationship = "Guardian";
    if (form.emergencyPhoneHome !== form.guardian.landline) patch.emergencyPhoneHome = form.guardian.landline;
    if (Object.keys(patch).length > 0) setForm((f) => ({ ...f, ...patch }));
  }, [form.emergencySameAsGuardian, form.guardian.firstName, form.guardian.middleName, form.guardian.lastName, form.guardian.suffix, form.guardian.landline]);

  function toggleEmergencySameAsMother(checked) {
    setForm((f) => ({
      ...f,
      emergencySameAsMotherContact: checked,
      emergencySameAsFatherContact: checked ? false : f.emergencySameAsFatherContact,
      emergencySameAsGuardian: checked ? false : f.emergencySameAsGuardian,
    }));
  }

  function toggleEmergencySameAsFather(checked) {
    setForm((f) => ({
      ...f,
      emergencySameAsFatherContact: checked,
      emergencySameAsMotherContact: checked ? false : f.emergencySameAsMotherContact,
      emergencySameAsGuardian: checked ? false : f.emergencySameAsGuardian,
    }));
  }

  function toggleEmergencySameAsGuardian(checked) {
    setForm((f) => ({
      ...f,
      emergencySameAsGuardian: checked,
      emergencySameAsMotherContact: checked ? false : f.emergencySameAsMotherContact,
      emergencySameAsFatherContact: checked ? false : f.emergencySameAsFatherContact,
    }));
  }

  // One-click fill for the Emergency Contact "Name" field from the
  // Mother/Father details captured earlier in the form. Also fills in the
  // Relationship field to match, same as the "Same as Guardian" behavior.
  function fillEmergencyFromParent(parent) {
    const name = parent === "Mother" ? form.motherName : form.fatherName;
    setForm((f) => ({
      ...f,
      emergencyName: name,
      emergencyRelationship: parent,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.sex ||
      !form.dateOfBirth ||
      !form.address.trim()
    ) {
      setError("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);

    // Re-derive the Hospital No. fresh right before saving rather than
    // trusting the value generated when the modal opened — now that
    // patients live in a real shared database instead of per-browser
    // localStorage, another registration could have happened in the
    // meantime (e.g. a teammate on another computer).
    const latestPatients = await loadPatients();
    const freshHospitalNo = generateHospitalNo(latestPatients);

    const patient = {
      patientId: generatePatientId(),
      hospitalNo: freshHospitalNo,
      pin: freshHospitalNo,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      middleName: form.middleName.trim(),
      suffix: form.suffix,
      sex: form.sex,
      dateOfBirth: form.dateOfBirth,
      email: form.email.trim(),
      landline: form.landline.trim(),
      mobile: form.mobile.trim(),
      hasGuardian: form.hasGuardian,
      guardian: form.hasGuardian ? form.guardian : null,
      address: form.address.trim(),
      region: form.region,
      regionCode: form.regionCode,
      province: form.province,
      provinceCode: form.provinceCode,
      city: form.city,
      cityCode: form.cityCode,
      barangay: form.barangay,
      zipCode: form.zipCode,

      motherName: form.motherName.trim(),
      motherContact: form.motherContact.trim(),
      fatherName: form.fatherName.trim(),
      fatherContact: form.fatherContact.trim(),
      nationality: form.nationality.trim(),
      religion: form.religion.trim(),
      maritalStatus: form.maritalStatus,

      emergencyName: form.emergencyName.trim(),
      emergencyAddress: form.emergencyAddress.trim(),
      emergencyRelationship: form.emergencyRelationship.trim(),
      emergencyPhoneHome: form.emergencyPhoneHome.trim(),
      emergencyPhoneCell: form.emergencyPhoneCell.trim(),

      konsultaEligibility: "Not Set",
      patientType: PATIENT_TYPE_BY_ROLE[user?.role] || "OPD Patient",
    };

    try {
      const created = await createPatient(patient);
      onCreated(created);
    } catch {
      setError("Could not save the patient. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-semibold text-slate-800">Create Patient</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
            {/* Patient Details */}
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-3">Patient Details</p>
              <div className="space-y-3">
                <Field label="Hospital No.">
                  <input
                    value={hospitalNo || "Generating…"}
                    readOnly
                    title="Auto-generated: sequence + year + month"
                    className={`${inputClass} bg-slate-50 text-slate-600 cursor-not-allowed`}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="First Name" required>
                    <input
                      value={form.firstName}
                      onChange={(e) => set("firstName", e.target.value)}
                      required
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Last Name" required>
                    <input
                      value={form.lastName}
                      onChange={(e) => set("lastName", e.target.value)}
                      required
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Middle Name">
                    <input
                      value={form.middleName}
                      onChange={(e) => set("middleName", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Suffix">
                    <select
                      value={form.suffix}
                      onChange={(e) => set("suffix", e.target.value)}
                      className={inputClass}
                    >
                      {SUFFIX_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s || "—"}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Sex" required>
                    <select
                      value={form.sex}
                      onChange={(e) => set("sex", e.target.value)}
                      required
                      className={inputClass}
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </Field>
                  <Field label="Date of Birth" required>
                    <input
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(e) => set("dateOfBirth", e.target.value)}
                      required
                      className={inputClass}
                    />
                  </Field>
                </div>

                <Field label="Age">
                  <input
                    type="text"
                    value={form.dateOfBirth ? `${ageInYears(form.dateOfBirth)} years old` : ""}
                    readOnly
                    disabled
                    placeholder="Auto-filled from date of birth"
                    className={inputClass}
                  />
                </Field>

                <Field label="Email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    className={inputClass}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Landline No.">
                    <input
                      value={form.landline}
                      onChange={(e) => set("landline", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Mobile No.">
                    <MobileField value={form.mobile} onChange={(e) => set("mobile", e.target.value)} />
                  </Field>
                </div>
              </div>
            </div>

            {/* Guardian Details */}
            <div>
              <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.hasGuardian}
                  onChange={(e) => set("hasGuardian", e.target.checked)}
                  className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                <span className="text-sm font-semibold text-slate-700">Has Guardian?</span>
              </label>

              <fieldset
                disabled={!form.hasGuardian}
                className={`space-y-3 ${!form.hasGuardian ? "opacity-50" : ""}`}
              >
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First Name">
                    <input
                      value={form.guardian.firstName}
                      onChange={(e) => setGuardian("firstName", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Last Name">
                    <input
                      value={form.guardian.lastName}
                      onChange={(e) => setGuardian("lastName", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Middle Name">
                    <input
                      value={form.guardian.middleName}
                      onChange={(e) => setGuardian("middleName", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Suffix">
                    <select
                      value={form.guardian.suffix}
                      onChange={(e) => setGuardian("suffix", e.target.value)}
                      className={inputClass}
                    >
                      {SUFFIX_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s || "—"}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Sex">
                    <select
                      value={form.guardian.sex}
                      onChange={(e) => setGuardian("sex", e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </Field>
                  <Field label="Date of Birth">
                    <input
                      type="date"
                      value={form.guardian.dateOfBirth}
                      onChange={(e) => setGuardian("dateOfBirth", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                </div>
                <Field label="PIN">
                  <input
                    value={form.guardian.pin}
                    onChange={(e) => setGuardian("pin", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Landline No.">
                    <input
                      value={form.guardian.landline}
                      onChange={(e) => setGuardian("landline", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Mobile No.">
                    <MobileField
                      value={form.guardian.mobile}
                      onChange={(e) => setGuardian("mobile", e.target.value)}
                    />
                  </Field>
                </div>
              </fieldset>
            </div>
          </div>

          {/* Address Details */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <p className="text-sm font-semibold text-slate-700 mb-3">Address Details</p>
            <div className="space-y-3">
              <Field label="Address" required>
                <input
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  required
                  placeholder="House/Unit No., Street, Subdivision"
                  className={inputClass}
                />
              </Field>

              <AddressFields value={form} onChange={handleAddressChange} Field={Field} inputClass={inputClass} />
            </div>
          </div>

          {/* Family Background */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <p className="text-sm font-semibold text-slate-700 mb-3">Family Background</p>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name of Mother">
                  <input
                    value={form.motherName}
                    onChange={(e) => set("motherName", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Contact No.">
                  <input
                    value={form.motherContact}
                    onChange={(e) => set("motherContact", e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name of Father">
                  <input
                    value={form.fatherName}
                    onChange={(e) => set("fatherName", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Contact No.">
                  <input
                    value={form.fatherContact}
                    onChange={(e) => set("fatherContact", e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Nationality">
                <input
                  value={form.nationality}
                  onChange={(e) => set("nationality", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Religion">
                <input
                  value={form.religion}
                  onChange={(e) => set("religion", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Marital Status">
                <select
                  value={form.maritalStatus}
                  onChange={(e) => set("maritalStatus", e.target.value)}
                  className={inputClass}
                >
                  {MARITAL_STATUS_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m || "Select"}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {/* Emergency Contact Person */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <p className="text-sm font-semibold text-slate-700 mb-3">Emergency Contact Person</p>
            <div className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <Field label="Name">
                  <input
                    value={form.emergencyName}
                    onChange={(e) => set("emergencyName", e.target.value)}
                    disabled={form.emergencySameAsGuardian}
                    className={inputClass}
                  />
                  <div className="mt-1.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fillEmergencyFromParent("Mother")}
                      disabled={form.emergencySameAsGuardian || !form.motherName.trim()}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Mother
                    </button>
                    <button
                      type="button"
                      onClick={() => fillEmergencyFromParent("Father")}
                      disabled={form.emergencySameAsGuardian || !form.fatherName.trim()}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Father
                    </button>
                  </div>
                </Field>
                <Field label="Relationship to Patient">
                  <input
                    value={form.emergencyRelationship}
                    onChange={(e) => set("emergencyRelationship", e.target.value)}
                    disabled={form.emergencySameAsGuardian}
                    className={inputClass}
                  />
                </Field>
              </div>

              {form.hasGuardian && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.emergencySameAsGuardian}
                    onChange={(e) => toggleEmergencySameAsGuardian(e.target.checked)}
                    className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  />
                  <span className="text-xs text-slate-500">Same as Guardian</span>
                </label>
              )}

              <div>
                <Field label="Address">
                  <input
                    value={form.emergencyAddress}
                    onChange={(e) => set("emergencyAddress", e.target.value)}
                    disabled={form.emergencySameAsPatientAddress}
                    className={inputClass}
                  />
                </Field>
                <label className="mt-1.5 flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.emergencySameAsPatientAddress}
                    onChange={(e) => set("emergencySameAsPatientAddress", e.target.checked)}
                    className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  />
                  <span className="text-xs text-slate-500">Same as Patient's Address</span>
                </label>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <Field label="Phone No. (Home)">
                  <input
                    value={form.emergencyPhoneHome}
                    onChange={(e) => set("emergencyPhoneHome", e.target.value)}
                    disabled={form.emergencySameAsGuardian}
                    className={inputClass}
                  />
                </Field>
                <div>
                  <Field label="Phone No. (Cell)">
                    <input
                      value={form.emergencyPhoneCell}
                      onChange={(e) => set("emergencyPhoneCell", e.target.value)}
                      disabled={
                        form.emergencySameAsMotherContact ||
                        form.emergencySameAsFatherContact ||
                        form.emergencySameAsGuardian
                      }
                      className={inputClass}
                    />
                  </Field>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={form.emergencySameAsMotherContact}
                        onChange={(e) => toggleEmergencySameAsMother(e.target.checked)}
                        className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                      />
                      <span className="text-xs text-slate-500">Same as Mother's Contact No.</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={form.emergencySameAsFatherContact}
                        onChange={(e) => toggleEmergencySameAsFather(e.target.checked)}
                        className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                      />
                      <span className="text-xs text-slate-500">Same as Father's Contact No.</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {submitting ? "Saving…" : "Create and Select Patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}