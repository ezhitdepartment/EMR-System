import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const C = {
  teal: "#0f766e",
  dark: "#1e293b",
  mid: "#64748b",
  light: "#94a3b8",
  border: "#cbd5e1",
  bg: "#f8fafc",
};

const dash = (v) => (v && String(v).trim() ? String(v) : "—");

const s = StyleSheet.create({
  page: {
    paddingTop: 32, paddingBottom: 36, paddingHorizontal: 36,
    fontSize: 9, fontFamily: "Helvetica", color: C.dark,
  },

  headerRow: {
    alignItems: "center",
    borderBottomWidth: 2, borderBottomColor: C.teal,
    paddingBottom: 8, marginBottom: 10,
  },
  hospName: { fontSize: 15, fontFamily: "Helvetica-Bold", textAlign: "center" },
  hospSub: { fontSize: 7.5, color: C.mid, marginTop: 2, textAlign: "center" },

  title: {
    fontSize: 11.5, fontFamily: "Helvetica-Bold", textAlign: "center",
    marginBottom: 4, textTransform: "uppercase",
  },

  dateRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 10 },
  dateLabel: { fontSize: 8, color: C.mid, marginRight: 4 },
  dateValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },

  bar: {
    backgroundColor: C.dark, paddingVertical: 4, paddingHorizontal: 7,
    marginTop: 8, marginBottom: 6, borderRadius: 2,
  },
  barText: { color: "#fff", fontSize: 8.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.4 },

  row: { flexDirection: "row", marginBottom: 6 },
  col: { flex: 1, paddingRight: 10 },

  fLabel: { fontSize: 6.5, color: C.light, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 },
  fValue: { fontSize: 9, fontFamily: "Helvetica-Bold", borderBottomWidth: 0.5, borderBottomColor: C.border, paddingBottom: 2 },

  blk: { marginBottom: 8 },
  blkLabel: { fontSize: 7, color: C.light, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 },
  blkVal: { fontSize: 8.5, backgroundColor: C.bg, padding: 6, borderRadius: 2, lineHeight: 1.45, minHeight: 26 },

  footerRow: { flexDirection: "row", marginTop: 14, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  footerCol: { flex: 1, paddingRight: 10 },
});

function ColField({ label, value }) {
  return (
    <View style={s.col}>
      <Text style={s.fLabel}>{label}</Text>
      <Text style={s.fValue}>{dash(value)}</Text>
    </View>
  );
}

function Block({ label, value }) {
  return (
    <View style={s.blk}>
      <Text style={s.blkLabel}>{label}</Text>
      <Text style={s.blkVal}>{dash(value)}</Text>
    </View>
  );
}

function Bar({ title }) {
  return (
    <View style={s.bar}>
      <Text style={s.barText}>{title}</Text>
    </View>
  );
}

export default function KonsultaReferralPDF({ form }) {
  return (
    <Document
      title={`Konsulta-Yakap Referral - ${form.fullName || "Patient"}`}
      author="E. ZARATE HOSPITAL"
    >
      <Page size="LETTER" style={s.page}>
        {/* Header */}
        <View style={s.headerRow}>
          <Text style={s.hospName}>E. ZARATE HOSPITAL</Text>
          <Text style={s.hospSub}>
            16 J. Aguilar Avenue, Talon I, Las Piñas City, Metro Manila, Philippines
          </Text>
          <Text style={s.hospSub}>
            Tel. Nos.: (02) 871-1440 / (02) 873-5593 / (02) 874-6905  |  E-mail: zarateclinic@yahoo.com
          </Text>
        </View>

        <Text style={s.title}>Emergency Care Benefit Referral to KONSULTA / YAKAP</Text>
        <View style={s.dateRow}>
          <Text style={s.dateLabel}>Date of Referral:</Text>
          <Text style={s.dateValue}>{dash(form.dateOfReferral)}</Text>
        </View>

        {/* Referring Hospital */}
        <Bar title="Referring Hospital" />
        <View style={s.row}>
          <ColField label="Name of Hospital" value={form.referringHospitalName} />
          <ColField label="Accreditation Number" value={form.accreditationNumber} />
        </View>
        <View style={s.row}>
          <ColField label="Address of Hospital" value={form.referringHospitalAddress} />
        </View>
        <View style={s.row}>
          <ColField label="Emergency Department Attending Physician" value={form.attendingPhysician} />
        </View>

        {/* Patient Data */}
        <Bar title="Patient Data" />
        <View style={s.row}>
          <ColField label="Name" value={form.fullName} />
          <ColField label="Age" value={form.age} />
          <ColField label="Sex" value={form.sex} />
          <ColField label="PIN" value={form.pin} />
        </View>

        <Block label="Chief Complaint" value={form.chiefComplaint} />
        <Block label="History of Present Illness" value={form.historyOfPresentIllness} />
        <Block label="Physical Examination" value={form.physicalExamination} />
        <Block label="Initial Impression" value={form.initialImpression} />
        <Block label="Management at ED" value={form.managementAtED} />
        <Block label="Final Diagnosis" value={form.finalDiagnosis} />
        <Block label="Recommendations" value={form.recommendations} />

        {/* Footer */}
        <View style={s.footerRow}>
          <View style={s.footerCol}>
            <Text style={s.fLabel}>Receiving Konsulta Provider</Text>
            <Text style={s.fValue}>{dash(form.receivingKonsultaProvider)}</Text>
          </View>
          <View style={s.footerCol}>
            <Text style={s.fLabel}>Date Received</Text>
            <Text style={s.fValue}>{dash(form.dateReceived)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
