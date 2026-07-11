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

  disclaimer: {
    marginTop: 10, padding: 6, borderWidth: 0.5, borderColor: C.border, borderRadius: 2,
    fontSize: 6.5, color: C.mid, lineHeight: 1.4,
  },

  sigRow: { flexDirection: "row", marginTop: 18, gap: 16 },
  sigBlock: { flex: 1, alignItems: "flex-start" },
  sigLine: { width: "100%", borderBottomWidth: 1, borderBottomColor: C.dark, height: 24, marginBottom: 3 },
  sigName: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  sigSub: { fontSize: 6.5, color: C.mid },
  sigMeta: { fontSize: 7, marginTop: 4 },

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

export default function MedicalCertificatePDF({ form }) {
  const generatedOn = new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });

  return (
    <Document title={`Medical Certificate - ${form.patientName || "Patient"}`} author="E. ZARATE HOSPITAL">
      <Page size="LEGAL" style={s.page}>

        {/* Header */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.hospName}>E. ZARATE HOSPITAL</Text>
            <Text style={s.hospSub}>16 J. Aguilar Avenue, Talon 1, Las Piñas City, Metro Manila, Philippines</Text>
            <Text style={s.hospSub}>
              Tel. Nos.: (02) 8871-1440 · (02) 8873-5593 · (02) 8874-6905  |  Mobile Nos.: Smart (0919) 991-4938 · Globe (0917) 538-2440
            </Text>
            <Text style={s.hospSub}>E-mails: zarateclinic@yahoo.com · zarateopd@gmail.com</Text>
            <Text style={[s.hospSub, { marginTop: 3, fontFamily: "Helvetica-Bold", color: C.dark, fontSize: 9 }]}>
              MEDICAL CERTIFICATE
            </Text>
          </View>
          <View>
            <Text style={s.recLabel}>Date</Text>
            <Text style={s.recNo}>{dash(form.date)}</Text>
          </View>
        </View>

        {/* Patient info */}
        <View style={s.row}>
          <ColField label="Patient's Name" value={form.patientName} />
          <ColField label="Age" value={form.age} />
        </View>
        <View style={s.row}>
          <ColField label="Occupation" value={form.occupation} />
          <ColField label="Classification" value={form.classification} />
        </View>
        <View style={s.row}>
          <ColField label="Address" value={form.address} />
        </View>
        <View style={s.row}>
          <ColField label="Inclusive Dates of Treatment" value={form.inclusiveDatesOfTreatment} />
        </View>

        {/* Clinical details */}
        <Bar title="Subjective Complaints" />
        <Blk label="Subjective Complaints" value={form.subjectiveComplaints} rows={2} />

        <Bar title="Pertinent Physical Examination Findings" />
        <Blk label="Pertinent Physical Examination Findings" value={form.pertinentPhysicalExaminationFindings} rows={3} />

        <Bar title="Ancillary Examination Done" />
        <Blk label="Ancillary Examination Done" value={form.ancillaryExaminationDone} rows={2} />

        <Bar title="Clinical Diagnosis" />
        <Blk label="Clinical Diagnosis" value={form.clinicalDiagnosis} rows={2} />

        <Bar title="Treatment Done / Medication Given" />
        <Blk label="Treatment Done / Medication Given" value={form.treatmentDoneMedicationGiven} rows={3} />

        <Bar title="Disposition" />
        <Blk label="Disposition" value={form.disposition} rows={1} />

        {/* Disclaimer, matches the printed pad */}
        <Text style={s.disclaimer}>
          Date In the Medical Certificate is based on actual medical records, issued upon the request and/or consent
          of the patient; Unless otherwise ordered by the court by way of subpoena duces tecum, medical records of
          the patient shall deemed confidential. For inquiries and verification, please contact the medical records
          section, at phone number here above indicated.
        </Text>

        {/* Attending physician signature */}
        <View style={s.sigRow}>
          <View style={s.sigBlock}>
            <View style={s.sigLine} />
            <Text style={s.sigName}>{dash(form.attendingPhysician)}, M.D.</Text>
            <Text style={s.sigSub}>Name and Signature of Attending Physician</Text>
            <Text style={s.sigMeta}>Lic. No.: {dash(form.licNo)}</Text>
            <Text style={s.sigMeta}>PTR No.: {dash(form.ptrNo)}</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>E. ZARATE HOSPITAL  |  Medical Certificate</Text>
          <Text>Generated on {generatedOn}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
