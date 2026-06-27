import { ProfileForm } from 'job_pilot';

export function EmptyForm() {
  return (
    <ProfileForm
      initialData={null}
      extractedFormData={null}
      userId="user-preview-123"
    />
  );
}

export function WithProfile() {
  return (
    <ProfileForm
      initialData={{
        id: 'profile-preview-1',
        full_name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+45 20 12 34 56',
        location: 'Copenhagen, Denmark',
        linkedin_url: 'https://linkedin.com/in/janedoe',
        portfolio_url: 'https://janedoe.dev',
        current_title: 'Senior Frontend Developer',
        experience_level: 'Senior',
        years_experience: 5,
        skills: ['React', 'TypeScript', 'Node.js', 'Tailwind CSS', 'Next.js'],
        industries: ['Tech', 'SaaS'],
        spoken_languages: [{ language: 'English', level: 'Fluent' }, { language: 'Danish', level: 'Native' }],
        work_experience: [
          {
            company: 'Acme Corp',
            title: 'Frontend Developer',
            startDate: '2021-01',
            endDate: '',
            currentlyWorking: true,
            responsibilities: 'Built and maintained the main product dashboard using React and TypeScript.',
            skills: ['React', 'TypeScript'],
          }
        ],
        education: [
          {
            degree: 'Bachelor',
            field: 'Computer Science',
            institution: 'Technical University of Denmark',
            year: '2020',
          }
        ],
        personal_projects: [],
        job_titles_seeking: ['Frontend Developer', 'Full-Stack Developer'],
        remote_preference: null,
        preferred_locations: null,
        salary_expectation: null,
        cover_letter_tone: null,
        cover_letter_instructions: null,
        personal_interests: null,
        motivation: null,
        proud_achievement: null,
        energy_tasks: null,
        company_type_preference: null,
        career_vision: null,
        avatar_url: null,
        resume_pdf_url: null,
        is_complete: false,
        approval_status: 'approved',
        is_admin: false,
        welcomed_at: null,
        onboarding_seen: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-06-01T00:00:00Z',
      }}
      extractedFormData={null}
      userId="user-preview-123"
    />
  );
}
