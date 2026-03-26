import XLSX from 'xlsx-js-style';
import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function exportSchoolsAsZip(schoolIds: string[]) {
  const [schoolsRes, classesRes, studentsRes, attendanceRes] = await Promise.all([
    supabase.from('schools').select('*').in('id', schoolIds),
    supabase.from('classes').select('*').in('school_id', schoolIds),
    supabase.from('students').select('*'),
    supabase.from('attendance').select('*'),
  ]);

  const schools = schoolsRes.data ?? [];
  const allClasses = classesRes.data ?? [];
  const allStudents = studentsRes.data ?? [];
  const allAttendance = attendanceRes.data ?? [];

  const classSchoolMap: Record<string, string> = {};
  allClasses.forEach((c) => { classSchoolMap[c.id] = c.school_id; });

  const zip = new JSZip();

  for (const school of schools) {
    const wb = XLSX.utils.book_new();

    // Sheet 1: School Info
    const infoRows = [
      ['School Name', school.name],
      ['Address', school.address ?? ''],
      ['Days', (school.days ?? []).join(', ')],
      ['IR Coordinator Name', school.ir_coordinator_name ?? ''],
      ['IR Coordinator Mobile', school.ir_coordinator_mobile ?? ''],
      ['Primary Coordinator Name', school.primary_coordinator_name ?? ''],
      ['Primary Coordinator Mobile', school.primary_coordinator_mobile ?? ''],
      ['Secondary Coordinator Name', school.secondary_coordinator_name ?? ''],
      ['Secondary Coordinator Mobile', school.secondary_coordinator_mobile ?? ''],
    ];
    const infoSheet = XLSX.utils.aoa_to_sheet([['Field', 'Value'], ...infoRows]);
    infoSheet['!cols'] = [{ wch: 30 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, infoSheet, 'School Info');

    // One sheet per class with attendance
    const schoolClasses = allClasses.filter((c) => c.school_id === school.id);

    for (const cls of schoolClasses) {
      const classStudents = allStudents.filter((s) => s.class_id === cls.id);
      const classAttendance = allAttendance.filter((a) => a.class_id === cls.id);

      // Get unique dates sorted
      const uniqueDates = [...new Set(classAttendance.map((a) => a.date))].sort();

      // Build date info headers
      const dateHeaders = uniqueDates.map((d) => {
        const parsed = parseISO(d);
        return format(parsed, 'dd/MM/yyyy');
      });
      const dayHeaders = uniqueDates.map((d) => {
        const parsed = parseISO(d);
        return DAY_NAMES[parsed.getDay()];
      });
      // Get topic per date
      const topicByDate: Record<string, string> = {};
      classAttendance.forEach((a) => {
        if (a.topic && !topicByDate[a.date]) topicByDate[a.date] = a.topic;
      });
      const topicHeaders = uniqueDates.map((d) => topicByDate[d] ?? '');

      // Build attendance lookup: student_id -> date -> status
      const statusMap: Record<string, Record<string, string>> = {};
      classAttendance.forEach((a) => {
        if (!statusMap[a.student_id]) statusMap[a.student_id] = {};
        statusMap[a.student_id][a.date] = a.status;
      });

      // Build rows
      // Build class display name for title row
      const classDisplayName = [cls.name, cls.grade, cls.div].filter(Boolean).join(' - ') + (cls.instructor_names ? ` | ${cls.instructor_names}` : '') + (cls.day ? ` | ${cls.day}` : '') + (cls.timing ? ` | ${cls.timing}` : '') + (cls.venue ? ` | ${cls.venue}` : '');
      const titleRow = [classDisplayName];
      const header1 = ['Student Name', 'Grade', 'Division', 'Parent Email 1', 'Parent Email 2', 'Parent Mobile 1', 'Parent Mobile 2', 'Total', ...dateHeaders];
      const header2 = ['', '', '', '', '', '', '', '', ...dayHeaders];
      const header3 = ['', '', '', '', '', '', '', '', ...topicHeaders];

      const dataRows = classStudents.map((s) => {
        const statuses = uniqueDates.map((d) => {
          const st = statusMap[s.id]?.[d] ?? '';
          if (st === 'present') return 'P';
          if (st === 'absent') return 'A';
          return '';
        });
        const attended = statuses.filter((x) => x === 'P').length;
        return [s.full_name, s.grade ?? '', s.div ?? '', s.parent_email_1 ?? '', s.parent_email_2 ?? '', s.parent_mobile_1 ?? '', s.parent_mobile_2 ?? '', `${attended} / ${uniqueDates.length}`, ...statuses];
      });

      const sheetData = [titleRow, header1, header2, header3, ...dataRows];
      const sheet = XLSX.utils.aoa_to_sheet(sheetData);

      // Define thin border style
      const thinBorder = {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } },
      };

      const statusColStart = 8;
      const dataRowStart = 4; // shifted by 1 for title row
      const totalCols = statusColStart + uniqueDates.length;

      // Style title row - merge across all columns
      sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }];
      const titleCellRef = XLSX.utils.encode_cell({ r: 0, c: 0 });
      if (!sheet[titleCellRef]) sheet[titleCellRef] = { v: classDisplayName, t: 's' };
      sheet[titleCellRef].s = { font: { bold: true, sz: 14, color: { rgb: '000000' } }, alignment: { horizontal: 'center' }, border: thinBorder };

      // Apply color coding to attendance status cells (P=green, A=red)
      for (let ri = 0; ri < dataRows.length; ri++) {
        for (let ci = 0; ci < uniqueDates.length; ci++) {
          const cellRef = XLSX.utils.encode_cell({ r: dataRowStart + ri, c: statusColStart + ci });
          const cell = sheet[cellRef];
          if (!cell) continue;
          const val = cell.v;
          if (val === 'P') {
            cell.s = { fill: { fgColor: { rgb: 'C6EFCE' } }, font: { color: { rgb: '006100' }, bold: true }, alignment: { horizontal: 'center' }, border: thinBorder };
          } else if (val === 'A') {
            cell.s = { fill: { fgColor: { rgb: 'FFC7CE' } }, font: { color: { rgb: '9C0006' }, bold: true }, alignment: { horizontal: 'center' }, border: thinBorder };
          }
        }
        // Apply borders to non-status data cells in this row
        for (let ci = 0; ci < statusColStart; ci++) {
          const cellRef = XLSX.utils.encode_cell({ r: dataRowStart + ri, c: ci });
          if (!sheet[cellRef]) sheet[cellRef] = { v: '', t: 's' };
          sheet[cellRef].s = { ...(sheet[cellRef].s || {}), border: thinBorder };
        }
      }

      // Style header rows (rows 1-3) with yellow background and borders
      for (let ci = 0; ci < totalCols; ci++) {
        for (let ri = 1; ri < 4; ri++) {
          const cellRef = XLSX.utils.encode_cell({ r: ri, c: ci });
          if (!sheet[cellRef]) sheet[cellRef] = { v: '', t: 's' };
          sheet[cellRef].s = { fill: { fgColor: { rgb: 'FFD966' } }, font: { bold: true, color: { rgb: '000000' } }, alignment: { horizontal: 'center' }, border: thinBorder };
        }
      }

      sheet['!cols'] = [
        { wch: 25 }, { wch: 8 }, { wch: 8 }, { wch: 25 }, { wch: 25 }, { wch: 16 }, { wch: 16 }, { wch: 6 },
        ...uniqueDates.map(() => ({ wch: 12 })),
      ];

      // Use sequential sheet names: Sheet1, Sheet2, etc.
      const sheetIndex = wb.SheetNames.length;
      const sheetName = `Sheet${sheetIndex}`;
      XLSX.utils.book_append_sheet(wb, sheet, sheetName);
    }

    const fileName = `${school.name.replace(/[^a-zA-Z0-9 ]/g, '').trim()}.xlsx`;
    const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    zip.file(fileName, wbOut);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'schools_export.zip';
  a.click();
  URL.revokeObjectURL(url);
}
