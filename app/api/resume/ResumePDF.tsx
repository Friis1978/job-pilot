import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link,
} from "@react-pdf/renderer";
import type { Profile } from "@/types";

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
};

const TEXT = "#111827";
const MUTED = "#6B7280";
const ACCENT = "#7C5CFC";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: TEXT,
    paddingTop: 30,
    paddingBottom: 30,
    paddingLeft: 40,
    paddingRight: 40,
    lineHeight: 1.4,
  },
  // Header
  headerName: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: TEXT,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 11,
    color: MUTED,
    marginBottom: 3,
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
    marginTop: 10,
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
    marginBottom: 4,
  },
  // Summary
  summaryText: {
    fontSize: 9,
    color: TEXT,
    lineHeight: 1.5,
  },
  // Skills
  skillGroupRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 2,
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
    lineHeight: 1.4,
    flex: 1,
  },
  skillsRowText: {
    fontSize: 8,
    color: TEXT,
    lineHeight: 1.4,
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
    marginBottom: 2,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 1,
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
    lineHeight: 1.4,
  },
  roleBlock: {
    marginBottom: 5,
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
    color: ACCENT,
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

export function ResumePDF({ profile, generated, skillYears = {} }: Props) {
  const contactParts: string[] = [];
  if (profile.email) contactParts.push(profile.email);
  if (profile.phone) contactParts.push(profile.phone);
  if (profile.location) contactParts.push(profile.location);
  if (profile.linkedin_url) contactParts.push(profile.linkedin_url);
  if (profile.portfolio_url) contactParts.push(profile.portfolio_url);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <Text style={styles.headerName}>{profile.full_name ?? ""}</Text>
        {profile.current_title ? (
          <Text style={styles.headerTitle}>{profile.current_title}</Text>
        ) : null}
        {contactParts.length > 0 ? (
          <View style={styles.headerContact}>
            {contactParts.map((part, i) => (
              <View key={i} style={{ flexDirection: "row" }}>
                {i > 0 ? <Text style={styles.headerDot}>·</Text> : null}
                <Text style={{ fontSize: 9, color: MUTED }}>{part}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Summary */}
        {generated.summary ? (
          <View>
            <Text style={styles.sectionLabel}>Professional Summary</Text>
            <View style={styles.divider} />
            <Text style={styles.summaryText}>{generated.summary}</Text>
          </View>
        ) : null}

        {/* Skills */}
        {(generated.skillGroups?.length ?? 0) > 0 ? (
          <View>
            <Text style={styles.sectionLabel}>Skills</Text>
            <View style={styles.divider} />
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
              const sorted = skills.map((skill) => {
                  const yrs = skillYears[skill];
                  return yrs && yrs > 0 ? `${skill} (${yrs} yr${yrs === 1 ? "" : "s"})` : skill;
                });
              const rows: string[][] = [];
              for (let i = 0; i < sorted.length; i += 8) rows.push(sorted.slice(i, i + 8));
              return (
                <View key={gi} style={styles.skillGroupRow}>
                  <Text style={styles.skillGroupLabel}>{group.label}</Text>
                  <View style={{ flex: 1 }}>
                    {rows.map((row, ri) => (
                      <Text key={ri} style={styles.skillsRowText}>{row.join("  ·  ")}</Text>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (profile.skills ?? []).length > 0 ? (
          <View>
            <Text style={styles.sectionLabel}>Skills</Text>
            <View style={styles.divider} />
            {(() => {
              const sorted = (profile.skills ?? [])
                .slice()
                .sort((a, b) => {
                  const yA = skillYears[a] ?? 0;
                  const yB = skillYears[b] ?? 0;
                  if (yB !== yA) return yB - yA;
                  return a.localeCompare(b);
                })
                .map((skill) => {
                  const yrs = skillYears[skill];
                  return yrs && yrs > 0 ? `${skill} (${yrs} yr${yrs === 1 ? "" : "s"})` : skill;
                });
              // Chunk into rows of 8 — react-pdf miscalculates height for long
              // wrapping Text nodes, pushing the next section into the wrong position.
              const rows: string[][] = [];
              for (let i = 0; i < sorted.length; i += 8) rows.push(sorted.slice(i, i + 8));
              return rows.map((row, ri) => (
                <Text key={ri} style={styles.skillsRowText}>{row.join("  ·  ")}</Text>
              ));
            })()}
          </View>
        ) : null}

        {/* Work Experience */}
        {generated.workExperience && generated.workExperience.length > 0 ? (
          <View>
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
              </View>
            ))}
          </View>
        ) : null}

        {/* Personal Projects */}
        {(profile.personal_projects ?? []).length > 0 ? (
          <View>
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
                </View>
              );
            })}
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
      </Page>
    </Document>
  );
}
