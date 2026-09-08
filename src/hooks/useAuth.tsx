import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'instructor' | 'admin';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    // No implicit role: users without a user_roles record get no access.
    setRole((data?.role as AppRole) ?? null);
  };

  useEffect(() => {
    let didInit = false;

    const handleSession = async (session: Session | null) => {
      // Keep loading true until the role is resolved, so protected routes never
      // flash the "access pending" screen while the role query is in flight.
      if (session?.user) {
        setLoading(true);
        setSession(session);
        setUser(session.user);
        await fetchRole(session.user.id);
      } else {
        setSession(null);
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!didInit) return;
        handleSession(session);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      didInit = true;
      handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
