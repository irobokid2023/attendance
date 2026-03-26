import XLSX from 'xlsx-js-style';

interface ExportExcelOptions {
  filename: string;
  sheetName?: string;
  rows: Record<string, any>[];
}

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

export function exportToExcel({ filename, sheetName = 'Sheet1', rows }: ExportExcelOptions) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const data = [headers, ...rows.map(r => headers.map(h => r[h] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Style headers
  for (let ci = 0; ci < headers.length; ci++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c: ci });
    if (ws[ref]) ws[ref].s = headerStyle;
  }

  // Borders on data
  for (let ri = 1; ri < data.length; ri++) {
    for (let ci = 0; ci < headers.length; ci++) {
      const ref = XLSX.utils.encode_cell({ r: ri, c: ci });
      if (!ws[ref]) ws[ref] = { v: '', t: 's' };
      ws[ref].s = { border: thinBorder };
    }
  }

  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 15) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
