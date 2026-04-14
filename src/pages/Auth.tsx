import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { LogIn, UserPlus, KeyRound } from 'lucide-react';

const Auth = () => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) toast.error(error.message);
      else toast.success('Password reset email sent! Check your inbox.');
      setLoading(false);
      return;
    }
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
      else navigate('/dashboard');
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName, role: 'instructor' }, emailRedirectTo: window.location.origin },
      });
      if (error) toast.error(error.message);
      else toast.success('Account created! Please check your email to verify.');
    }
    setLoading(false);
  };

  const title = mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create account' : 'Reset password';
  const description = mode === 'login' ? 'Sign in to your instructor account' : mode === 'signup' ? 'Register as an instructor' : 'Enter your email to receive a reset link';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] rounded-full bg-accent/5 blur-3xl" />

      <div className="w-full max-w-md animate-fade-in relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-card shadow-lg border mb-5">
            <img src="/logo.ico" alt="iRobokid Logo" className="w-12 h-12 rounded-xl" />
          </div>
          <h1 className="text-3xl font-bold font-heading text-foreground tracking-tight">iRobokid</h1>
          <p className="text-muted-foreground mt-1 text-sm">Attendance Management</p>
        </div>

        <Card className="shadow-lg border-border/60">
          <CardHeader className="text-center pb-2 pt-6">
            <CardTitle className="text-xl tracking-tight">{title}</CardTitle>
            <CardDescription className="text-[13px]">{description}</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-medium">Full Name</Label>
                  <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" required className="h-10" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@institute.edu" required className="h-10" />
              </div>
              {mode !== 'forgot' && (
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-medium">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="h-10" />
                </div>
              )}
              <Button type="submit" className="w-full h-10 mt-2 font-semibold" disabled={loading}>
                {loading ? 'Please wait...' : mode === 'login' ? (<><LogIn className="w-4 h-4 mr-2" /> Sign In</>) : mode === 'signup' ? (<><UserPlus className="w-4 h-4 mr-2" /> Sign Up</>) : (<><KeyRound className="w-4 h-4 mr-2" /> Send Reset Link</>)}
              </Button>
            </form>
            <div className="mt-5 text-center space-y-2">
              {mode === 'login' && (
                <button type="button" onClick={() => setMode('forgot')} className="text-xs text-muted-foreground hover:text-primary transition-colors block w-full">
                  Forgot password?
                </button>
              )}
              <button type="button" onClick={() => setMode(mode === 'signup' ? 'login' : mode === 'login' ? 'signup' : 'login')} className="text-xs text-primary hover:underline font-medium transition-colors">
                {mode === 'signup' ? 'Already have an account? Sign in' : mode === 'login' ? "Don't have an account? Sign up" : 'Back to sign in'}
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground/60 mt-6">© {new Date().getFullYear()} iRobokid. All rights reserved.</p>
      </div>
    </div>
  );
};

export default Auth;
