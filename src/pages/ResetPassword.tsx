import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';
import { sendPasswordResetEmail } from '@/lib/passwordRecovery';

const RECOVERY_MARKER = 'irobokid-password-recovery-verified';
const RECOVERY_MARKER_MAX_AGE_MS = 30 * 60 * 1000;

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Set when the link's security code can't be verified in this browser
  // (e.g. the email was opened in a different browser/app than the request).
  const [needsResend, setNeedsResend] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const navigate = useNavigate();

  const handleLinkError = (message: string) => {
    if (message.toLowerCase().includes('code verifier')) {
      setNeedsResend(true);
    } else {
      setErrorMsg(message);
    }
    setChecking(false);
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendLoading(true);
    try {
      const { error } = await sendPasswordResetEmail(resendEmail);
      if (error) {
        toast.error(error.message);
      } else {
        setResendSent(true);
      }
    } catch {
      toast.error('Could not send the reset email. Check your connection and try again.');
    } finally {
      setResendLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Only a verified recovery event should unlock the password form.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        sessionStorage.setItem(RECOVERY_MARKER, Date.now().toString());
        setReady(true);
        setChecking(false);
      }
    });

    const init = async () => {
      try {
        const url = new URL(window.location.href);
        const hash = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hash);

        // Surface explicit errors from the email link (expired/invalid)
        const errorDesc = hashParams.get('error_description') || url.searchParams.get('error_description');
        const errorCode = hashParams.get('error') || url.searchParams.get('error');
        if (errorDesc || errorCode) {
          setErrorMsg(errorDesc || errorCode || 'Invalid or expired link');
          setChecking(false);
          return;
        }

        const finish = () => {
          sessionStorage.setItem(RECOVERY_MARKER, Date.now().toString());
          window.history.replaceState({}, '', '/reset-password');
          setReady(true);
          setChecking(false);
        };

        // 1) Implicit flow: #access_token=...&type=recovery
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) { setErrorMsg(error.message); setChecking(false); return; }
          finish();
          return;
        }

        // 2) PKCE flow: ?code=...
        const code = url.searchParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) { finish(); return; }
          // The code may already have been consumed — fall back to the session.
          const { data } = await supabase.auth.getSession();
          if (data.session) { finish(); return; }
          handleLinkError(error.message);
          return;
        }

        // 3) Token-hash flow: ?token_hash=...&type=recovery
        const tokenHash = url.searchParams.get('token_hash') || hashParams.get('token_hash');
        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
          if (error) { handleLinkError(error.message); return; }
          finish();
          return;
        }

        // A refresh after a verified link may have no URL token left. Only
        // reuse its session briefly; an ordinary signed-in session is not enough.
        const verifiedAt = Number(sessionStorage.getItem(RECOVERY_MARKER));
        if (verifiedAt && Date.now() - verifiedAt <= RECOVERY_MARKER_MAX_AGE_MS) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            setReady(true);
            setChecking(false);
            return;
          }
        }
        sessionStorage.removeItem(RECOVERY_MARKER);
        setChecking(false);
      } catch (err: unknown) {
        handleLinkError(err instanceof Error ? err.message : 'Could not verify reset link');
      }
    };


    init();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Password updated successfully!');
      sessionStorage.removeItem(RECOVERY_MARKER);
      // Sign out so the user logs in with the new password
      await supabase.auth.signOut();
      navigate('/auth');
    } catch {
      toast.error('Could not update your password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.ico" alt="iRobokid Logo" className="w-16 h-16 mx-auto mb-4 rounded-2xl" />
          <h1 className="text-3xl font-bold font-heading text-foreground">iRobokid</h1>
        </div>
        <Card>
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Set New Password</CardTitle>
            <CardDescription>
              {checking
                ? 'Verifying reset link...'
                : ready
                  ? 'Enter your new password below'
                  : needsResend
                    ? 'This reset link is no longer valid. Please request a new one.'
                    : errorMsg ?? 'This reset link is invalid or expired. Please request a new one.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {checking ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : ready ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  <KeyRound className="w-4 h-4 mr-2" />
                  {loading ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            ) : needsResend ? (
              resendSent ? (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    New reset link sent! Open it from your email on any device to set your password.
                  </p>
                  <Button className="w-full" variant="outline" onClick={() => navigate('/auth')}>
                    Back to Sign In
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleResend} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Enter your email to get a fresh reset link. The new link works on any device or browser.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="resendEmail">Email</Label>
                    <Input id="resendEmail" type="email" value={resendEmail} onChange={(e) => setResendEmail(e.target.value)} placeholder="you@institute.edu" required />
                  </div>
                  <Button type="submit" className="w-full" disabled={resendLoading}>
                    <KeyRound className="w-4 h-4 mr-2" />
                    {resendLoading ? 'Sending...' : 'Send New Reset Link'}
                  </Button>
                </form>
              )
            ) : (
              <Button className="w-full" onClick={() => navigate('/auth')}>
                Back to Sign In
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
