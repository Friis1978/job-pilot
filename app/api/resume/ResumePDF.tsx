import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
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
    fontSize: 10,
    color: TEXT,
    paddingTop: 40,
    paddingBottom: 40,
    paddingLeft: 48,
    paddingRight: 48,
    lineHeight: 1.5,
  },
  // Header
  headerName: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: TEXT,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 12,
    color: MUTED,
    marginBottom: 4,
  },
  headerContact: {
    fontSize: 9,
    color: MUTED,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  headerDot: {
    fontSize: 9,
    color: MUTED,
    marginLeft: 4,
    marginRight: 4,
  },
  // Section
  sectionLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    marginTop: 14,
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
    marginBottom: 6,
  },
  // Summary
  summaryText: {
    fontSize: 10,
    color: TEXT,
    lineHeight: 1.6,
  },
  // Skills
  skillGroupRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  skillGroupLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    width: 110,
    paddingTop: 1,
    flexShrink: 0,
  },
  skillsText: {
    fontSize: 9,
    color: TEXT,
    lineHeight: 1.5,
    flex: 1,
  },
  // Work experience
  roleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 1,
  },
  roleCompany: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: TEXT,
  },
  roleDates: {
    fontSize: 9,
    color: MUTED,
  },
  roleTitle: {
    fontSize: 10,
    color: MUTED,
    marginBottom: 2,
  },
  roleSkills: {
    fontSize: 8,
    color: MUTED,
    marginBottom: 3,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 2,
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 9,
    color: TEXT,
    width: 10,
  },
  bulletText: {
    fontSize: 9,
    color: TEXT,
    flex: 1,
    lineHeight: 1.5,
  },
  roleBlock: {
    marginBottom: 8,
  },
  // Education
  eduDegree: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: TEXT,
  },
  eduDetail: {
    fontSize: 10,
    color: MUTED,
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
              const sorted = group.skills
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
              return (
                <View key={gi} style={styles.skillGroupRow}>
                  <Text style={styles.skillGroupLabel}>{group.label}</Text>
                  <Text style={styles.skillsText}>{sorted.join("  ·  ")}</Text>
                </View>
              );
            })}
          </View>
        ) : (profile.skills ?? []).length > 0 ? (
          <View>
            <Text style={styles.sectionLabel}>Skills</Text>
            <View style={styles.divider} />
            <Text style={styles.skillsText}>
              {(profile.skills ?? [])
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
                })
                .join("  ·  ")}
            </Text>
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

        {/* Education */}
        {profile.education && profile.education.degree ? (
          <View>
            <Text style={styles.sectionLabel}>Education</Text>
            <View style={styles.divider} />
            <Text style={styles.eduDegree}>
              {profile.education.degree}
              {profile.education.field ? ` in ${profile.education.field}` : ""}
            </Text>
            <Text style={styles.eduDetail}>
              {[profile.education.institution, profile.education.year]
                .filter(Boolean)
                .join("  ·  ")}
            </Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
