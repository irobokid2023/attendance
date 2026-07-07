import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLogger';
import XLSX from 'xlsx-js-style';

interface Props {
  programs: string[];
  userId: string;
  onImported: () => void;
}

const capitalize = (str: string) => (str ? str.replace(/\b\w/g, c => c.toUpperCase()) : str);

const CurriculumImportDialog = ({ programs, userId, onImported }: Props) => {
  const [open, setOpen] = useState(false);
  const [program, setProgram] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const headers = ['Session No', 'Topic Name'];
    const sample: Array<[number, string]> = [
      [1, 'Introduction'],
      [2, 'Basics'],
      [3, 'Hands-on Project'],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const thin = { top: { style: 'thin', color: { rgb: '000000' } }, bottom: { style: 'thin', color: { rgb: '000000' } }, left: { style: 'thin', color: { rgb: '000000' } }, right: { style: 'thin', color: { rgb: '000000' } } };
    const hStyle = { fill: { fgColor: { rgb: 'FFD966' } }, font: { bold: true }, alignment: { horizontal: 'center' as const }, border: thin };
    headers.forEach((_, i) => {
      const ref = XLSX.utils.encode_cell({ r: 0, c: i });
      if (ws[ref]) ws[ref].s = hStyle;
    });
    sample.forEach((row, rIdx) => {
      const r = rIdx + 1;
      ws[XLSX.utils.encode_cell({ r, c: 0 })] = { t: 'n', v: row[0], s: { alignment: { horizontal: 'center' as const }, border: thin } };
      ws[XLSX.utils.encode_cell({ r, c: 1 })] = { t: 's', v: row[1], s: { alignment: { horizontal: 'left' as const }, border: thin } };
    });
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: sample.length, c: 1 } });
    ws['!cols'] = [{ wch: 12 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Curriculum');
    XLSX.writeFile(wb, 'curriculum_import_template.xlsx');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!program) {
      toast.error('Please select a program first');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { raw: true } as any);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (rows.length === 0) { toast.error('No data found'); setImporting(false); return; }

      const entries: any[] = [];
      const errors: string[] = [];
      rows.forEach((row, idx) => {
        const sessionRaw = row['Session No'] ?? row['session no'] ?? row['Session'] ?? row['session'];
        const topic = String(row['Topic Name'] ?? row['topic name'] ?? row['Topic'] ?? '').trim();
        const sessionNum = parseInt(String(sessionRaw), 10);
        if (isNaN(sessionNum) || sessionNum <= 0) { errors.push(`Row ${idx + 2}: Invalid session no`); return; }
        if (!topic) { errors.push(`Row ${idx + 2}: Missing topic name`); return; }
        entries.push({ program_name: program, session_no: sessionNum, topic_name: capitalize(topic), created_by: userId });
      });

      if (errors.length) toast.error(`${errors.length} error(s): ${errors.slice(0, 3).join('; ')}`);

      if (entries.length) {
        const { error } = await (supabase as any).from('curriculum').upsert(entries, { onConflict: 'program_name,session_no' });
        if (error) toast.error(error.message);
        else {
          toast.success(`${entries.length} curriculum entries imported!`);
          logActivity({ action: 'imported', section: 'curriculum', description: `Imported ${entries.length} entries for "${program}"`, metadata: { count: entries.length, program } });
          onImported();
          setOpen(false);
        }
      }
    } catch {
      toast.error('Failed to parse file');
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="w-4 h-4 mr-2" /> Import</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Import Curriculum</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Program *</Label>
            <Select value={program} onValueChange={setProgram}>
              <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
              <SelectContent>
                {programs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" className="w-full" onClick={downloadTemplate}>
            <Download className="w-4 h-4 mr-2" /> Download Template
          </Button>

          <div className="space-y-2">
            <Label>Upload Excel File (.xlsx)</Label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              disabled={importing}
              className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            File must have columns: <strong>Session No</strong> and <strong>Topic Name</strong>. Existing sessions for this program will be overwritten.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CurriculumImportDialog;
