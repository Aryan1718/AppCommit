import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!email) {
      setError('Enter your email address to continue.');
      return;
    }

    setLoading(true);
    const { error: resetError } = await resetPassword(email);
    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSuccess('Check your email for a reset link');
  };

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
          <h1 className="text-3xl font-semibold tracking-tight">Reset your password</h1>
          <p className="text-sm text-zinc-400">Enter your email and we&apos;ll send you a reset link.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-zinc-200">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
              placeholder="you@example.com"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {success}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-6 text-sm text-zinc-400">
          <Link to="/login" className="font-medium text-zinc-100 transition hover:text-white">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
