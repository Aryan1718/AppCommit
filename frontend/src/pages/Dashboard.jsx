import { useEffect, useMemo, useState } from 'react';
import ApplicationCard from '../components/ApplicationCard';
import useAppStore from '../store/useAppStore';

const statCard = (count, label, note) => (
  <div className="dossier-card p-6">
    <p className="text-[11px] uppercase tracking-[0.28em] text-stone-400">{label}</p>
    <p className="mt-3 font-serif text-5xl text-stone-950">{count}</p>
    <p className="mt-2 text-sm text-stone-600">{note}</p>
  </div>
);

const loadingCard = (key) => (
  <div key={key} className="dossier-card p-6">
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-3">
        <div className="h-4 w-20 animate-pulse rounded bg-stone-300/70" />
        <div className="h-8 w-40 animate-pulse rounded bg-stone-300/70" />
      </div>
      <div className="h-8 w-24 animate-pulse rounded-full bg-stone-300/70" />
    </div>
    <div className="my-5 h-px bg-stone-300/70" />
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="h-4 w-32 animate-pulse rounded bg-stone-300/70" />
      <div className="h-4 w-28 animate-pulse rounded bg-stone-300/70" />
    </div>
  </div>
);

function Dashboard() {
  const applications = useAppStore((state) => state.applications);
  const resumes = useAppStore((state) => state.resumes);
  const fetchApplications = useAppStore((state) => state.fetchApplications);
  const fetchResumes = useAppStore((state) => state.fetchResumes);
  const isFetchingApplications = useAppStore((state) => state.isFetchingApplications);
  const applicationsError = useAppStore((state) => state.applicationsError);
  const [search, setSearch] = useState('');
  const [resumeFilter, setResumeFilter] = useState('all');
  const [portalFilter, setPortalFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchApplications();
    fetchResumes();
  }, [fetchApplications, fetchResumes]);

  const filteredApplications = useMemo(() => {
    return applications
      .filter((application) => {
        const matchesSearch =
          application.company.toLowerCase().includes(search.toLowerCase()) ||
          application.jobTitle.toLowerCase().includes(search.toLowerCase());
        const matchesResume =
          resumeFilter === 'all'
            ? true
            : (application.resumeFilename || 'resume_not_detected') === resumeFilter;
        const matchesPortal = portalFilter === 'all' ? true : application.portal === portalFilter;
        const matchesStatus = statusFilter === 'all' ? true : application.status === statusFilter;
        return matchesSearch && matchesResume && matchesPortal && matchesStatus;
      })
      .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
  }, [applications, portalFilter, resumeFilter, search, statusFilter]);

  const stats = useMemo(
    () => ({
      snapshots: applications.length,
      resumeVersions: resumes.length,
      portals: new Set(applications.map((application) => application.portal)).size,
    }),
    [applications, resumes.length],
  );

  const resumeOptions = useMemo(() => {
    const filenames = new Set(
      applications.map((application) => application.resumeFilename || 'resume_not_detected'),
    );
    return [...filenames];
  }, [applications]);

  const portalOptions = useMemo(() => {
    const portals = new Set(applications.map((application) => application.portal));
    return [...portals];
  }, [applications]);

  return (
    <div className="space-y-8 pb-10">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="panel p-8">
          <p className="eyebrow">Dashboard</p>
          <p className="mt-3 text-sm uppercase tracking-[0.22em] text-stone-500">Direct access mode</p>
          <h1 className="mt-4 max-w-3xl text-5xl text-stone-950">Open any application like a dated case file.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600">
            Search snapshots by company or role, narrow them by resume and portal, and reopen the exact submission context before interviews.
          </p>
        </div>

        <div className="rounded-[2rem] bg-stone-950 p-8 text-stone-100 shadow-[0_28px_70px_rgba(32,18,9,0.16)]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-stone-500">Archive note</p>
          <h2 className="mt-4 font-serif text-4xl text-stone-50">Memory is unreliable. Records are not.</h2>
          <p className="mt-4 text-sm leading-7 text-stone-400">
            AppCommit is strongest when you need precise recall: what resume you sent, what the posting looked like, and when the application was captured.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {statCard(stats.snapshots, 'Snapshots captured', 'Every stored application record')}
        {statCard(stats.resumeVersions, 'Resume versions', 'Tracked resume lineage')}
        {statCard(stats.portals, 'Portals tracked', 'Distinct ATS sources in your archive')}
      </section>

      <section className="panel p-5 sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input"
              placeholder="Search company or role"
            />
            <select
              value={resumeFilter}
              onChange={(event) => setResumeFilter(event.target.value)}
              className="input lg:w-64"
            >
              <option value="all">All resume versions</option>
              {resumeOptions.map((filename) => (
                <option key={filename} value={filename}>
                  {filename}
                </option>
              ))}
            </select>
            <select
              value={portalFilter}
              onChange={(event) => setPortalFilter(event.target.value)}
              className="input lg:w-56"
            >
              <option value="all">All portals</option>
              {portalOptions.map((portal) => (
                <option key={portal} value={portal}>
                  {portal}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm text-stone-500">Sorted newest first</div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="input sm:w-52"
              >
                <option value="all">All statuses</option>
                <option value="applied">Applied</option>
                <option value="interview">Interview</option>
                <option value="offer">Offer</option>
                <option value="rejected">Rejected</option>
              </select>
              <div className="rounded-full border border-stone-900/10 bg-white/55 px-4 py-3 text-sm text-stone-500">
                Status is secondary to the captured record.
              </div>
            </div>
          </div>
        </div>
      </section>

      {applicationsError ? (
        <div className="rounded-[1.6rem] border border-[color:var(--app-accent)]/20 bg-[color:var(--app-accent)]/10 px-4 py-3 text-sm text-[color:var(--app-accent-deep)]">
          {applicationsError}
        </div>
      ) : null}

      {isFetchingApplications ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {[1, 2, 3, 4].map((key) => loadingCard(key))}
        </section>
      ) : null}

      {!isFetchingApplications && !filteredApplications.length ? (
        <div className="rounded-[2rem] border border-dashed border-stone-900/15 bg-white/35 p-10 text-center">
          <p className="font-serif text-4xl text-stone-950">No snapshots yet.</p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-stone-600">
            Install the extension, apply on a supported job portal, and your first record will appear here.
          </p>
        </div>
      ) : null}

      {!isFetchingApplications && filteredApplications.length ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {filteredApplications.map((application) => (
            <ApplicationCard key={application.id} application={application} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

export default Dashboard;
