// E. Zarate Hospital — Medical Abstract, laid out to match the hospital's
// pre-printed paper form field-for-field (Medical Record No., Admitting
// Physician/Nurse, the Signs & Symptoms checklist, Physical Examination on
// Admission per system, Ancillaries/Medication done, Course in the Ward,
// Final Diagnosis, Outcome of Treatment, Take Home Medicines,
// Certification) — same "faithful replica of the real form" approach as
// CF4PDF.jsx / ErDischargePDF.jsx / MedicalCertificatePDF.jsx, rather than
// the dashboard's teal/rounded house style.
//
// DATA SOURCES — same three-source pattern CF4PDF.jsx already uses, since
// this is assembled from the exact same consultation data (a Medical
// Abstract and a CF4 summarize the same admission, just laid out
// differently on paper):
//   - `patient`     — name, sex, date of birth, address, Hospital No.
//   - `doctorEntry` — the doctor's most recent consultation save for this
//     admission. Owns nearly every field on this form: Chief Complaint,
//     Admitting Impression (admittingDiagnosis), History of Present
//     Illness, Signs & Symptoms, Referral, Physical Examination, Surgical
//     Procedure/RVS Code, Course in the Ward, Final Diagnosis
//     (dischargeDiagnosis), Case Rate Codes (used for "ICD 10 Code/RVS" —
//     there's no separate ICD-10 field on the Consultation Form yet),
//     admission/discharge date & time, Outcome of Treatment, Disposition,
//     Take Home Medicines (prescriptionItems), and the Certification
//     signature block.
//   - `erEntry`     — the ER/OPD nurse's most recent consultation save for
//     the same admission. Owns Pertinent Past Medical History and OB/GYN
//     History.
//   - `triage`      — the encounter's vitals (BP/HR/RR/Temp/Wt/Ht), for
//     the Vital Signs line under Physical Examination on Admission.
//   - `ancillaries` — optional array of { testName, status, datePerformed }
//     for any Lab/X-Ray/Ultrasound orders tied to this same admission
//     (see resolveMedicalAbstractSources() in utils/admittedPatients.js).
//     Renders under "Ancillaries Done"; the paper form's own blank is
//     otherwise hand-filled, so this is a bonus, not a required prop.
//
// Two fields on the paper form — "Admitting Nurse" and a dedicated ICD-10
// code for the Final Diagnosis — don't have their own column/field
// anywhere in the schema yet (nothing currently records which nurse's
// name should print there, and Case Rate Codes are the closest existing
// stand-in for "ICD 10 Code/RVS"). Both are left as blank ruled space
// instead of guessing, exactly like every other not-yet-captured field on
// this form.

import {
  Document, Page, Text, View, StyleSheet, Image,
} from "@react-pdf/renderer";
import logoImg from "../../assets/logo.jpg";
import { formatAge, ageInYears } from "../../utils/age";
import {
  SIGNS_AND_SYMPTOMS_OPTIONS,
  GENERAL_SURVEY_OPTIONS,
  HEENT_OPTIONS,
  PE_SYSTEMS,
} from "./ConsultationForm";

const ABSTRACT_SIZE = [595.28, 780];

const C = {
  black: "#0f172a",
  mid: "#334155",
  line: "#0f172a",
  rule: "#94a3b8",
  bg: "#f1f5f9",
};

