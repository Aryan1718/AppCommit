import { Link } from 'react-router-dom';

const formatDate = (value) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));

function ApplicationCard({ application }) {
  return (
    <Link
      to={`/applications/${application.id}`}
      className="block rounded-[1.6rem] border border-zinc-800 bg-zinc-900 p-5 transition hover:-translate-y-0.5 hover:border-zinc-600"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-white">{application.company}</p>
          <p className="mt-1 text-sm text-zinc-300">{application.jobTitle}</p>
        </div>
        <p className="text-sm text-zinc-500">{formatDate(application.appliedAt)}</p>
      </div>

      <div className="my-4 h-px bg-zinc-800" />

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-400">
        <span className="inline-flex items-center gap-2 font-mono text-zinc-200">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-indigo-300" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M7 3.75h7l5 5V20.25A1.75 1.75 0 0 1 17.25 22h-10.5A1.75 1.75 0 0 1 5 20.25V5.5A1.75 1.75 0 0 1 6.75 3.75H7Z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 3.75v5h5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {application.resumeFilename || 'resume_not_detected'}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="text-emerald-300">#</span>
          {application.portal}
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-indigo-300">View Snapshot</span>
        <span className="inline-flex items-center gap-2 text-zinc-500">
          <span className="h-2 w-2 rounded-full bg-zinc-500" />
          {application.status}
        </span>
      </div>
    </Link>
  );
}

export default ApplicationCard;
