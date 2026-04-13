import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';

const formatDate = (value) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));

function ApplicationCard({ application }) {
  return (
    <article className="rounded-[1.4rem] border border-[color:var(--app-line)] bg-[rgba(255,255,255,0.76)] p-3 sm:p-4 shadow-[0_18px_50px_rgba(18,18,18,0.05)] transition hover:border-[color:var(--app-accent)]/35 hover:bg-[rgba(255,255,255,0.84)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid flex-1 gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] xl:items-center">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.28em] text-stone-400">{application.portal}</p>
            <p className="mt-2 truncate font-serif text-xl sm:text-2xl text-stone-950">{application.jobTitle}</p>
            <p className="mt-1 truncate text-sm font-medium text-stone-600">{application.company}</p>
          </div>

          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.24em] text-stone-400">Resume</p>
            <p className="mt-2 truncate text-sm font-medium text-stone-800">
              {application.resumeFilename || 'No resume detected'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 xl:justify-start">
            <StatusBadge status={application.status} />
            <p className="rounded-full border border-[color:var(--app-line)] bg-[rgba(255,255,255,0.72)] px-3 py-1 text-xs uppercase tracking-[0.2em] text-stone-500">
              {formatDate(application.appliedAt)}
            </p>
          </div>

          <div className="xl:justify-self-end">
            <Link
              to={`/applications/${application.id}`}
              className="inline-flex w-full whitespace-nowrap rounded-none border border-[color:var(--app-accent)]/24 bg-[color:var(--app-accent)]/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--app-accent)] transition hover:border-[color:var(--app-accent)]/40 hover:bg-[color:var(--app-accent)]/16 sm:w-auto"
            >
              View
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export default ApplicationCard;
