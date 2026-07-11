import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link,
  Image,
} from "@react-pdf/renderer";
import type { Profile, LinkedInRecommendation } from "@/types";

type SkillGroup = { label: string; skills: string[] };

type GeneratedContent = {
  summary: string;
  skillGroups?: SkillGroup[];
  skills?: string[];
  workExperience: {
    company: string;
    title: string;
    startDate: string;
    endDate: string;
    currentlyWorking: boolean;
    bullets: string[];
    skills?: string[];
  }[];
};

type Props = {
  profile: Profile;
  generated: GeneratedContent;
  skillYears?: Record<string, number>;
  motivation?: string;
  resumeText?: string;
  recommendations?: LinkedInRecommendation[];
  avatarUrl?: string;
  includeImages?: boolean;
};

const TEXT = "#111827";
const MUTED = "#6B7280";
const ACCENT = "#111827";
const BLUE = "#2563EB";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: TEXT,
    paddingTop: 22,
    paddingBottom: 22,
    paddingLeft: 34,
    paddingRight: 34,
    lineHeight: 1.3,
  },
  // Header
  headerName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: TEXT,
    marginBottom: 7,
  },
  headerTitle: {
    fontSize: 10,
    color: BLUE,
    marginBottom: 6,
  },
  headerContact: {
    fontSize: 8,
    color: MUTED,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  headerDot: {
    fontSize: 8,
    color: MUTED,
    marginLeft: 4,
    marginRight: 4,
  },
  // Section
  sectionLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    marginTop: 17,
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  h2Heading: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: TEXT,
    marginTop: 6,
    marginBottom: 2,
  },
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
    marginBottom: 3,
  },
  // Summary
  summaryText: {
    fontSize: 9,
    color: TEXT,
    lineHeight: 1.4,
  },
  // Skills
  skillGroupRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 1.5,
  },
  skillGroupLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    width: 100,
    paddingTop: 1,
    flexShrink: 0,
  },
  skillsText: {
    fontSize: 8,
    color: TEXT,
    lineHeight: 1.3,
    flex: 1,
  },
  skillsRowText: {
    fontSize: 8,
    color: TEXT,
    lineHeight: 1.3,
  },
  skillPillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    flex: 1,
  },
  skillPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#eff6ff",
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 2,
  },
  skillPillText: {
    fontSize: 7.5,
    color: TEXT,
    lineHeight: 1,
  },
  skillYrsBadge: {
    backgroundColor: "#dbeafe",
    borderRadius: 99,
    paddingHorizontal: 3,
    paddingTop: 1,
    paddingBottom: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  skillYrsText: {
    fontSize: 6.5,
    color: BLUE,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1,
    textAlign: "center",
  },
  // Work experience
  roleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 1,
  },
  roleCompany: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: TEXT,
  },
  roleDates: {
    fontSize: 8,
    color: MUTED,
  },
  roleTitle: {
    fontSize: 9,
    color: MUTED,
    marginBottom: 1,
  },
  roleSkills: {
    fontSize: 7,
    color: MUTED,
    marginBottom: 1,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 0.5,
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 8,
    color: TEXT,
    width: 10,
  },
  bulletText: {
    fontSize: 8,
    color: TEXT,
    flex: 1,
    lineHeight: 1.35,
  },
  roleBlock: {
    marginBottom: 10,
  },
  // Recommendations — speech bubble grid
  recGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "flex-start",
  },
  recCard: {
    width: "47%",
  },
  recBubble: {
    backgroundColor: "#F3F4F6",
    borderRadius: 5,
    padding: 5,
  },
  recTail: {
    width: 0,
    height: 0,
    borderStyle: "solid",
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: "#ffffff",
    borderRightColor: "#ffffff",
    borderTopColor: "#F3F4F6",
    borderBottomWidth: 0,
    marginLeft: 14,
  },
  recMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
  },
  recAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  recAvatarFallback: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  recInfo: {
    flex: 1,
  },
  recText: {
    fontSize: 7.5,
    color: TEXT,
    lineHeight: 1.5,
    fontStyle: "italic",
  },
  recName: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: BLUE,
    textDecoration: "none",
  },
  recRole: {
    fontSize: 6.5,
    color: MUTED,
  },
  // Education
  eduDegree: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: TEXT,
  },
  eduDetail: {
    fontSize: 9,
    color: MUTED,
  },
  // Personal projects
  projectDesc: {
    fontSize: 8,
    color: TEXT,
    lineHeight: 1.4,
  },
  projectLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 2,
    gap: 8,
  },
  projectLink: {
    fontSize: 7,
    color: BLUE,
    textDecoration: "none",
  },
  projectLinkLabel: {
    fontSize: 6,
    color: MUTED,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginRight: 2,
  },
});

