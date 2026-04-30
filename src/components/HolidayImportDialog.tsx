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
    const sampleRows: Array<[string, string, string, string]> = [
      ['2026-01-26', '2026-01-26', 'Republic Day', 'National holiday'],
      ['2026-08-15', '2026-08-15', 'Independence Day', 'National holiday'],
      ['2026-10-12', '2026-10-17', 'Dussehra Break', 'Festival holidays'],
    ];
    const excelSerialFromIsoDate = (isoDate: string) => {
      const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return isoDate;
      const [, y, m, d] = match;
      const utcMs = Date.UTC(Number(y), Number(m) - 1, Number(d));
      return utcMs / 86400000 + 25569;
    };
    const ws = XLSX.utils.aoa_to_sheet([headers]);

    const thinBorder = {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    };
    const headerStyle = {
      fill: { fgColor: { rgb: 'FFD966' } },
      font: { bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center' as const },
      border: thinBorder,
    };
    for (let i = 0; i < headers.length; i++) {
      const ref = XLSX.utils.encode_cell({ r: 0, c: i });
      if (ws[ref]) ws[ref].s = headerStyle;
    }

    // Write rows with timezone-safe Excel serial dates and plain text cells
    sampleRows.forEach((row, rIdx) => {
      const r = rIdx + 1;
      const dateStyle = { numFmt: 'yyyy-mm-dd', alignment: { horizontal: 'center' as const }, border: thinBorder };
      const textStyle = { alignment: { horizontal: 'left' as const }, border: thinBorder };

      ws[XLSX.utils.encode_cell({ r, c: 0 })] = { t: 'n', v: excelSerialFromIsoDate(row[0]), z: 'yyyy-mm-dd', s: dateStyle };
      ws[XLSX.utils.encode_cell({ r, c: 1 })] = { t: 'n', v: excelSerialFromIsoDate(row[1]), z: 'yyyy-mm-dd', s: dateStyle };
      ws[XLSX.utils.encode_cell({ r, c: 2 })] = { t: 's', v: row[2], s: textStyle };
      ws[XLSX.utils.encode_cell({ r, c: 3 })] = { t: 's', v: row[3], s: textStyle };
    });

    // Update sheet range to include all rows
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: sampleRows.length, c: headers.length - 1 } });

    ws['!cols'] = [
      { wch: 15 }, // Start Date
      { wch: 15 }, // End Date
      { wch: 25 }, // Event
      { wch: 35 }, // Description
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Holidays');
    XLSX.writeFile(wb, 'holiday_import_template.xlsx');
  };

  const parseDate = (value: any): string | null => {
    if (value === null || value === undefined || value === '') return null;
    const toIsoDate = (year: number, month: number, day: number) => {
      if (month < 1 || month > 12 || day < 1 || day > 31) return null;
      const dt = new Date(Date.UTC(year, month - 1, day));
      if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return null;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return toIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
    }

    if (typeof value === 'number') {
      const serial = Math.floor(value + 1e-9);
      const dt = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return toIsoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    }

    const str = String(value).trim();

    const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

    const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (dmy) {
      const day = Number(dmy[1]);
      const month = Number(dmy[2]);
      const year = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]);
      return toIsoDate(year, month, day);
    }

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
      const wb = XLSX.read(data, { cellDates: false, cellNF: true, raw: true } as any);
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
