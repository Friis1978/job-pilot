import { Tooltip } from 'job_pilot';

export function Default() {
  return (
    <div style={{ padding: '40px 24px' }}>
      <Tooltip content="This score reflects how well your profile matches the job requirements">
        <span className="text-sm font-medium text-accent underline decoration-dotted cursor-help">
          Match Score: 87%
        </span>
      </Tooltip>
    </div>
  );
}

export function LongContent() {
  return (
    <div style={{ padding: '40px 24px' }}>
      <Tooltip content="Upload your resume as a PDF to enable AI-powered extraction of your skills, experience, and education into the form fields below.">
        <button className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <span>What does this do?</span>
          <span className="w-4 h-4 rounded-full bg-surface-secondary text-xs flex items-center justify-center font-bold">?</span>
        </button>
      </Tooltip>
    </div>
  );
}
