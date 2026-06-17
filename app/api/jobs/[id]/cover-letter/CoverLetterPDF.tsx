import {
  Document,
  Page,
  Text,
  View,
  Image,
  Link,
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
const ACCENT = "#8B5E3C";
const BORDER = "#E5E7EB";
const LINK_COLOR = "#1D4ED8";

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
  divider: {
    borderBottomWidth: 0.75,
    borderBottomColor: BORDER,
    marginBottom: 16,
  },
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
  paragraph: {
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    color: DARK,
    lineHeight: 1.65,
    marginBottom: 10,
  },
  h1: {
    fontFamily: "Times-Bold",
    fontSize: 14,
    color: DARK,
    lineHeight: 1.4,
    marginBottom: 6,
    marginTop: 4,
  },
  h2: {
    fontFamily: "Times-Bold",
    fontSize: 12,
    color: DARK,
    lineHeight: 1.4,
    marginBottom: 5,
    marginTop: 4,
  },
  h3: {
    fontFamily: "Times-Bold",
    fontSize: 11,
    color: DARK,
    lineHeight: 1.4,
    marginBottom: 4,
    marginTop: 4,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 8,
  },
  bulletDot: {
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    color: DARK,
    lineHeight: 1.65,
    width: 14,
    flexShrink: 0,
  },
  bulletText: {
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    color: DARK,
    lineHeight: 1.65,
    flex: 1,
  },
});

// ── Inline markdown parser ─────────────────────────────────────────────────

type InlineToken =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "bold-italic"; text: string }
  | { kind: "link"; text: string; url: string };

// Order matters: bold-italic before bold before italic
const INLINE_RE = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\s*\(([^)]+)\)/g;

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) tokens.push({ kind: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined)      tokens.push({ kind: "bold-italic", text: m[1] });
    else if (m[2] !== undefined) tokens.push({ kind: "bold", text: m[2] });
    else if (m[3] !== undefined) tokens.push({ kind: "italic", text: m[3] });
    else                         tokens.push({ kind: "link", text: m[4], url: m[5] });
    last = INLINE_RE.lastIndex;
  }
  if (last < text.length) tokens.push({ kind: "text", text: text.slice(last) });
  return tokens;
}

function renderInline(tokens: InlineToken[]) {
  return tokens.map((tok, i) => {
    if (tok.kind === "bold")
      return <Text key={i} style={{ fontFamily: "Times-Bold" }}>{tok.text}</Text>;
    if (tok.kind === "italic")
      return <Text key={i} style={{ fontFamily: "Times-Italic" }}>{tok.text}</Text>;
    if (tok.kind === "bold-italic")
      return <Text key={i} style={{ fontFamily: "Times-BoldItalic" }}>{tok.text}</Text>;
    if (tok.kind === "link")
      return (
        <Link key={i} src={tok.url} style={{ color: LINK_COLOR, textDecoration: "underline" }}>
          {tok.text}
        </Link>
      );
    return <Text key={i}>{tok.text}</Text>;
  });
}

// ── Block markdown parser ──────────────────────────────────────────────────

type Block =
  | { kind: "paragraph"; tokens: InlineToken[] }
  | { kind: "h1" | "h2" | "h3"; tokens: InlineToken[] }
  | { kind: "bullet"; items: InlineToken[][] };

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];

  // Split on blank lines first
  const rawBlocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  for (const raw of rawBlocks) {
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    // Headings — treat each as its own block
    if (lines[0].startsWith("### ")) {
      blocks.push({ kind: "h3", tokens: parseInline(lines[0].slice(4)) });
      if (lines.length > 1)
        blocks.push({ kind: "paragraph", tokens: parseInline(lines.slice(1).join(" ")) });
      continue;
    }
    if (lines[0].startsWith("## ")) {
      blocks.push({ kind: "h2", tokens: parseInline(lines[0].slice(3)) });
      if (lines.length > 1)
        blocks.push({ kind: "paragraph", tokens: parseInline(lines.slice(1).join(" ")) });
      continue;
    }
    if (lines[0].startsWith("# ")) {
      blocks.push({ kind: "h1", tokens: parseInline(lines[0].slice(2)) });
      if (lines.length > 1)
        blocks.push({ kind: "paragraph", tokens: parseInline(lines.slice(1).join(" ")) });
      continue;
    }

    // Bullet list — collect all consecutive bullet lines
    const isBullet = (l: string) => l.startsWith("- ") || l.startsWith("* ");
    if (lines.every(isBullet)) {
      blocks.push({
        kind: "bullet",
        items: lines.map((l) => parseInline(l.replace(/^[-*] /, ""))),
      });
      continue;
    }

    // Mixed block (some bullets, some prose) — split into sub-blocks
    if (lines.some(isBullet)) {
      let paraAcc: string[] = [];
      let bulletAcc: string[] = [];
      const flush = () => {
        if (paraAcc.length) { blocks.push({ kind: "paragraph", tokens: parseInline(paraAcc.join(" ")) }); paraAcc = []; }
        if (bulletAcc.length) { blocks.push({ kind: "bullet", items: bulletAcc.map((l) => parseInline(l.replace(/^[-*] /, ""))) }); bulletAcc = []; }
      };
      for (const line of lines) {
        if (isBullet(line)) { if (paraAcc.length) flush(); bulletAcc.push(line); }
        else { if (bulletAcc.length) flush(); paraAcc.push(line); }
      }
      flush();
      continue;
    }

    // Plain paragraph
    blocks.push({ kind: "paragraph", tokens: parseInline(lines.join(" ")) });
  }

  return blocks;
}

// ── Component ──────────────────────────────────────────────────────────────

export function CoverLetterPDF({
  fullName,
  jobTitle,
  company,
  coverLetterText,
  contactParts,
  avatarUrl,
  labels,
}: Props) {
  const blocks = parseBlocks(coverLetterText);

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
        {blocks.map((block, i) => {
          if (block.kind === "h1")
            return <Text key={i} style={styles.h1}>{renderInline(block.tokens)}</Text>;
          if (block.kind === "h2")
            return <Text key={i} style={styles.h2}>{renderInline(block.tokens)}</Text>;
          if (block.kind === "h3")
            return <Text key={i} style={styles.h3}>{renderInline(block.tokens)}</Text>;
          if (block.kind === "bullet")
            return (
              <View key={i} style={{ marginBottom: 8 }}>
                {block.items.map((item, j) => (
                  <View key={j} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{renderInline(item)}</Text>
                  </View>
                ))}
              </View>
            );
          // paragraph
          return (
            <Text key={i} style={styles.paragraph}>
              {renderInline(block.tokens)}
            </Text>
          );
        })}
      </Page>
    </Document>
  );
}
