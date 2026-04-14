import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, ChevronRight, ChevronLeft, School, BookOpen, Users, ClipboardCheck, Award, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const TOUR_KEY = 'onboarding_tour_completed';

const steps = [
  {
    icon: Sparkles,
    title: 'Welcome to iRobokid!',
    description: 'Let\'s take a quick tour to get you started with managing your STEM classes and attendance.',
    color: 'text-primary',
  },
  {
    icon: School,
    title: 'Add Your Schools',
    description: 'Start by adding the schools you teach at. Include coordinator details and operational days for each school.',
    color: 'text-primary',
  },
  {
    icon: BookOpen,
    title: 'Create Classes',
    description: 'Set up your STEM and Robotics programs under each school — including grade, division, timing, and session count.',
    color: 'text-accent',
  },
  {
    icon: Users,
    title: 'Enroll Students',
    description: 'Add students to each class with their details. You can also import them from Excel spreadsheets.',
    color: 'text-success',
  },
  {
    icon: ClipboardCheck,
    title: 'Mark Attendance',
    description: 'Track daily attendance for each class session. View stats and export reports anytime.',
    color: 'text-warning',
  },
  {
    icon: Award,
    title: 'Grade & Track Progress',
    description: 'Assign grades, set topics of the day, and monitor student progress across sessions. You\'re all set!',
    color: 'text-destructive',
  },
];

const OnboardingTour = () => {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_KEY);
    if (!completed) {
      const timer = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const complete = () => {
    localStorage.setItem(TOUR_KEY, 'true');
    setShow(false);
  };

  if (!show) return null;

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <Card className="w-full max-w-md mx-4 shadow-2xl border-primary/20">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center bg-muted', current.color)}>
              <Icon className="w-6 h-6" />
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2" onClick={complete}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <h3 className="text-lg font-heading font-bold text-foreground mb-2">{current.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">{current.description}</p>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 mb-5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/20'
                )}
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>

            {isLast ? (
              <Button size="sm" onClick={complete} className="gap-1">
                Get Started <Sparkles className="w-4 h-4" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep(s => s + 1)} className="gap-1">
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingTour;
