import { ResumeUpload } from 'job_pilot';

export function NoResume() {
  return (
    <ResumeUpload
      initialResumeUrl={null}
      userId="user-preview-123"
    />
  );
}

export function WithResume() {
  return (
    <ResumeUpload
      initialResumeUrl="https://example.com/resume.pdf"
      userId="user-preview-123"
    />
  );
}

export function Embedded() {
  return (
    <ResumeUpload
      initialResumeUrl="https://example.com/resume.pdf"
      userId="user-preview-123"
      embedded={true}
    />
  );
}