const s = StyleSheet.create({
  page: {
    paddingTop: 26, paddingBottom: 30,
    paddingHorizontal: 40,
    fontSize: 9, fontFamily: "Times-Roman", color: C.black,
  },
  headerRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    borderBottomWidth: 1.5, borderBottomColor: C.black,
    paddingBottom: 8, marginBottom: 8,
  },
  hospName: { fontSize: 17, fontFamily: "Times-Bold", letterSpacing: 0.5 },
  hospSub: { fontSize: 7.5, color: C.mid, marginTop: 2 },
  sealCol: { alignItems: "center", width: 70 },
  seal: {
    width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: "#cbd5e1",
    overflow: "hidden",
  },
  sealImg: { width: 52, height: 52, objectFit: "cover" },

  mrnRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 4 },
  mrnLabel: { fontSize: 8.5, fontFamily: "Times-Bold" },
  mrnValue: {
    fontSize: 9.5, minWidth: 110, textAlign: "center",
    borderBottomWidth: 0.75, borderBottomColor: C.line, marginLeft: 4,
  },

  title: {
    fontSize: 13, fontFamily: "Times-Bold", textAlign: "center",
    textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10,
  },

  fieldRow: { flexDirection: "row", marginBottom: 5, alignItems: "flex-end" },
  fLabel: { fontSize: 8.5, fontFamily: "Times-Bold", marginRight: 4 },
  fValue: {
    flex: 1, fontSize: 9.5, borderBottomWidth: 0.75, borderBottomColor: C.line,
    paddingBottom: 1, minHeight: 12,
  },

  bar: {
    backgroundColor: C.black, paddingVertical: 2.5, paddingHorizontal: 5,
    marginTop: 8, marginBottom: 4,
  },
  barText: {
    color: "#ffffff", fontSize: 7.6, fontFamily: "Times-Bold",
    textTransform: "uppercase", letterSpacing: 0.4,
  },

  blockWrap: { marginBottom: 5 },
  blockLabel: { fontSize: 8.5, fontFamily: "Times-Bold", marginBottom: 2 },
  ruledBox: { borderWidth: 0.5, borderColor: C.rule },
  ruledLineText: {
    fontSize: 9, minHeight: 13, paddingHorizontal: 2, paddingTop: 2,
    borderBottomWidth: 0.5, borderBottomColor: C.rule,
  },

  checkGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 3 },
  checkItem4: { flexDirection: "row", alignItems: "flex-start", width: "25%", marginBottom: 3, paddingRight: 3 },
  checkItem3: { flexDirection: "row", alignItems: "flex-start", width: "33.33%", marginBottom: 3, paddingRight: 3 },
  checkItem2: { flexDirection: "row", alignItems: "flex-start", width: "50%", marginBottom: 3, paddingRight: 3 },
  checkBox: {
    width: 7.5, height: 7.5, borderWidth: 0.9, borderColor: C.black,
    marginRight: 3, marginTop: 1, flexShrink: 0,
  },
  checkBoxChecked: { backgroundColor: C.black },
  checkLabel: { fontSize: 7.4, lineHeight: 1.15 },

  peSystem: { marginBottom: 4 },
  peSystemLabel: {
    fontSize: 7.8, fontFamily: "Times-Bold", textTransform: "uppercase",
    marginBottom: 1, color: C.mid,
  },

  table: { borderWidth: 0.5, borderColor: C.rule, marginTop: 1, marginBottom: 5 },
  tHeadRow: { flexDirection: "row", backgroundColor: C.bg, borderBottomWidth: 0.5, borderBottomColor: C.rule },
  tRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.rule },
  tRowLast: { flexDirection: "row" },
  tCellDate: { width: 60, padding: 3, fontSize: 7.6, borderRightWidth: 0.5, borderRightColor: C.rule },
  tCellHeadDate: {
    width: 60, padding: 3, fontSize: 6.8, fontFamily: "Times-Bold",
    textTransform: "uppercase", borderRightWidth: 0.5, borderRightColor: C.rule,
  },
  tCellWide: { flex: 1, padding: 3, fontSize: 7.8 },
  tCellHeadWide: { flex: 1, padding: 3, fontSize: 6.8, fontFamily: "Times-Bold", textTransform: "uppercase" },

  outcomeRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 2, marginBottom: 4 },
  outcomeItem: { flexDirection: "row", alignItems: "center", marginRight: 16, marginBottom: 2 },

  sigRow: { marginTop: 22, flexDirection: "row", gap: 40 },
  sigCol: { flex: 1 },
  sigLine: { borderBottomWidth: 1, borderBottomColor: C.black, height: 22 },
  sigName: { fontSize: 9.5, fontFamily: "Times-Bold", marginTop: 3 },
  sigLabel: { fontSize: 7.5, fontFamily: "Times-Italic", color: C.mid },
  certifyText: { fontSize: 8, fontFamily: "Times-Italic", marginTop: 4, marginBottom: 2, lineHeight: 1.3 },

  footer: {
    position: "absolute", bottom: 16, left: 40, right: 40,
    flexDirection: "row", justifyContent: "space-between",
    fontSize: 6.5, color: C.mid,
    borderTopWidth: 0.5, borderTopColor: C.rule, paddingTop: 4,
  },
});

