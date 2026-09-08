import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type CurriculumRow = { program_name: string; session_no: number; topic_name: string };

let cache: CurriculumRow[] | null = null;
let inflight: Promise<CurriculumRow[]> | null = null;

const loadCurriculum = async (): Promise<CurriculumRow[]> => {
  if (cache) return cache;
  if (!inflight) {
    inflight = (supabase as any)
      .from('curriculum')
      .select('program_name, session_no, topic_name')
      .order('program_name')
      .order('session_no')
      .then(({ data }: any) => {
        cache = (data ?? []) as CurriculumRow[];
        inflight = null;
        return cache;
      });
  }
  return inflight!;
};

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Program name of the selected class — suggestions for it are shown first */
  program?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

const TopicSuggestInput = ({ value, onChange, program, placeholder, className, required }: Props) => {
  const [rows, setRows] = useState<CurriculumRow[]>(cache ?? []);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadCurriculum().then(setRows); }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [] as CurriculumRow[];
    const scored = rows
      .filter((r) => r.topic_name?.toLowerCase().includes(q))
      .sort((a, b) => {
        const ap = program && a.program_name === program ? 0 : 1;
        const bp = program && b.program_name === program ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return (a.session_no ?? 0) - (b.session_no ?? 0);
      });
    const seen = new Set<string>();
    return scored.filter((r) => {
      const k = `${r.program_name}|${r.topic_name}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 5);
  }, [rows, value, program]);

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { if (value.trim()) setOpen(true); }}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {suggestions.map((r) => (
            <button
              key={`${r.program_name}-${r.session_no}-${r.topic_name}`}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => { e.preventDefault(); onChange(r.topic_name); setOpen(false); }}
            >
              {r.topic_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TopicSuggestInput;
