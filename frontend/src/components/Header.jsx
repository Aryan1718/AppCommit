import { Link, NavLink } from 'react-router-dom';
import AppCommitLogo from './AppCommitLogo';

const navLinkClass = ({ isActive }) =>
  `px-4 py-2 text-sm font-semibold uppercase tracking-[0.14em] transition ${
    isActive
      ? 'bg-stone-950 text-stone-50'
      : 'text-stone-600 hover:bg-white/65 hover:text-[color:var(--app-accent)]'
  }`;

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-900/10 bg-[#f6f4ee]/88 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 text-stone-950">
            <span className="flex h-11 w-11 items-center justify-center border border-stone-900/10 bg-white/80 text-[color:var(--app-accent)]">
              <AppCommitLogo className="h-8 w-8" />
            </span>
            <div>
              <p className="text-2xl font-semibold tracking-[-0.06em]">AppCommit</p>
              <p className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Application Commit</p>
            </div>
          </Link>
          <span className="hidden rounded-full border border-stone-900/10 bg-white/55 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-stone-500 sm:inline-flex">
            self-hosted workspace
          </span>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <nav className="flex items-center gap-2 border border-stone-900/10 bg-white/45 p-1">
            <NavLink to="/dashboard" className={navLinkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/resumes" className={navLinkClass}>
              Resumes
            </NavLink>
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-stone-900">Open-source workspace</p>
              <p className="text-[11px] uppercase tracking-[0.22em] text-stone-500">no sign-in required</p>
            </div>
            <Link to="/dashboard" className="button-secondary">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
