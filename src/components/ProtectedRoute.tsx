import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const ProtectedRoute = ({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) => {
  const { user, role, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Users without an assigned role have no access until an admin approves them.
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-semibold">Access pending approval</h1>
          <p className="text-muted-foreground">
            Your account has been created but no role has been assigned yet.
            Please contact an administrator to get access.
          </p>
          <button
            onClick={() => signOut()}
            className="mt-2 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (adminOnly && role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export default ProtectedRoute;