function formatDateRange(
  startDate: string,
  endDate: string,
  currentlyWorking: boolean,
): string {
  const fmt = (d: string) => {
    if (!d) return "";
    const [year, month] = d.split("-");
    if (!month) return year;
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    return `${months[parseInt(month, 10) - 1]} ${year}`;
  };
  const start = fmt(startDate);
  const end = currentlyWorking ? "Present" : fmt(endDate);
  return start && end ? `${start} – ${end}` : start || end;
}

// ── Markdown → PDF renderer ───────────────────────────────────────────────
type InlineToken = { kind: "text"; text: string } | { kind: "bold"; text: string } | { kind: "italic"; text: string } | { kind: "bold-italic"; text: string } | { kind: "link"; text: string; url: string };
const INLINE_RE = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\s*\(([^)]+)\)/g;
function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = []; let last = 0; let m: RegExpExecArray | null; INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) tokens.push({ kind: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) tokens.push({ kind: "bold-italic", text: m[1] });
    else if (m[2] !== undefined) tokens.push({ kind: "bold", text: m[2] });
    else if (m[3] !== undefined) tokens.push({ kind: "italic", text: m[3] });
    else tokens.push({ kind: "link", text: m[4], url: m[5] });
    last = INLINE_RE.lastIndex;
  }
  if (last < text.length) tokens.push({ kind: "text", text: text.slice(last) });
  return tokens;
}
type MdBlock = { kind: "h1" | "h2" | "h3"; tokens: InlineToken[] } | { kind: "paragraph"; tokens: InlineToken[] } | { kind: "bullet"; items: InlineToken[][] };
function pushMixedPdf(blocks: MdBlock[], lines: string[]) {
  if (!lines.length) return;
  const isBullet = (l: string) => l.startsWith("- ") || l.startsWith("* ");
  if (lines.every(isBullet)) { blocks.push({ kind: "bullet", items: lines.map((l) => parseInline(l.replace(/^[-*] /, ""))) }); return; }
  if (!lines.some(isBullet)) { blocks.push({ kind: "paragraph", tokens: parseInline(lines.join(" ")) }); return; }
  let paraAcc: string[] = [], bulletAcc: string[] = [];
  const flush = () => { if (paraAcc.length) { blocks.push({ kind: "paragraph", tokens: parseInline(paraAcc.join(" ")) }); paraAcc = []; } if (bulletAcc.length) { blocks.push({ kind: "bullet", items: bulletAcc.map((l) => parseInline(l.replace(/^[-*] /, ""))) }); bulletAcc = []; } };
  for (const line of lines) { if (isBullet(line)) { if (paraAcc.length) flush(); bulletAcc.push(line); } else { if (bulletAcc.length) flush(); paraAcc.push(line); } }
  flush();
}
function parseMdBlocks(text: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  for (const raw of text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)) {
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (lines[0].startsWith("### ")) { blocks.push({ kind: "h3", tokens: parseInline(lines[0].slice(4)) }); pushMixedPdf(blocks, lines.slice(1)); continue; }
    if (lines[0].startsWith("## "))  { blocks.push({ kind: "h2", tokens: parseInline(lines[0].slice(3)) }); pushMixedPdf(blocks, lines.slice(1)); continue; }
    if (lines[0].startsWith("# "))   { blocks.push({ kind: "h1", tokens: parseInline(lines[0].slice(2)) }); pushMixedPdf(blocks, lines.slice(1)); continue; }
    pushMixedPdf(blocks, lines);
  }
  return blocks;
}
function renderInlinePdf(tokens: InlineToken[]) {
  return tokens.map((tok, i) => {
    if (tok.kind === "bold") return <Text key={i} style={{ fontFamily: "Helvetica-Bold" }}>{tok.text}</Text>;
    if (tok.kind === "italic") return <Text key={i} style={{ fontFamily: "Helvetica-Oblique" }}>{tok.text}</Text>;
    if (tok.kind === "bold-italic") return <Text key={i} style={{ fontFamily: "Helvetica-BoldOblique" }}>{tok.text}</Text>;
    if (tok.kind === "link") return <Link key={i} src={tok.url} style={{ color: BLUE, textDecoration: "none" }}>{tok.text}</Link>;
    return <Text key={i}>{tok.text}</Text>;
  });
}
function MdPdf({ text, baseStyle }: { text: string; baseStyle?: Record<string, unknown> }) {
  const base = baseStyle ?? {};
  const blocks = parseMdBlocks(text);
  return (
    <>
      {blocks.map((block, i) => {
        if (block.kind === "h1") return <Text key={i} style={{ ...base, fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 3, marginTop: i > 0 ? 6 : 0 }}>{renderInlinePdf(block.tokens)}</Text>;
        if (block.kind === "h2") return <Text key={i} style={{ ...base, fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 2, marginTop: i > 0 ? 14 : 8 }}>{renderInlinePdf(block.tokens)}</Text>;
        if (block.kind === "h3") return <Text key={i} style={{ ...base, fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 2, marginTop: i > 0 ? 4 : 0 }}>{renderInlinePdf(block.tokens)}</Text>;
        if (block.kind === "bullet") return (
          <View key={i} style={{ marginBottom: 2 }}>
            {block.items.map((item, j) => (
              <View key={j} style={{ flexDirection: "row", marginBottom: 1 }}>
                <Text style={{ ...base, width: 10 }}>{"•"}</Text>
                <Text style={{ ...base, flex: 1 }}>{renderInlinePdf(item)}</Text>
              </View>
            ))}
          </View>
        );
        return <Text key={i} style={{ ...base, marginBottom: 3, lineHeight: 1.5 }}>{renderInlinePdf(block.tokens)}</Text>;
      })}
    </>
  );
}