const dash = (v) => (v && String(v).trim() ? String(v) : "");

function Bar({ title }) {
  return (
    <View style={s.bar}>
      <Text style={s.barText}>{title}</Text>
    </View>
  );
}

function FieldLine({ label, value, width }) {
  return (
    <View style={[s.fieldRow, width ? { width } : { flex: 1 }]}>
      <Text style={s.fLabel}>{label}:</Text>
      <Text style={s.fValue}>{dash(value)}</Text>
    </View>
  );
}

// Word-wraps free text into fixed ruled lines, same approach every sibling
// PDF (MedicalCertificatePDF, AdmissionDischargeRecordPDF, CF4PDF) uses so
// longer fields still read like they belong on a ruled pad instead of one
// run-on line.
function RuledBlock({ label, value, lines }) {
  const text = dash(value);
  const words = text.split(/\s+/).filter(Boolean);
  const rowsOut = [];
  let current = "";
  const maxCharsPerLine = 96;
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (next.length > maxCharsPerLine) {
      rowsOut.push(current);
      current = w;
    } else {
      current = next;
    }
  }
  if (current) rowsOut.push(current);

  const rowCount = Math.max(lines, rowsOut.length);
  const filled = Array.from({ length: rowCount }, (_, i) => rowsOut[i] || "");

  return (
    <View style={s.blockWrap}>
      <Text style={s.blockLabel}>{label}:</Text>
      <View style={s.ruledBox}>
        {filled.map((line, i) => (
          <Text key={i} style={s.ruledLineText}>{line}</Text>
        ))}
      </View>
    </View>
  );
}

function Check({ checked, label, width = 4 }) {
  const style = width === 2 ? s.checkItem2 : width === 3 ? s.checkItem3 : s.checkItem4;
  return (
    <View style={style}>
      <View style={[s.checkBox, checked ? s.checkBoxChecked : null]} />
      <Text style={s.checkLabel}>{label}</Text>
    </View>
  );
}

