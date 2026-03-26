interface PdfTableOptions {
  title: string;
  headers: string[];
  rows: string[][];
  filename: string;
}

export function exportToPdf({ title, headers, rows, filename }: PdfTableOptions) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const headerCells = headers.map(h => `<th style="border:1px solid #333;padding:6px 10px;background:#FFD966;font-weight:bold;font-size:11px;text-align:left;">${h}</th>`).join('');
  const bodyRows = rows.map(row =>
    `<tr>${row.map((cell, ci) => {
      let bg = '';
      if (cell === 'P') bg = 'background:#C6EFCE;color:#006100;text-align:center;font-weight:bold;';
      else if (cell === 'A') bg = 'background:#FFC7CE;color:#9C0006;text-align:center;font-weight:bold;';
      return `<td style="border:1px solid #ccc;padding:5px 8px;font-size:10px;${bg}">${cell}</td>`;
    }).join('')}</tr>`
  ).join('');

  printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 20px; }
  h1 { font-size: 18px; margin-bottom: 10px; }
  table { border-collapse: collapse; width: 100%; }
  @media print { body { margin: 10px; } }
</style></head><body>
<h1>${title}</h1>
<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>
<script>window.onload=function(){window.print();}</script>
</body></html>`);
  printWindow.document.close();
}
