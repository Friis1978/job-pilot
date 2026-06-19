"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { saveProfile, updateAvatarUrl } from "@/actions/profile";
import { toast } from "@/lib/toast";
import { insforge } from "@/lib/insforge-client";
import { AvatarCropModal } from "@/components/profile/AvatarCropModal";
import { Tooltip } from "@/components/ui/Tooltip";
import type { Profile, ProfileFormInput } from "@/types";

type WorkExperienceEntry = {
  id: string;
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  currentlyWorking: boolean;
  responsibilities: string;
  skills: string[];
  skillInput: string;
};

type EducationEntry = {
  id: string;
  degree: string;
  field: string;
  institution: string;
  year: string;
};

type PersonalProjectEntry = {
  id: string;
  name: string;
  description: string;
  url: string;
  githubUrl: string;
  videoUrl: string;
  skills: string[];
  startDate: string;
  endDate: string;
  currentlyWorking: boolean;
  skillInput: string;
};

type FormData = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  portfolioUrl: string;
  currentTitle: string;
  experienceLevel: string;
  skills: string[];
  skillInput: string;
  industries: string[];
  industryInput: string;
  workExperience: WorkExperienceEntry[];
  personalProjects: PersonalProjectEntry[];
  educations: EducationEntry[];
  jobTitlesSeeking: string;
  remotePreference: string;
  salaryExpectation: string;
  preferredLocations: string;
  coverLetterTone: string;
  coverLetterInstructions: string;
  motivation: string;
  proudAchievement: string;
  energyTasks: string;
  companyTypePreference: string[];
  careerVision: string;
};

const CHANGE_LABELS: Partial<Record<keyof FormData, string>> = {
  fullName:           "Name",
  email:              "Email",
  phone:              "Phone",
  location:           "Location",
  currentTitle:       "Current Title",
  experienceLevel:    "Experience Level",
  linkedinUrl:        "LinkedIn URL",
  portfolioUrl:       "Portfolio URL",
  skills:             "Skills",
  industries:         "Industries",
  personalProjects:   "Personal Projects",
  educations:         "Education",
  jobTitlesSeeking:   "Job Titles Seeking",
  remotePreference:   "Remote Preference",
  salaryExpectation:  "Salary Expectation",
  preferredLocations: "Preferred Locations",
  coverLetterTone:    "Cover Letter Tone",
  coverLetterInstructions: "Cover Letter Instructions",
  motivation:         "Motivation",
  proudAchievement:   "Key Achievement",
  energyTasks:        "Energy Tasks",
  companyTypePreference: "Company Type",
  careerVision:       "Career Vision",
};

function computeChangedFields(current: FormData, savedJson: string): string[] {
  const prev = JSON.parse(savedJson) as Record<string, unknown>;
  const changed: string[] = [];

  for (const [key, label] of Object.entries(CHANGE_LABELS) as [keyof FormData, string][]) {
    if (JSON.stringify(current[key]) !== JSON.stringify(prev[key])) changed.push(label);
  }

  const currWE = JSON.stringify(current.workExperience.map(({ skillInput: _si, ...r }) => r));
  if (currWE !== JSON.stringify(prev.workExperience)) changed.push("Work Experience");

  return changed;
}

function fmtMonthYear(ym: string): string {
  const [year, month] = ym.split("-");
  return new Date(Number(year), Number(month) - 1).toLocaleString("en-US", { month: "short", year: "numeric" });
}

const labelClass =
  "relative group/tooltip block w-fit text-xs font-medium uppercase tracking-wide text-text-secondary mb-1.5";

const inputClass =
  "w-full px-3 py-2 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent bg-surface transition-colors";

const selectClass =
  "w-full px-3 py-2 border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent bg-surface transition-colors appearance-none";

function InfoIcon({ tip }: { tip: string }) {
  return (
    <>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="text-text-muted cursor-default shrink-0">
        <circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeWidth="1.2" />
        <path d="M6.5 5.5v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="6.5" cy="3.5" r="0.6" fill="currentColor" />
      </svg>
      <span
        role="tooltip"
        className="pointer-events-none absolute z-50 bottom-full left-0 mb-2 px-2.5 py-1.5 rounded-md bg-[#111] text-white text-xs leading-snug opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150 w-max min-w-[8rem] max-w-xs break-words whitespace-normal text-left normal-case tracking-normal"
      >
        {tip}
      </span>
      <span className="pointer-events-none absolute z-50 bottom-full left-1/2 -translate-x-1/2 opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150 border-x-8 border-t-8 border-b-0 border-transparent border-t-[#111]" />
    </>
  );
}

function SectionAccordion({ title, children }: { title: string; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className="pt-6 border-t border-border mt-6">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center gap-2 mb-4 text-left group"
      >
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-text-muted transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      </button>
      {isOpen && children}
    </div>
  );
}

type Props = {
  initialData?: Profile | null;
  extractedFormData?: Partial<ProfileFormInput> | null;
  userId?: string | null;
  resumeSection?: ReactNode;
};

function profileToFormData(p: Profile | null | undefined): FormData {
  if (!p) {
    return {
      fullName: "", email: "", phone: "", location: "",
      linkedinUrl: "", portfolioUrl: "",
      currentTitle: "", experienceLevel: "",
      skills: [], skillInput: "", industries: [], industryInput: "",
      workExperience: [], personalProjects: [], educations: [], jobTitlesSeeking: "",
      remotePreference: "", salaryExpectation: "", preferredLocations: "",
      coverLetterTone: "", coverLetterInstructions: "",
      motivation: "", proudAchievement: "", energyTasks: "",
      companyTypePreference: [], careerVision: "",
    };
  }
  const rawEdu = p.education as unknown;
  const eduArr: { degree?: string; field?: string; institution?: string; year?: string }[] =
    Array.isArray(rawEdu) ? rawEdu : rawEdu ? [rawEdu as { degree?: string; field?: string; institution?: string; year?: string }] : [];
  return {
    fullName: p.full_name ?? "",
    email: p.email ?? "",
    phone: p.phone ?? "",
    location: p.location ?? "",
    linkedinUrl: p.linkedin_url ?? "",
    portfolioUrl: p.portfolio_url ?? "",
    currentTitle: p.current_title ?? "",
    experienceLevel: p.experience_level ?? "",
    skills: p.skills ?? [],
    skillInput: "",
    industries: p.industries ?? [],
    industryInput: "",
    workExperience: (p.work_experience ?? []).map((r) => ({
      id: crypto.randomUUID(),
      company: r.company ?? "",
      title: r.title ?? "",
      startDate: r.startDate ?? "",
      endDate: r.endDate ?? "",
      currentlyWorking: r.currentlyWorking ?? false,
      responsibilities: r.responsibilities ?? "",
      skills: r.skills ?? [],
      skillInput: "",
    })),
    personalProjects: (p.personal_projects ?? []).map((proj) => ({
      id: crypto.randomUUID(),
      name: proj.name ?? "",
      description: proj.description ?? "",
      url: proj.url ?? "",
      githubUrl: proj.githubUrl ?? "",
      videoUrl: proj.videoUrl ?? "",
      skills: proj.skills ?? [],
      startDate: proj.startDate ?? "",
      endDate: proj.endDate ?? "",
      currentlyWorking: proj.currentlyWorking ?? false,
      skillInput: "",
    })),
    educations: eduArr.map((e) => ({
      id: crypto.randomUUID(),
      degree: e.degree ?? "",
      field: e.field ?? "",
      institution: e.institution ?? "",
      year: e.year ?? "",
    })),
    jobTitlesSeeking: (p.job_titles_seeking ?? []).join(", "),
    remotePreference: p.remote_preference ?? "",
    salaryExpectation: p.salary_expectation ?? "",
    preferredLocations: (p.preferred_locations ?? []).join(", "),
    coverLetterTone: p.cover_letter_tone ?? "",
    coverLetterInstructions: p.cover_letter_instructions ?? "",
    motivation: p.motivation ?? "",
    proudAchievement: p.proud_achievement ?? "",
    energyTasks: p.energy_tasks ?? "",
    companyTypePreference: p.company_type_preference ?? [],
    careerVision: p.career_vision ?? "",
  };
}

