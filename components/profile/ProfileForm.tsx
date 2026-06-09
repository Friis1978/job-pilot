"use client";

import { useState } from "react";

type WorkExperienceEntry = {
  id: string;
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  currentlyWorking: boolean;
  responsibilities: string;
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

export function ProfileForm() {
  const [data, setData] = useState<FormData>({
    fullName: "",
    email: "",
    phone: "",
    location: "",
    linkedinUrl: "",
    portfolioUrl: "",
    workAuthorization: "",
    currentTitle: "",
    experienceLevel: "",
    yearsExperience: "",
    skills: [],
    skillInput: "",
    industries: [],
    industryInput: "",
    workExperience: [],
    highestDegree: "",
    fieldOfStudy: "",
    institution: "",
    graduationYear: "",
    jobTitlesSeeking: "",
    remotePreference: "",
    salaryExpectation: "",
    preferredLocations: "",
    coverLetterTone: "",
  });

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
    setField("workExperience", [
      ...data.workExperience,
      {
        id: crypto.randomUUID(),
        company: "",
        title: "",
        startDate: "",
        endDate: "",
        currentlyWorking: false,
        responsibilities: "",
      },
    ]);
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

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-[0px_1px_3px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]">
      <h2 className="text-base font-semibold text-text-primary">Profile Information</h2>
      <p className="text-sm text-text-secondary mt-1">
        This section is used to accurately represent you in agent interactions.
      </p>

      <form
        onSubmit={(e) => e.preventDefault()}
        className="mt-6 flex flex-col gap-0"
      >
        {/* Personal Info */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-4">Personal Info</h3>
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
            {data.workExperience.map((role, index) => (
              <div
                key={role.id}
                className="border border-border rounded-xl p-4 flex flex-col gap-4"
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
                    <label className={labelClass}>Company Name</label>
                    <input
                      type="text"
                      value={role.company}
                      onChange={(e) => updateRole(role.id, "company", e.target.value)}
                      placeholder="Acme Inc."
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Job Title</label>
                    <input
                      type="text"
                      value={role.title}
                      onChange={(e) => updateRole(role.id, "title", e.target.value)}
                      placeholder="Frontend Engineer"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Start Date</label>
                    <input
                      type="month"
                      value={role.startDate}
                      onChange={(e) => updateRole(role.id, "startDate", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>End Date</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="month"
                        value={role.endDate}
                        disabled={role.currentlyWorking}
                        onChange={(e) => updateRole(role.id, "endDate", e.target.value)}
                        className={`flex-1 px-3 py-2 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent bg-surface transition-colors disabled:bg-surface-secondary disabled:text-text-muted`}
                      />
                      <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0">
                        <input
                          type="checkbox"
                          checked={role.currentlyWorking}
                          onChange={(e) => updateRole(role.id, "currentlyWorking", e.target.checked)}
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
              </div>
            ))}
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

        <button
          type="submit"
          className="mt-8 w-full py-3 bg-accent text-accent-foreground text-sm font-medium rounded-lg hover:bg-accent-dark transition-colors"
        >
          Save Profile
        </button>
      </form>
    </div>
  );
}
