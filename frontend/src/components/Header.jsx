import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getDisplayName } from '../utils/helpers';

const navLinkClass = ({ isActive }) =>
  `rounded-full px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
  }`;

function Header() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const handleLogout = async () => {
    const { error } = await signOut();
    if (!error) {
      navigate('/login');
    }
  };

  return (
    <header className="border-b border-zinc-800 bg-[#0a0a0a]/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-400" />
            </span>
            <span>AppCommit</span>
          </Link>
          <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400 sm:inline-flex">
            Version control for job applications
          </span>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <nav className="flex items-center gap-2">
            <NavLink to="/dashboard" className={navLinkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/resumes" className={navLinkClass}>
              Resumes
            </NavLink>
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-white">{getDisplayName(user?.email)}</p>
              <p className="text-xs text-zinc-500">Snapshot workspace</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
