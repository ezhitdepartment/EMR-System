// PhilHealth CF4 (Claim Form 4) — laid out to match the hospital's paper
// CF4 as closely as react-pdf's box model allows (section bars numbered
// I–VII, boxed fields, checkbox grids), instead of the hospital's own
// house style the other Patient Files PDFs use.
//
// This form is never filled out on its own screen — it's assembled
// entirely from data other roles already captured:
//   - `doctorEntry`  — the doctor's most recent consultation save. Owns
//     nearly every CF4 field: Chief Complaint, Admitting/Discharge
//     Diagnosis, Case Rate Codes, admission/discharge date & time,
//     Referral, Pertinent Signs & Symptoms, Physical Examination on
//     Admission, Outcome of Treatment, Drugs/Medicines, and the
//     Certification signature block.
//   - `erEntry` — the ER nurse's most recent consultation save (matched to
//     the same encounter as `doctorEntry` when possible). Owns Pertinent
//     Past Medical History, OB/GYN History, Course in the Ward, and
//     Surgical Procedure/RVS Code — see ER_NURSE_ONLY_SECTIONS and
//     NURSE_SECTIONS in ConsultationForm.jsx for why those specifically
//     live there instead of on the doctor's entry.
//   - `patient` — name, sex, date of birth, Hospital No.
//   - `triage` — the encounter's vitals (BP/HR/RR/Temp), for the Vital
//     Signs line under Physical Examination on Admission.
//
// Nothing here is hand-typed by staff — if a field reads "—" it's because
// neither the doctor's nor the ER nurse's consultation entry has filled
// that field in yet, not because this form has its own blank to fill.

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { ageInYears } from "../../utils/age";
import {
  SIGNS_AND_SYMPTOMS_OPTIONS,
  GENERAL_SURVEY_OPTIONS,
  HEENT_OPTIONS,
  PE_SYSTEMS,
} from "./ConsultationForm";

const C = {
  dark: "#1e293b",
  mid: "#64748b",
  light: "#94a3b8",
  border: "#94a3b8",
  bg: "#f1f5f9",
  barBg: "#334155",
  white: "#ffffff",
};

