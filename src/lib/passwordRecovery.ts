import { createClient } from '@supabase/supabase-js';

// Dedicated client used ONLY to request password-reset emails.
// It uses the implicit flow, so the email link carries its own one-time
// tokens and works on any device or browser — no security code has to be
// stored in the browser that requested the reset (unlike the PKCE flow).
const memory = new Map<string, string>();
const recoveryClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      flowType: 'implicit',
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'irobokid-recovery-request',
      storage: {
        getItem: (k) => memory.get(k) ?? null,
        setItem: (k, v) => { memory.set(k, v); },
        removeItem: (k) => { memory.delete(k); },
      },
    },
  },
);

export const RESET_REDIRECT_URL = 'https://irobokidattendance.lovable.app/';

export const sendPasswordResetEmail = (email: string) =>
  recoveryClient.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: RESET_REDIRECT_URL,
  });
