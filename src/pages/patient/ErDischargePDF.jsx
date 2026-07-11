import {
  Document, Page, Text, View, StyleSheet,
} from "@react-pdf/renderer";

const C = {
  teal: "#0f766e",
  dark: "#1e293b",
  mid: "#64748b",
  light: "#94a3b8",
  border: "#cbd5e1",
  bg: "#f8fafc",
  white: "#ffffff",
};

const s = StyleSheet.create({
  page: {
    paddingTop: 28, paddingBottom: 32,
    paddingHorizontal: 32,
    fontSize: 8, fontFamily: "Helvetica", color: C.dark,
  },

  headerRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2, borderBottomColor: C.teal,
    paddingBottom: 6, marginBottom: 6,
  },
  hospName: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  hospSub:  { fontSize: 7, color: C.mid, marginTop: 1 },
  recLabel: { fontSize: 7, color: C.mid, textAlign: "right" },
  recNo:    { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.teal, textAlign: "right", letterSpacing: 1 },

  bar: {
    backgroundColor: C.dark, paddingVertical: 3, paddingHorizontal: 6,
    marginTop: 6, marginBottom: 4, borderRadius: 2,
  },
  barText: { color: C.white, fontSize: 7.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.4 },

  row: { flexDirection: "row", marginBottom: 4 },
  col: { flex: 1, paddingRight: 8 },

  fLabel: { fontSize: 6, color: C.light, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 1 },
  fValue: { fontSize: 8, fontFamily: "Helvetica-Bold", borderBottomWidth: 0.5, borderBottomColor: C.border, paddingBottom: 1 },

  blk: { marginBottom: 5 },
  blkLabel: { fontSize: 6, color: C.light, textTransform: "uppercase", marginBottom: 1 },
  blkVal: { fontSize: 7.5, backgroundColor: C.bg, padding: 4, borderRadius: 2, lineHeight: 1.4, minHeight: 20 },

  twoCol: { flexDirection: "row", gap: 8 },
  twoItem: { flex: 1 },

  // Ancillaries checklist
  checkGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  checkItem: { flexDirection: "row", alignItems: "center", width: "25%", marginBottom: 3 },
  checkBox: {
    width: 8, height: 8, borderWidth: 0.75, borderColor: C.dark,
    marginRight: 3, alignItems: "center", justifyContent: "center",
  },
  checkBoxMark: { fontSize: 6.5, fontFamily: "Helvetica-Bold" },
  checkLabel: { fontSize: 7 },

  // Medications table
  table: { borderWidth: 0.5, borderColor: C.border, borderRadius: 2, marginTop: 2, marginBottom: 4 },
  tHeadRow: { flexDirection: "row", backgroundColor: C.bg, borderBottomWidth: 0.5, borderBottomColor: C.border },
  tRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.border },
  tRowLast: { flexDirection: "row" },
  tCellNo: { width: 16, padding: 3, fontSize: 6.5, color: C.light },
  tCellHeadNo: { width: 16, padding: 3, fontSize: 6, color: C.mid, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  tCell: { flex: 1, padding: 3, fontSize: 7, borderLeftWidth: 0.5, borderLeftColor: C.border },
  tCellHead: { flex: 1, padding: 3, fontSize: 6, color: C.mid, fontFamily: "Helvetica-Bold", textTransform: "uppercase", borderLeftWidth: 0.5, borderLeftColor: C.border },

  sigRow: { flexDirection: "row", marginTop: 16, gap: 16 },
  sigBlockNarrow: { width: 140, alignItems: "center" },
  sigLine: { width: "100%", borderBottomWidth: 1, borderBottomColor: C.dark, height: 24, marginBottom: 3 },
  sigName: { fontSize: 7.5, fontFamily: "Helvetica-Bold", textAlign: "center" },
  sigSub: { fontSize: 6.5, color: C.mid, textAlign: "center" },

  footer: {
    position: "absolute", bottom: 16, left: 32, right: 32,
    flexDirection: "row", justifyContent: "space-between",
    fontSize: 6.5, color: C.light,
    borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 4,
  },
});

const dash = (v) => (v && String(v).trim() ? String(v) : "—");

function Bar({ title }) {
  return <View style={s.bar}><Text style={s.barText}>{title}</Text></View>;
}

function ColField({ label, value }) {
  return (
    <View style={s.col}>
      <Text style={s.fLabel}>{label}</Text>
      <Text style={s.fValue}>{dash(value)}</Text>
    </View>
  );
}

function Blk({ label, value, rows = 2 }) {
  return (
    <View style={s.blk}>
      <Text style={s.blkLabel}>{label}</Text>
      <Text style={[s.blkVal, { minHeight: rows * 11 }]}>{dash(value)}</Text>
    </View>
  );
}

function Check({ checked, label }) {
  return (
    <View style={s.checkItem}>
      <View style={s.checkBox}>{checked ? <Text style={s.checkBoxMark}>x</Text> : null}</View>
      <Text style={s.checkLabel}>{label}</Text>
    </View>
  );
}

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

