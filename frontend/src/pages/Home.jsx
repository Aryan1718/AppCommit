import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppCommitLogo from '../components/AppCommitLogo';

const dossierCards = [
  {
    company: 'Linear',
    role: 'Product Engineer',
    label: 'Snapshot 048',
    note: 'Resume attached: product-systems-v4.pdf',
  },
  {
    company: 'Stripe',
    role: 'Backend Engineer',
    label: 'Snapshot 049',
    note: 'Status advanced: technical interview',
  },
  {
    company: 'Notion',
    role: 'Design Engineer',
    label: 'Snapshot 050',
    note: 'Portal captured via Greenhouse',
  },
];

const principles = [
  'Captures the exact job description you applied to',
  'Pins the resume version you actually sent',
  'Lets you reopen every submission like a case file',
];

function Home() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen overflow-hidden text-stone-950">
      <header
        className={`fixed inset-x-0 top-0 z-50 transition ${
          scrolled ? 'border-b border-stone-900/10 bg-[#f6f4ee]/92 backdrop-blur-xl' : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center border border-stone-900/10 bg-white/75 text-[color:var(--app-accent)]">
              <AppCommitLogo className="h-8 w-8" />
            </span>
            <div>
              <p className="text-2xl font-semibold leading-none tracking-[-0.06em]">AppCommit</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.28em] text-stone-500">Application archive</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-stone-600 md:flex">
            <Link to="/privacy" className="transition hover:text-stone-950">
              Privacy
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="button-primary">
              Dashboard
            </Link>
            <Link to="/resumes" className="button-secondary">
              Resumes
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative px-4 pb-20 pt-32 sm:px-6 lg:px-8 lg:pb-28 lg:pt-40">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute right-0 top-24 h-64 w-64 bg-[radial-gradient(circle,rgba(225,73,45,0.12),transparent_68%)] blur-3xl" />
            <div className="absolute left-1/3 top-16 h-px w-[48vw] bg-stone-900/10" />
          </div>

          <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="eyebrow">Self-hosted by default</p>
              <h1 className="mt-6 max-w-5xl text-6xl font-semibold leading-[0.92] text-stone-950 sm:text-7xl lg:text-[7rem]">
                Keep every
                <span className="block text-[color:var(--app-accent)]">application receipt.</span>
              </h1>
              <p className="mt-8 max-w-2xl text-lg leading-8 text-stone-700">
                AppCommit treats job applications like evidence, not memory. Each submission becomes a dated record of the role, the description, the resume version, and the portal where it happened.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link to="/dashboard" className="button-primary">
                  Dashboard
                </Link>
                <Link to="/privacy" className="button-secondary">
                  Privacy
                </Link>
              </div>

              <div className="mt-12 grid gap-4 sm:grid-cols-3">
                {principles.map((item, index) => (
                  <div
                    key={item}
                    className="border border-stone-900/10 bg-white/52 px-5 py-5"
                  >
                    <p className="text-xs uppercase tracking-[0.28em] text-stone-400">0{index + 1}</p>
                    <p className="mt-3 text-sm leading-6 text-stone-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative lg:pl-10">
              <div className="absolute left-10 top-4 hidden h-full w-px bg-gradient-to-b from-stone-900/10 via-stone-900/20 to-transparent lg:block" />
              <div className="dossier-card relative overflow-hidden p-6 sm:p-8">
                <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--app-accent),var(--app-accent))]" />
                <div className="flex items-start justify-between gap-4 border-b border-stone-900/10 pb-5">
                  <div>
                    <p className="eyebrow">Active record</p>
                    <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-stone-950">Candidate dossier</h2>
                  </div>
                  <div className="border border-stone-900/10 bg-stone-950 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-stone-100">
                    private archive
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {dossierCards.map((card, index) => (
                    <div
                      key={card.label}
                      className={`rounded-[1.5rem] border px-5 py-5 transition ${
                        index === 1
                          ? 'border-[color:var(--app-accent)] bg-stone-950 text-stone-100'
                          : 'border-stone-900/10 bg-white/70 text-stone-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className={`text-xs uppercase tracking-[0.28em] ${index === 1 ? 'text-stone-400' : 'text-stone-500'}`}>
                          {card.label}
                        </p>
                        <span
                          className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.24em] ${
                            index === 1
                              ? 'border border-stone-700 text-stone-300'
                              : 'border border-stone-900/10 text-stone-500'
                          }`}
                        >
                          stored
                        </span>
                      </div>
                      <h3 className="mt-4 text-3xl font-semibold tracking-[-0.05em]">{card.company}</h3>
                      <p className={`mt-2 text-sm ${index === 1 ? 'text-stone-300' : 'text-stone-600'}`}>{card.role}</p>
                      <p className={`mt-5 border-t pt-4 text-sm ${index === 1 ? 'border-stone-800 text-stone-400' : 'border-stone-900/10 text-stone-500'}`}>
                        {card.note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}

export default Home;