const s = StyleSheet.create({
  page: {
    paddingTop: 24, paddingBottom: 30, paddingHorizontal: 30,
    fontSize: 7.5, fontFamily: "Helvetica", color: C.dark,
  },

  // Header
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  phName: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  phSub: { fontSize: 6.5, color: C.mid, fontStyle: "italic" },
  formTitle: { fontSize: 15, fontFamily: "Helvetica-Bold", textAlign: "right" },
  formSub: { fontSize: 6.5, color: C.mid, textAlign: "right" },
  reminders: { fontSize: 6, color: C.mid, lineHeight: 1.4, marginTop: 3, marginBottom: 3 },
  remindersBold: { fontFamily: "Helvetica-Bold" },

  // Section bars — "I. HEALTH CARE INSTITUTION (HCI) INFORMATION" etc.
  bar: { backgroundColor: C.barBg, paddingVertical: 3, paddingHorizontal: 6, marginTop: 5, marginBottom: 4 },
  barText: { color: C.white, fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.3 },

  // Boxed grid — mimics the paper form's ruled boxes.
  grid: { borderWidth: 0.75, borderColor: C.border },
  gridRow: { flexDirection: "row" },
  gridRowBorder: { flexDirection: "row", borderTopWidth: 0.75, borderTopColor: C.border },
  cell: { flex: 1, padding: 4, borderRightWidth: 0.75, borderRightColor: C.border },
  cellLast: { flex: 1, padding: 4 },
  cellLabel: { fontSize: 5.5, color: C.mid, textTransform: "uppercase", marginBottom: 2 },
  cellVal: { fontSize: 8, fontFamily: "Helvetica-Bold", minHeight: 10 },
  cellValSm: { fontSize: 7, fontFamily: "Helvetica-Bold", minHeight: 9 },

  blk: { marginTop: 4, marginBottom: 2 },
  blkLabel: { fontSize: 6, color: C.mid, textTransform: "uppercase", marginBottom: 2, fontFamily: "Helvetica-Bold" },
  blkVal: { fontSize: 7.5, backgroundColor: C.bg, padding: 5, lineHeight: 1.45, minHeight: 24 },

  // Checkbox grids
  checkGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 2, marginBottom: 3 },
  checkItem: { flexDirection: "row", alignItems: "flex-start", width: "25%", marginBottom: 3, paddingRight: 3 },
  checkItemWide: { flexDirection: "row", alignItems: "flex-start", width: "50%", marginBottom: 3, paddingRight: 3 },
  checkBox: {
    width: 7, height: 7, borderWidth: 0.75, borderColor: C.dark,
    marginRight: 3, alignItems: "center", justifyContent: "center", marginTop: 0.5, flexShrink: 0,
  },
  checkBoxMark: { fontSize: 6, fontFamily: "Helvetica-Bold" },
  checkLabel: { fontSize: 6.5, lineHeight: 1.2 },

  sectionLabel: { fontSize: 6.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginTop: 4, marginBottom: 2 },

  // Tables — Course in the Ward / Drugs & Medicines
  table: { borderWidth: 0.75, borderColor: C.border, marginTop: 2, marginBottom: 4 },
  tHeadRow: { flexDirection: "row", backgroundColor: C.bg, borderBottomWidth: 0.75, borderBottomColor: C.border },
  tRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.border },
  tRowLast: { flexDirection: "row" },
  tCellDate: { width: 46, padding: 3, fontSize: 6.5, borderRightWidth: 0.5, borderRightColor: C.border },
  tCellHeadDate: { width: 46, padding: 3, fontSize: 6, fontFamily: "Helvetica-Bold", textTransform: "uppercase", borderRightWidth: 0.5, borderRightColor: C.border },
  tCellWide: { flex: 1, padding: 3, fontSize: 7 },
  tCellHeadWide: { flex: 1, padding: 3, fontSize: 6, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  tCell3: { flex: 1, padding: 3, fontSize: 6.5, borderRightWidth: 0.5, borderRightColor: C.border },
  tCell3Last: { flex: 1, padding: 3, fontSize: 6.5 },
  tCellHead3: { flex: 1, padding: 3, fontSize: 6, fontFamily: "Helvetica-Bold", textTransform: "uppercase", borderRightWidth: 0.5, borderRightColor: C.border },
  tCellHead3Last: { flex: 1, padding: 3, fontSize: 6, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },

  outcomeRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 3, marginBottom: 3 },
  outcomeItem: { flexDirection: "row", alignItems: "center", marginRight: 14, marginBottom: 3 },

  certifyText: { fontSize: 7, fontStyle: "italic", marginTop: 3, marginBottom: 10, lineHeight: 1.4 },
  sigRow: { flexDirection: "row", marginTop: 4, gap: 20 },
  sigBlock: { flex: 1 },
  sigLine: { borderBottomWidth: 0.75, borderBottomColor: C.dark, height: 20, marginBottom: 2 },
  sigCaption: { fontSize: 6, color: C.mid, textAlign: "center" },

  footer: {
    position: "absolute", bottom: 14, left: 30, right: 30,
    flexDirection: "row", justifyContent: "space-between",
    fontSize: 6, color: C.light,
    borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 3,
  },
});

const dash = (v) => (v === 0 ? "0" : v && String(v).trim() ? String(v) : "—");

function Bar({ title }) {
  return (
    <View style={s.bar}>
      <Text style={s.barText}>{title}</Text>
    </View>
  );
}

function Cell({ label, value, last, small }) {
  return (
    <View style={last ? s.cellLast : s.cell}>
      <Text style={s.cellLabel}>{label}</Text>
      <Text style={small ? s.cellValSm : s.cellVal}>{dash(value)}</Text>
    </View>
  );
}

