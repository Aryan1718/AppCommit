import { useEffect, useMemo, useState } from 'react';
import ApplicationCard from '../components/ApplicationCard';
import { useAuth } from '../hooks/useAuth';
import useAppStore from '../store/useAppStore';
import { getDisplayName } from '../utils/helpers';

const statCard = (count, label) => (
  <div className="rounded-[1.6rem] border border-zinc-800 bg-zinc-900 p-5">
    <p className="text-2xl font-semibold text-white">{count}</p>
    <p className="mt-1 text-sm text-zinc-400">{label}</p>
  </div>
);

const loadingCard = (key) => (
  <div key={key} className="rounded-[1.6rem] border border-zinc-800 bg-zinc-900 p-5">
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-3">
        <div className="h-5 w-36 animate-pulse rounded bg-zinc-800" />
        <div className="h-4 w-44 animate-pulse rounded bg-zinc-800" />
      </div>
      <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
    </div>
    <div className="my-4 h-px bg-zinc-800" />
    <div className="flex justify-between gap-4">
      <div className="h-4 w-36 animate-pulse rounded bg-zinc-800" />
      <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
    </div>
    <div className="mt-5 flex justify-between gap-4">
      <div className="h-4 w-28 animate-pulse rounded bg-zinc-800" />
      <div className="h-4 w-20 animate-pulse rounded bg-zinc-800" />
    </div>
  </div>
);

function Dashboard() {
  const { user } = useAuth();
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
    <div className="space-y-8">
      <section className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-indigo-300">Snapshots</p>
        <p className="text-sm text-zinc-400">Welcome back, {getDisplayName(user?.email)}.</p>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white">
          Open any application like a commit
        </h1>
        <p className="max-w-2xl text-sm leading-7 text-zinc-400">
          Search snapshots by company or role, then filter by the resume version and portal that
          created the record.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {statCard(stats.snapshots, 'Snapshots Captured')}
        {statCard(stats.resumeVersions, 'Resume Versions')}
        {statCard(stats.portals, 'Portals Tracked')}
      </section>

      <section className="rounded-[1.6rem] border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-zinc-600"
              placeholder="Search company or role"
            />
            <select
              value={resumeFilter}
              onChange={(event) => setResumeFilter(event.target.value)}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white focus:border-zinc-600 lg:w-64"
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
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white focus:border-zinc-600 lg:w-56"
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
            <div className="text-sm text-zinc-500">Newest first</div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white focus:border-zinc-600 sm:w-52"
              >
                <option value="all">All statuses</option>
                <option value="applied">Applied</option>
                <option value="interview">Interview</option>
                <option value="offer">Offer</option>
                <option value="rejected">Rejected</option>
              </select>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
                Status is secondary to the snapshot record
              </div>
            </div>
          </div>
        </div>
      </section>

      {applicationsError ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {applicationsError}
        </div>
      ) : null}

      {isFetchingApplications ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {[1, 2, 3, 4].map((key) => loadingCard(key))}
        </section>
      ) : null}

      {!isFetchingApplications && !filteredApplications.length ? (
        <div className="rounded-[1.6rem] border border-dashed border-zinc-800 bg-zinc-900/70 p-10 text-center">
          <p className="text-xl font-semibold text-white">No snapshots yet.</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
            Install the extension and apply to your first job.
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
