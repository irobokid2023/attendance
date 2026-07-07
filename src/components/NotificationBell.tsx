import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Bell, Send, X, ClipboardCheck, Upload, MessageSquareText, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

const CATEGORIES = [
  { id: 'attendance', label: 'Fill Attendance', icon: ClipboardCheck, defaultTitle: 'Attendance reminder', defaultMsg: 'Please fill today\'s attendance for your classes.' },
  { id: 'media', label: 'Upload Media', icon: Upload, defaultTitle: 'Upload media reminder', defaultMsg: 'Please upload today\'s class media to Drive.' },
  { id: 'topic', label: 'Topic of the Day', icon: MessageSquareText, defaultTitle: 'Topic of the Day reminder', defaultMsg: 'Please enter the Topic of the Day for your classes.' },
  { id: 'general', label: 'General', icon: Megaphone, defaultTitle: '', defaultMsg: '' },
];

const NotificationBell = () => {
  const { user, role } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [reads, setReads] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [category, setCategory] = useState('attendance');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    if (!user) return;
    const [{ data: notifs }, { data: rd }] = await Promise.all([
      (supabase as any).from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
      (supabase as any).from('notification_reads').select('notification_id').eq('user_id', user.id),
    ]);
    setItems(notifs ?? []);
    setReads(new Set((rd ?? []).map((r: any) => r.notification_id)));
  };

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = (supabase as any)
      .channel('notifications-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload: any) => {
        setItems(prev => [payload.new, ...prev]);
        toast.info(payload.new.title, { description: payload.new.message });
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [user]);

  const unread = useMemo(() => items.filter(i => !reads.has(i.id)).length, [items, reads]);

  const markRead = async (id: string) => {
    if (reads.has(id) || !user) return;
    setReads(prev => new Set(prev).add(id));
    await (supabase as any).from('notification_reads').insert({ notification_id: id, user_id: user.id });
  };

  const markAllRead = async () => {
    if (!user) return;
    const unreadIds = items.filter(i => !reads.has(i.id)).map(i => i.id);
    if (!unreadIds.length) return;
    setReads(new Set(items.map(i => i.id)));
    await (supabase as any).from('notification_reads').insert(unreadIds.map(id => ({ notification_id: id, user_id: user.id })));
  };

  const pickCategory = (id: string) => {
    setCategory(id);
    const c = CATEGORIES.find(x => x.id === id)!;
    setTitle(c.defaultTitle);
    setMessage(c.defaultMsg);
  };

  const send = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    setSending(true);
    const { error } = await (supabase as any).from('notifications').insert({
      title: title.trim(),
      message: message.trim() || null,
      category,
      created_by: user?.id ?? null,
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Notification sent to all users');
    setComposeOpen(false);
    load();
  };

  return (
    <>
      <Popover open={open} onOpenChange={o => { setOpen(o); if (o) markAllRead(); }}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-sm font-semibold">Notifications</span>
            {role === 'admin' && (
              <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => { setComposeOpen(true); setOpen(false); pickCategory('attendance'); }}>
                <Send className="w-3.5 h-3.5" /> New
              </Button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">No notifications yet</div>
            ) : items.map(n => {
              const cat = CATEGORIES.find(c => c.id === n.category) ?? CATEGORIES[3];
              const Icon = cat.icon;
              return (
                <div key={n.id} className="px-3 py-2.5 border-b last:border-0 hover:bg-muted/40">
                  <div className="flex items-start gap-2">
                    <Icon className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{n.title}</div>
                      {n.message && <div className="text-xs text-muted-foreground mt-0.5">{n.message}</div>}
                      <div className="text-[10px] text-muted-foreground mt-1">{format(parseISO(n.created_at), 'dd MMM, p')}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send notification to all users</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Category</Label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map(c => {
                  const I = c.icon;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pickCategory(c.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm text-left transition ${category === c.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                    >
                      <I className="w-4 h-4" /> {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Notification title" />
            </div>
            <div className="space-y-1.5">
              <Label>Message (optional)</Label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
            <Button onClick={send} disabled={sending}><Send className="w-4 h-4 mr-1.5" /> {sending ? 'Sending…' : 'Send to all'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NotificationBell;
