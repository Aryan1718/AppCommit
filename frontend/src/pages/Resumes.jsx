import { useEffect, useMemo, useRef, useState } from 'react';
import { deleteResume, downloadResume, uploadResume } from '../api/client';
import useAppStore from '../store/useAppStore';

const formatDate = (value) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));

const formatFileSize = (size) => `${Math.max(1, Math.round(size / 1024))}KB`;

const fileTypeLabel = (filename) => {
  const extension = filename.split('.').pop()?.toUpperCase();
  return extension || 'FILE';
};

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = () => reject(new Error('Unable to read this file.'));
    reader.readAsDataURL(file);
  });

function Resumes() {
  const fileInputRef = useRef(null);
  const applications = useAppStore((state) => state.applications);
  const resumes = useAppStore((state) => state.resumes);
  const fetchApplications = useAppStore((state) => state.fetchApplications);
  const fetchResumes = useAppStore((state) => state.fetchResumes);
  const setResumes = useAppStore((state) => state.setResumes);
  const isFetchingResumes = useAppStore((state) => state.isFetchingResumes);
  const resumesError = useAppStore((state) => state.resumesError);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [resumeActionId, setResumeActionId] = useState('');

  useEffect(() => {
    fetchApplications();
    fetchResumes();
  }, [fetchApplications, fetchResumes]);

  const counts = useMemo(() => {
    return applications.reduce((map, application) => {
      if (!application.resumeId) {
        return map;
      }

      return {
        ...map,
        [application.resumeId]: (map[application.resumeId] || 0) + 1,
      };
    }, {});
  }, [applications]);

  const companiesByResume = useMemo(() => {
    return applications.reduce((map, application) => {
      if (!application.resumeId) {
        return map;
      }

      const companies = map[application.resumeId] || [];
      if (!companies.includes(application.company)) {
        companies.push(application.company);
      }

      return {
        ...map,
        [application.resumeId]: companies,
      };
    }, {});
  }, [applications]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploading(true);
    setError('');

    try {
      const base64payload = await fileToBase64(file);
      const nextResume = await uploadResume(base64payload, file);
      setResumes([nextResume, ...resumes]);
    } catch (uploadError) {
      setError(uploadError.message || 'Unable to upload resume.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    setError('');

    try {
      await deleteResume(id, true);
      setResumes(resumes.filter((resume) => resume.id !== id));
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete resume.');
    } finally {
      setDeletingId('');
    }
  };

  const handleView = async (resume) => {
    setResumeActionId(resume.id);
    setError('');

    try {
      const result = await downloadResume(resume.id);
      window.open(result.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (resumeError) {
      setError(resumeError.message || 'Unable to open resume preview.');
    } finally {
      setResumeActionId('');
    }
  };

  const handleDownload = async (resume) => {
    setResumeActionId(resume.id);
    setError('');

    try {
      const result = await downloadResume(resume.id);
      window.open(result.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (resumeError) {
      setError(resumeError.message || 'Unable to download resume.');
    } finally {
      setResumeActionId('');
    }
  };

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white">Resume Versions</h1>
        <p className="text-sm leading-7 text-zinc-400">
          Track which version of your resume went to which companies
        </p>
      </section>

      <section className="rounded-[1.6rem] border border-zinc-800 bg-zinc-900 p-6 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-zinc-400">
            Upload files here first so the extension can match resume filenames automatically.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" onChange={handleFileChange} className="hidden" />
          <button
            type="button"
            onClick={handleUploadClick}
            className="inline-flex items-center justify-center rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400"
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Upload Resume Version'}
          </button>
        </div>
      </section>

      {error || resumesError ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error || resumesError}
        </div>
      ) : null}

      {isFetchingResumes ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((key) => (
            <div key={key} className="rounded-[1.6rem] border border-zinc-800 bg-zinc-900 p-6">
              <div className="space-y-3">
                <div className="h-5 w-40 animate-pulse rounded bg-zinc-800" />
                <div className="h-4 w-60 animate-pulse rounded bg-zinc-800" />
                <div className="h-4 w-44 animate-pulse rounded bg-zinc-800" />
                <div className="h-4 w-72 animate-pulse rounded bg-zinc-800" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!isFetchingResumes ? (
        <section className="space-y-4">
          {resumes.length ? (
            <div className="space-y-4">
              {resumes.map((resume) => (
                <div key={resume.id} className="rounded-[1.6rem] border border-zinc-800 bg-zinc-900 p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <p className="font-mono text-lg font-semibold text-white">{resume.filename}</p>
                      <p className="text-sm text-zinc-400">
                        Uploaded {formatDate(resume.uploadedAt)} | {formatFileSize(resume.size)} | {fileTypeLabel(resume.filename)}
                      </p>
                      <p className="text-sm text-zinc-300">Used in {resume.usedIn || counts[resume.id] || 0} snapshots</p>
                      <p className="text-sm text-zinc-400">
                        Sent to:{' '}
                        {(companiesByResume[resume.id] || []).slice(0, 3).join(', ') || 'No companies yet'}
                        {(companiesByResume[resume.id] || []).length > 3
                          ? ` (+${(companiesByResume[resume.id] || []).length - 3} more)`
                          : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => handleView(resume)}
                        className="inline-flex items-center rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                        disabled={resumeActionId === resume.id}
                      >
                        {resumeActionId === resume.id ? 'Loading...' : 'View'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(resume)}
                        className="inline-flex items-center rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                        disabled={resumeActionId === resume.id}
                      >
                        Download
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(resume.id)}
                        className="inline-flex items-center rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                        disabled={deletingId === resume.id}
                      >
                        {deletingId === resume.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-zinc-800 bg-zinc-900/70 p-10 text-center">
              <p className="text-lg font-semibold text-white">No resume versions uploaded yet.</p>
              <p className="mt-2 text-sm text-zinc-400">
                Upload your first resume version to start capturing exact snapshots.
              </p>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

export default Resumes;
