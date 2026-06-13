import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

type Props = {
  fullName: string;
  jobTitle: string;
  company: string;
  coverLetterText: string;
  contactParts: string[];
  avatarUrl: string | null;
  labels: { category: string; position: string };
};

const DARK = "#111827";
const MUTED = "#6B7280";
const ACCENT = "#8B5E3C"; // warm brown for the category label, matching the design
const BORDER = "#E5E7EB";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    color: DARK,
    paddingTop: 48,
    paddingBottom: 48,
    paddingLeft: 56,
    paddingRight: 56,
    lineHeight: 1.6,
    backgroundColor: "#FFFFFF",
  },
  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 24,
    marginBottom: 20,
  },
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: "hidden",
    flexShrink: 0,
    backgroundColor: BORDER,
  },
  avatarImage: {
    width: 88,
    height: 88,
  },
  headerRight: {
    flex: 1,
    paddingTop: 4,
  },
  categoryLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    letterSpacing: 1.5,
    color: ACCENT,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  nameText: {
    fontFamily: "Times-Roman",
    fontSize: 26,
    color: DARK,
    marginBottom: 6,
    lineHeight: 1.15,
  },
  contactRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 0,
  },
  contactPart: {
    fontSize: 9,
    color: MUTED,
    fontFamily: "Helvetica",
  },
  contactDot: {
    fontSize: 9,
    color: MUTED,
    fontFamily: "Helvetica",
    marginLeft: 5,
    marginRight: 5,
  },
  // Divider
  divider: {
    borderBottomWidth: 0.75,
    borderBottomColor: BORDER,
    marginBottom: 16,
  },
  // Position block
  positionLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    letterSpacing: 1.5,
    color: MUTED,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  positionText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    color: DARK,
    marginBottom: 14,
    lineHeight: 1.3,
  },
  // Body
  paragraph: {
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    color: DARK,
    lineHeight: 1.65,
    marginBottom: 10,
  },
});

export function CoverLetterPDF({
  fullName,
  jobTitle,
  company,
  coverLetterText,
  contactParts,
  avatarUrl,
  labels,
}: Props) {
  const paragraphs = coverLetterText.split(/\n\n+/).map((p) => p.replace(/\n/g, " ").trim()).filter(Boolean);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          {avatarUrl && (
            <View style={styles.avatarContainer}>
              <Image src={avatarUrl} style={styles.avatarImage} />
            </View>
          )}
          <View style={styles.headerRight}>
            <Text style={styles.categoryLabel}>{labels.category}</Text>
            <Text style={styles.nameText}>{fullName}</Text>
            {contactParts.length > 0 && (
              <View style={styles.contactRow}>
                {contactParts.map((part, i) => (
                  <View key={i} style={{ flexDirection: "row" }}>
                    {i > 0 && <Text style={styles.contactDot}>·</Text>}
                    <Text style={styles.contactPart}>{part}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Position */}
        <Text style={styles.positionLabel}>{labels.position}</Text>
        <Text style={styles.positionText}>{jobTitle} — {company}</Text>

        {/* Cover letter body */}
        {paragraphs.map((para, i) => (
          <Text key={i} style={styles.paragraph}>{para}</Text>
        ))}
      </Page>
    </Document>
  );
}
