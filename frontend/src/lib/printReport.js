function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Shared A4 table print — matches dashboard/pharmacy letterhead style.
 * Uses iframe so the app shell (and route URL) is not part of the print content.
 * Date is not repeated in the body (browser print header already shows it when enabled).
 */
export function printReportTable({ title, columns = [], rows = [] }) {
  const logoUrl = `${window.location.origin}/brand/jadeed-logo.png?v=6`
  const safeTitle = escapeHtml(title || 'Report')
  const head = columns.map((col) => `<th>${escapeHtml(col)}</th>`).join('')
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('')
  const colSpan = Math.max(columns.length, 1)
  const count = rows.length

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Jadeed Rifah Rehab &amp; Care Center</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 12mm 14mm 12mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #12263f;
      font-family: "DM Sans", system-ui, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      width: 100%;
      max-width: 186mm;
      margin: 0 auto;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 8px;
      border-bottom: 1.5px solid #12263f;
      margin-bottom: 10px;
    }
    .head img {
      width: 42px;
      height: 42px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .head-text { min-width: 0; flex: 1; }
    .org {
      margin: 0;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #12263f;
    }
    .tagline {
      margin: 2px 0 0;
      font-size: 9px;
      color: #5b6b7c;
    }
    .title {
      margin: 0 0 4px;
      font-size: 14px;
      font-weight: 700;
      color: #12263f;
      line-height: 1.25;
    }
    .meta {
      margin: 0 0 10px;
      font-size: 9px;
      color: #5b6b7c;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: auto;
      font-size: 9.5px;
      line-height: 1.35;
    }
    th, td {
      border: 1px solid #c5ced8;
      padding: 5px 6px;
      text-align: left;
      vertical-align: top;
      word-break: break-word;
    }
    th {
      background: #f4f6f9;
      font-weight: 700;
      color: #12263f;
    }
    .foot {
      margin-top: 10px;
      padding-top: 6px;
      border-top: 1px solid #d9e1ec;
      font-size: 8px;
      color: #5b6b7c;
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .foot span { white-space: nowrap; }
  </style>
</head>
<body>
  <div class="sheet">
    <header class="head">
      <img src="${logoUrl}" alt="Jadeed Rifah" />
      <div class="head-text">
        <p class="org">Jadeed Rifah Rehab &amp; Care Center</p>
        <p class="tagline">Smart Rehab Management ERP</p>
      </div>
    </header>
    <h1 class="title">${safeTitle}</h1>
    <p class="meta">${count} row(s)</p>
    <table>
      <thead><tr>${head}</tr></thead>
      <tbody>${body || `<tr><td colspan="${colSpan}">No rows</td></tr>`}</tbody>
    </table>
    <footer class="foot">
      <span>For official use only</span>
      <span>Jadeed Rifah Rehab ERP</span>
    </footer>
  </div>
</body>
</html>`

  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.setAttribute('title', 'Print report')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;'
  document.body.appendChild(frame)

  const win = frame.contentWindow
  const doc = frame.contentDocument || win?.document
  if (!doc || !win) {
    document.body.removeChild(frame)
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  const cleanup = () => {
    setTimeout(() => {
      if (frame.parentNode) frame.parentNode.removeChild(frame)
    }, 500)
  }

  const runPrint = () => {
    try {
      win.focus()
      win.print()
    } finally {
      cleanup()
    }
  }

  const logo = doc.querySelector('img')
  if (logo && !logo.complete) {
    logo.onload = () => setTimeout(runPrint, 50)
    logo.onerror = () => setTimeout(runPrint, 50)
    setTimeout(runPrint, 1200)
  } else {
    setTimeout(runPrint, 80)
  }
}
