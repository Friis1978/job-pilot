"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { saveProfile, updateAvatarUrl } from "@/actions/profile";
import { insforge } from "@/lib/insforge-client";
import { AvatarCropModal } from "@/components/profile/AvatarCropModal";
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

type FormData = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  portfolioUrl: string;
  workAuthorization: string;
  currentTitle: string;
  experienceLevel: string;
  yearsExperience: string;
  skills: string[];
  skillInput: string;
  industries: string[];
  industryInput: string;
  workExperience: WorkExperienceEntry[];
  highestDegree: string;
  fieldOfStudy: string;
  institution: string;
  graduationYear: string;
  jobTitlesSeeking: string;
  remotePreference: string;
  salaryExpectation: string;
  preferredLocations: string;
  coverLetterTone: string;
};

const labelClass =
  "block text-xs font-medium uppercase tracking-wide text-text-secondary mb-1.5";

const inputClass =
  "w-full px-3 py-2 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent bg-surface transition-colors";

const selectClass =
  "w-full px-3 py-2 border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent bg-surface transition-colors appearance-none";

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="pt-6 border-t border-border">
      <h3 className="text-sm font-semibold text-text-primary mb-4">{title}</h3>
    </div>
  );
}

type Props = {
  initialData?: Profile | null;
  extractedFormData?: Partial<ProfileFormInput> | null;
  userId?: string | null;
};

function profileToFormData(p: Profile | null | undefined): FormData {
  if (!p) {
    return {
      fullName: "", email: "", phone: "", location: "",
      linkedinUrl: "", portfolioUrl: "", workAuthorization: "",
      currentTitle: "", experienceLevel: "", yearsExperience: "",
      skills: [], skillInput: "", industries: [], industryInput: "",
      workExperience: [], highestDegree: "", fieldOfStudy: "",
      institution: "", graduationYear: "", jobTitlesSeeking: "",
      remotePreference: "", salaryExpectation: "", preferredLocations: "",
      coverLetterTone: "",
    };
  }
  const edu = p.education as { degree?: string; field?: string; institution?: string; year?: string } | null;
  return {
    fullName: p.full_name ?? "",
    email: p.email ?? "",
    phone: p.phone ?? "",
    location: p.location ?? "",
    linkedinUrl: p.linkedin_url ?? "",
    portfolioUrl: p.portfolio_url ?? "",
    workAuthorization: p.work_authorization ?? "",
    currentTitle: p.current_title ?? "",
    experienceLevel: p.experience_level ?? "",
    yearsExperience: p.years_experience?.toString() ?? "",
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
    highestDegree: edu?.degree ?? "",
    fieldOfStudy: edu?.field ?? "",
    institution: edu?.institution ?? "",
    graduationYear: edu?.year ?? "",
    jobTitlesSeeking: (p.job_titles_seeking ?? []).join(", "),
    remotePreference: p.remote_preference ?? "",
    salaryExpectation: p.salary_expectation ?? "",
    preferredLocations: (p.preferred_locations ?? []).join(", "),
    coverLetterTone: p.cover_letter_tone ?? "",
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
    yearsExperience: extracted.yearsExperience || base.yearsExperience,
    skills: extracted.skills?.length ? extracted.skills : base.skills,
    industries: extracted.industries?.length ? extracted.industries : base.industries,
    workExperience: extracted.workExperience?.length
      ? extracted.workExperience.map((r) => ({ ...r, id: crypto.randomUUID(), skills: r.skills ?? [], skillInput: "" }))
      : base.workExperience,
    highestDegree: extracted.highestDegree || base.highestDegree,
    fieldOfStudy: extracted.fieldOfStudy || base.fieldOfStudy,
    institution: extracted.institution || base.institution,
    graduationYear: extracted.graduationYear || base.graduationYear,
  };
}

