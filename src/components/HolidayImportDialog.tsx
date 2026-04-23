import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { capitalizeFields } from '@/lib/utils';
import { logActivity } from '@/lib/activityLogger';
import XLSX from 'xlsx-js-style';
import { format, parse, isValid } from 'date-fns';

interface HolidayImportDialogProps {
  schools: { id: string; name: string }[];
  userId: string;
  onImported: () => void;
}

const HolidayImportDialog = ({ schools, userId, onImported }: HolidayImportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [schoolId, setSchoolId] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const headers = ['Start Date', 'End Date', 'Event', 'Description'];
    const sampleRows = [
      ['2026-01-26', '2026-01-26', 'Republic Day', 'National holiday'],
      ['2026-08-15', '2026-08-15', 'Independence Day', 'National holiday'],
      ['2026-10-12', '2026-10-17', 'Dussehra Break', 'Festival holidays'],
    ];
    const data = [headers, ...sampleRows];
    const ws = XLSX.utils.aoa_to_sheet(data);

    const headerStyle = {
      fill: { fgColor: { rgb: 'FFD966' } },
      font: { bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center' as const },
      border: {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } },
      },
    };
    for (let i = 0; i < headers.length; i++) {
      const ref = XLSX.utils.encode_cell({ r: 0, c: i });
      if (ws[ref]) ws[ref].s = headerStyle;
    }
    ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 35 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Holidays');
    XLSX.writeFile(wb, 'holiday_import_template.xlsx');
  };

  const parseDate = (value: any): string | null => {
    if (!value) return null;
    if (value instanceof Date && isValid(value)) {
      return format(value, 'yyyy-MM-dd');
    }
    const str = String(value).trim();
    const d1 = parse(str, 'yyyy-MM-dd', new Date());
    if (isValid(d1)) return format(d1, 'yyyy-MM-dd');
    const d2 = parse(str, 'dd-MM-yyyy', new Date());
    if (isValid(d2)) return format(d2, 'yyyy-MM-dd');
    const d3 = parse(str, 'dd/MM/yyyy', new Date());
    if (isValid(d3)) return format(d3, 'yyyy-MM-dd');
    return null;
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!schoolId) {
      toast.error('Please select a school first');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (rows.length === 0) {
        toast.error('No data found in file');
        setImporting(false);
        return;
      }

      const holidays: any[] = [];
      const errors: string[] = [];

      rows.forEach((row, idx) => {
        const event = String(row['Event'] || row['event'] || '').trim();
        const startDateRaw = row['Start Date'] || row['start date'] || row['Date'] || row['date'];
        const endDateRaw = row['End Date'] || row['end date'];
        const desc = String(row['Description'] || row['description'] || '').trim();

        if (!event) { errors.push(`Row ${idx + 2}: Missing event name`); return; }
        const parsedStart = parseDate(startDateRaw);
        if (!parsedStart) { errors.push(`Row ${idx + 2}: Invalid start date`); return; }
        const parsedEnd = parseDate(endDateRaw) || parsedStart;

        holidays.push(capitalizeFields({
          name: event,
          date: parsedStart,
          end_date: parsedEnd,
          school_id: schoolId,
          description: desc || null,
          created_by: userId,
        }, ['name', 'description']));
      });

      if (errors.length > 0) {
        toast.error(`${errors.length} error(s): ${errors.slice(0, 3).join('; ')}`);
      }

      if (holidays.length > 0) {
        const { error } = await supabase.from('holidays').insert(holidays);
        if (error) toast.error(error.message);
        else {
          const schoolName = schools.find((school) => school.id === schoolId)?.name ?? 'selected school';
          toast.success(`${holidays.length} holiday(s) imported!`);
          onImported();
          logActivity({
            action: 'imported',
            section: 'holidays',
            description: `Imported ${holidays.length} holiday(s) for "${schoolName}"`,
            metadata: { count: holidays.length, school_id: schoolId },
          });
          setOpen(false);
        }
      }
    } catch (_err: any) {
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
        <DialogHeader><DialogTitle>Import Holidays</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>School *</Label>
            <Select value={schoolId} onValueChange={setSchoolId}>
              <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
              <SelectContent>
                {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
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
            File must have columns: <strong>Start Date</strong>, <strong>End Date</strong>, <strong>Event</strong>, <strong>Description</strong>. Supported date formats: yyyy-MM-dd, dd-MM-yyyy, dd/MM/yyyy.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HolidayImportDialog;
