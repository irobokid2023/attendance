import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Sun, Sunrise, Sunset, Sparkles, CalendarHeart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const THOUGHTS = [
  'Every small step you take today builds the path you walk tomorrow.',
  'Teaching one child well can change an entire generation.',
  'Progress, not perfection, is the goal worth chasing.',
  'Your patience today becomes someone else\u2019s confidence tomorrow.',
  'Consistency turns ordinary effort into extraordinary results.',
  'A kind word costs nothing but can carry someone all day.',
  'Great things are built quietly, one honest day at a time.',
  'Curiosity is the spark; encouragement is the fuel.',
  'The best way to predict the future is to teach it well.',
  'Showing up matters more than showing off.',
  'Every question a child asks is a door opening.',
  'Growth begins the moment comfort ends.',
  'Celebrate effort \u2014 results will follow.',
  'You are shaping minds that will shape the world.',
  'Small wins, stacked daily, become big victories.',
  'Be the reason someone believes in themselves today.',
  'Discipline is choosing what you want most over what you want now.',
  'Learning never exhausts the mind \u2014 it lights it up.',
  'Kindness is a skill worth practising every single day.',
  'Focus on what you can control, and let the rest go.',
  'Today is a fresh page \u2014 write something worth reading.',
  'Energy flows where attention goes.',
  'Mistakes are proof that you are trying something new.',
  'The classroom is a garden; patience is the water.',
  'Encourage loudly, correct gently.',
  'Your enthusiasm is contagious \u2014 spread it generously.',
  'Do the ordinary things extraordinarily well.',
  'Every record you keep today makes tomorrow easier.',
  'Strong roots make tall trees \u2014 build the basics well.',
  'Optimism is a strategy, not just a mood.',
  'Someone remembers a teacher who believed in them. Be that person.',
];

const OCCASIONS: Record<string, string> = {
  '01-01': "New Year's Day",
  '01-04': 'World Braille Day',
  '01-12': 'National Youth Day',
  '01-15': 'Indian Army Day',
  '01-24': 'International Day of Education',
  '01-26': 'Republic Day',
  '01-28': 'Data Privacy Day',
  '02-04': 'World Cancer Day',
  '02-11': 'International Day of Women & Girls in Science',
  '02-21': 'International Mother Language Day',
  '02-28': 'National Science Day',
  '03-03': 'World Wildlife Day',
  '03-08': "International Women's Day",
  '03-14': 'Pi Day',
  '03-20': 'International Day of Happiness',
  '03-21': 'World Poetry Day',
  '03-22': 'World Water Day',
  '04-02': 'World Autism Awareness Day',
  '04-07': 'World Health Day',
  '04-12': 'International Day of Human Space Flight',
  '04-22': 'Earth Day',
  '04-23': 'World Book Day',
  '05-01': 'Labour Day',
  '05-11': 'National Technology Day',
  '05-15': 'International Day of Families',
  '05-22': 'International Day for Biological Diversity',
  '06-05': 'World Environment Day',
  '06-08': 'World Oceans Day',
  '06-21': 'International Yoga Day',
  '07-11': 'World Population Day',
  '07-26': 'Kargil Vijay Diwas',
  '08-12': 'International Youth Day',
  '08-15': 'Independence Day',
  '08-29': 'National Sports Day',
  '09-01': 'World Letter Writing Day',
  '09-05': "Teachers' Day",
  '09-08': 'International Literacy Day',
  '09-14': 'Hindi Diwas',
  '09-21': 'International Day of Peace',
  '09-27': 'World Tourism Day',
  '10-01': 'International Day of Older Persons',
  '10-02': 'Gandhi Jayanti',
  '10-05': 'World Teachers\u2019 Day',
  '10-11': 'International Day of the Girl Child',
  '10-15': 'World Students\u2019 Day',
  '10-16': 'World Food Day',
  '11-11': 'National Education Day',
  '11-14': "Children's Day",
  '11-19': 'International Men\u2019s Day',
  '11-20': 'World Children\u2019s Day',
  '11-26': 'Constitution Day of India',
  '12-01': 'World AIDS Day',
  '12-03': 'International Day of Persons with Disabilities',
  '12-10': 'Human Rights Day',
  '12-11': 'International Mountain Day',
  '12-22': 'National Mathematics Day',
  '12-25': 'Christmas Day',
};

const getOccasion = (date: Date) => OCCASIONS[format(date, 'MM-dd')] || null;

/** Nearest upcoming observance within the next 60 days, used when today has none. */
const getNextOccasion = (date: Date) => {
  for (let i = 1; i <= 60; i++) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + i);
    const name = OCCASIONS[format(d, 'MM-dd')];
    if (name) return { name, date: d };
  }
  return null;
};

const WelcomeBanner = () => {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [now] = useState(() => new Date());

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setFullName(data?.full_name || ''));
  }, [user]);

  const hour = now.getHours();
  const { greeting, Icon } =
    hour < 12
      ? { greeting: 'Good morning', Icon: Sunrise }
      : hour < 17
        ? { greeting: 'Good afternoon', Icon: Sun }
        : { greeting: 'Good evening', Icon: Sunset };

  // Deterministic day-based rotation: a new thought each calendar day.
  const dayIndex = Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000,
  );
  const thought = THOUGHTS[dayIndex % THOUGHTS.length];

  const firstName = fullName ? fullName.split(' ')[0] : '';
  const occasion = getOccasion(now);
  const next = occasion ? null : getNextOccasion(now);
  const occasionLabel = occasion ?? next?.name ?? null;
  const occasionCaption = occasion
    ? 'Today we celebrate'
    : next
      ? `Coming up · ${format(next.date, 'dd MMM')}`
      : null;

  return (
    <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/10 via-accent/10 to-transparent animate-fade-in">
      <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="rounded-xl bg-primary/15 text-primary p-3 shrink-0">
            <Icon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground">
              {greeting}{firstName ? `, ${firstName}` : ''}!
            </h2>
            <p className="text-xs text-muted-foreground">{format(now, 'EEEE, dd MMMM yyyy')}</p>
            <p className="mt-2 text-sm text-foreground/90 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <span className="italic">{thought}</span>
            </p>
          </div>
        </div>
        {occasionLabel && (
          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-primary/20 bg-background/70 px-4 py-2 w-full sm:w-auto sm:max-w-[240px]">
            <CalendarHeart className="w-5 h-5 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{occasionCaption}</p>
              <p className="text-sm font-semibold leading-tight text-foreground">{occasionLabel}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WelcomeBanner;