function Blk({ label, value, rows = 2 }) {
  return (
    <View style={s.blk}>
      <Text style={s.blkLabel}>{label}</Text>
      <Text style={[s.blkVal, { minHeight: rows * 10 }]}>{dash(value)}</Text>
    </View>
  );
}

function Check({ checked, label, wide }) {
  return (
    <View style={wide ? s.checkItemWide : s.checkItem}>
      <View style={s.checkBox}>{checked ? <Text style={s.checkBoxMark}>X</Text> : null}</View>
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
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${mStr} ${period}`;
}

export default function CF4PDF({ patient = {}, doctorEntry = {}, erEntry = {}, triage = null }) {
  const generatedOn = new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
  const fullName = `${patient.lastName || ""}, ${patient.firstName || ""} ${patient.middleName || ""}`.trim();
  const isFemale = (patient.sex || "").toLowerCase() === "female";
  const age = ageInYears(patient.dateOfBirth);

  const signs = doctorEntry.admissionSigns || [];
  const pastMedicalHistory = (erEntry.pastMedicalHistory || [])
    .map((item) => item.text)
    .filter(Boolean)
    .join("; ");
  const obGyneNA = !isFemale;
  const referred = doctorEntry.referredFromOtherHCI;
  const courseInWard = (erEntry.courseInWardEntries || []).filter((e) => e.date || e.orderAction);
  const prescriptionItems = (doctorEntry.prescriptionItems || []).filter(
    (i) => i.medicineName || i.instructions
  );

  const vitals = triage
    ? `BP: ${dash(triage.systolic && triage.diastolic ? `${triage.systolic}/${triage.diastolic}` : "")}   HR: ${dash(
        triage.heartRate
      )}   RR: ${dash(triage.respiratoryRate)}   Temp: ${dash(triage.temperature)}`
    : null;

  return (
    <Document title={`CF4 - ${patient.hospitalNo || fullName}`} author="E. ZARATE HOSPITAL">
      {/* ── PAGE 1 ── */}
      <Page size="LETTER" style={s.page}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.phName}>PhilHealth</Text>
            <Text style={s.phSub}>Your Partner in Health</Text>
          </View>
          <View>
            <Text style={s.formSub}>This form may be reproduced and is NOT FOR SALE</Text>
            <Text style={s.formTitle}>CF4</Text>
            <Text style={s.formSub}>(Claim Form 4)</Text>
          </View>
        </View>

        <Text style={s.reminders}>
          <Text style={s.remindersBold}>IMPORTANT REMINDERS: </Text>
          Please fill out appropriate fields. Write in capital letters and check the appropriate boxes. This form,
          together with other supporting documents, should be filed within sixty (60) calendar days from date of
          discharge. All information, fields and tick boxes in this form are necessary.
        </Text>

        <Bar title="I. Health Care Institution (HCI) Information" />
        <View style={s.grid}>
          <View style={s.gridRow}>
            <Cell label="Name of HCI" value="E. ZARATE HOSPITAL" />
            <Cell label="Accreditation Number" value={null} last />
          </View>
          <View style={s.gridRowBorder}>
            <Cell label="Address of HCI" value="16 J. Aguilar Ave., Talon, Las Piñas City" last />
          </View>
        </View>

        <Bar title="II. Patient's Data" />
        <View style={s.grid}>
          <View style={s.gridRow}>
            <Cell label="Last Name" value={patient.lastName} />
            <Cell label="First Name" value={patient.firstName} />
            <Cell label="Middle Name" value={patient.middleName} />
            <Cell label="Hospital No. (PIN)" value={patient.hospitalNo} last small />
          </View>
          <View style={s.gridRowBorder}>
            <Cell label="Age" value={age !== null ? age : null} />
            <Cell
              label="Sex"
              value={patient.sex ? patient.sex.toUpperCase() : null}
              last
            />
          </View>
          <View style={s.gridRowBorder}>
            <Cell label="Chief Complaint" value={doctorEntry.chiefComplaint} last />
          </View>
          <View style={s.gridRowBorder}>
            <Cell label="Admitting Diagnosis" value={doctorEntry.admittingDiagnosis} />
            <Cell label="Discharge Diagnosis" value={doctorEntry.dischargeDiagnosis} last />
          </View>
          <View style={s.gridRowBorder}>
            <Cell label="1st Case Rate Code" value={doctorEntry.caseRateCode1} />
            <Cell label="2nd Case Rate Code" value={doctorEntry.caseRateCode2} last />
          </View>
          <View style={s.gridRowBorder}>
            <Cell label="Date Admitted" value={formatDate(doctorEntry.dateAdmitted)} />
            <Cell label="Time Admitted" value={formatTime(doctorEntry.timeAdmitted)} />
            <Cell label="Date Discharged" value={formatDate(doctorEntry.dateDischarged)} />
            <Cell label="Time Discharged" value={formatTime(doctorEntry.timeDischarged)} last />
          </View>
        </View>

        <Bar title="III. Reason for Admission" />
        <Blk label="History of Present Illness" value={doctorEntry.historyOfPresentIllness} rows={5} />
        <Blk label="Pertinent Past Medical History" value={pastMedicalHistory} rows={3} />

        <View style={s.blk}>
          <Text style={s.blkLabel}>OB/GYN History</Text>
          <Text style={s.blkVal}>
            {obGyneNA
              ? "N/A"
              : `G ${dash(erEntry.noOfPregnancies)}   P ${dash(erEntry.noOfDeliveries)}   ` +
                `(${dash(erEntry.fullTerm)} - ${dash(erEntry.premature)} - ${dash(erEntry.noOfAbortions)})   ` +
                `LMP: ${dash(erEntry.lastMenstrualPeriod)}`}
          </Text>
        </View>

        <Text style={s.sectionLabel}>Pertinent Signs and Symptoms on Admission</Text>
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

        <Text style={s.sectionLabel}>Referred from another Health Care Institution (HCI)?</Text>
        <View style={s.checkGrid}>
          <Check checked={referred === "NO"} label="No" wide />
          <Check
            checked={referred === "YES"}
            label={`Yes — ${dash(doctorEntry.referringHCIName)}`}
            wide
          />
        </View>

        <Bar title="Physical Examination on Admission (Pertinent Findings per System)" />
        <Text style={s.sectionLabel}>General Survey</Text>
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
              wide
            />
          ))}
        </View>
        {vitals && <Text style={[s.blkVal, { marginBottom: 4 }]}>{vitals}</Text>}

        <Text style={s.sectionLabel}>HEENT</Text>
        <View style={s.checkGrid}>
          {HEENT_OPTIONS.map((opt) => (
            <Check key={opt} checked={(doctorEntry.peHeent || []).includes(opt)} label={opt} />
          ))}
          {doctorEntry.peHeentOthers ? <Check checked label={`Others: ${doctorEntry.peHeentOthers}`} wide /> : null}
        </View>

        <View style={s.footer} fixed>
          <Text>E. ZARATE HOSPITAL  |  PhilHealth CF4</Text>
          <Text>Generated on {generatedOn}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ── PAGE 2 ── */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.sectionLabel}>Physical Examination continued (Pertinent Findings per System)</Text>
        {PE_SYSTEMS.map((system) => (
          <View key={system.key} style={{ marginBottom: 3 }}>
            <Text style={[s.sectionLabel, { marginBottom: 1 }]}>{system.label}</Text>
            <View style={s.checkGrid}>
              {system.options.map((opt) => (
                <Check key={opt} checked={(doctorEntry[system.key] || []).includes(opt)} label={opt} />
              ))}
              {doctorEntry[system.othersKey] ? (
                <Check checked label={`Others: ${doctorEntry[system.othersKey]}`} wide />
              ) : null}
            </View>
          </View>
        ))}

        <Bar title="IV. Course in the Ward (Doctor's Order/Action)" />
        <View style={s.table}>
          <View style={s.tHeadRow}>
            <Text style={s.tCellHeadDate}>Date</Text>
            <Text style={s.tCellHeadWide}>Doctor's Order/Action</Text>
          </View>
          {courseInWard.length === 0 ? (
            <View style={s.tRowLast}>
              <Text style={s.tCellDate}> </Text>
              <Text style={[s.tCellWide, { color: C.light }]}>—</Text>
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

        <Text style={s.sectionLabel}>Surgical Procedure / RVS Code</Text>
        <View style={[s.blkVal, { marginBottom: 4 }]}>
          <Text>
            {dash(erEntry.surgicalProcedureRvsCode)}
            {erEntry.surgicalProcedureNotes ? ` — ${erEntry.surgicalProcedureNotes}` : ""}
          </Text>
        </View>

        <Bar title="V. Drugs / Medicines" />
        <View style={s.table}>
          <View style={s.tHeadRow}>
            <Text style={s.tCellHead3}>Generic Name</Text>
            <Text style={s.tCellHead3}>Quantity / Dosage / Route</Text>
            <Text style={s.tCellHead3Last}>Total Cost</Text>
          </View>
          {prescriptionItems.length === 0 ? (
            <View style={s.tRowLast}>
              <Text style={[s.tCell3, { color: C.light }]}>—</Text>
              <Text style={s.tCell3}> </Text>
              <Text style={s.tCell3Last}> </Text>
            </View>
          ) : (
            prescriptionItems.map((item, i) => (
              <View key={item.id || i} style={i === prescriptionItems.length - 1 ? s.tRowLast : s.tRow}>
                <Text style={s.tCell3}>{dash(item.medicineName)}</Text>
                <Text style={s.tCell3}>
                  {[item.quantity, item.instructions].filter(Boolean).join(" — ") || "—"}
                </Text>
                <Text style={s.tCell3Last}>{dash(item.totalCost)}</Text>
              </View>
            ))
          )}
        </View>

        <Bar title="VI. Outcome of Treatment" />
        <View style={s.outcomeRow}>
          {["Improved", "HAMA", "Expired", "Absconded", "Transferred"].map((opt) => (
            <View key={opt} style={s.outcomeItem}>
              <View style={s.checkBox}>
                {doctorEntry.outcomeOfTreatment === opt ? <Text style={s.checkBoxMark}>X</Text> : null}
              </View>
              <Text style={s.checkLabel}>{opt.toUpperCase()}</Text>
            </View>
          ))}
        </View>
        {["Absconded", "Transferred", "Expired"].includes(doctorEntry.outcomeOfTreatment) && (
          <Text style={s.blkVal}>Reason: {dash(doctorEntry.outcomeOfTreatmentReason)}</Text>
        )}

        <Bar title="VII. Certification of Health Care Professional" />
        <Text style={s.certifyText}>
          I certify that the above information given in this form, including all attachments, are true and correct.
        </Text>
        <View style={s.sigRow}>
          <View style={s.sigBlock}>
            <View style={s.sigLine} />
            <Text style={[s.sigCaption, { fontFamily: "Helvetica-Bold", color: C.dark, fontSize: 7 }]}>
              {dash(doctorEntry.attendingPrintedName)}
            </Text>
            <Text style={s.sigCaption}>Signature over Printed Name of Attending Health Care Professional</Text>
            <Text style={s.sigCaption}>License No. / PTR: {dash(doctorEntry.attendingLicenseNumber)}</Text>
          </View>
          <View style={{ width: 100 }}>
            <View style={s.sigLine} />
            <Text style={[s.sigCaption, { fontFamily: "Helvetica-Bold", color: C.dark, fontSize: 7 }]}>
              {formatDate(doctorEntry.attendingCertifiedDate) || "—"}
            </Text>
            <Text style={s.sigCaption}>Date Signed</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>E. ZARATE HOSPITAL  |  PhilHealth CF4</Text>
          <Text>Generated on {generatedOn}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
