import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { apiLogin, apiSignup } from '../services/api';

const AuthContext = createContext(null);
const LOCAL_STORAGE_KEY = 'dailyvoice_auth_session';

function generateUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize session on mount
  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        if (isSupabaseConfigured && supabase) {
          // Check live Supabase session
          const { data: { session: currentSession }, error } = await supabase.auth.getSession();
          if (error) throw error;

          if (mounted) {
            setSession(currentSession);
            setUser(currentSession?.user || null);
          }

          // Listen for Supabase auth state transitions
          const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
            if (mounted) {
              setSession(newSession);
              setUser(newSession?.user || null);
            }
          });

          return () => {
            subscription?.unsubscribe();
          };
        } else {
          // Local session store from persistent local storage
          const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              const token = parsed?.session?.access_token;
              const isValidJwt = typeof token === 'string' && token.trim().split('.').length === 3;
              if (parsed && parsed.user && isValidJwt) {
                if (mounted) {
                  setUser(parsed.user);
                  setSession(parsed.session || null);
                }
              } else {
                // Stale, malformed, or non-JWT legacy mock token - clean up
                localStorage.removeItem(LOCAL_STORAGE_KEY);
                if (mounted) {
                  setUser(null);
                  setSession(null);
                }
              }
            } catch (e) {
              localStorage.removeItem(LOCAL_STORAGE_KEY);
            }
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setUser(data.user);
        setSession(data.session);
        return { data, error: null };
      } else {
        // Authenticate against backend /api/auth/login to issue cryptographically signed JWT
        const res = await apiLogin(email, password);
        const token = res.data?.session?.access_token;
        const isValidJwt = typeof token === 'string' && token.trim().split('.').length === 3;

        if (res.ok && res.data?.user && isValidJwt) {
          const sessionPayload = {
            user: res.data.user,
            session: res.data.session,
          };
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessionPayload));
          setUser(res.data.user);
          setSession(res.data.session);
          return { data: sessionPayload, error: null };
        }

        const errorMessage =
          res.data?.message ||
          res.error ||
          'Authentication failed. Please verify credentials and ensure the backend server is running.';
        return { data: null, error: new Error(errorMessage) };
      }
    } catch (error) {
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email, password, fullName) => {
    setLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });
        if (error) throw error;
        setUser(data.user);
        setSession(data.session);
        return { data, error: null };
      } else {
        // Authenticate against backend /api/auth/signup to issue signed JWT
        const res = await apiSignup(email, password, fullName);
        const token = res.data?.session?.access_token;
        const isValidJwt = typeof token === 'string' && token.trim().split('.').length === 3;

        if (res.ok && res.data?.user && isValidJwt) {
          const sessionPayload = {
            user: res.data.user,
            session: res.data.session,
          };
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessionPayload));
          setUser(res.data.user);
          setSession(res.data.session);
          return { data: sessionPayload, error: null };
        }

        const errorMessage =
          res.data?.message ||
          res.error ||
          'Subscription creation failed. Please ensure the backend server is running.';
        return { data: null, error: new Error(errorMessage) };
      }
    } catch (error) {
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.warn('Supabase signOut error:', e);
    } finally {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setUser(null);
      setSession(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAuthenticated: Boolean(user),
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