function mergeExtracted(
  base: FormData,
  extracted: Partial<ProfileFormInput>,
): FormData {
  return {
    ...base,
    fullName: extracted.fullName || base.fullName,
    phone: extracted.phone || base.phone,
    location: extracted.location || base.location,
    linkedinUrl: extracted.linkedinUrl || base.linkedinUrl,
    portfolioUrl: extracted.portfolioUrl || base.portfolioUrl,
    currentTitle: extracted.currentTitle || base.currentTitle,
    experienceLevel: extracted.experienceLevel || base.experienceLevel,
    skills: extracted.skills?.length ? extracted.skills : base.skills,
    industries: extracted.industries?.length ? extracted.industries : base.industries,
    workExperience: extracted.workExperience?.length
      ? extracted.workExperience.map((r) => ({ ...r, id: crypto.randomUUID(), skills: r.skills ?? [], skillInput: "" }))
      : base.workExperience,
    educations: extracted.educations?.length
      ? extracted.educations.map((e) => ({ ...e, id: crypto.randomUUID() }))
      : base.educations,
  };
}

export function ProfileForm({ initialData, extractedFormData, userId, resumeSection }: Props) {
  const [data, setData] = useState<FormData>(() => {
    const base = profileToFormData(initialData);
    return extractedFormData ? mergeExtracted(base, extractedFormData) : base;
  });
  const [hasUnreviewedExtraction, setHasUnreviewedExtraction] = useState(
    () => extractedFormData != null,
  );
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialData?.avatar_url ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [generatingResume, setGeneratingResume] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const workExperienceEndRef = useRef<HTMLDivElement>(null);
  const [shouldScrollToRole, setShouldScrollToRole] = useState(false);
  const [roleErrors, setRoleErrors] = useState<Record<string, Set<string>>>({});
  const [openRoles, setOpenRoles] = useState<Set<string>>(new Set());
  const [openProjects, setOpenProjects] = useState<Set<string>>(new Set());
  const [openEducations, setOpenEducations] = useState<Set<string>>(new Set());
  const [skillDupeError, setSkillDupeError] = useState(false);
  const [industryDupeError, setIndustryDupeError] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState(() => snapshot(data));

  function snapshot(d: typeof data) {
    return JSON.stringify({
      ...d,
      skillInput: undefined,
      industryInput: undefined,
      workExperience: d.workExperience.map(({ skillInput: _si, ...r }) => r),
      personalProjects: d.personalProjects.map(({ skillInput: _si, ...r }) => r),
    });
  }

  const hasUnsavedChanges = snapshot(data) !== savedSnapshot;
  const firstErrorRoleRef = useRef<HTMLDivElement>(null);

  function handleCancel() {
    const parsed = JSON.parse(savedSnapshot) as FormData;
    setData({
      ...parsed,
      skillInput: "",
      industryInput: "",
      workExperience: parsed.workExperience.map((r) => ({ ...r, skillInput: "" })),
      personalProjects: parsed.personalProjects.map((p) => ({ ...p, skillInput: "" })),
    });
    setRoleErrors({});
    setSaveSuccess(false);
  }

  useEffect(() => {
    if (!hasUnreviewedExtraction || saveSuccess) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnreviewedExtraction, saveSuccess]);

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function addSkill() {
    const trimmed = data.skillInput.trim();
    if (!trimmed) return;
    if (data.skills.map((s) => s.toLowerCase()).includes(trimmed.toLowerCase())) {
      setSkillDupeError(true);
      toast(`"${trimmed}" is already in your skills list.`, "error");
      return;
    }
    setSkillDupeError(false);
    setData((prev) => ({ ...prev, skills: [...prev.skills, trimmed], skillInput: "" }));
  }

  function removeSkill(skill: string) {
    setField("skills", data.skills.filter((s) => s !== skill));
  }

  function addIndustry() {
    const trimmed = data.industryInput.trim();
    if (!trimmed) return;
    if (data.industries.map((i) => i.toLowerCase()).includes(trimmed.toLowerCase())) {
      setIndustryDupeError(true);
      toast(`"${trimmed}" is already in your industries list.`, "error");
      return;
    }
    setIndustryDupeError(false);
    setData((prev) => ({ ...prev, industries: [...prev.industries, trimmed], industryInput: "" }));
  }

  function removeIndustry(industry: string) {
    setField("industries", data.industries.filter((i) => i !== industry));
  }

  function addRole() {
    const newId = crypto.randomUUID();
    setData((prev) => ({
      ...prev,
      workExperience: [
        ...prev.workExperience,
        {
          id: newId,
          company: "",
          title: "",
          startDate: "",
          endDate: "",
          currentlyWorking: false,
          responsibilities: "",
          skills: [],
          skillInput: "",
        },
      ],
    }));
    setOpenRoles((prev) => new Set([...prev, newId]));
    setShouldScrollToRole(true);
  }

  function addEducation() {
    const newId = crypto.randomUUID();
    setData((prev) => ({
      ...prev,
      educations: [
        ...prev.educations,
        { id: newId, degree: "", field: "", institution: "", year: "" },
      ],
    }));
    setOpenEducations((prev) => new Set([...prev, newId]));
  }

  function removeEducation(id: string) {
    setData((prev) => ({ ...prev, educations: prev.educations.filter((e) => e.id !== id) }));
  }

  function updateEducation(id: string, field: keyof Omit<EducationEntry, "id">, value: string) {
    setData((prev) => ({
      ...prev,
      educations: prev.educations.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    }));
  }

  useEffect(() => {
    if (shouldScrollToRole && workExperienceEndRef.current) {
      workExperienceEndRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      setShouldScrollToRole(false);
    }
  }, [shouldScrollToRole, data.workExperience.length]);

  function addRoleSkill(roleId: string) {
    setField(
      "workExperience",
      data.workExperience.map((r) => {
        if (r.id !== roleId) return r;
        const trimmed = r.skillInput.trim();
        if (!trimmed || r.skills.includes(trimmed)) return { ...r, skillInput: "" };
        return { ...r, skills: [...r.skills, trimmed], skillInput: "" };
      }),
    );
  }

  function removeRoleSkill(roleId: string, skill: string) {
    setField(
      "workExperience",
      data.workExperience.map((r) =>
        r.id === roleId ? { ...r, skills: r.skills.filter((s) => s !== skill) } : r,
      ),
    );
  }

  function updateRoleSkillInput(roleId: string, value: string) {
    setField(
      "workExperience",
      data.workExperience.map((r) =>
        r.id === roleId ? { ...r, skillInput: value } : r,
      ),
    );
  }

  function addRoleSkillDirect(roleId: string, skill: string) {
    setField(
      "workExperience",
      data.workExperience.map((r) =>
        r.id === roleId && !r.skills.includes(skill)
          ? { ...r, skills: [...r.skills, skill] }
          : r,
      ),
    );
  }

  function removeRole(id: string) {
    setField(
      "workExperience",
      data.workExperience.filter((r) => r.id !== id),
    );
    setOpenRoles((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }

  function updateRole(id: string, field: keyof WorkExperienceEntry, value: string | boolean) {
    setField(
      "workExperience",
      data.workExperience.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  }

  function addProject() {
    const newId = crypto.randomUUID();
    setData((prev) => ({
      ...prev,
      personalProjects: [
        ...prev.personalProjects,
        { id: newId, name: "", description: "", url: "", githubUrl: "", videoUrl: "", skills: [], startDate: "", endDate: "", currentlyWorking: false, skillInput: "" },
      ],
    }));
    setOpenProjects((prev) => new Set([...prev, newId]));
  }

  function removeProject(id: string) {
    setField("personalProjects", data.personalProjects.filter((p) => p.id !== id));
    setOpenProjects((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }

  function updateProject(id: string, field: keyof PersonalProjectEntry, value: string) {
    setField(
      "personalProjects",
      data.personalProjects.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  }

  function addProjectSkill(projectId: string) {
    setField(
      "personalProjects",
      data.personalProjects.map((p) => {
        if (p.id !== projectId) return p;
        const trimmed = p.skillInput.trim();
        if (!trimmed || p.skills.includes(trimmed)) return { ...p, skillInput: "" };
        return { ...p, skills: [...p.skills, trimmed], skillInput: "" };
      }),
    );
  }

  function removeProjectSkill(projectId: string, skill: string) {
    setField(
      "personalProjects",
      data.personalProjects.map((p) =>
        p.id === projectId ? { ...p, skills: p.skills.filter((s) => s !== skill) } : p,
      ),
    );
  }

  function addProjectSkillDirect(projectId: string, skill: string) {
    setField(
      "personalProjects",
      data.personalProjects.map((p) =>
        p.id === projectId && !p.skills.includes(skill)
          ? { ...p, skills: [...p.skills, skill] }
          : p,
      ),
    );
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset input so the same file can be re-selected after cancel
    e.target.value = "";
    if (!file || !userId) return;
    if (!file.type.startsWith("image/")) return;
    const objectUrl = URL.createObjectURL(file);
    setCropImageSrc(objectUrl);
  }

  const handleCropConfirm = useCallback(async (blob: Blob) => {
    if (!userId) return;
    setCropImageSrc((src) => { if (src) URL.revokeObjectURL(src); return null; });
    setAvatarUploading(true);
    try {
      const path = `${userId}/avatar.jpg`;
      await insforge.storage.from("avatars").remove(path);
      const { data: uploaded, error } = await insforge.storage.from("avatars").upload(path, blob);
      if (error || !uploaded) return;
      const result = await updateAvatarUrl(uploaded.url);
      if (result.success) setAvatarUrl(uploaded.url);
    } catch {
      // silent — non-critical
    } finally {
      setAvatarUploading(false);
    }
  }, [userId]);

  const handleCropCancel = useCallback(() => {
    setCropImageSrc((src) => { if (src) URL.revokeObjectURL(src); return null; });
  }, []);

  async function handleGenerateResume() {
    setGeneratingResume(true);
    try {
      const response = await fetch("/api/resume/generate", { method: "POST" });
      if (!response.ok) {
        const json = await response.json() as { error?: string };
        toast(json.error ?? "Generation failed. Please try again.", "error");
        return;
      }
      // Route streams PDF bytes directly — create a local object URL for download
      // so the browser never needs to hit the auth-gated storage URL.
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = "resume.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast("Something went wrong. Please try again.", "error");
    } finally {
      setGeneratingResume(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-[0px_1px_3px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Profile Information</h2>
          <p className="text-sm text-text-secondary mt-1">
            This section is used to accurately represent you in agent interactions.
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={handleGenerateResume}
            disabled={generatingResume}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground text-sm font-medium rounded-lg hover:bg-accent-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {generatingResume ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Generating…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2v7M4 6l3 3 3-3M2 10v1a1 1 0 001 1h8a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Generate Resume
              </>
            )}
          </button>
        </div>
      </div>

      {hasUnreviewedExtraction && !saveSuccess && (
        <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5 text-warning">
            <path d="M8 1.5L1 14.5h14L8 1.5zM8 6v4M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-sm text-warning">
            Your profile was auto-populated from your resume — review the fields below and save your changes.
          </p>
        </div>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();

          // Validate work experience required fields
          const errors: Record<string, Set<string>> = {};
          for (const role of data.workExperience) {
            const missing = new Set<string>();
            if (!role.company.trim()) missing.add("company");
            if (!role.title.trim()) missing.add("title");
            if (!role.startDate.trim()) missing.add("startDate");
            if (!role.currentlyWorking && !role.endDate.trim()) missing.add("endDate");
            if (missing.size > 0) errors[role.id] = missing;
          }

          if (Object.keys(errors).length > 0) {
            setRoleErrors(errors);
            setOpenRoles((prev) => new Set([...prev, ...Object.keys(errors)]));
            // Scroll to first invalid role on next paint
            requestAnimationFrame(() => {
              firstErrorRoleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
            return;
          }

          setRoleErrors({});
          setSaving(true);
                setSaveSuccess(false);
          const result = await saveProfile({
            ...data,
            workExperience: data.workExperience.map(
              ({ skillInput: _si, ...r }) => r,
            ),
            personalProjects: data.personalProjects.map(
              ({ id: _id, skillInput: _si, ...r }) => r,
            ),
            educations: data.educations.map(({ id: _id, ...e }) => e),
          });
          setSaving(false);
          if (result.success) {
            setSaveSuccess(true);
            setSavedSnapshot(snapshot(data));
            setHasUnreviewedExtraction(false);
            toast("Profile saved successfully.", "success");
          } else {
            toast(result.error ?? "Something went wrong. Please try again.", "error");
          }
        }}
        className="mt-6 flex flex-col gap-0"
      >
        {/* Personal Info */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-4">Personal Info</h3>

          {/* Avatar upload */}
          <div className="flex items-center gap-4 mb-5">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-border bg-surface-secondary flex items-center justify-center shrink-0 hover:border-accent transition-colors disabled:opacity-60 group"
              title="Change profile photo"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Profile photo" className="w-full h-full object-cover" />
              ) : (
                <svg className="w-7 h-7 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              )}
              <div className="absolute inset-0 bg-overlay/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {avatarUploading ? (
                  <svg className="w-5 h-5 text-white animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                )}
              </div>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <div>
              <p className="text-sm font-medium text-text-primary">Profile Photo</p>
              <p className="text-xs text-text-muted mt-0.5">Used in downloaded cover letters</p>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                className="mt-1.5 text-xs text-accent hover:text-accent-dark transition-colors disabled:opacity-50"
              >
                {avatarUploading ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <label className={`${labelClass} flex items-center gap-1.5`}>Full Name <InfoIcon tip="Enter your full name as it should appear on your resume and cover letters" /></label>
              <input
                type="text"
                value={data.fullName}
                onChange={(e) => setField("fullName", e.target.value)}
                placeholder="Your full name"
                className={inputClass}
              />
            </div>
            <div>
              <label className={`${labelClass} flex items-center gap-1.5`}>Email <InfoIcon tip="Your primary email address used for job application correspondence" /></label>
              <input
                type="email"
                value={data.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className={`${labelClass} flex items-center gap-1.5`}>Phone Number <InfoIcon tip="Your contact number — include the country code if you are applying internationally" /></label>
              <input
                type="tel"
                value={data.phone}
                onChange={(e) => setField("phone", e.target.value)}
                placeholder="(123) 456-7890"
                className={inputClass}
              />
            </div>
            <div>
              <label className={`${labelClass} flex items-center gap-1.5`}>Location <InfoIcon tip="Your current city and country — used to find nearby jobs and appear on your resume" /></label>
              <input
                type="text"
                value={data.location}
                onChange={(e) => setField("location", e.target.value)}
                placeholder="City, Country"
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className={`${labelClass} flex items-center gap-1.5`}>LinkedIn URL <InfoIcon tip="Paste your full LinkedIn profile URL — it will be included on your resume and cover letters" /></label>
              <input
                type="url"
                value={data.linkedinUrl}
                onChange={(e) => setField("linkedinUrl", e.target.value)}
                placeholder="https://linkedin.com/in/you"
                className={inputClass}
              />
            </div>
            <div>
              <label className={`${labelClass} flex items-center gap-1.5`}>Portfolio / GitHub <InfoIcon tip="Link to your portfolio site, GitHub profile, or personal website — shown to employers on your resume" /></label>
              <input
                type="url"
                value={data.portfolioUrl}
                onChange={(e) => setField("portfolioUrl", e.target.value)}
                placeholder="https://github.com/you"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {resumeSection}

        {/* Professional Info */}
        <SectionAccordion title="Professional Info">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="xl:col-span-3">
              <label className={`${labelClass} flex items-center gap-1.5`}>Current / Recent Job Title <InfoIcon tip="Your current or most recent job title — used to match you with relevant jobs and tailor your resume" /></label>
              <input
                type="text"
                value={data.currentTitle}
                onChange={(e) => setField("currentTitle", e.target.value)}
                placeholder="Frontend Engineer"
                className={inputClass}
              />
            </div>
            <div>
              <label className={`${labelClass} flex items-center gap-1.5`}>Experience Level <InfoIcon tip="Select the seniority level that best describes you — affects how jobs are matched and how your resume is positioned" /></label>
              <div className="relative">
                <select
                  value={data.experienceLevel}
                  onChange={(e) => setField("experienceLevel", e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select...</option>
                  <option value="junior">Junior</option>
                  <option value="mid">Mid</option>
                  <option value="senior">Senior</option>
                  <option value="lead">Lead</option>
                </select>
                <svg
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                >
                  <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Skills */}
          <div>
            <label className={`${labelClass} flex items-center gap-1.5`}>Skills <InfoIcon tip="Add your technical and professional skills one at a time — press Enter after each one" /></label>
            <div className="flex gap-2">
              <input
                type="text"
                value={data.skillInput}
                onChange={(e) => { setField("skillInput", e.target.value); setSkillDupeError(false); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                placeholder="Add a skill"
                className={`${inputClass} ${skillDupeError ? "border-error focus:ring-error focus:border-error" : ""}`}
              />
              <button
                type="button"
                onClick={addSkill}
                className="shrink-0 px-4 py-2 border border-border rounded-lg text-sm font-medium text-text-primary hover:bg-surface-secondary transition-colors"
              >
                Add
              </button>
            </div>
            {skillDupeError && (
              <p className="mt-1 text-xs text-error">This skill is already in your list.</p>
            )}
            {data.skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {data.skills
                  .slice()
                  .sort((a, b) => {
                    const usedSkills = new Set([
                      ...data.workExperience.flatMap((r) => r.skills),
                      ...data.personalProjects.flatMap((p) => p.skills),
                    ]);
                    const aUsed = usedSkills.has(a);
                    const bUsed = usedSkills.has(b);
                    if (aUsed !== bUsed) return aUsed ? -1 : 1;
                    return a.localeCompare(b);
                  })
                  .map((skill) => {
                  const isUsed = data.workExperience.some((r) => r.skills.includes(skill)) ||
                    data.personalProjects.some((p) => p.skills.includes(skill));
                  return (
                  <span
                    key={skill}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                      isUsed
                        ? "bg-accent/10 border-accent/30 text-accent"
                        : "bg-surface-secondary border-border text-text-primary"
                    }`}
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="text-text-muted hover:text-text-primary transition-colors"
                      aria-label={`Remove ${skill}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Industries */}
          <div>
            <label className={`${labelClass} flex items-center gap-1.5`}>Industries (Optional) <InfoIcon tip="Add industries you have worked in or prefer — improves the accuracy of job matching" /></label>
            <div className="flex gap-2">
              <input
                type="text"
                value={data.industryInput}
                onChange={(e) => { setField("industryInput", e.target.value); setIndustryDupeError(false); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addIndustry();
                  }
                }}
                placeholder="E.g. Fintech, Healthcare"
                className={`${inputClass} ${industryDupeError ? "border-error focus:ring-error focus:border-error" : ""}`}
              />
              <button
                type="button"
                onClick={addIndustry}
                className="shrink-0 px-4 py-2 border border-border rounded-lg text-sm font-medium text-text-primary hover:bg-surface-secondary transition-colors"
              >
                Add
              </button>
            </div>
            {industryDupeError && (
              <p className="mt-1 text-xs text-error">This industry is already in your list.</p>
            )}
            {data.industries.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {data.industries.map((industry) => (
                  <span
                    key={industry}
                    className="flex items-center gap-1.5 px-3 py-1 bg-surface-secondary border border-border rounded-full text-xs font-medium text-text-primary"
                  >
                    {industry}
                    <button
                      type="button"
                      onClick={() => removeIndustry(industry)}
                      className="text-text-muted hover:text-text-primary transition-colors"
                      aria-label={`Remove ${industry}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        </SectionAccordion>

        {/* Work Experience */}
        <div className="pt-6 border-t border-border mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">Work Experience</h3>
            <button
              type="button"
              onClick={addRole}
              className="flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-dark transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Add role
            </button>
          </div>

          {data.workExperience.length === 0 && (
            <p className="text-sm text-text-muted">No work experience added yet.</p>
          )}

          <div className="flex flex-col gap-2">
            {data.workExperience.map((role, index) => {
              const errs = roleErrors[role.id];
              const isFirstError = errs && Object.keys(roleErrors)[0] === role.id;
              const isOpen = openRoles.has(role.id);
              const dateRange = [
                role.startDate ? fmtMonthYear(role.startDate) : null,
                role.currentlyWorking ? "Present" : role.endDate ? fmtMonthYear(role.endDate) : null,
              ].filter(Boolean).join(" – ");
              const heading = role.title && role.company
                ? `${role.title} at ${role.company}`
                : role.title || role.company || `Role ${index + 1}`;
              return (
              <div
                key={role.id}
                ref={
                  index === data.workExperience.length - 1
                    ? workExperienceEndRef
                    : isFirstError
                      ? firstErrorRoleRef
                      : undefined
                }
                className={`border rounded-xl overflow-hidden ${errs ? "border-error" : "border-border"}`}
              >
                {/* Accordion header */}
                <div className="flex items-center hover:bg-surface-secondary transition-colors">
                  <button
                    type="button"
                    onClick={() => setOpenRoles((prev) => {
                      const next = new Set(prev);
                      if (next.has(role.id)) next.delete(role.id);
                      else next.add(role.id);
                      return next;
                    })}
                    className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-w-0"
                  >
                    <svg
                      width="16" height="16" viewBox="0 0 16 16" fill="none"
                      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                      className={`shrink-0 text-text-muted transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                    >
                      <path d="M6 4l4 4-4 4" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{heading}</p>
                      {dateRange && <p className="text-xs text-text-muted">{dateRange}</p>}
                    </div>
                    {errs && (
                      <span className="shrink-0 text-xs text-error font-medium">Incomplete</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRole(role.id)}
                    className="shrink-0 text-xs text-text-muted hover:text-error transition-colors px-4 py-3"
                  >
                    Remove
                  </button>
                </div>

                {/* Accordion body */}
                {isOpen && (
                  <div className="px-4 pb-4 flex flex-col gap-4 border-t border-border pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={`${labelClass} flex items-center gap-1.5`}>Company Name <InfoIcon tip="The full name of the company you worked at" /> <span className="text-error">*</span></label>
                        <input
                          type="text"
                          value={role.company}
                          onChange={(e) => {
                            updateRole(role.id, "company", e.target.value);
                            if (e.target.value.trim()) setRoleErrors((prev) => { const n = { ...prev }; n[role.id]?.delete("company"); if (!n[role.id]?.size) delete n[role.id]; return n; });
                          }}
                          placeholder="Acme Inc."
                          className={`${inputClass} ${errs?.has("company") ? "border-error focus:ring-error focus:border-error" : ""}`}
                        />
                      </div>
                      <div>
                        <label className={`${labelClass} flex items-center gap-1.5`}>Job Title <InfoIcon tip="Your official title at this company — be specific, as it is used to match you with similar roles" /> <span className="text-error">*</span></label>
                        <input
                          type="text"
                          value={role.title}
                          onChange={(e) => {
                            updateRole(role.id, "title", e.target.value);
                            if (e.target.value.trim()) setRoleErrors((prev) => { const n = { ...prev }; n[role.id]?.delete("title"); if (!n[role.id]?.size) delete n[role.id]; return n; });
                          }}
                          placeholder="Frontend Engineer"
                          className={`${inputClass} ${errs?.has("title") ? "border-error focus:ring-error focus:border-error" : ""}`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={`${labelClass} flex items-center gap-1.5`}>Start Date <InfoIcon tip="Month and year you started this role" /> <span className="text-error">*</span></label>
                        <input
                          type="month"
                          value={role.startDate}
                          onChange={(e) => {
                            updateRole(role.id, "startDate", e.target.value);
                            if (e.target.value.trim()) setRoleErrors((prev) => { const n = { ...prev }; n[role.id]?.delete("startDate"); if (!n[role.id]?.size) delete n[role.id]; return n; });
                          }}
                          className={`${inputClass} ${errs?.has("startDate") ? "border-error focus:ring-error focus:border-error" : ""}`}
                        />
                      </div>
                      <div>
                        <label className={`${labelClass} flex items-center gap-1.5`}>End Date <InfoIcon tip="Month and year you left this role — leave blank if currently working here" /> {!role.currentlyWorking && <span className="text-error">*</span>}</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="month"
                            value={role.endDate}
                            disabled={role.currentlyWorking}
                            onChange={(e) => {
                              updateRole(role.id, "endDate", e.target.value);
                              if (e.target.value.trim()) setRoleErrors((prev) => { const n = { ...prev }; n[role.id]?.delete("endDate"); if (!n[role.id]?.size) delete n[role.id]; return n; });
                            }}
                            className={`flex-1 px-3 py-2 border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 bg-surface transition-colors disabled:bg-surface-secondary disabled:text-text-muted ${errs?.has("endDate") ? "border-error focus:ring-error focus:border-error" : "border-border focus:ring-accent focus:border-accent"}`}
                          />
                          <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0">
                            <input
                              type="checkbox"
                              checked={role.currentlyWorking}
                              onChange={(e) => {
                                updateRole(role.id, "currentlyWorking", e.target.checked);
                                if (e.target.checked) setRoleErrors((prev) => { const n = { ...prev }; n[role.id]?.delete("endDate"); if (!n[role.id]?.size) delete n[role.id]; return n; });
                              }}
                              className="w-4 h-4 rounded border-border accent-accent"
                            />
                            <span className="text-xs text-text-secondary">Currently working here</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className={`${labelClass} flex items-center gap-1.5`}>Key Responsibilities <InfoIcon tip="Summarise your main responsibilities and achievements — the AI uses this to tailor your resume and cover letters to each job" /></label>
                      <textarea
                        value={role.responsibilities}
                        onChange={(e) => updateRole(role.id, "responsibilities", e.target.value)}
                        placeholder="Describe your key contributions and responsibilities..."
                        rows={3}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent bg-surface transition-colors resize-y"
                      />
                    </div>

                    <div>
                      <label className={`${labelClass} flex items-center gap-1.5`}>Skills Used <InfoIcon tip="Add technologies and skills you used in this role — helps match you with similar positions" /></label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={role.skillInput}
                          onChange={(e) => updateRoleSkillInput(role.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addRoleSkill(role.id);
                            }
                          }}
                          placeholder="Add a skill used in this role"
                          className={inputClass}
                        />
                        <button
                          type="button"
                          onClick={() => addRoleSkill(role.id)}
                          className="shrink-0 px-4 py-2 border border-border rounded-lg text-sm font-medium text-text-primary hover:bg-surface-secondary transition-colors"
                        >
                          Add
                        </button>
                      </div>
                      {role.skills.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {role.skills.map((skill) => (
                            <span
                              key={skill}
                              className="flex items-center gap-1.5 px-3 py-1 bg-surface-secondary border border-border rounded-full text-xs font-medium text-text-primary"
                            >
                              {skill}
                              <button
                                type="button"
                                onClick={() => removeRoleSkill(role.id, skill)}
                                className="text-text-muted hover:text-text-primary transition-colors"
                                aria-label={`Remove ${skill}`}
                              >
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      {data.skills.filter((s) => !role.skills.includes(s)).length > 0 && (
                        <div className="mt-2.5">
                          <p className="text-xs text-text-muted mb-1.5">From your profile:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {data.skills
                              .filter((s) => !role.skills.includes(s))
                              .map((skill) => (
                                <button
                                  key={skill}
                                  type="button"
                                  onClick={() => addRoleSkillDirect(role.id, skill)}
                                  className="px-2.5 py-0.5 border border-dashed border-border rounded-full text-xs text-text-secondary hover:border-accent hover:text-accent transition-colors"
                                >
                                  + {skill}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>

        {/* Personal Projects */}
        <div className="pt-6 border-t border-border mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Personal Projects</h3>
              <p className="text-xs text-text-muted mt-0.5">Side projects, AI tools, open-source work — skills here count toward your profile.</p>
            </div>
            <button
              type="button"
              onClick={addProject}
              className="flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-dark transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Add project
            </button>
          </div>

          {data.personalProjects.length === 0 && (
            <p className="text-sm text-text-muted">No personal projects added yet.</p>
          )}

          <div className="flex flex-col gap-2">
            {data.personalProjects.map((proj, index) => {
              const isOpen = openProjects.has(proj.id);
              return (
                <div
                  key={proj.id}
                  className="border border-border rounded-xl overflow-hidden"
                >
                  {/* Accordion header */}
                  <div className="flex items-center hover:bg-surface-secondary transition-colors">
                    <button
                      type="button"
                      onClick={() => setOpenProjects((prev) => {
                        const next = new Set(prev);
                        if (next.has(proj.id)) next.delete(proj.id);
                        else next.add(proj.id);
                        return next;
                      })}
                      className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-w-0"
                    >
                      <svg
                        width="16" height="16" viewBox="0 0 16 16" fill="none"
                        stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                        className={`shrink-0 text-text-muted transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                      >
                        <path d="M6 4l4 4-4 4" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {proj.name || `Project ${index + 1}`}
                        </p>
                        {(proj.startDate || proj.currentlyWorking) && (
                          <p className="text-xs text-text-muted">
                            {[
                              proj.startDate ? fmtMonthYear(proj.startDate) : null,
                              proj.currentlyWorking ? "Present" : proj.endDate ? fmtMonthYear(proj.endDate) : null,
                            ].filter(Boolean).join(" – ")}
                          </p>
                        )}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeProject(proj.id)}
                      className="shrink-0 text-xs text-text-muted hover:text-error transition-colors px-4 py-3"
                    >
                      Remove
                    </button>
                  </div>

                  {/* Accordion body */}
                  {isOpen && <div className="px-4 pb-4 flex flex-col gap-4 border-t border-border pt-4">
                    <div>
                      <label className={`${labelClass} flex items-center gap-1.5`}>Project Name <InfoIcon tip="Give the project a short, clear name that describes what it is" /></label>
                      <input
                        type="text"
                        value={proj.name}
                        onChange={(e) => updateProject(proj.id, "name", e.target.value)}
                        placeholder="Job Pilot, AI Resume Builder..."
                        className={inputClass}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={`${labelClass} flex items-center gap-1.5`}>From <InfoIcon tip="Month and year you started this project" /></label>
                        <input
                          type="month"
                          value={proj.startDate}
                          onChange={(e) => updateProject(proj.id, "startDate", e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={`${labelClass} flex items-center gap-1.5`}>To <InfoIcon tip="Month and year you finished — leave blank if still active" /></label>
                        <div className="flex items-center gap-3">
                          <input
                            type="month"
                            value={proj.endDate}
                            disabled={proj.currentlyWorking}
                            onChange={(e) => updateProject(proj.id, "endDate", e.target.value)}
                            className={`flex-1 px-3 py-2 border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent bg-surface transition-colors border-border disabled:bg-surface-secondary disabled:text-text-muted`}
                          />
                          <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0">
                            <input
                              type="checkbox"
                              checked={proj.currentlyWorking}
                              onChange={(e) => {
                                setField(
                                  "personalProjects",
                                  data.personalProjects.map((p) =>
                                    p.id === proj.id ? { ...p, currentlyWorking: e.target.checked } : p,
                                  ),
                                );
                              }}
                              className="w-4 h-4 rounded border-border accent-accent"
                            />
                            <span className="text-xs text-text-secondary">Still active</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className={`${labelClass} flex items-center gap-1.5`}>Description <InfoIcon tip="What did you build? What does it do? What problems did it solve?" /></label>
                      <textarea
                        value={proj.description}
                        onChange={(e) => updateProject(proj.id, "description", e.target.value)}
                        placeholder="What did you build? What does it do? What problems did it solve?"
                        rows={3}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent bg-surface transition-colors resize-y"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className={`${labelClass} flex items-center gap-1.5`}>Live URL (Optional) <InfoIcon tip="Link to the deployed or live version of this project if publicly accessible" /></label>
                        <input
                          type="url"
                          value={proj.url}
                          onChange={(e) => updateProject(proj.id, "url", e.target.value)}
                          placeholder="https://myproject.com"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={`${labelClass} flex items-center gap-1.5`}>GitHub (Optional) <InfoIcon tip="Link to this project's source code repository on GitHub or similar" /></label>
                        <input
                          type="url"
                          value={proj.githubUrl}
                          onChange={(e) => updateProject(proj.id, "githubUrl", e.target.value)}
                          placeholder="https://github.com/you/repo"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={`${labelClass} flex items-center gap-1.5`}>Video (Optional) <InfoIcon tip="Link to a demo, walkthrough, or presentation video of this project" /></label>
                        <input
                          type="url"
                          value={proj.videoUrl}
                          onChange={(e) => updateProject(proj.id, "videoUrl", e.target.value)}
                          placeholder="https://youtube.com/watch?v=..."
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={`${labelClass} flex items-center gap-1.5`}>Skills Used <InfoIcon tip="Add the technologies and tools you used — helps match you to jobs requiring similar work" /></label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={proj.skillInput}
                          onChange={(e) => updateProject(proj.id, "skillInput", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addProjectSkill(proj.id);
                            }
                          }}
                          placeholder="Add a skill used in this project"
                          className={inputClass}
                        />
                        <button
                          type="button"
                          onClick={() => addProjectSkill(proj.id)}
                          className="shrink-0 px-4 py-2 border border-border rounded-lg text-sm font-medium text-text-primary hover:bg-surface-secondary transition-colors"
                        >
                          Add
                        </button>
                      </div>
                      {proj.skills.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {proj.skills.map((skill) => (
                            <span
                              key={skill}
                              className="flex items-center gap-1.5 px-3 py-1 bg-accent/10 border border-accent/30 rounded-full text-xs font-medium text-accent"
                            >
                              {skill}
                              <button
                                type="button"
                                onClick={() => removeProjectSkill(proj.id, skill)}
                                className="text-accent/60 hover:text-accent transition-colors"
                                aria-label={`Remove ${skill}`}
                              >
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      {data.skills.filter((s) => !proj.skills.includes(s)).length > 0 && (
                        <div className="mt-2.5">
                          <p className="text-xs text-text-muted mb-1.5">From your profile:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {data.skills
                              .filter((s) => !proj.skills.includes(s))
                              .map((skill) => (
                                <button
                                  key={skill}
                                  type="button"
                                  onClick={() => addProjectSkillDirect(proj.id, skill)}
                                  className="px-2.5 py-0.5 border border-dashed border-border rounded-full text-xs text-text-secondary hover:border-accent hover:text-accent transition-colors"
                                >
                                  + {skill}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Education */}
        <SectionAccordion title="Education">
          <div className="flex flex-col gap-2">
            {data.educations.length === 0 && (
              <p className="text-sm text-text-muted">No education added yet.</p>
            )}
            {data.educations.map((edu, index) => {
              const isOpen = openEducations.has(edu.id);
              const degreeLabel: Record<string, string> = {
                high_school: "High School", associate: "Associate",
                bachelor: "Bachelor's", master: "Master's", phd: "PhD", other: "Other",
              };
              const heading = edu.degree && edu.institution
                ? `${degreeLabel[edu.degree] ?? edu.degree} — ${edu.institution}`
                : edu.degree ? (degreeLabel[edu.degree] ?? edu.degree)
                : edu.institution || `Education ${index + 1}`;
              return (
                <div key={edu.id} className="border rounded-xl overflow-hidden border-border">
                  <div className="flex items-center hover:bg-surface-secondary transition-colors">
                    <button
                      type="button"
                      onClick={() => setOpenEducations((prev) => {
                        const next = new Set(prev);
                        if (next.has(edu.id)) next.delete(edu.id);
                        else next.add(edu.id);
                        return next;
                      })}
                      className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-w-0"
                    >
                      <svg
                        width="16" height="16" viewBox="0 0 16 16" fill="none"
                        stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                        className={`shrink-0 text-text-muted transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                      >
                        <path d="M6 4l4 4-4 4" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{heading}</p>
                        {edu.year && <p className="text-xs text-text-muted">{edu.year}</p>}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeEducation(edu.id)}
                      className="shrink-0 text-xs text-text-muted hover:text-error transition-colors px-4 py-3"
                    >
                      Remove
                    </button>
                  </div>
                  {isOpen && (
                    <div className="px-4 pb-4 flex flex-col gap-4 border-t border-border pt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div>
                          <label className={`${labelClass} flex items-center gap-1.5`}>Degree <InfoIcon tip="Select the highest degree you earned at this institution" /></label>
                          <div className="relative">
                            <select
                              value={edu.degree}
                              onChange={(e) => updateEducation(edu.id, "degree", e.target.value)}
                              className={selectClass}
                            >
                              <option value="">Select...</option>
                              <option value="high_school">High School</option>
                              <option value="associate">Associate</option>
                              <option value="bachelor">Bachelor&apos;s</option>
                              <option value="master">Master&apos;s</option>
                              <option value="phd">PhD</option>
                              <option value="other">Other</option>
                            </select>
                            <svg
                              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
                              width="14" height="14" viewBox="0 0 14 14" fill="none"
                            >
                              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>
                        <div>
                          <label className={`${labelClass} flex items-center gap-1.5`}>Field of Study <InfoIcon tip="Your major or primary area of study at this institution" /></label>
                          <input
                            type="text"
                            value={edu.field}
                            onChange={(e) => updateEducation(edu.id, "field", e.target.value)}
                            placeholder="Computer Science"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={`${labelClass} flex items-center gap-1.5`}>Institution Name <InfoIcon tip="The full name of the university, college, or school" /></label>
                          <input
                            type="text"
                            value={edu.institution}
                            onChange={(e) => updateEducation(edu.id, "institution", e.target.value)}
                            placeholder="E.g. State University"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={`${labelClass} flex items-center gap-1.5`}>Graduation Year <InfoIcon tip="The year you graduated or are expected to graduate from this programme" /></label>
                          <input
                            type="text"
                            value={edu.year}
                            onChange={(e) => updateEducation(edu.id, "year", e.target.value)}
                            placeholder="YYYY"
                            maxLength={4}
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={addEducation}
              className="mt-1 flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-dark transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Add education
            </button>
          </div>
        </SectionAccordion>

        {/* Job Preferences */}
        <SectionAccordion title="Job Preferences">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="xl:col-span-2">
              <label className={`${labelClass} flex items-center gap-1.5`}>Job Titles Seeking <InfoIcon tip="Enter the job titles you are actively applying for, separated by commas — used to filter and rank job matches" /></label>
              <input
                type="text"
                value={data.jobTitlesSeeking}
                onChange={(e) => setField("jobTitlesSeeking", e.target.value)}
                placeholder="Frontend Engineer, React Developer"
                className={inputClass}
              />
            </div>
            <div>
              <label className={`${labelClass} flex items-center gap-1.5`}>Remote Preference <InfoIcon tip="Whether you want to work on-site, hybrid, or fully remote" /></label>
              <div className="relative">
                <select
                  value={data.remotePreference}
                  onChange={(e) => setField("remotePreference", e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select...</option>
                  <option value="remote">Remote</option>
                  <option value="onsite">On-site</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="any">Any</option>
                </select>
                <svg
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                >
                  <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <div>
              <label className={`${labelClass} flex items-center gap-1.5`}>Salary Expectation (Optional) <InfoIcon tip="Your target annual salary — used to filter job listings by compensation range" /></label>
              <input
                type="text"
                value={data.salaryExpectation}
                onChange={(e) => setField("salaryExpectation", e.target.value)}
                placeholder="E.g. $120k+"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={`${labelClass} flex items-center gap-1.5`}>Preferred Locations (Optional) <InfoIcon tip="Cities or regions where you want to work, separated by commas" /></label>
            <input
              type="text"
              value={data.preferredLocations}
              onChange={(e) => setField("preferredLocations", e.target.value)}
              placeholder="E.g. New York, London"
              className={inputClass}
            />
          </div>
        </div>
        </SectionAccordion>

        {/* What Drives You */}
        <SectionAccordion title="What Drives You">
          <div className="flex flex-col gap-5">
            <p className="text-xs text-text-secondary -mt-1">
              These fields help generate more personal cover letters and find better job matches. All optional.
            </p>

            <div>
              <label className={`${labelClass} flex items-center gap-1.5`}>Motivation <InfoIcon tip="What motivates you in your work? What kind of impact do you want to create?" /></label>
              <textarea
                value={data.motivation}
                onChange={(e) => setField("motivation", e.target.value)}
                placeholder="What motivates you in your work? What kind of impact do you want to create?"
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent bg-surface transition-colors resize-y"
              />
            </div>

            <div>
              <label className={`${labelClass} flex items-center gap-1.5`}>Key Achievement <InfoIcon tip="Describe a result or achievement you're proud of — what was the situation, what did you do, and what happened?" /></label>
              <textarea
                value={data.proudAchievement}
                onChange={(e) => setField("proudAchievement", e.target.value)}
                placeholder="Describe a result or achievement you're proud of — what was the situation, what did you do, and what happened?"
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent bg-surface transition-colors resize-y"
              />
            </div>

            <div>
              <label className={`${labelClass} flex items-center gap-1.5`}>What Gives You Energy <InfoIcon tip="What kinds of tasks, problems, or situations energize you most at work?" /></label>
              <textarea
                value={data.energyTasks}
                onChange={(e) => setField("energyTasks", e.target.value)}
                placeholder="What kinds of tasks, problems, or situations energize you most at work?"
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent bg-surface transition-colors resize-y"
              />
            </div>

            <div>
              <label className={`${labelClass} flex items-center gap-1.5`}>Preferred Company Type <InfoIcon tip="Used to find jobs and personalize cover letters toward the kinds of companies you want to work at" /></label>
              <div className="flex flex-wrap gap-2 mt-1">
                {(["Startup", "Scale-up", "Established corporation", "Agency / consultancy", "Public sector", "Non-profit"] as const).map((type) => {
                  const selected = data.companyTypePreference.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        setField(
                          "companyTypePreference",
                          selected
                            ? data.companyTypePreference.filter((t) => t !== type)
                            : [...data.companyTypePreference, type],
                        )
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        selected
                          ? "bg-accent/10 border-accent/40 text-accent"
                          : "bg-surface-secondary border-border text-text-secondary hover:border-accent/40 hover:text-text-primary"
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className={`${labelClass} flex items-center gap-1.5`}>Career Vision <InfoIcon tip="Where do you want to be professionally in 2-3 years? What are you growing toward?" /></label>
              <textarea
                value={data.careerVision}
                onChange={(e) => setField("careerVision", e.target.value)}
                placeholder="Where do you want to be professionally in 2-3 years? What are you growing toward?"
                rows={2}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent bg-surface transition-colors resize-y"
              />
            </div>
          </div>
        </SectionAccordion>

        {/* Cover Letter Instructions */}
        <SectionAccordion title="Cover Letter Instructions">
          <div className="flex flex-col gap-3">
            <div>
              <label className={`${labelClass} flex items-center gap-1.5`}>Cover Letter Tone <InfoIcon tip="Sets the overall writing style — formal keeps it professional, casual is relaxed, enthusiastic shows excitement, confident is assertive" /></label>
              <div className="relative inline-block">
                <select
                  value={data.coverLetterTone}
                  onChange={(e) => setField("coverLetterTone", e.target.value)}
                  className={selectClass.replace("w-full", "w-auto pr-8")}
                >
                  <option value="">Select...</option>
                  <option value="formal">Formal</option>
                  <option value="casual">Casual</option>
                  <option value="enthusiastic">Enthusiastic</option>
                  <option value="confident">Confident</option>
                </select>
                <svg
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                >
                  <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <div>
            <div className="flex items-end justify-between gap-3 mb-1.5">
              <label htmlFor="cl-instructions-textarea" className={`${labelClass} flex items-center gap-1.5 mb-0`}>
                Instructions
                <InfoIcon tip="Paste a Markdown instruction set that guides cover letter generation — voice rules, projects, career facts, structural preferences. The agent uses this instead of its defaults." />
              </label>
              <div className="flex items-center gap-2 shrink-0">
                <label
                  htmlFor="cl-instructions-upload"
                  className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-text-primary hover:bg-surface-secondary transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M6.5 1v7M3.5 4l3-3 3 3M1.5 10v1a1 1 0 001 1h9a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Upload Markdown
                </label>
                <input
                  id="cl-instructions-upload"
                  type="file"
                  accept=".md,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setField("coverLetterInstructions", (ev.target?.result as string) ?? "");
                    };
                    reader.readAsText(file);
                  }}
                />
              </div>
            </div>
            <textarea
              id="cl-instructions-textarea"

              value={data.coverLetterInstructions}
              onChange={(e) => setField("coverLetterInstructions", e.target.value)}
              placeholder="# Cover Letter Instructions&#10;&#10;Paste your instruction set here, or load a .md file above..."
              rows={12}
              className="w-full px-3 py-2 border border-border rounded-lg text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent bg-surface transition-colors resize-y"
            />
            </div>
          </div>
        </SectionAccordion>

        {/* Sticky save footer */}
        {(hasUnsavedChanges || saving || Object.keys(roleErrors).length > 0) && (
        <div className="sticky bottom-0 bg-surface border-t border-border px-6 py-4 -mx-6 mt-6 flex flex-col gap-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
          {hasUnsavedChanges && !saveSuccess && (() => {
            const fields = computeChangedFields(data, savedSnapshot);
            return (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-text-muted shrink-0">Unsaved:</span>
                {fields.map((f) => (
                  <span key={f} className="px-2 py-0.5 bg-warning/10 text-warning rounded-full text-xs font-medium">
                    {f}
                  </span>
                ))}
              </div>
            );
          })()}
          {Object.keys(roleErrors).length > 0 && (() => {
            const FIELD_LABELS: Record<string, string> = {
              company: "Company Name",
              title: "Job Title",
              startDate: "Start Date",
              endDate: "End Date",
            };
            const items: { roleIndex: number; field: string }[] = [];
            data.workExperience.forEach((role, idx) => {
              roleErrors[role.id]?.forEach((field) => {
                items.push({ roleIndex: idx + 1, field });
              });
            });
            return (
              <div className="rounded-xl border border-error/30 bg-error/5 px-4 py-3 flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-error">Missing required fields</p>
                <ul className="flex flex-col gap-1">
                  {items.map(({ roleIndex, field }, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-error">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
                        <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                        <path d="M6 3.5v3M6 8h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                      Role {roleIndex} — {FIELD_LABELS[field] ?? field}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}


          <div className="flex gap-3">
            {hasUnsavedChanges && !saving && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-5 py-2.5 border border-border rounded-lg text-sm font-medium text-text-primary hover:bg-surface-secondary transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="ml-auto px-5 py-2.5 flex items-center gap-2 bg-accent text-accent-foreground text-sm font-medium rounded-lg hover:bg-accent-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving && (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {saving ? "Saving…" : "Save Profile"}
            </button>
          </div>
        </div>
        )}
      </form>

      {cropImageSrc && (
        <AvatarCropModal
          imageSrc={cropImageSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