export function ProfileForm({ initialData, extractedFormData, userId }: Props) {
  const [data, setData] = useState<FormData>(() => {
    const base = profileToFormData(initialData);
    return extractedFormData ? mergeExtracted(base, extractedFormData) : base;
  });
  const [hasUnreviewedExtraction, setHasUnreviewedExtraction] = useState(
    () => extractedFormData != null,
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialData?.avatar_url ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const workExperienceEndRef = useRef<HTMLDivElement>(null);
  const [shouldScrollToRole, setShouldScrollToRole] = useState(false);
  const [roleErrors, setRoleErrors] = useState<Record<string, Set<string>>>({});
  const firstErrorRoleRef = useRef<HTMLDivElement>(null);

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
    if (trimmed && !data.skills.includes(trimmed)) {
      setData((prev) => ({ ...prev, skills: [...prev.skills, trimmed], skillInput: "" }));
    }
  }

  function removeSkill(skill: string) {
    setField("skills", data.skills.filter((s) => s !== skill));
  }

  function addIndustry() {
    const trimmed = data.industryInput.trim();
    if (trimmed && !data.industries.includes(trimmed)) {
      setData((prev) => ({
        ...prev,
        industries: [...prev.industries, trimmed],
        industryInput: "",
      }));
    }
  }

  function removeIndustry(industry: string) {
    setField("industries", data.industries.filter((i) => i !== industry));
  }

  function addRole() {
    setData((prev) => ({
      ...prev,
      workExperience: [
        ...prev.workExperience,
        {
          id: crypto.randomUUID(),
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
    setShouldScrollToRole(true);
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
  }

  function updateRole(id: string, field: keyof WorkExperienceEntry, value: string | boolean) {
    setField(
      "workExperience",
      data.workExperience.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
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
      const { data: uploaded, error } = await insforge.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
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

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-[0px_1px_3px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]">
      <h2 className="text-base font-semibold text-text-primary">Profile Information</h2>
      <p className="text-sm text-text-secondary mt-1">
        This section is used to accurately represent you in agent interactions.
      </p>

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
            // Scroll to first invalid role on next paint
            requestAnimationFrame(() => {
              firstErrorRoleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
            return;
          }

          setRoleErrors({});
          setSaving(true);
          setSaveError(null);
          setSaveSuccess(false);
          const result = await saveProfile({
            ...data,
            workExperience: data.workExperience.map(
              ({ skillInput: _si, ...r }) => r,
            ),
          });
          setSaving(false);
          if (result.success) {
            setSaveSuccess(true);
            setHasUnreviewedExtraction(false);
          } else {
            setSaveError(result.error ?? "Something went wrong. Please try again.");
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Full Name</label>
              <input
                type="text"
                value={data.fullName}
                onChange={(e) => setField("fullName", e.target.value)}
                placeholder="Your full name"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={data.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Phone Number</label>
              <input
                type="tel"
                value={data.phone}
                onChange={(e) => setField("phone", e.target.value)}
                placeholder="(123) 456-7890"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Location</label>
              <input
                type="text"
                value={data.location}
                onChange={(e) => setField("location", e.target.value)}
                placeholder="City, Country"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>LinkedIn URL</label>
              <input
                type="url"
                value={data.linkedinUrl}
                onChange={(e) => setField("linkedinUrl", e.target.value)}
                placeholder="https://linkedin.com/in/you"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Portfolio / GitHub</label>
              <input
                type="url"
                value={data.portfolioUrl}
                onChange={(e) => setField("portfolioUrl", e.target.value)}
                placeholder="https://github.com/you"
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2 sm:max-w-xs">
              <label className={labelClass}>Work Authorization</label>
              <div className="relative">
                <select
                  value={data.workAuthorization}
                  onChange={(e) => setField("workAuthorization", e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select...</option>
                  <option value="citizen">Citizen</option>
                  <option value="permanent_resident">Permanent Resident</option>
                  <option value="visa_required">Visa Required</option>
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
        </div>

        {/* Professional Info */}
        <SectionDivider title="Professional Info" />
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelClass}>Current / Recent Job Title</label>
            <input
              type="text"
              value={data.currentTitle}
              onChange={(e) => setField("currentTitle", e.target.value)}
              placeholder="Frontend Engineer"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Experience Level</label>
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
            <div>
              <label className={labelClass}>Years of Experience</label>
              <input
                type="number"
                min="0"
                max="50"
                value={data.yearsExperience}
                onChange={(e) => setField("yearsExperience", e.target.value)}
                placeholder="4"
                className={inputClass}
              />
            </div>
          </div>

          {/* Skills */}
          <div>
            <label className={labelClass}>Skills</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={data.skillInput}
                onChange={(e) => setField("skillInput", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                placeholder="Add a skill"
                className={inputClass}
              />
              <button
                type="button"
                onClick={addSkill}
                className="shrink-0 px-4 py-2 border border-border rounded-lg text-sm font-medium text-text-primary hover:bg-surface-secondary transition-colors"
              >
                Add
              </button>
            </div>
            {data.skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {data.skills.map((skill) => (
                  <span
                    key={skill}
                    className="flex items-center gap-1.5 px-3 py-1 bg-surface-secondary border border-border rounded-full text-xs font-medium text-text-primary"
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
                ))}
              </div>
            )}
          </div>

          {/* Industries */}
          <div>
            <label className={labelClass}>Industries (Optional)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={data.industryInput}
                onChange={(e) => setField("industryInput", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addIndustry();
                  }
                }}
                placeholder="E.g. Fintech, Healthcare"
                className={inputClass}
              />
              <button
                type="button"
                onClick={addIndustry}
                className="shrink-0 px-4 py-2 border border-border rounded-lg text-sm font-medium text-text-primary hover:bg-surface-secondary transition-colors"
              >
                Add
              </button>
            </div>
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

          <div className="flex flex-col gap-4">
            {data.workExperience.map((role, index) => {
              const errs = roleErrors[role.id];
              const isFirstError = errs && Object.keys(roleErrors)[0] === role.id;
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
                className={`border rounded-xl p-4 flex flex-col gap-4 ${errs ? "border-error" : "border-border"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
                    Role {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRole(role.id)}
                    className="text-xs text-text-muted hover:text-error transition-colors"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Company Name <span className="text-error">*</span></label>
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
                    <label className={labelClass}>Job Title <span className="text-error">*</span></label>
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
                    <label className={labelClass}>Start Date <span className="text-error">*</span></label>
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
                    <label className={labelClass}>End Date {!role.currentlyWorking && <span className="text-error">*</span>}</label>
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
                  <label className={labelClass}>Key Responsibilities</label>
                  <textarea
                    value={role.responsibilities}
                    onChange={(e) => updateRole(role.id, "responsibilities", e.target.value)}
                    placeholder="Describe your key contributions and responsibilities..."
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent bg-surface transition-colors resize-none"
                  />
                </div>

                <div>
                  <label className={labelClass}>Skills Used</label>
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
              );
            })}
          </div>
        </div>

        {/* Education */}
        <SectionDivider title="Education" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Highest Degree</label>
            <div className="relative">
              <select
                value={data.highestDegree}
                onChange={(e) => setField("highestDegree", e.target.value)}
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
            <label className={labelClass}>Field of Study</label>
            <input
              type="text"
              value={data.fieldOfStudy}
              onChange={(e) => setField("fieldOfStudy", e.target.value)}
              placeholder="Computer Science"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Institution Name</label>
            <input
              type="text"
              value={data.institution}
              onChange={(e) => setField("institution", e.target.value)}
              placeholder="E.g. State University"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Graduation Year</label>
            <input
              type="text"
              value={data.graduationYear}
              onChange={(e) => setField("graduationYear", e.target.value)}
              placeholder="YYYY"
              maxLength={4}
              className={inputClass}
            />
          </div>
        </div>

        {/* Job Preferences */}
        <SectionDivider title="Job Preferences" />
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelClass}>Job Titles Seeking</label>
            <input
              type="text"
              value={data.jobTitlesSeeking}
              onChange={(e) => setField("jobTitlesSeeking", e.target.value)}
              placeholder="Frontend Engineer, React Developer"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Remote Preference</label>
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
              <label className={labelClass}>Salary Expectation (Optional)</label>
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
            <label className={labelClass}>Preferred Locations (Optional)</label>
            <input
              type="text"
              value={data.preferredLocations}
              onChange={(e) => setField("preferredLocations", e.target.value)}
              placeholder="E.g. New York, London"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Cover Letter Tone</label>
            <div className="relative sm:max-w-xs">
              <select
                value={data.coverLetterTone}
                onChange={(e) => setField("coverLetterTone", e.target.value)}
                className={selectClass}
              >
                <option value="">Select...</option>
                <option value="formal">Formal</option>
                <option value="casual">Casual</option>
                <option value="enthusiastic">Enthusiastic</option>
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
            <div className="mt-6 rounded-xl border border-error/30 bg-error/5 px-4 py-3 flex flex-col gap-2">
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

        {saveError && (
          <p className="mt-4 text-sm text-error text-center">{saveError}</p>
        )}
        {saveSuccess && (
          <p className="mt-4 text-sm text-success text-center">Profile saved successfully.</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="mt-4 w-full py-3 flex items-center justify-center gap-2 bg-accent text-accent-foreground text-sm font-medium rounded-lg hover:bg-accent-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving && (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          )}
          {saving ? "Saving…" : "Save Profile"}
        </button>
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
