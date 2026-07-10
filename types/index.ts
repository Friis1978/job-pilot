export type SpokenLanguage = {
  language: string;
  level: string;
};

export type PersonalProject = {
  name: string;
  description: string;
  url?: string;
  githubUrl?: string;
  videoUrl?: string;
  images?: [string?, string?, string?];
  skills: string[];
  startDate?: string;
  endDate?: string;
  currentlyWorking?: boolean;
};

export type WorkExperience = {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  currentlyWorking: boolean;
  responsibilities: string;
  skills?: string[];
  reference?: {
    name: string;
    title: string;
    phone: string;
    linkedinUrl: string;
  } | null;
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
  education: Education[] | null;
  job_titles_seeking: string[] | null;
  remote_preference: string | null;
  preferred_locations: string[] | null;
  salary_expectation: string | null;
  cover_letter_tone: string | null;
  cover_letter_instructions: string | null;
  cover_letter_examples: string[] | null;
  personal_projects: PersonalProject[] | null;
  personal_interests: string | null;
  motivation: string | null;
  proud_achievement: string | null;
  energy_tasks: string | null;
  company_type_preference: string[] | null;
  career_vision: string | null;
  spoken_languages: SpokenLanguage[] | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  website_url: string | null;
  resume_pdf_url: string | null;
  avatar_url: string | null;
  is_complete: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
  is_admin: boolean;
  welcomed_at: string | null;
  onboarding_seen: boolean;
  created_at: string;
  updated_at: string;
};

export type JobRow = {
  id: string;
  company: string;
  title: string;
  location: string | null;
  match_score: number;
  found_at: string;
  researched_at: string | null;
  matched_skills: string[] | null;
  status: string;
  source: string;
  updated_at: string | null;
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
  experienceScore: number;
  seniorityScore: number;
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
  websiteUrl: string;
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
  educations: Education[];
  jobTitlesSeeking: string;
  remotePreference: string;
  salaryExpectation: string;
  preferredLocations: string;
  coverLetterTone: string;
  coverLetterInstructions: string;
  coverLetterExamples: string[];
  personalProjects: { name: string; description: string; url: string; githubUrl: string; videoUrl: string; images: [string, string, string]; skills: string[]; startDate: string; endDate: string; currentlyWorking: boolean }[];
  personalInterests: string;
  motivation: string;
  proudAchievement: string;
  energyTasks: string;
  companyTypePreference: string[];
  careerVision: string;
  spokenLanguages: { language: string; level: string }[];
};

export type Connection = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  linkedin_url: string | null;
  email: string | null;
  company: string;
  position: string;
  connected_on: string | null;
  is_favorite: boolean;
  notes: string | null;
  imported_at: string;
  created_at: string;
};

export type NetworkImport = {
  id: string;
  user_id: string;
  imported_at: string;
  connection_count: number;
  file_name: string | null;
};

export type LinkedInRecommendation = {
  id: string;
  user_id: string;
  recommender_name: string;
  recommender_title: string;
  recommender_linkedin_url: string | null;
  avatar_url: string | null;
  work_experience_company: string | null;
  recommendation_text: string;
  recommendation_date: string;
  created_at: string;
};
