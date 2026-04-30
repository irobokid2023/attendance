import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Settings2, Palette, Bell, Save } from 'lucide-react';

interface AppSettings {
  id: string;
  app_name: string;
  tagline: string;
  primary_color: string;
  academic_year: string;
  default_class_duration_minutes: number;
  notify_holiday_alerts: boolean;
  notify_attendance_reminders: boolean;
  reminder_time: string;
}

const AdminSettings = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('app_settings').select('*').limit(1).maybeSingle();
    if (error) toast.error(error.message);
    else setSettings(data as AppSettings);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = (patch: Partial<AppSettings>) => setSettings(s => s ? { ...s, ...patch } : s);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const { id, ...payload } = settings;
    const { error } = await supabase.from('app_settings').update(payload).eq('id', id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success('Settings saved');
  };

  if (loading || !settings) {
    return (
      <DashboardLayout>
        <div className="py-12 text-center text-sm text-muted-foreground">Loading settings...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold tracking-tight">Admin Settings</h1>
            <p className="text-sm text-muted-foreground">Configure branding, defaults, and notifications.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Palette className="w-4 h-4" /> Branding</CardTitle>
            <CardDescription>How the app presents itself to users.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="app_name">App Name</Label>
                <Input id="app_name" value={settings.app_name} onChange={e => update({ app_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tagline">Tagline</Label>
                <Input id="tagline" value={settings.tagline} onChange={e => update({ tagline: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5 max-w-xs">
              <Label htmlFor="primary_color">Primary Color</Label>
              <div className="flex gap-2 items-center">
                <Input id="primary_color" type="color" value={settings.primary_color} onChange={e => update({ primary_color: e.target.value })} className="w-16 h-10 p-1" />
                <Input value={settings.primary_color} onChange={e => update({ primary_color: e.target.value })} className="flex-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Settings2 className="w-4 h-4" /> Defaults</CardTitle>
            <CardDescription>Default values used across the app.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="academic_year">Academic Year</Label>
                <Input id="academic_year" value={settings.academic_year} onChange={e => update({ academic_year: e.target.value })} placeholder="2025-2026" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="duration">Default Class Duration (minutes)</Label>
                <Input id="duration" type="number" min={15} max={240} value={settings.default_class_duration_minutes}
                  onChange={e => update({ default_class_duration_minutes: parseInt(e.target.value) || 60 })} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Bell className="w-4 h-4" /> Notifications</CardTitle>
            <CardDescription>Control alerts and reminders shown in the app.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <div className="text-sm font-medium">Holiday alerts</div>
                <div className="text-xs text-muted-foreground">Warn instructors when marking attendance on a holiday.</div>
              </div>
              <Switch checked={settings.notify_holiday_alerts} onCheckedChange={(v) => update({ notify_holiday_alerts: v })} />
            </div>
            <div className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <div className="text-sm font-medium">Attendance reminders</div>
                <div className="text-xs text-muted-foreground">Show a daily prompt to mark attendance.</div>
              </div>
              <Switch checked={settings.notify_attendance_reminders} onCheckedChange={(v) => update({ notify_attendance_reminders: v })} />
            </div>
            {settings.notify_attendance_reminders && (
              <div className="space-y-1.5 max-w-xs">
                <Label htmlFor="reminder_time">Reminder Time</Label>
                <Input id="reminder_time" type="time" value={settings.reminder_time?.slice(0,5) ?? '09:00'}
                  onChange={e => update({ reminder_time: e.target.value })} />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminSettings;
