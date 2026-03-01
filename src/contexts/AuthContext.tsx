import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, organizationName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const isNetworkAuthError = (error: unknown) => {
    if (!error || typeof error !== 'object') return false;

    const maybeError = error as { message?: string; name?: string; status?: number };
    const message = (maybeError.message ?? '').toLowerCase();

    return (
      maybeError.status === 0 ||
      maybeError.name === 'AuthRetryableFetchError' ||
      message.includes('networkerror') ||
      message.includes('network request failed') ||
      message.includes('failed to fetch')
    );
  };

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const runAuthWithRetry = async <T,>(request: () => Promise<T>, maxAttempts = 3): Promise<T> => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await request();
      } catch (error) {
        lastError = error;

        if (!isNetworkAuthError(error) || attempt === maxAttempts) {
          throw error;
        }

        await wait(500 * attempt);
      }
    }

    throw lastError;
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await runAuthWithRetry(() =>
        supabase.auth.signInWithPassword({ email, password })
      );
      return { error: error as Error | null };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error
            : new Error('Unable to connect to authentication service. Please try again.'),
      };
    }
  };

  const signUp = async (email: string, password: string, organizationName?: string) => {
    try {
      const { error, data } = await runAuthWithRetry(() =>
        supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        })
      );

      if (!error && data.user && organizationName) {
        // Update the profile with organization name
        await supabase
          .from('profiles')
          .update({ organization_name: organizationName })
          .eq('id', data.user.id);
      }

      return { error: error as Error | null };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error
            : new Error('Unable to connect to authentication service. Please try again.'),
      };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
