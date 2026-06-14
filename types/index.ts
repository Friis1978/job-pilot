export type WorkExperience = {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  currentlyWorking: boolean;
  responsibilities: string;
  skills?: string[];
};

export type Education = {
  degree: string;
  field: string;
  institution: string;
  year: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  current_title: string | null;
  experience_level: string | null;
  years_experience: number | null;
  skills: string[] | null;
  industries: string[] | null;
  work_experience: WorkExperience[] | null;
  education: Education | null;
  job_titles_seeking: string[] | null;
  remote_preference: string | null;
  preferred_locations: string[] | null;
  salary_expectation: string | null;
  cover_letter_tone: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  resume_pdf_url: string | null;
  avatar_url: string | null;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
};

export type JobRow = {
  id: string;
  company: string;
  title: string;
  location: string | null;
  match_score: number;
  salary: string | null;
  found_at: string;
  matched_skills: string[] | null;
  status: string;
  source: string;
};

export type AdzunaJob = {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  description: string;
  redirect_url: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted: "0" | "1";
  contract_type?: string;
  created: string;
  category: { tag: string; label: string };
};

export type ScoredJob = {
  matchScore: number;
  matchReason: string;
  matchedSkills: string[];
  missingSkills: string[];
};

export type NormalizedJob = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  description: string;
  url: string;
  salary?: string | null;
  job_type?: string | null;
  source: "adzuna" | "jobtech" | "jooble" | "careerjet" | "glassdoor" | "url";
};

export type ProfileFormInput = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  portfolioUrl: string;
  currentTitle: string;
  experienceLevel: string;
  skills: string[];
  industries: string[];
  workExperience: {
    id: string;
    company: string;
    title: string;
    startDate: string;
    endDate: string;
    currentlyWorking: boolean;
    responsibilities: string;
    skills?: string[];
  }[];
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
