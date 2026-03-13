import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function Login() {
  const navigate = useNavigate();
  const { loading: authLoading, signIn, user } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.email || !form.password) {
      setError('Enter both email and password to continue.');
      return;
    }

    setLoading(true);
    const { error: authError } = await signIn(form.email, form.password);
    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    navigate('/dashboard');
  };

  if (!authLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl shadow-black/30">
        <div className="mb-8 space-y-3">
          <Link to="/" className="inline-flex items-center gap-3 text-sm font-semibold text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
              <span className="h-3 w-3 rounded-full bg-indigo-400" />
            </span>
            <span>AppCommit</span>
          </Link>
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Sign In</p>
          <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-zinc-400">
            Sign in to review every application snapshot, attached resume, and status update.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-zinc-200">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-zinc-200">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500 transition hover:text-zinc-300"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={handleChange}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
                placeholder="Enter your password"
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-xl bg-indigo-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

        <div className="mt-6 flex items-center justify-between text-sm text-zinc-400">
          <Link to="/signup" className="font-medium text-zinc-100 transition hover:text-white">
            Don&apos;t have an account? Sign up
          </Link>
          <Link to="/forgot-password" className="transition hover:text-white">
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Login;