// "2026-07-19" -> "07/19/2026"
function formatDate(d) {
  if (!d) return "";
  const dt = new Date(`${d}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return d;
  return `${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")}/${dt.getFullYear()}`;
}

// "14:05" -> "02:05 PM"
function formatTime(t) {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return "";
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${mStr} ${period}`;
}

// Whole admitted days, inclusive of both the admission and discharge date
// — "Duration" on the paper form is filled by hand the same way, so this
// is just the arithmetic a nurse would otherwise do themselves.
function computeDuration(dateAdmitted, dateDischarged) {
  if (!dateAdmitted || !dateDischarged) return "";
  const a = new Date(`${dateAdmitted}T00:00:00`);
  const d = new Date(`${dateDischarged}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(d.getTime())) return "";
  const days = Math.round((d - a) / 86400000) + 1;
  return days > 0 ? `${days} day${days === 1 ? "" : "s"}` : "";
}

export default function MedicalAbstractPDF({
  patient = {}, doctorEntry = {}, erEntry = {}, triage = null, ancillaries = [],
}) {
  const generatedOn = new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
  const fullName = [patient.lastName, patient.firstName, patient.middleName].filter(Boolean).join(", ");
  const isFemale = (patient.sex || "").toLowerCase() === "female";
  const age = ageInYears(patient.dateOfBirth);

  const signs = doctorEntry.admissionSigns || [];
  const pastMedicalHistory = (erEntry.pastMedicalHistory || [])
    .map((item) => item.text)
    .filter(Boolean)
    .join("; ");
  const referred = doctorEntry.referredFromOtherHCI;
  const courseInWard = (doctorEntry.courseInWardEntries || []).filter((e) => e.date || e.orderAction);
  const erMedicineItems = (doctorEntry.erMedicineItems || []).filter(
    (i) => i.genericName || i.quantityDosageRoute || i.totalCost
  );
  const takeHomeItems = (doctorEntry.prescriptionItems || []).filter(
    (i) => i.medicineName || i.instructions
  );
  const ancillaryRows = (ancillaries || []).filter((a) => a.testName);

  const icd10OrRvs = [doctorEntry.caseRateCode1, doctorEntry.caseRateCode2].filter(Boolean).join(" / ");
  const duration = computeDuration(doctorEntry.dateAdmitted, doctorEntry.dateDischarged);

  const vitals = triage
    ? `BP: ${dash(triage.systolic && triage.diastolic ? `${triage.systolic}/${triage.diastolic}` : "")}   ` +
      `HR: ${dash(triage.heartRate)}   RR: ${dash(triage.respiratoryRate)}   Temp: ${dash(triage.temperature)}   ` +
      `Wt: ${dash(triage.weight)}   Ht: ${dash(triage.height)}`
    : null;

  return (
    <Document title={`Medical Abstract - ${fullName || "Patient"}`} author="E. ZARATE HOSPITAL">
      {/* ── PAGE 1 ── */}
      <Page size={ABSTRACT_SIZE} style={s.page}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.hospName}>E. ZARATE HOSPITAL</Text>
            <Text style={s.hospSub}>16 J. Aguilar Avenue, Talon 1, Las Piñas City, Metro Manila, Philippines</Text>
            <Text style={s.hospSub}>Tel. Nos.: (02) 8871-1440 · (02) 8873-5593 · (02) 8874-6905</Text>
            <Text style={s.hospSub}>Mobile Nos.: Smart (0919) 991-4938 · Globe (0917) 538-2440</Text>
            <Text style={s.hospSub}>E-mails: zarateclinic@yahoo.com · zarateopd@gmail.com</Text>
          </View>
          <View style={s.sealCol}>
            <View style={s.seal}><Image src={logoImg} style={s.sealImg} /></View>
          </View>
        </View>

        <View style={s.mrnRow}>
          <Text style={s.mrnLabel}>Medical Record No.:</Text>
          <Text style={s.mrnValue}>{dash(patient.hospitalNo)}</Text>
        </View>

        <Text style={s.title}>Medical Abstract</Text>

        <FieldLine label="Name" value={fullName} />
        <View style={s.fieldRow}>
          <FieldLine label="Age / Sex" value={age !== null ? `${age} / ${dash(patient.sex)}` : dash(patient.sex)} width={140} />
          <View style={{ width: 10 }} />
          <FieldLine label="DOB" value={formatDate(patient.dateOfBirth)} width={140} />
        </View>
        <FieldLine label="Address" value={patient.address} />
        <View style={s.fieldRow}>
          <FieldLine label="Admitting Physician" value={doctorEntry.attendingPrintedName} />
          <View style={{ width: 10 }} />
          {/* No dedicated "admitting nurse" field exists yet in the
              Consultation Form's data model — left blank rather than
              guessing which nurse this was, same reasoning as the file
              banner above. */}
          <FieldLine label="Admitting Nurse" value={null} />
        </View>
        <FieldLine
          label="Date/Time Admitted"
          value={
            doctorEntry.dateAdmitted
              ? `${formatDate(doctorEntry.dateAdmitted)}${doctorEntry.timeAdmitted ? `  ${formatTime(doctorEntry.timeAdmitted)}` : ""}`
              : ""
          }
        />

        <RuledBlock label="Chief Complaint" value={doctorEntry.chiefComplaint} lines={1} />
        <RuledBlock label="Admitting Impression" value={doctorEntry.admittingDiagnosis} lines={1} />
        <RuledBlock label="Brief History of Present Illness" value={doctorEntry.historyOfPresentIllness} lines={4} />
        <RuledBlock label="Pertinent Past Medical History" value={pastMedicalHistory} lines={2} />
        <View style={s.blockWrap}>
          <Text style={s.blockLabel}>OB/GYN History:</Text>
          <View style={s.ruledBox}>
            <Text style={s.ruledLineText}>
              {isFemale
                ? `G ${dash(erEntry.noOfPregnancies)}   P ${dash(erEntry.noOfDeliveries)}   ` +
                  `(${dash(erEntry.fullTerm)} - ${dash(erEntry.premature)} - ${dash(erEntry.noOfAbortions)})   ` +
                  `LMP: ${dash(erEntry.lastMenstrualPeriod)}`
                : "N/A"}
            </Text>
          </View>
        </View>

        <Text style={s.blockLabel}>Pertinent signs and symptoms on admission (tick applicable box/es)</Text>
        <View style={s.checkGrid}>
          {SIGNS_AND_SYMPTOMS_OPTIONS.filter((o) => o !== "Pain" && o !== "Others").map((opt) => (
            <Check key={opt} checked={signs.includes(opt)} label={opt} />
          ))}
          <Check
            checked={signs.includes("Pain")}
            label={`Pain${doctorEntry.admissionSignsPainSite ? ` (${doctorEntry.admissionSignsPainSite})` : ""}`}
          />
          <Check
            checked={signs.includes("Others")}
            label={`Others${doctorEntry.admissionSignsOthers ? `: ${doctorEntry.admissionSignsOthers}` : ""}`}
          />
        </View>

        <View style={s.fieldRow}>
          <Text style={s.blockLabel}>Referred from another health care institution (HCI)?  </Text>
        </View>
        <View style={s.checkGrid}>
          <Check checked={referred === "NO"} label="No" width={2} />
          <Check checked={referred === "YES"} label="Yes" width={2} />
        </View>
        <FieldLine label="Name of originating HCI" value={doctorEntry.referringHCIName} />

        <Bar title="Physical Examination on Admission (Pertinent Findings per System)" />

        <View style={s.peSystem}>
          <Text style={s.peSystemLabel}>General Survey</Text>
          <View style={s.checkGrid}>
            {GENERAL_SURVEY_OPTIONS.map((opt) => (
              <Check
                key={opt}
                checked={(doctorEntry.peGeneralSurvey || []).includes(opt)}
                label={
                  opt === "Altered sensorium" && doctorEntry.peGeneralSurveyAlteredSensoriumSpecify
                    ? `${opt}: ${doctorEntry.peGeneralSurveyAlteredSensoriumSpecify}`
                    : opt
                }
              />
            ))}
          </View>
          {vitals && (
            <View style={s.ruledBox}>
              <Text style={s.ruledLineText}>{vitals}</Text>
            </View>
          )}
        </View>

        <View style={s.peSystem}>
          <Text style={s.peSystemLabel}>SHEENT</Text>
          <View style={s.checkGrid}>
            {HEENT_OPTIONS.map((opt) => (
              <Check key={opt} checked={(doctorEntry.peHeent || []).includes(opt)} label={opt} />
            ))}
            {doctorEntry.peHeentOthers ? <Check checked label={`Others: ${doctorEntry.peHeentOthers}`} width={2} /> : null}
          </View>
        </View>

        {PE_SYSTEMS.map((system) => (
          <View key={system.key} style={s.peSystem}>
            <Text style={s.peSystemLabel}>{system.label.toUpperCase()}</Text>
            <View style={s.checkGrid}>
              {system.options.map((opt) => (
                <Check key={opt} checked={(doctorEntry[system.key] || []).includes(opt)} label={opt} />
              ))}
              {doctorEntry[system.othersKey] ? (
                <Check checked label={`Others: ${doctorEntry[system.othersKey]}`} width={2} />
              ) : null}
            </View>
          </View>
        ))}

        <RuledBlock label="Surgical Procedures (RVS CODE)" value={doctorEntry.surgicalProcedureRvsCode} lines={1} />

        <View style={s.footer} fixed>
          <Text>E. ZARATE HOSPITAL  |  Medical Abstract</Text>
          <Text>Generated on {generatedOn}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ── PAGE 2 ── */}
      <Page size={ABSTRACT_SIZE} style={s.page}>
        <RuledBlock
          label="Ancillaries Done"
          value={
            ancillaryRows.length
              ? ancillaryRows
                  .map((a) => `${a.testName}${a.datePerformed ? ` (${formatDate(a.datePerformed)})` : ""}`)
                  .join("; ")
              : ""
          }
          lines={2}
        />
        <RuledBlock
          label="Medication / Treatment Done"
          value={
            erMedicineItems.length
              ? erMedicineItems
                  .map((i) => [i.genericName, i.quantityDosageRoute].filter(Boolean).join(" — "))
                  .join("; ")
              : ""
          }
          lines={3}
        />

        <Text style={s.blockLabel}>Course in the Ward:</Text>
        <View style={s.table}>
          <View style={s.tHeadRow}>
            <Text style={s.tCellHeadDate}>Date</Text>
            <Text style={s.tCellHeadWide}>Doctor's Order / Action</Text>
          </View>
          {courseInWard.length === 0 ? (
            <View style={s.tRowLast}>
              <Text style={s.tCellDate}> </Text>
              <Text style={[s.tCellWide, { color: C.rule }]}> </Text>
            </View>
          ) : (
            courseInWard.map((entry, i) => (
              <View key={entry.id || i} style={i === courseInWard.length - 1 ? s.tRowLast : s.tRow}>
                <Text style={s.tCellDate}>{formatDate(entry.date)}</Text>
                <Text style={s.tCellWide}>{dash(entry.orderAction)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={s.fieldRow}>
          <FieldLine label="Final Diagnosis" value={doctorEntry.dischargeDiagnosis} />
          <View style={{ width: 10 }} />
          <FieldLine label="ICD 10 Code / RVS" value={icd10OrRvs} width={140} />
        </View>
        <View style={s.fieldRow}>
          <FieldLine
            label="Date/Time of Discharge"
            value={
              doctorEntry.dateDischarged
                ? `${formatDate(doctorEntry.dateDischarged)}${doctorEntry.timeDischarged ? `  ${formatTime(doctorEntry.timeDischarged)}` : ""}`
                : "Still Admitted"
            }
          />
          <View style={{ width: 10 }} />
          <FieldLine label="Duration" value={duration} width={110} />
        </View>

        <Text style={s.blockLabel}>Outcome of treatment:</Text>
        <View style={s.outcomeRow}>
          {["Improved", "HAMA", "Expired", "Absconded", "Transferred"].map((opt) => (
            <View key={opt} style={s.outcomeItem}>
              <View style={[s.checkBox, doctorEntry.outcomeOfTreatment === opt ? s.checkBoxChecked : null]} />
              <Text style={s.checkLabel}>{opt.toUpperCase()}</Text>
            </View>
          ))}
        </View>
        <FieldLine label="Disposition" value={doctorEntry.disposition} />

        <RuledBlock
          label="Take Home Medicines"
          value={
            takeHomeItems.length
              ? takeHomeItems
                  .map((i) =>
                    [
                      `${i.medicineName || ""}${i.milligram ? ` (${i.milligram})` : ""}`.trim(),
                      i.quantity ? `x${i.quantity}` : "",
                      i.instructions,
                    ]
                      .filter(Boolean)
                      .join(" — ")
                  )
                  .join("; ")
              : ""
          }
          lines={3}
        />

        <Text style={s.blockLabel}>Certification of Attending Health Care Professional</Text>
        <Text style={s.certifyText}>
          I certify that the above information given in this form, including all attachments, are true and correct.
        </Text>

        <View style={s.sigRow}>
          <View style={s.sigCol}>
            <View style={s.sigLine} />
            <Text style={s.sigName}>
              {dash(doctorEntry.attendingPrintedName)}
              {doctorEntry.attendingPrintedName ? ", M.D." : ""}
            </Text>
            <Text style={s.sigLabel}>Signature over Printed Name of Attending Physician</Text>
          </View>
          <View style={{ width: 110 }}>
            <View style={s.sigLine} />
            <Text style={s.sigName}>{formatDate(doctorEntry.attendingCertifiedDate) || " "}</Text>
            <Text style={s.sigLabel}>Date Signed</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>E. ZARATE HOSPITAL  |  Medical Abstract</Text>
          <Text>Generated on {generatedOn}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
