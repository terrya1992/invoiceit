/*
 * InvoiceIt — free invoice generator
 * Binds to the Webflow page at /free-invoice-generator
 *
 * Expects these element IDs on the page:
 *   biz-name, biz-address, biz-vat, biz-email
 *   cli-name, cli-address
 *   inv-number, vat-rate, inv-date, inv-due
 *   payment-terms
 *   line-items (container), add-line (trigger)
 *   preview (render target), download-pdf (trigger)
 *
 * No dependencies at load. jsPDF is fetched on first download.
 */
(function () {
  'use strict';

  var JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  var STORE_KEY = 'invoiceit.business.v1';
  var SEQ_KEY = 'invoiceit.sequence.v1';

  var $ = function (id) { return document.getElementById(id); };

  /* ---------------------------------------------------------------
   * Styles for everything this script injects (item rows + preview).
   * Kept here rather than in Webflow so the markup and its styling
   * ship together.
   * ------------------------------------------------------------- */
  var CSS = [
    '.gen-line{display:grid;grid-template-columns:2.4fr .7fr 1fr auto;grid-column-gap:10px;align-items:center;margin-bottom:10px}',
    '.gen-line-remove{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:8px;border:1px solid #e6eaf1;background:#fff;color:#8b95a5;cursor:pointer;font-size:18px;line-height:1;user-select:none}',
    '.gen-line-remove:hover{border-color:#d8dee8;color:#14181f}',
    '.gen-line-head{display:grid;grid-template-columns:2.4fr .7fr 1fr auto;grid-column-gap:10px;margin-bottom:8px;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#8b95a5}',
    '.gen-line-head span:last-child{width:34px}',
    '@media (max-width:767px){.gen-line{grid-template-columns:1fr 1fr auto}.gen-line [data-desc]{grid-column:1/-1}.gen-line-head{display:none}}',

    '.iv-empty{display:flex;align-items:center;justify-content:center;height:480px;text-align:center;color:#8b95a5;font-size:15px;line-height:1.6;padding:0 32px}',
    '.iv-doc{font-size:13px;line-height:1.5;color:#14181f}',
    '.iv-head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding-bottom:28px;border-bottom:2px solid #14181f}',
    '.iv-biz{font-size:17px;font-weight:700;letter-spacing:-.01em;margin-bottom:6px}',
    '.iv-word{font-size:26px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#2563eb;text-align:right}',
    '.iv-num{font-size:14px;font-weight:600;text-align:right;margin-top:4px}',
    '.iv-muted{color:#5b6472}',
    '.iv-ghost{color:#c3cddd}',
    '.iv-meta{display:grid;grid-template-columns:1fr auto;gap:32px;padding-top:24px;padding-bottom:28px}',
    '.iv-cap{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8b95a5;margin-bottom:5px}',
    '.iv-strong{font-weight:600}',
    '.iv-dates{text-align:right}',
    '.iv-dates-row{margin-bottom:10px}',
    '.iv-table{width:100%;border-collapse:collapse}',
    '.iv-table th{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8b95a5;text-align:left;padding:0 0 8px;border-bottom:1px solid #e6eaf1}',
    '.iv-table th.iv-r,.iv-table td.iv-r{text-align:right}',
    '.iv-table td{padding:11px 0;border-bottom:1px solid #f1f4f9;vertical-align:top}',
    '.iv-table td.iv-r{white-space:nowrap;padding-left:12px}',
    '.iv-totals{display:flex;justify-content:flex-end;padding-top:16px}',
    '.iv-totals-inner{width:220px}',
    '.iv-trow{display:flex;justify-content:space-between;padding:6px 0;color:#5b6472}',
    '.iv-trow-total{border-top:2px solid #14181f;margin-top:8px;padding-top:12px;color:#14181f;font-weight:700;font-size:16px}',
    '.iv-terms{margin-top:32px;padding-top:20px;border-top:1px solid #e6eaf1}'
  ].join('');

  function injectStyles() {
    if ($('invoiceit-gen-styles')) return;
    var s = document.createElement('style');
    s.id = 'invoiceit-gen-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ---------------------------------------------------------------
   * Helpers
   * ------------------------------------------------------------- */
  function money(n) {
    return '\u00A3' + (Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function num(v) {
    var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Renders a value, or a ghosted placeholder when the field is empty.
  function orGhost(value, placeholder) {
    if (value && String(value).trim()) return esc(value);
    return '<span class="iv-ghost">' + esc(placeholder) + '</span>';
  }

  function ukDate(d) {
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  function val(id) {
    var el = $(id);
    return el ? el.value.trim() : '';
  }

  /* ---------------------------------------------------------------
   * Line items
   * ------------------------------------------------------------- */
  function lineRow() {
    var row = document.createElement('div');
    row.className = 'gen-line';
    row.innerHTML =
      '<input type="text" class="gen-input" data-desc placeholder="What are you billing for?">' +
      '<input type="text" class="gen-input" data-qty placeholder="1" inputmode="decimal">' +
      '<input type="text" class="gen-input" data-rate placeholder="0.00" inputmode="decimal">' +
      '<div class="gen-line-remove" data-remove title="Remove this line">\u00D7</div>';
    return row;
  }

  function addLine(focus) {
    var box = $('line-items');
    if (!box) return;
    var row = lineRow();
    box.appendChild(row);
    if (focus) row.querySelector('[data-desc]').focus();
    render();
  }

  function readLines() {
    var out = [];
    var rows = document.querySelectorAll('#line-items .gen-line');
    for (var i = 0; i < rows.length; i++) {
      var desc = rows[i].querySelector('[data-desc]').value.trim();
      var qtyRaw = rows[i].querySelector('[data-qty]').value.trim();
      var rateRaw = rows[i].querySelector('[data-rate]').value.trim();
      if (!desc && !qtyRaw && !rateRaw) continue;
      var qty = qtyRaw === '' ? 1 : num(qtyRaw);
      var rate = num(rateRaw);
      out.push({ desc: desc, qty: qty, rate: rate, amount: qty * rate });
    }
    return out;
  }

  function totals(lines) {
    var sub = 0;
    for (var i = 0; i < lines.length; i++) sub += lines[i].amount;
    var rate = num(val('vat-rate'));
    var vat = sub * (rate / 100);
    return { sub: sub, vatRate: rate, vat: vat, total: sub + vat };
  }

  /* ---------------------------------------------------------------
   * Preview
   * ------------------------------------------------------------- */
  function render() {
    var box = $('preview');
    if (!box) return;

    var lines = readLines();
    var t = totals(lines);
    var hasAnything = val('biz-name') || val('cli-name') || lines.length;

    if (!hasAnything) {
      box.innerHTML =
        '<div class="iv-empty">Start filling in the form and your invoice will build here, line by line.</div>';
      return;
    }

    var rowsHtml = '';
    if (lines.length) {
      for (var i = 0; i < lines.length; i++) {
        rowsHtml +=
          '<tr>' +
          '<td>' + orGhost(lines[i].desc, 'Untitled item') + '</td>' +
          '<td class="iv-r">' + lines[i].qty + '</td>' +
          '<td class="iv-r">' + money(lines[i].rate) + '</td>' +
          '<td class="iv-r"><strong>' + money(lines[i].amount) + '</strong></td>' +
          '</tr>';
      }
    } else {
      rowsHtml = '<tr><td colspan="4" class="iv-ghost" style="padding:16px 0">No items yet</td></tr>';
    }

    var vatLine = t.vatRate
      ? '<div class="iv-trow"><span>VAT at ' + t.vatRate + '%</span><span>' + money(t.vat) + '</span></div>'
      : '';

    var vatNo = val('biz-vat')
      ? '<div class="iv-muted">VAT No. ' + esc(val('biz-vat')) + '</div>'
      : '';

    var email = val('biz-email')
      ? '<div class="iv-muted">' + esc(val('biz-email')) + '</div>'
      : '';

    var terms = val('payment-terms')
      ? '<div class="iv-terms"><div class="iv-cap">Payment details</div><div class="iv-muted">' +
        esc(val('payment-terms')) + '</div></div>'
      : '';

    box.innerHTML =
      '<div class="iv-doc">' +
        '<div class="iv-head">' +
          '<div>' +
            '<div class="iv-biz">' + orGhost(val('biz-name'), 'Your business name') + '</div>' +
            '<div class="iv-muted">' + orGhost(val('biz-address'), 'Your address') + '</div>' +
            vatNo + email +
          '</div>' +
          '<div>' +
            '<div class="iv-word">Invoice</div>' +
            '<div class="iv-num">' + orGhost(val('inv-number'), 'INV-0001') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="iv-meta">' +
          '<div>' +
            '<div class="iv-cap">Bill to</div>' +
            '<div class="iv-strong">' + orGhost(val('cli-name'), 'Client name') + '</div>' +
            '<div class="iv-muted">' + orGhost(val('cli-address'), 'Client address') + '</div>' +
          '</div>' +
          '<div class="iv-dates">' +
            '<div class="iv-dates-row"><div class="iv-cap">Invoice date</div>' +
              orGhost(val('inv-date'), '—') + '</div>' +
            '<div><div class="iv-cap">Due date</div>' +
              orGhost(val('inv-due'), '—') + '</div>' +
          '</div>' +
        '</div>' +
        '<table class="iv-table">' +
          '<thead><tr><th>Description</th><th class="iv-r">Qty</th>' +
          '<th class="iv-r">Rate</th><th class="iv-r">Amount</th></tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
        '</table>' +
        '<div class="iv-totals"><div class="iv-totals-inner">' +
          '<div class="iv-trow"><span>Subtotal</span><span>' + money(t.sub) + '</span></div>' +
          vatLine +
          '<div class="iv-trow iv-trow-total"><span>Total due</span><span>' + money(t.total) + '</span></div>' +
        '</div></div>' +
        terms +
      '</div>';
  }

  /* ---------------------------------------------------------------
   * Remembering the user's own details (this device only)
   * ------------------------------------------------------------- */
  var REMEMBER = ['biz-name', 'biz-address', 'biz-vat', 'biz-email', 'payment-terms'];

  function saveBusiness() {
    try {
      var data = {};
      REMEMBER.forEach(function (id) { data[id] = val(id); });
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) { /* private mode, storage full — not worth interrupting anyone over */ }
  }

  function loadBusiness() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      REMEMBER.forEach(function (id) {
        if (data[id] && $(id)) $(id).value = data[id];
      });
    } catch (e) { /* ignore */ }
  }

  function nextInvoiceNumber() {
    var n = 1;
    try {
      var stored = parseInt(localStorage.getItem(SEQ_KEY), 10);
      if (!isNaN(stored)) n = stored + 1;
    } catch (e) { /* ignore */ }
    return 'INV-' + String(n).padStart(4, '0');
  }

  function bumpSequence() {
    var m = /(\d+)\s*$/.exec(val('inv-number'));
    if (!m) return;
    try { localStorage.setItem(SEQ_KEY, String(parseInt(m[1], 10))); } catch (e) { /* ignore */ }
  }

  /* ---------------------------------------------------------------
   * PDF
   * ------------------------------------------------------------- */
  function loadJsPDF() {
    return new Promise(function (resolve, reject) {
      if (window.jspdf && window.jspdf.jsPDF) return resolve(window.jspdf.jsPDF);
      var s = document.createElement('script');
      s.src = JSPDF_CDN;
      s.onload = function () {
        if (window.jspdf && window.jspdf.jsPDF) resolve(window.jspdf.jsPDF);
        else reject(new Error('jsPDF loaded but not found on window'));
      };
      s.onerror = function () { reject(new Error('Could not load the PDF library')); };
      document.head.appendChild(s);
    });
  }

  function buildPdf(jsPDF) {
    var doc = new jsPDF({ unit: 'mm', format: 'a4' });
    var W = 210, M = 18;
    var right = W - M;
    var y = M + 6;

    var lines = readLines();
    var t = totals(lines);

    // Header — business (left) / INVOICE (right)
    doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(20, 24, 31);
    doc.text(val('biz-name') || 'Your business', M, y);

    doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(37, 99, 235);
    doc.text('INVOICE', right, y, { align: 'right' });

    y += 6;
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(91, 100, 114);
    var addr = doc.splitTextToSize(val('biz-address') || '', 80);
    if (addr.length && addr[0]) { doc.text(addr, M, y); y += addr.length * 4; }
    if (val('biz-vat')) { doc.text('VAT No. ' + val('biz-vat'), M, y); y += 4; }
    if (val('biz-email')) { doc.text(val('biz-email'), M, y); y += 4; }

    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(20, 24, 31);
    doc.text(val('inv-number') || 'INV-0001', right, M + 12, { align: 'right' });

    y = Math.max(y, M + 20) + 6;
    doc.setDrawColor(20, 24, 31).setLineWidth(0.5).line(M, y, right, y);
    y += 9;

    // Bill to / dates
    doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(139, 149, 165);
    doc.text('BILL TO', M, y);
    doc.text('INVOICE DATE', right - 34, y);
    doc.text('DUE DATE', right, y, { align: 'right' });

    y += 5;
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(20, 24, 31);
    doc.text(val('cli-name') || '—', M, y);
    doc.setFont('helvetica', 'normal').setFontSize(9);
    doc.text(val('inv-date') || '—', right - 34, y);
    doc.text(val('inv-due') || '—', right, y, { align: 'right' });

    y += 5;
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(91, 100, 114);
    var caddr = doc.splitTextToSize(val('cli-address') || '', 80);
    if (caddr.length && caddr[0]) { doc.text(caddr, M, y); y += caddr.length * 4; }

    y += 8;

    // Table header
    var colQty = right - 62, colRate = right - 38, colAmt = right;
    doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(139, 149, 165);
    doc.text('DESCRIPTION', M, y);
    doc.text('QTY', colQty, y, { align: 'right' });
    doc.text('RATE', colRate, y, { align: 'right' });
    doc.text('AMOUNT', colAmt, y, { align: 'right' });
    y += 2.5;
    doc.setDrawColor(230, 234, 241).setLineWidth(0.2).line(M, y, right, y);
    y += 6;

    // Rows
    doc.setFontSize(9.5);
    for (var i = 0; i < lines.length; i++) {
      if (y > 250) { doc.addPage(); y = M + 6; }
      var d = doc.splitTextToSize(lines[i].desc || 'Untitled item', 95);
      doc.setFont('helvetica', 'normal').setTextColor(20, 24, 31);
      doc.text(d, M, y);
      doc.text(String(lines[i].qty), colQty, y, { align: 'right' });
      doc.text(money(lines[i].rate), colRate, y, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(money(lines[i].amount), colAmt, y, { align: 'right' });
      y += Math.max(d.length * 4.2, 5) + 3;
      doc.setDrawColor(241, 244, 249).line(M, y - 2, right, y - 2);
    }

    // Totals
    y += 5;
    if (y > 245) { doc.addPage(); y = M + 6; }
    var labelX = right - 42;
    doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(91, 100, 114);
    doc.text('Subtotal', labelX, y);
    doc.text(money(t.sub), colAmt, y, { align: 'right' });
    y += 5.5;
    if (t.vatRate) {
      doc.text('VAT at ' + t.vatRate + '%', labelX, y);
      doc.text(money(t.vat), colAmt, y, { align: 'right' });
      y += 5.5;
    }
    y += 1;
    doc.setDrawColor(20, 24, 31).setLineWidth(0.5).line(labelX, y, right, y);
    y += 6;
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(20, 24, 31);
    doc.text('Total due', labelX, y);
    doc.text(money(t.total), colAmt, y, { align: 'right' });

    // Payment details
    if (val('payment-terms')) {
      y += 14;
      if (y > 265) { doc.addPage(); y = M + 6; }
      doc.setDrawColor(230, 234, 241).setLineWidth(0.2).line(M, y - 6, right, y - 6);
      doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(139, 149, 165);
      doc.text('PAYMENT DETAILS', M, y);
      y += 5;
      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(91, 100, 114);
      doc.text(doc.splitTextToSize(val('payment-terms'), right - M), M, y);
    }

    return doc;
  }

  function filename() {
    var n = (val('inv-number') || 'invoice').replace(/[^a-z0-9\-_]/gi, '-');
    var c = val('cli-name').replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '-');
    return (c ? n + '-' + c : n).toLowerCase() + '.pdf';
  }

  function onDownload() {
    var btn = $('download-pdf');
    var lines = readLines();

    if (!lines.length) {
      flash(btn, 'Add at least one item first');
      return;
    }

    var original = btn.textContent;
    btn.textContent = 'Building your PDF…';
    btn.style.pointerEvents = 'none';

    loadJsPDF()
      .then(function (jsPDF) {
        buildPdf(jsPDF).save(filename());
        bumpSequence();
        saveBusiness();
        btn.textContent = original;
        btn.style.pointerEvents = '';
        var capture = document.querySelector('.capture');
        if (capture && capture.scrollIntoView) {
          capture.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      })
      .catch(function (err) {
        btn.textContent = original;
        btn.style.pointerEvents = '';
        flash(btn, 'PDF failed — check your connection and try again');
        if (window.console) console.error('[InvoiceIt]', err);
      });
  }

  function flash(btn, message) {
    var note = document.getElementById('gen-flash');
    if (!note) {
      note = document.createElement('div');
      note.id = 'gen-flash';
      note.className = 'gen-hint';
      note.style.color = '#b4232a';
      note.style.textAlign = 'center';
      btn.parentNode.appendChild(note);
    }
    note.textContent = message;
    clearTimeout(note._t);
    note._t = setTimeout(function () { note.textContent = ''; }, 4000);
  }

  /* ---------------------------------------------------------------
   * Wiring
   * ------------------------------------------------------------- */
  function init() {
    if (!$('preview') || !$('line-items')) return; // not the generator page

    injectStyles();

    // Column headings above the item rows
    var head = document.createElement('div');
    head.className = 'gen-line-head';
    head.innerHTML = '<span>Description</span><span>Qty</span><span>Rate</span><span></span>';
    $('line-items').parentNode.insertBefore(head, $('line-items'));

    loadBusiness();

    if (!val('inv-number')) $('inv-number').value = nextInvoiceNumber();
    if (!val('inv-date')) $('inv-date').value = ukDate(new Date());
    if (!val('inv-due')) {
      var due = new Date();
      due.setDate(due.getDate() + 30);
      $('inv-due').value = ukDate(due);
    }

    addLine(false);

    // The invoice panel is a Webflow form; stop Enter from submitting it.
    var form = $('biz-name') && $('biz-name').closest('form');
    if (form) {
      form.setAttribute('novalidate', 'novalidate');
      form.addEventListener('submit', function (e) { e.preventDefault(); });
    }

    // Any input anywhere in the panel re-renders the preview.
    document.addEventListener('input', function (e) {
      if (e.target.closest && e.target.closest('.gen-panel')) render();
    });
    document.addEventListener('change', function (e) {
      if (e.target.closest && e.target.closest('.gen-panel')) render();
    });

    $('add-line').addEventListener('click', function () { addLine(true); });

    $('line-items').addEventListener('click', function (e) {
      if (!e.target.hasAttribute('data-remove')) return;
      var rows = document.querySelectorAll('#line-items .gen-line');
      if (rows.length === 1) {
        // Keep one row on screen — an empty container reads as broken.
        rows[0].querySelectorAll('input').forEach(function (i) { i.value = ''; });
      } else {
        e.target.closest('.gen-line').remove();
      }
      render();
    });

    $('download-pdf').addEventListener('click', onDownload);

    // Remember business details as they're typed, not just on download.
    REMEMBER.forEach(function (id) {
      if ($(id)) $(id).addEventListener('blur', saveBusiness);
    });

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
