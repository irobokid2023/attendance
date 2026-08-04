interface PdfSection {
  heading: string;
  headers: string[];
  rows: (string | number)[][];
  /** Optional accent colour override (hex). */
  accent?: string;
}

interface Kpi {
  label: string;
  value: string | number;
}

interface MultiPdfOptions {
  title: string;
  subtitle?: string;
  kpis?: Kpi[];
  sections: PdfSection[];
}

const ACCENTS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#4f46e5'];

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const isPercentHeader = (h: string) => /%|rate|completion/i.test(h);

const pctCell = (value: string | number) => {
  const n = Number(String(value).replace('%', ''));
  if (Number.isNaN(n)) return { bg: '', fg: '' };
  if (n >= 80) return { bg: '#dcfce7', fg: '#166534' };
  if (n >= 60) return { bg: '#fef3c7', fg: '#92400e' };
  return { bg: '#fee2e2', fg: '#991b1b' };
};

export function exportMultiTablePdf({ title, subtitle, kpis = [], sections }: MultiPdfOptions) {
  const w = window.open('', '_blank');
  if (!w) return;

  const kpiHtml = kpis.length
    ? `<div class="kpis">${kpis
        .map(
          (k, i) => `<div class="kpi" style="border-top:4px solid ${ACCENTS[i % ACCENTS.length]}">
            <div class="kpi-label">${esc(k.label)}</div>
            <div class="kpi-value" style="color:${ACCENTS[i % ACCENTS.length]}">${esc(k.value)}</div>
          </div>`,
        )
        .join('')}</div>`
    : '';

  const sectionHtml = sections
    .map((s, si) => {
      const accent = s.accent ?? ACCENTS[si % ACCENTS.length];
      const head = s.headers
        .map(h => `<th style="background:${accent};">${esc(h)}</th>`)
        .join('');
      const body = s.rows
        .map((row, ri) => {
          const cells = row
            .map((cell, ci) => {
              const header = s.headers[ci] ?? '';
              if (isPercentHeader(header)) {
                const { bg, fg } = pctCell(cell);
                return `<td style="text-align:right;font-weight:700;background:${bg};color:${fg};">${esc(cell)}${String(cell).includes('%') ? '' : '%'}</td>`;
              }
              const numeric = typeof cell === 'number' || /^-?\d+(\.\d+)?$/.test(String(cell));
              return `<td style="${numeric ? 'text-align:right;font-variant-numeric:tabular-nums;' : ''}">${esc(cell)}</td>`;
            })
            .join('');
          return `<tr class="${ri % 2 ? 'alt' : ''}">${cells}</tr>`;
        })
        .join('');
      return `<section>
        <h2 style="border-left:6px solid ${accent};">${esc(s.heading)}</h2>
        <table>
          <thead><tr>${head}</tr></thead>
          <tbody>${body || `<tr><td colspan="${s.headers.length}" class="empty">No data</td></tr>`}</tbody>
        </table>
      </section>`;
    })
    .join('');

  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; margin: 24px; color:#0f172a; }
  .header { background: linear-gradient(90deg,#1e3a8a,#2563eb 55%,#0891b2); color:#fff; padding:18px 22px; border-radius:10px; }
  .header h1 { font-size: 22px; margin: 0 0 4px; }
  .header .meta { font-size: 11px; opacity: .9; }
  .kpis { display:flex; flex-wrap:wrap; gap:10px; margin:16px 0 4px; }
  .kpi { flex:1 1 140px; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; background:#f8fafc; }
  .kpi-label { font-size:10px; text-transform:uppercase; letter-spacing:.5px; color:#64748b; }
  .kpi-value { font-size:18px; font-weight:800; margin-top:2px; }
  section { margin-top: 20px; }
  h2 { font-size: 14px; margin: 0 0 8px; padding-left: 8px; }
  table { border-collapse: collapse; width: 100%; font-size: 10px; }
  th { color:#fff; text-align:left; padding:7px 9px; font-size:10.5px; border:1px solid rgba(255,255,255,.35); }
  td { border:1px solid #e2e8f0; padding:6px 9px; }
  tr.alt td { background:#f8fafc; }
  td.empty { text-align:center; color:#94a3b8; padding:10px; }
  @media print {
    body { margin: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h2 { page-break-after: avoid; }
    table { page-break-inside: avoid; }
    section { page-break-inside: avoid; }
  }
</style></head><body>
<div class="header">
  <h1>${esc(title)}</h1>
  <div class="meta">${subtitle ? esc(subtitle) + ' &middot; ' : ''}Generated ${new Date().toLocaleString()}</div>
</div>
${kpiHtml}
${sectionHtml}
<script>window.onload=function(){window.print();}</script>
</body></html>`);
  w.document.close();
}