function fmtRecDate(d: string) {
  if (!d) return "";
  const [year, month] = d.split("-");
  if (!month) return year;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(month, 10) - 1]} ${year}`;
}

export function ResumePDF({ profile, generated, skillYears = {}, motivation, resumeText, recommendations = [], avatarUrl, includeImages = false }: Props) {
  const contactParts: { text: string; label?: string; isUrl: boolean }[] = [];
  if (profile.email) contactParts.push({ text: profile.email, isUrl: false });
  if (profile.phone) contactParts.push({ text: profile.phone, isUrl: false });
  if (profile.location) contactParts.push({ text: profile.location, isUrl: false });
  if (profile.linkedin_url) contactParts.push({ text: profile.linkedin_url, label: "LinkedIn", isUrl: true });
  if (profile.portfolio_url) contactParts.push({ text: profile.portfolio_url, label: "GitHub", isUrl: true });
  if (profile.website_url) contactParts.push({ text: profile.website_url, label: "Website", isUrl: true });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 2 }}>
          {avatarUrl ? (
            <Image src={avatarUrl} style={{ width: 56, height: 56, borderRadius: 28 }} />
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName}>{profile.full_name ?? ""}</Text>
            {profile.current_title ? (
              <Text style={styles.headerTitle}>{profile.current_title}</Text>
            ) : null}
            {contactParts.length > 0 ? (
              <View style={styles.headerContact}>
                {contactParts.map((part, i) => (
                  <View key={i} style={{ flexDirection: "row" }}>
                    {i > 0 ? <Text style={styles.headerDot}>·</Text> : null}
                    {part.isUrl ? (
                      <Link src={part.text} style={{ fontSize: 9, color: BLUE, textDecoration: "none" }}>{part.label ?? part.text}</Link>
                    ) : (
                      <Text style={{ fontSize: 9, color: MUTED }}>{part.text}</Text>
                    )}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {/* Motivation (shown first if present) — same ## heading style as resume content */}
        {motivation ? (
          <View>
            <MdPdf text={`## Motivation\n\n${motivation}`} baseStyle={styles.summaryText} />
          </View>
        ) : null}

        {/* Professional Summary — rendered above skills; from resumeText summary part or generated.summary */}
        {resumeText ? (
          (() => {
            const bodyStart = resumeText.startsWith("## ") || resumeText.startsWith("# ")
              ? resumeText.indexOf("\n\n## ")
              : (() => { const f = resumeText.indexOf("\n\n## "); return f > -1 ? resumeText.indexOf("\n\n## ", f + 1) : -1; })();
            const summaryPart = bodyStart > -1 ? resumeText.slice(0, bodyStart).trim() : resumeText.trim();
            return summaryPart ? <MdPdf text={summaryPart} baseStyle={styles.summaryText} /> : null;
          })()
        ) : generated.summary ? (
          <MdPdf text={`## Professional Summary\n\n${generated.summary}`} baseStyle={styles.summaryText} />
        ) : null}

        {/* Skills — ## heading style matching resume content headers */}
        {(generated.skillGroups?.length ?? 0) > 0 ? (
          <View>
            <Text style={styles.h2Heading}>Skills</Text>
            {generated.skillGroups!.map((group, gi) => {
              // "Required" group preserves the route's custom order (frontend frameworks first).
              // All other groups sort by years of experience descending.
              const skills = group.label === "Required"
                ? group.skills.slice()
                : group.skills.slice().sort((a, b) => {
                    const yA = skillYears[a] ?? 0;
                    const yB = skillYears[b] ?? 0;
                    if (yB !== yA) return yB - yA;
                    return a.localeCompare(b);
                  });
              return (
                <View key={gi} style={styles.skillGroupRow}>
                  <Text style={styles.skillGroupLabel}>{group.label}</Text>
                  <View style={styles.skillPillsWrap}>
                    {skills.map((skill, si) => {
                      const yrs = skillYears[skill];
                      return (
                        <View key={si} style={styles.skillPill}>
                          <Text style={styles.skillPillText}>{skill}</Text>
                          {yrs && yrs > 0 ? (
                            <View style={styles.skillYrsBadge}>
                              <Text style={styles.skillYrsText}>{yrs} y</Text>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (profile.skills ?? []).length > 0 ? (
          <View>
            <Text style={styles.h2Heading}>Skills</Text>
            {(() => {
              const skills = (profile.skills ?? [])
                .slice()
                .sort((a, b) => {
                  const yA = skillYears[a] ?? 0;
                  const yB = skillYears[b] ?? 0;
                  if (yB !== yA) return yB - yA;
                  return a.localeCompare(b);
                });
              return (
                <View style={styles.skillPillsWrap}>
                  {skills.map((skill, si) => {
                    const yrs = skillYears[skill];
                    return (
                      <View key={si} style={styles.skillPill}>
                        <Text style={styles.skillPillText}>{skill}</Text>
                        {yrs && yrs > 0 ? (
                          <View style={styles.skillYrsBadge}>
                            <Text style={styles.skillYrsText}>{yrs}y</Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              );
            })()}
          </View>
        ) : null}

        {/* Education */}
        {profile.education && profile.education.length > 0 ? (
          <View>
            <Text style={styles.sectionLabel}>Education</Text>
            <View style={styles.divider} />
            {profile.education.map((edu, i) => (
              <View key={i} style={i > 0 ? { marginTop: 6 } : undefined}>
                <Text style={styles.eduDegree}>
                  {edu.degree}
                  {edu.field ? ` in ${edu.field}` : ""}
                </Text>
                <Text style={styles.eduDetail}>
                  {[edu.institution, edu.year].filter(Boolean).join("  ·  ")}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Spoken Languages */}
        {profile.spoken_languages && profile.spoken_languages.length > 0 ? (
          <View>
            <Text style={styles.sectionLabel}>Languages</Text>
            <View style={styles.divider} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {profile.spoken_languages.map((l, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                  <Text style={{ fontSize: 8.5, color: TEXT, fontFamily: "Helvetica-Bold" }}>{l.language}</Text>
                  {l.level ? <Text style={{ fontSize: 8, color: MUTED }}>{l.level}</Text> : null}
                  {i < profile.spoken_languages!.length - 1 && (
                    <Text style={{ fontSize: 8, color: MUTED, marginLeft: 2 }}>·</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Personal Interests */}
        {profile.personal_interests ? (
          <View>
            <Text style={styles.sectionLabel}>Interests</Text>
            <View style={styles.divider} />
            <Text style={{ fontSize: 8.5, color: TEXT, lineHeight: 1.5 }}>{profile.personal_interests}</Text>
          </View>
        ) : null}

        {/* Free-text resume body — Work Experience part rendered after skills with page break */}
        {resumeText ? (
          (() => {
            const bodyStart2 = resumeText.startsWith("## ") || resumeText.startsWith("# ")
              ? resumeText.indexOf("\n\n## ")
              : (() => { const f = resumeText.indexOf("\n\n## "); return f > -1 ? resumeText.indexOf("\n\n## ", f + 1) : -1; })();
            const bodyPart = bodyStart2 > -1 ? resumeText.slice(bodyStart2 + 2).trim() : null;
            return bodyPart ? (
              <View break>
                <MdPdf text={bodyPart} baseStyle={styles.summaryText} />
              </View>
            ) : null;
          })()
        ) : null}

        {/* Work Experience — only when no free-text override */}
        {!resumeText && generated.workExperience && generated.workExperience.length > 0 ? (
          <View break>
            <Text style={styles.sectionLabel}>Work Experience</Text>
            <View style={styles.divider} />
            {generated.workExperience.map((role, i) => (
              <View key={i} style={styles.roleBlock} wrap={false}>
                <View style={styles.roleRow}>
                  <Text style={styles.roleCompany}>{role.company}</Text>
                  <Text style={styles.roleDates}>
                    {formatDateRange(role.startDate, role.endDate, role.currentlyWorking)}
                  </Text>
                </View>
                <Text style={styles.roleTitle}>{role.title}</Text>
                {role.skills && role.skills.length > 0 ? (
                  <Text style={styles.roleSkills}>{role.skills.join("  ·  ")}</Text>
                ) : null}
                {role.bullets.map((bullet, j) => (
                  <View key={j} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{bullet}</Text>
                  </View>
                ))}
                {(() => {
                  const ref = (profile.work_experience ?? []).find((r) => r.company === role.company)?.reference;
                  if (!ref?.name) return null;
                  const refParts = [ref.name, ref.title].filter(Boolean).join(", ");
                  return (
                    <View style={{ marginTop: 4 }}>
                      <Text style={{ fontSize: 7.5, color: MUTED, fontFamily: "Helvetica-Oblique" }}>
                        {"Reference: "}{refParts}
                        {ref.phone ? `  ·  ${ref.phone}` : ""}
                      </Text>
                      {ref.linkedinUrl ? (
                        <Link src={ref.linkedinUrl} style={{ fontSize: 7.5, color: BLUE, textDecoration: "none" }}>
                          {ref.linkedinUrl}
                        </Link>
                      ) : null}
                    </View>
                  );
                })()}
              </View>
            ))}
          </View>
        ) : null}

        {/* Personal Projects */}
        {(profile.personal_projects ?? []).length > 0 ? (
          <View break>
            <Text style={styles.sectionLabel}>Personal Projects</Text>
            <View style={styles.divider} />
            {(profile.personal_projects ?? []).map((project, i) => {
              const desc = project.description;
              // Show max 8 short skills (≤25 chars) — long multi-word skills blow out row height
              const shortSkills = (project.skills ?? [])
                .filter((s) => s.length <= 25)
                .slice(0, 8);
              return (
                <View key={i} style={styles.roleBlock} wrap={false}>
                  <View style={styles.roleRow}>
                    <Text style={styles.roleCompany}>{project.name}</Text>
                    {(project.startDate || project.endDate || project.currentlyWorking) ? (
                      <Text style={styles.roleDates}>
                        {formatDateRange(
                          project.startDate ?? "",
                          project.endDate ?? "",
                          project.currentlyWorking ?? false,
                        )}
                      </Text>
                    ) : null}
                  </View>
                  {shortSkills.length > 0 ? (
                    <Text style={styles.roleSkills}>{shortSkills.join("  ·  ")}</Text>
                  ) : null}
                  <Text style={styles.projectDesc}>{desc}</Text>
                  {(project.url || project.githubUrl || project.videoUrl) ? (
                    <View style={styles.projectLinks}>
                      {project.url ? (
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <Text style={styles.projectLinkLabel}>Live </Text>
                          <Link src={project.url} style={styles.projectLink}>{project.url}</Link>
                        </View>
                      ) : null}
                      {project.githubUrl ? (
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <Text style={styles.projectLinkLabel}>GitHub </Text>
                          <Link src={project.githubUrl} style={styles.projectLink}>{project.githubUrl}</Link>
                        </View>
                      ) : null}
                      {project.videoUrl ? (
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <Text style={styles.projectLinkLabel}>Video </Text>
                          <Link src={project.videoUrl} style={styles.projectLink}>{project.videoUrl}</Link>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                  {/* Screenshots — only included when includeImages=true */}
                  {includeImages && (project.images ?? []).filter(Boolean).length > 0 ? (
                    <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                      {(project.images ?? []).filter(Boolean).map((url, si) => (
                        <View key={si} style={{ flex: 1 }}>
                          <Image src={url!} style={{ width: "100%", borderRadius: 4 }} />
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {/* LinkedIn Recommendations — speech bubble grid */}
        {recommendations.length > 0 ? (
          <View break>
            <Text style={styles.sectionLabel}>LinkedIn Recommendations</Text>
            <View style={styles.divider} />
            {(() => {
              const GAP = 10;
              const renderCard = (rec: typeof recommendations[0], i: number, isLast: boolean) => {
                const company = rec.work_experience_company ?? "Former Colleague";
                const role = [rec.recommender_title, company].filter(Boolean).join(" · ");
                return (
                  <View key={i} style={{ marginBottom: isLast ? 0 : GAP }}>
                    <View style={styles.recBubble}>
                      <Text style={styles.recText}>&ldquo;{rec.recommendation_text}&rdquo;</Text>
                    </View>
                    <View style={styles.recTail} />
                    <View style={styles.recMeta}>
                      {rec.avatar_url ? (
                        <Image src={rec.avatar_url} style={styles.recAvatar} />
                      ) : (
                        <View style={styles.recAvatarFallback}>
                          <Text style={{ fontSize: 8, color: MUTED, fontFamily: "Helvetica-Bold" }}>
                            {rec.recommender_name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.recInfo}>
                        {rec.recommender_linkedin_url ? (
                          <Link src={rec.recommender_linkedin_url} style={styles.recName}>{rec.recommender_name}</Link>
                        ) : (
                          <Text style={styles.recName}>{rec.recommender_name}</Text>
                        )}
                        <Text style={styles.recRole}>{role} · {fmtRecDate(rec.recommendation_date)}</Text>
                      </View>
                    </View>
                  </View>
                );
              };
              const left = recommendations.filter((_, i) => i % 2 === 0);
              const right = recommendations.filter((_, i) => i % 2 === 1);
              return (
                <View style={{ flexDirection: "row" }}>
                  <View style={{ flex: 1, marginRight: GAP }}>
                    {left.map((rec, i) => renderCard(rec, i, i === left.length - 1))}
                  </View>
                  <View style={{ flex: 1 }}>
                    {right.map((rec, i) => renderCard(rec, i, i === right.length - 1))}
                  </View>
                </View>
              );
            })()}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
