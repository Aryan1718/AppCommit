import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const dashboardPreview = [
  {
    id: 'preview-1',
    company: 'Stripe',
    role: 'Backend Engineer',
    portal: 'Greenhouse',
    date: 'Mar 7, 2024',
    resume: 'backend_v3.pdf',
  },
  {
    id: 'preview-2',
    company: 'Airbnb',
    role: 'Frontend Engineer',
    portal: 'Lever',
    date: 'Mar 5, 2024',
    resume: 'frontend_v2.pdf',
  },
  {
    id: 'preview-3',
    company: 'Linear',
    role: 'Full Stack Engineer',
    portal: 'Workday',
    date: 'Mar 3, 2024',
    resume: 'general_v1.pdf',
  },
];

const steps = [
  {
    id: 'capture',
    title: 'Auto-Captured on Submit',
    description:
      'The moment you click submit on any job portal, AppCommit freezes a snapshot - your resume version, the full job description, company, and role.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path
          d="M4.5 8.5h3l1.5-2h6l1.5 2h3A1.5 1.5 0 0 1 21 10v8.5A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5V10A1.5 1.5 0 0 1 4.5 8.5Z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="14" r="3.5" />
      </svg>
    ),
  },
  {
    id: 'store',
    title: 'Stored Like a Commit',
    description:
      'Every application is saved as an immutable record. The job description is captured as it existed that day - even if the company changes it later.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="6" cy="12" r="2" />
        <circle cx="18" cy="7" r="2" />
        <circle cx="18" cy="17" r="2" />
        <path d="M8 12h8" strokeLinecap="round" />
        <path d="M16.2 8.7 8.3 11.2" strokeLinecap="round" />
        <path d="M16.2 15.3 8.3 12.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'recall',
    title: 'Instant Recall Before Interviews',
    description:
      'Got a call from Stripe? Open AppCommit, find the snapshot, and see exactly what resume you sent and what they were asking for. Be prepared in seconds.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path
          d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

const resumeRows = [
  ['backend_v3.pdf', 'Stripe, Google, Anthropic', 'Mar 7'],
  ['backend_v2.pdf', 'Meta, Apple', 'Feb 28'],
  ['general_v1.pdf', 'Linear, Figma, Notion', 'Feb 20'],
];

function Home() {
  const { signOut, user } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <style>{`
        @keyframes appcommit-spotlight {
          0%, 100% {
            transform: translate3d(-4%, -2%, 0) scale(1);
            opacity: 0.68;
          }
          50% {
            transform: translate3d(4%, 2%, 0) scale(1.08);
            opacity: 0.92;
          }
        }

        @keyframes appcommit-float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes appcommit-glow {
          0%, 100% {
            opacity: 0.5;
            transform: scale(0.95);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.04);
          }
        }
      `}</style>

      <header
        className={`fixed inset-x-0 top-0 z-50 backdrop-blur-xl transition ${
          scrolled ? 'border-b border-white/10 bg-[#0a0a0a]/75 shadow-[0_10px_50px_rgba(0,0,0,0.35)]' : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
              <span className="h-3 w-3 rounded-full bg-indigo-400" />
            </span>
            <span className="text-sm font-bold tracking-[0.02em] text-white">AppCommit</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-zinc-300 md:flex">
            <a href="#top" className="transition hover:text-white">
              Home
            </a>
            <a href="#how-it-works" className="transition hover:text-white">
              How it Works
            </a>
            <Link to="/dashboard" className="transition hover:text-white">
              Dashboard
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center rounded-full bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
                >
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
                >
                  Sign In
                </Link>
                <a
                  href="#"
                  className="inline-flex items-center rounded-full bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
                >
                  Install Extension
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="top">
        <section className="relative overflow-hidden px-4 pb-20 pt-32 sm:px-6 lg:px-8 lg:pb-28 lg:pt-40">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-16 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(129,140,248,0.24),rgba(168,85,247,0.16),transparent_68%)] blur-3xl" />
            <div
              className="absolute left-1/2 top-8 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.14),transparent_62%)] blur-3xl"
              style={{ animation: 'appcommit-spotlight 9s ease-in-out infinite' }}
            />
          </div>

          <div className="relative mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.28em] text-zinc-300">
                Version control for your job applications
              </span>
              <h1 className="mt-8 text-5xl font-semibold tracking-[-0.05em] text-white sm:text-6xl lg:text-7xl">
                Every Application.
                <span className="block">Perfectly Captured.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-zinc-400 sm:text-lg">
                AppCommit snapshots your resume and job description the moment you apply. When the
                interview call comes, open your dashboard - everything you submitted is exactly as
                it was.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                {user ? (
                  <Link
                    to="/dashboard"
                    className="inline-flex min-w-48 items-center justify-center rounded-full bg-indigo-500 px-6 py-3 text-sm font-medium text-white transition hover:bg-indigo-400"
                  >
                    Open Dashboard
                  </Link>
                ) : (
                  <a
                    href="#"
                    className="inline-flex min-w-48 items-center justify-center rounded-full bg-indigo-500 px-6 py-3 text-sm font-medium text-white transition hover:bg-indigo-400"
                  >
                    Install Extension
                  </a>
                )}
                <Link
                  to={user ? '/dashboard' : '/login'}
                  className="inline-flex min-w-48 items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/10"
                >
                  {user ? 'View Dashboard' : 'Sign In'} <span aria-hidden="true" className="ml-1">&rarr;</span>
                </Link>
              </div>
            </div>

            <div className="relative mx-auto mt-16 max-w-5xl">
              <div
                className="pointer-events-none absolute left-1/2 top-full h-24 w-3/4 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.34),transparent_70%)] blur-3xl"
                style={{ animation: 'appcommit-glow 5s ease-in-out infinite' }}
              />

              <div
                className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/80 shadow-[0_30px_90px_rgba(0,0,0,0.55)]"
                style={{ animation: 'appcommit-float 7s ease-in-out infinite' }}
              >
                <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                    <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                    <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                  </div>
                  <div className="ml-3 flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-left text-xs text-zinc-500">
                    appcommit.dev/dashboard
                  </div>
                </div>

                <div className="grid gap-6 p-5 lg:grid-cols-[0.72fr_1.28fr] lg:p-8">
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
                    <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Snapshot Index</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                      <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                        <p className="text-2xl font-semibold text-white">47</p>
                        <p className="mt-1 text-xs text-zinc-500">Snapshots captured</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                        <p className="text-2xl font-semibold text-white">4</p>
                        <p className="mt-1 text-xs text-zinc-500">Resume versions</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                        <p className="text-2xl font-semibold text-white">3</p>
                        <p className="mt-1 text-xs text-zinc-500">Portals tracked</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
                    <div>
                      <p className="text-sm font-medium text-white">Snapshot history</p>
                      <p className="mt-1 text-xs text-zinc-500">Every submission stored like a commit</p>
                    </div>

                    <div className="mt-5 space-y-3">
                      {dashboardPreview.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-base font-semibold text-white">{item.company}</p>
                            <p className="text-sm text-zinc-500">{item.date}</p>
                          </div>
                          <p className="mt-1 text-sm text-zinc-300">{item.role}</p>
                          <div className="my-3 h-px bg-zinc-800" />
                          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-400">
                            <span className="font-mono text-zinc-200">{item.resume}</span>
                            <span>via {item.portal}</span>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-sm">
                            <span className="text-zinc-300">Snapshot captured</span>
                            <span className="font-mono text-indigo-300">-&gt;</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-t border-white/6 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-sm font-medium uppercase tracking-[0.28em] text-indigo-300">Workflow</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
                How AppCommit Works
              </h2>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-7 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-200 ring-1 ring-white/10">
                    {step.icon}
                  </div>
                  <p className="mt-6 text-xs font-medium uppercase tracking-[0.28em] text-zinc-500">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-3 text-xl font-semibold text-white">{step.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-zinc-400">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/6 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-sm font-medium uppercase tracking-[0.28em] text-indigo-300">Snapshot Demo</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
                Your Application. Frozen in Time.
              </h2>
              <p className="mt-4 text-sm leading-7 text-zinc-400">
                Like a git commit - but for job applications
              </p>
            </div>

            <div className="mt-12 grid gap-6 xl:grid-cols-[0.9fr_auto_1.1fr] xl:items-center">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
                <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-zinc-950/90">
                  <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                    <span className="ml-3 text-sm font-medium text-zinc-200">AppCommit</span>
                  </div>

                  <div className="space-y-6 p-5">
                    <div>
                      <p className="text-xl font-semibold text-white">Stripe</p>
                      <p className="mt-1 text-sm text-zinc-300">Backend Engineer</p>
                      <p className="mt-1 text-sm text-zinc-500">via Greenhouse</p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-white">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M7 3.75h7l5 5V20.25A1.75 1.75 0 0 1 17.25 22h-10.5A1.75 1.75 0 0 1 5 20.25V5.5A1.75 1.75 0 0 1 6.75 3.75H7Z" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M14 3.75v5h5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="font-mono">backend_v3.pdf</span>
                      </div>
                      <p className="mt-1 text-xs text-emerald-300">Resume detected</p>
                    </div>

                    <a
                      href="#"
                      className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-400"
                    >
                      Save Snapshot
                    </a>
                  </div>
                </div>
              </div>

              <div className="hidden justify-center xl:flex">
                <span className="font-mono text-4xl text-indigo-300">&rarr;</span>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
                <div className="rounded-[1.5rem] border border-white/10 bg-zinc-950/90 p-6">
                  <p className="font-mono text-sm text-indigo-300">snapshot | a3f92b1</p>
                  <p className="mt-2 text-sm text-zinc-500">Mar 7, 2024 | Greenhouse</p>
                  <div className="mt-6 h-px bg-zinc-800" />

                  <h3 className="mt-6 text-2xl font-semibold text-white">Stripe - Backend Engineer</h3>

                  <div className="mt-8 space-y-6">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Resume Used</p>
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="font-mono text-sm font-medium text-white">backend_v3.pdf</p>
                        <button
                          type="button"
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-white/10"
                        >
                          View
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Job Description Snapshot</p>
                      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 font-mono text-sm leading-7 text-zinc-300">
                        "We are looking for a backend engineer to join our payments infrastructure
                        team. You will work on systems that process..."
                      </div>
                      <button
                        type="button"
                        className="mt-4 text-sm font-medium text-indigo-300 transition hover:text-indigo-200"
                      >
                        Read full snapshot -&gt;
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-6 text-sm text-zinc-500">
              Captured at time of application. This snapshot may differ from the current job posting.
            </p>
          </div>
        </section>

        <section className="border-t border-white/6 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-sm font-medium uppercase tracking-[0.28em] text-indigo-300">Resume Versions</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
                Track Every Resume Version
              </h2>
              <p className="mt-4 text-sm leading-7 text-zinc-400">
                Know exactly which version went where
              </p>
            </div>

            <div className="mt-10 overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.03]">
              <div className="grid grid-cols-1 gap-3 border-b border-white/10 px-5 py-4 text-xs uppercase tracking-[0.22em] text-zinc-500 md:grid-cols-[1.2fr_1.6fr_0.8fr]">
                <p>Resume Version</p>
                <p>Sent To</p>
                <p>Date</p>
              </div>
              {resumeRows.map(([filename, companies, date]) => (
                <div
                  key={filename}
                  className="grid grid-cols-1 gap-3 border-b border-white/6 px-5 py-4 text-sm text-zinc-300 md:grid-cols-[1.2fr_1.6fr_0.8fr] md:items-center"
                >
                  <p className="font-mono text-white">{filename}</p>
                  <p>{companies}</p>
                  <p className="text-zinc-400">{date}</p>
                </div>
              ))}
            </div>

            <p className="mt-5 text-sm text-zinc-500">
              Never wonder "wait, which resume did I send them?" again.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/6 bg-[#0a0a0a] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
                  <span className="h-3 w-3 rounded-full bg-indigo-400" />
                </span>
                <span className="text-sm font-semibold text-white">AppCommit</span>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-7 text-zinc-400">
                Version control for your job applications
              </p>
            </div>

            <div className="flex flex-col gap-3 text-sm text-zinc-400">
              <a href="#top" className="transition hover:text-white">
                Home
              </a>
              <Link to="/dashboard" className="transition hover:text-white">
                Dashboard
              </Link>
              <a href="#" className="transition hover:text-white">
                Install Extension
              </a>
            </div>

            <div className="max-w-sm text-sm leading-7 text-zinc-400">
              Built for job seekers who take interviews seriously
            </div>
          </div>

          <div className="mt-10 border-t border-white/6 pt-6 text-sm text-zinc-500">
            &copy; 2024 AppCommit. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Home;
