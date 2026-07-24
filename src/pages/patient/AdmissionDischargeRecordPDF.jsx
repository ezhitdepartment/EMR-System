import {
  Document, Page, Text, View, StyleSheet, Image,
} from "@react-pdf/renderer";
import logoImg from "../../assets/logo.jpg";
import { formatAge } from "../../utils/age";

// Same plain black-on-white, ruled-paper approach as
// MedicalCertificatePDF.jsx / MedicalAbstractPDF.jsx.
const RECORD_SIZE = [595.28, 780];

const C = {
  black: "#0f172a",
  mid: "#334155",
  line: "#0f172a",
  rule: "#94a3b8",
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
    paddingBottom: 8, marginBottom: 10,
  },
  hospName: { fontSize: 17, fontFamily: "Times-Bold", letterSpacing: 0.5 },
  hospSub: { fontSize: 7.5, color: C.mid, marginTop: 2 },
  sealCol: { alignItems: "center", width: 70 },
  seal: {
    width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: "#cbd5e1",
    overflow: "hidden",
  },
  sealImg: { width: 52, height: 52, objectFit: "cover" },

  title: {
    fontSize: 13, fontFamily: "Times-Bold", textAlign: "center",
    textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14,
  },

  fieldRow: { flexDirection: "row", marginBottom: 6, alignItems: "flex-end" },
  fLabel: { fontSize: 8.5, fontFamily: "Times-Bold", marginRight: 4 },
  fValue: {
    flex: 1, fontSize: 9.5, borderBottomWidth: 0.75, borderBottomColor: C.line,
    paddingBottom: 1, minHeight: 12,
  },

  sectionTitle: {
    fontSize: 10, fontFamily: "Times-Bold", textTransform: "uppercase",
    letterSpacing: 0.5, marginTop: 10, marginBottom: 6,
    borderBottomWidth: 0.75, borderBottomColor: C.rule, paddingBottom: 3,
  },

  twoCol: { flexDirection: "row", gap: 16 },
  colBox: {
    flex: 1, borderWidth: 0.5, borderColor: C.rule, borderRadius: 2,
    padding: 8,
  },
  colHeading: {
    fontSize: 9, fontFamily: "Times-Bold", textTransform: "uppercase",
    marginBottom: 6, color: C.mid,
  },

  blockWrap: { marginBottom: 6 },
  blockLabel: { fontSize: 8.5, fontFamily: "Times-Bold", marginBottom: 2 },
  ruledBox: { borderWidth: 0.5, borderColor: C.rule },
  ruledLineText: {
    fontSize: 9, minHeight: 13, paddingHorizontal: 2, paddingTop: 2,
    borderBottomWidth: 0.5, borderBottomColor: C.rule,
  },

  sigRow: { marginTop: 20, flexDirection: "row", gap: 40 },
  sigCol: { flex: 1 },
  sigLine: { borderBottomWidth: 1, borderBottomColor: C.black, height: 22 },
  sigName: { fontSize: 9.5, fontFamily: "Times-Bold", marginTop: 3 },
  sigLabel: { fontSize: 7.5, fontFamily: "Times-Italic", color: C.mid },

  footer: {
    position: "absolute", bottom: 16, left: 40, right: 40,
    flexDirection: "row", justifyContent: "space-between",
    fontSize: 6.5, color: C.mid,
    borderTopWidth: 0.5, borderTopColor: C.rule, paddingTop: 4,
  },
});

const dash = (v) => (v && String(v).trim() ? String(v) : "");

function FieldLine({ label, value, width }) {
  return (
    <View style={[s.fieldRow, width ? { width } : { flex: 1 }]}>
      <Text style={s.fLabel}>{label}:</Text>
      <Text style={s.fValue}>{dash(value)}</Text>
    </View>
  );
}

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

// `form` is an admitted-patient record as returned by
// loadAdmittedPatients() in utils/admittedPatients.js.
export default function AdmissionDischargeRecordPDF({ form }) {
  const generatedOn = new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
  const stillAdmitted = !form.dateDischarged;

  return (
    <Document title={`Admission and Discharge Record - ${form.fullName || "Patient"}`} author="E. ZARATE HOSPITAL">
      <Page size={RECORD_SIZE} style={s.page}>
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

        <Text style={s.title}>Admission and Discharge Record</Text>

        <View style={s.fieldRow}>
          <FieldLine label="Patient's Name" value={form.fullName} />
          <View style={{ width: 10 }} />
          <FieldLine label="Age" value={formatAge(form.dateOfBirth)} width={140} />
          <View style={{ width: 10 }} />
          <FieldLine label="Sex" value={form.sex} width={70} />
        </View>
        <View style={s.fieldRow}>
          <FieldLine label="Hospital No." value={form.hospitalNo} width={150} />
          <View style={{ width: 10 }} />
          <FieldLine label="Patient Type" value={form.patientType} width={150} />
        </View>

        <Text style={s.sectionTitle}>Confinement Summary</Text>
        <View style={s.twoCol}>
          <View style={s.colBox}>
            <Text style={s.colHeading}>Admission</Text>
            <FieldLine label="Date Admitted" value={form.dateAdmitted} />
            <FieldLine label="Admitting Physician" value={form.attendingPhysician} />
          </View>
          <View style={s.colBox}>
            <Text style={s.colHeading}>Discharge</Text>
            <FieldLine label="Date Discharged" value={stillAdmitted ? "Still Admitted" : form.dateDischarged} />
            <FieldLine label="Discharging Physician" value={form.attendingPhysician} />
          </View>
        </View>

        <RuledBlock label="Admitting Diagnosis" value={form.admittingDiagnosis} lines={2} />
        <RuledBlock label="Final / Discharge Diagnosis" value={form.dischargeDiagnosis} lines={2} />
        <RuledBlock label="Outcome of Treatment" value={form.outcomeOfTreatment} lines={1} />
        <RuledBlock label="Discharge Notes / Instructions" value={form.dispositionNotes} lines={3} />

        <View style={s.sigRow}>
          <View style={s.sigCol}>
            <View style={s.sigLine} />
            <Text style={s.sigName}>{dash(form.attendingPhysician)}{form.attendingPhysician ? ", M.D." : ""}</Text>
            <Text style={s.sigLabel}>Attending Physician</Text>
          </View>
          <View style={s.sigCol}>
            <View style={s.sigLine} />
            <Text style={s.sigName}>{dash(form.fullName)}</Text>
            <Text style={s.sigLabel}>Patient / Guardian Signature</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>E. ZARATE HOSPITAL  |  Admission and Discharge Record</Text>
          <Text>Generated on {generatedOn}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
