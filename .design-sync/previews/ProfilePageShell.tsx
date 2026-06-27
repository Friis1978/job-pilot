import { ProfilePageShell } from 'job_pilot';

export function NewUser() {
  return (
    <ProfilePageShell
      profile={null}
      initialResumeUrl={null}
      userId="user-preview-123"
    />
  );
}

export function ExistingUser() {
  return (
    <ProfilePageShell
      profile={{
        id: 'profile-preview-1',
        full_name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+45 20 12 34 56',
        location: 'Copenhagen, Denmark',
        linkedin_url: 'https://linkedin.com/in/janedoe',
        portfolio_url: null,
        current_title: 'Senior Frontend Developer',
        experience_level: 'Senior',
        years_experience: 5,
        skills: ['React', 'TypeScript', 'Next.js'],
        industries: ['Tech'],
        spoken_languages: [{ language: 'English', level: 'Fluent' }],
        work_experience: [{
          company: 'Acme Corp', title: 'Frontend Developer',
          startDate: '2021-01', endDate: '', currentlyWorking: true,
          responsibilities: 'Built the main product dashboard.', skills: ['React'],
        }],
        education: [{ degree: 'Bachelor', field: 'CS', institution: 'DTU', year: '2020' }],
        personal_projects: [],
        job_titles_seeking: ['Frontend Developer'],
        remote_preference: null, preferred_locations: null, salary_expectation: null,
        cover_letter_tone: null, cover_letter_instructions: null,
        personal_interests: null, motivation: null, proud_achievement: null,
        energy_tasks: null, company_type_preference: null, career_vision: null,
        avatar_url: null, resume_pdf_url: 'https://example.com/resume.pdf',
        is_complete: false, approval_status: 'approved', is_admin: false,
        welcomed_at: null, onboarding_seen: true,
        created_at: '2024-01-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z',
      }}
      initialResumeUrl="https://example.com/resume.pdf"
      userId="user-preview-123"
    />
  );
}
