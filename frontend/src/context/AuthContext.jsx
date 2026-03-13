import { createContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const AuthContext = createContext(null);
const EXTENSION_ID = import.meta.env.VITE_EXTENSION_ID;

const formatAuthError = (error, fallbackMessage) => {
  if (!error) {
    return null;
  }

  const message = String(error.message || fallbackMessage || 'Something went wrong.')
    .replace(/Auth[A-Za-z]*Error:?\s*/g, '')
    .replace(/\b[A-Z_]{3,}\b/g, '')
    .trim();

  return {
    message: message || fallbackMessage || 'Something went wrong.',
  };
};

const syncExtensionToken = async (token) => {
  if (!EXTENSION_ID || typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return;
  }

  try {
    await chrome.runtime.sendMessage(EXTENSION_ID, {
      type: 'STORE_TOKEN',
      token,
    });
  } catch {
    // Extension sync should never block auth flows in the dashboard.
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const {
        data: { session: activeSession },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      setUser(activeSession?.user ?? null);
      await syncExtensionToken(activeSession?.access_token);
      setLoading(false);
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      console.log('[Auth] Event:', event);

      if (event === 'TOKEN_REFRESHED') {
        console.log('[Auth] Token refreshed automatically');
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        await syncExtensionToken(null);
        window.location.href = '/login';
        return;
      }

      setUser(nextSession?.user ?? null);
      await syncExtensionToken(nextSession?.access_token);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email, password) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    return {
      error: formatAuthError(error, 'Unable to create your account right now.'),
    };
  };

  const signIn = async (email, password) => {
    const {
      data: { session: nextSession },
      error,
    } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error) {
      await syncExtensionToken(nextSession?.access_token);
    }

    return {
      error: formatAuthError(error, 'Unable to sign you in right now.'),
    };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return {
      error: formatAuthError(error, 'Unable to sign you out right now.'),
    };
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });

    return {
      error: formatAuthError(error, 'Unable to send a reset email right now.'),
    };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp,
        signIn,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