export default function ErDischargePDF({ form }) {
  const generatedOn = new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
  const ancillaries = form.ancillaries || {};
  const medications = (form.medications || []).filter((m) => m.medicine || m.dosage || m.time);

  return (
    <Document title={`ER Discharge Instructions - ${form.hospitalNo || form.patientName}`} author="E. ZARATE HOSPITAL">
      <Page size="LEGAL" style={s.page}>

        {/* Header */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.hospName}>E. ZARATE HOSPITAL</Text>
            <Text style={s.hospSub}>DOH-Licensed & PhA-Member Level I Hospital</Text>
            <Text style={s.hospSub}>16 J. Aguilar Ave., Talon, Las Piñas City  |  0917-538-2440  |  ezaratehospital@yahoo.com</Text>
            <Text style={[s.hospSub, { marginTop: 3, fontFamily: "Helvetica-Bold", color: C.dark }]}>
              EMERGENCY ROOM DISCHARGE INSTRUCTION FORM
            </Text>
          </View>
          <View>
            <Text style={s.recLabel}>Hospital No.</Text>
            <Text style={s.recNo}>{dash(form.hospitalNo)}</Text>
          </View>
        </View>

        {/* Patient info */}
        <View style={s.row}>
          <ColField label="Patient's Name" value={form.patientName} />
          <ColField label="Address" value={form.address} />
        </View>
        <View style={s.row}>
          <ColField label="Age" value={form.age} />
          <ColField label="Sex" value={form.sex} />
          <ColField label="Date of Birth" value={form.dob} />
          <ColField label="Nurse on Duty" value={form.nurseOnDuty} />
        </View>
        <View style={s.row}>
          <ColField label="Date/Time Attended" value={form.dateTimeAttended} />
        </View>

        {/* Chief complaints */}
        <Bar title="Chief Complaint/s" />
        <Blk label="Chief Complaint/s" value={form.chiefComplaints} rows={2} />

        {/* Ancillaries */}
        <Bar title="Ancillaries Done" />
        <View style={s.checkGrid}>
          {ANCILLARY_ITEMS.map((item) => (
            <Check key={item.key} checked={!!ancillaries[item.key]} label={item.label} />
          ))}
          <Check checked={!!form.xray} label={`Xray: ${form.xrayNote || ""}`.trim()} />
          <Check checked={!!form.others} label={`Others: ${form.othersNote || ""}`.trim()} />
        </View>

        {/* Final diagnosis / Treatment given */}
        <View style={s.twoCol}>
          <View style={s.twoItem}>
            <Bar title="Final Diagnosis" />
            <Blk label="Final Diagnosis" value={form.finalDiagnosis} rows={6} />
          </View>
          <View style={s.twoItem}>
            <Bar title="Treatment / Medication Given" />
            <Blk label="Treatment / Medication Given" value={form.treatmentGiven} rows={6} />
          </View>
        </View>

        {/* Discharge details */}
        <Bar title="Discharge Details" />
        <View style={s.row}>
          <ColField label="Date and Time of Discharge" value={form.dateTimeDischarge} />
          <ColField label="Condition Upon Discharge" value={form.conditionUponDischarge} />
          <ColField label="Disposition" value={form.disposition} />
        </View>

        {/* Take home medications */}
        <Bar title="Take Home Medications" />
        <View style={s.table}>
          <View style={s.tHeadRow}>
            <Text style={s.tCellHeadNo}>#</Text>
            <Text style={s.tCellHead}>Medicine</Text>
            <Text style={s.tCellHead}>Dosage</Text>
            <Text style={s.tCellHead}>Time</Text>
          </View>
          {medications.length === 0 ? (
            <View style={s.tRowLast}>
              <Text style={s.tCellNo}> </Text>
              <Text style={[s.tCell, { color: C.light }]}>—</Text>
              <Text style={s.tCell}> </Text>
              <Text style={s.tCell}> </Text>
            </View>
          ) : (
            medications.map((row, i) => (
              <View key={i} style={i === medications.length - 1 ? s.tRowLast : s.tRow}>
                <Text style={s.tCellNo}>{i + 1}</Text>
                <Text style={s.tCell}>{dash(row.medicine)}</Text>
                <Text style={s.tCell}>{dash(row.dosage)}</Text>
                <Text style={s.tCell}>{dash(row.time)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Follow-up */}
        <Bar title="Follow-up Examination" />
        <Blk label="Follow-up Examination" value={form.followUpExamination} rows={1} />

        {/* Physician signature */}
        <View style={s.sigRow}>
          <View style={s.sigBlockNarrow}>
            <View style={s.sigLine} />
            <Text style={s.sigName}>{dash(form.erPhysician)}</Text>
            <Text style={s.sigSub}>E.R. Physician on Duty</Text>
          </View>
          <View style={s.sigBlockNarrow}>
            <View style={s.sigLine} />
            <Text style={s.sigName}>{dash(form.physicianDate)}</Text>
            <Text style={s.sigSub}>Date</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>E. ZARATE HOSPITAL  |  ER Discharge Instruction Form</Text>
          <Text>Generated on {generatedOn}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
