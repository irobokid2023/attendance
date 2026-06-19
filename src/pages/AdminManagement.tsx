import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ShieldCheck, KeyRound, Trash2, Search, Users, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import UsageAnalytics from '@/components/UsageAnalytics';

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'instructor';
  banned_until: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

const callAdmin = async (action: string, payload: any = {}) => {
  // Ensure session is still valid before invoking — stale tokens cause 401s.
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) {
    await supabase.auth.signOut();
    window.location.href = '/auth';
    throw new Error('Session expired. Please sign in again.');
  }
  const { data, error } = await supabase.functions.invoke('admin-users', { body: { action, payload } });
  if (error) {
    // 401 from edge fn = token rejected → force re-login
    if ((error as any).context?.status === 401 || /401|unauthorized/i.test(error.message)) {
      await supabase.auth.signOut();
      window.location.href = '/auth';
    }
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  return data;
};

const AdminManagement = () => {
  const { role, loading: authLoading, user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const load = async () => {
    setLoading(true);
    try {
      const { users } = await callAdmin('list');
      setUsers(users);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role === 'admin') load();
  }, [role]);

  if (authLoading) return null;
  if (role !== 'admin') return <Navigate to="/dashboard" replace />;

  const setRole = async (u: AdminUser, newRole: 'admin' | 'instructor') => {
    try {
      await callAdmin('set_role', { user_id: u.id, role: newRole });
      toast.success(`Role updated for ${u.email}`);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const toggleBan = async (u: AdminUser) => {
    const banned = !u.banned_until || new Date(u.banned_until) < new Date();
    try {
      await callAdmin('set_banned', { user_id: u.id, banned });
      toast.success(banned ? 'User disabled' : 'User enabled');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const resetPassword = async (u: AdminUser) => {
    try {
      await callAdmin('reset_password', { email: u.email, redirect_to: `${window.location.origin}/reset-password` });
      toast.success(`Password reset email sent to ${u.email}`);
    } catch (e: any) { toast.error(e.message); }
  };

  const deleteUser = async (u: AdminUser) => {
    try {
      await callAdmin('delete_user', { user_id: u.id });
      toast.success('User deleted');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const filtered = useMemo(() => users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase())
  ), [users, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold tracking-tight">Admin Management</h1>
            <p className="text-sm text-muted-foreground">Manage users, roles, access, and password resets.</p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base"><Users className="w-4 h-4" /> Users ({filtered.length})</CardTitle>
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search name or email" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading users...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Sign-in</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map(u => {
                    const isBanned = u.banned_until && new Date(u.banned_until) > new Date();
                    const isSelf = u.id === user?.id;
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name || '—'}{isSelf && <Badge variant="outline" className="ml-2">You</Badge>}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Select value={u.role} onValueChange={(v) => setRole(u, v as any)} disabled={isSelf}>
                            <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="instructor">Instructor</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch checked={!isBanned} onCheckedChange={() => toggleBan(u)} disabled={isSelf} />
                            <span className="text-xs text-muted-foreground">{isBanned ? 'Disabled' : 'Active'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : 'Never'}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => resetPassword(u)} title="Send password reset">
                            <KeyRound className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" disabled={isSelf} title="Delete user">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this user?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently removes <b>{u.email}</b> from the system. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteUser(u)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No users found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
            {!loading && filtered.length > 0 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </Button>
                  <span className="text-xs text-muted-foreground tabular-nums">Page {currentPage} of {totalPages}</span>
                  <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                    Next <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="pt-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-heading font-bold tracking-tight">Usage & Analytics</h2>
              <p className="text-sm text-muted-foreground">Daily app activity, database footprint, and platform metrics.</p>
            </div>
          </div>
          <UsageAnalytics />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminManagement;
