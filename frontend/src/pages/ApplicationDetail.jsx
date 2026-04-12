import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteApplication, downloadResume, getApplication, updateApplication } from '../api/client';
import JobDescriptionViewer from '../components/JobDescriptionViewer';
import Timeline from '../components/Timeline';
import useAppStore from '../store/useAppStore';

const formatDate = (value) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));

const formatDateTime = (value) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));

const statusOrder = ['applied', 'interview', 'offer'];

function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fetchApplications = useAppStore((state) => state.fetchApplications);
  const fetchResumes = useAppStore((state) => state.fetchResumes);
  const getApplicationById = useAppStore((state) => state.getApplicationById);
  const refreshApplication = useAppStore((state) => state.refreshApplication);
  const updateStatus = useAppStore((state) => state.updateStatus);
  const removeApplication = useAppStore((state) => state.removeApplication);
  const applications = useAppStore((state) => state.applications);
  const resumes = useAppStore((state) => state.resumes);
  const isUpdatingApplication = useAppStore((state) => state.isUpdatingApplication);
  const [application, setApplication] = useState(() => getApplicationById(id));
  const [notes, setNotes] = useState(application?.notes || '');
  const [detailLoading, setDetailLoading] = useState(!application);
  const [error, setError] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadApplication = async () => {
      setDetailLoading(true);
      setError('');

      try {
        await fetchApplications();
        await fetchResumes();
        const resolved = getApplicationById(id) || (await getApplication(id));

        if (isMounted) {
          setApplication(resolved);
          setNotes(resolved.notes || '');
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || 'Unable to load this snapshot.');
        }
      } finally {
        if (isMounted) {
          setDetailLoading(false);
        }
      }
    };

    loadApplication();

    return () => {
      isMounted = false;
    };
  }, [fetchApplications, fetchResumes, getApplicationById, id]);

  const shortId = application?.id?.split('-').join('').slice(0, 7) || 'unknown';

  const relatedResume = useMemo(
    () => resumes.find((resume) => resume.id === application?.resumeId),
    [application?.resumeId, resumes],
  );

  const resumeUsageCount = useMemo(
    () => applications.filter((item) => item.resumeId && item.resumeId === application?.resumeId).length,
    [application?.resumeId, applications],
  );

  const statusStep = useMemo(() => {
    if (application?.status === 'rejected') {
      return 'applied';
    }

    return application?.status || 'applied';
  }, [application?.status]);

  const handleStatusChange = async (event) => {
    const nextStatus = event.target.value;

    try {
      const updated = await updateStatus(id, nextStatus);
      setApplication(updated);
    } catch (updateError) {
      setError(updateError.message || 'Unable to update status.');
    }
  };

  const handleNotesBlur = async () => {
    if (!application || notes === application.notes) {
      return;
    }

    setSavingNotes(true);
    setError('');

    try {
      const updated = await updateApplication(id, { notes });
      refreshApplication(updated);
      setApplication(updated);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleViewResume = async () => {
    if (!application?.resumeId) {
      setError('No resume was detected for this snapshot.');
      return;
    }

    setResumeLoading(true);
    setError('');

    try {
      const resume = await downloadResume(application.resumeId);
      window.open(resume.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (resumeError) {
      setError(resumeError.message || 'Unable to open resume preview.');
    } finally {
      setResumeLoading(false);
    }
  };

  const handleDownloadResume = async () => {
    if (!application?.resumeId) {
      setError('No resume was detected for this snapshot.');
      return;
    }

    setResumeLoading(true);
    setError('');

    try {
      const resume = await downloadResume(application.resumeId);
      window.open(resume.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (resumeError) {
      setError(resumeError.message || 'Unable to download resume.');
    } finally {
      setResumeLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError('');

    try {
      await deleteApplication(id);
      removeApplication(id);
      navigate('/dashboard');
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete snapshot.');
    } finally {
      setDeleting(false);
    }
  };

  if (detailLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-stone-300" />
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
          <div className="h-96 animate-pulse border border-stone-300 bg-white/55" />
          <div className="h-96 animate-pulse border border-stone-300 bg-white/55" />
        </div>
      </div>
    );
  }

  if (error && !application) {
    return (
      <div className="space-y-4">
        <div className="border border-stone-900/12 bg-black px-4 py-3 text-sm text-white">{error}</div>
        <Link to="/dashboard" className="button-secondary">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="space-y-4">
        <div className="panel p-8">
          <p className="text-lg font-semibold text-stone-950">Snapshot not found</p>
          <p className="mt-2 text-sm text-stone-500">
            This record may have been deleted or never existed.
          </p>
        </div>
        <Link to="/dashboard" className="button-secondary">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Link to="/dashboard" className="text-sm font-medium text-stone-500 hover:text-stone-950">
            Back to dashboard
          </Link>
          <p className="font-mono text-sm text-[color:var(--app-accent)]">snapshot | {shortId}</p>
          <h1 className="text-4xl font-semibold tracking-[-0.05em] text-stone-950">
            {application.company} - {application.jobTitle}
          </h1>
          <p className="text-sm text-stone-500">
            Captured {formatDateTime(application.appliedAt)} via {application.portal}
          </p>
        </div>
        <button type="button" onClick={handleDelete} className="button-secondary" disabled={deleting}>
          {deleting ? 'Deleting...' : 'Delete snapshot'}
        </button>
      </div>

      {error ? (
        <div className="border border-stone-900/12 bg-black px-4 py-3 text-sm text-white">{error}</div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <div className="space-y-6">
          <div className="dossier-card p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Resume Used</p>
                <p className="mt-3 font-mono text-lg font-semibold text-stone-950">
                  {application.resumeFilename || 'Resume not detected'}
                </p>
                <p className="mt-2 text-sm text-stone-500">
                  Uploaded {relatedResume ? formatDate(relatedResume.uploadedAt) : 'Unknown'} | Used in{' '}
                  {resumeUsageCount || 0} snapshots
                </p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={handleViewResume} className="button-secondary" disabled={resumeLoading}>
                  {resumeLoading ? 'Loading...' : 'View Resume'}
                </button>
                <button type="button" onClick={handleDownloadResume} className="button-primary" disabled={resumeLoading}>
                  Download
                </button>
              </div>
            </div>
          </div>

          <div className="dossier-card p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Job Description Snapshot</p>
            <div className="mt-4 flex flex-col gap-2 text-sm text-stone-500">
              <p>Captured at time of application</p>
              <p className="text-[color:var(--app-accent)]">
                This is a frozen snapshot. The live posting may have changed.
              </p>
            </div>
            <div className="mt-5">
              <JobDescriptionViewer description={application.jobDescription} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="dossier-card p-6">
            <div className="space-y-5">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Company</p>
                <p className="mt-2 text-sm font-medium text-stone-950">{application.company}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Role</p>
                <p className="mt-2 text-sm font-medium text-stone-950">{application.jobTitle}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Portal</p>
                <p className="mt-2 text-sm font-medium text-stone-950">{application.portal}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">URL</p>
                {application.jobUrl ? (
                  <a href={application.jobUrl} target="_blank" rel="noreferrer" className="mt-2 block text-sm text-[color:var(--app-accent)] hover:underline">
                    {application.jobUrl}
                  </a>
                ) : (
                  <p className="mt-2 text-sm text-stone-500">Original posting URL not captured</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Captured</p>
                <p className="mt-2 text-sm font-medium text-stone-950">{formatDateTime(application.appliedAt)}</p>
              </div>
            </div>
          </div>

          <div className="dossier-card p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Status</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              {statusOrder.map((status) => {
                const isActive = statusOrder.indexOf(status) <= statusOrder.indexOf(statusStep);
                return (
                  <div key={status} className="flex flex-1 items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${isActive ? 'bg-[color:var(--app-accent)]' : 'bg-stone-300'}`} />
                    <span className={`text-sm capitalize ${isActive ? 'text-stone-950' : 'text-stone-400'}`}>{status}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-5">
              <select value={application.status} onChange={handleStatusChange} className="input" disabled={isUpdatingApplication}>
                <option value="applied">Applied</option>
                <option value="interview">Interview</option>
                <option value="offer">Offer</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="dossier-card p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-stone-500">Notes</p>
              <span className="text-xs text-stone-500">{savingNotes ? 'Saving...' : 'Auto-saves on blur'}</span>
            </div>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              onBlur={handleNotesBlur}
              rows={5}
              className="mt-4 w-full resize-none border border-stone-900/10 bg-white/70 px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[color:var(--app-accent)]"
              placeholder="Add interview notes, recruiter name..."
            />
          </div>
        </div>
      </section>

      <section className="dossier-card p-6">
        <p className="text-lg font-semibold text-stone-950">Snapshot History</p>
        <div className="mt-5">
          <Timeline events={application.timeline} resumeFilename={application.resumeFilename} portal={application.portal} />
        </div>
      </section>
    </div>
  );
}

export default ApplicationDetail;
