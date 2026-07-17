/*
 * InvoiceIt — free invoice generator v1.4
 * Adds template variants via ?template= URL parameter:
 *   vat        — VAT-first: 20% default, VAT number emphasised
 *   freelance  — Days/Hrs + Day rate columns
 *   contractor — Labour/Materials line types + CIS deduction
 *   blank      — the plain generator (default)
 */
(function () {
  'use strict';

  var JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  var STORE_KEY = 'invoiceit.business.v1';
  var SEQ_KEY = 'invoiceit.sequence.v1';

  var $ = function (id) { return document.getElementById(id); };

  /* ------------------------------------------------------------- */
  /* Templates                                                      */
  /* ------------------------------------------------------------- */
  var TEMPLATES = {
    blank: {
      title: 'Free invoice generator',
      sub: 'Fill in the details on the left and watch your invoice build on the right. Download it as a PDF when you are happy.',
      qtyLabel: 'Qty', rateLabel: 'Rate',
      qtyPlaceholder: '1', ratePlaceholder: '0.00',
      lineTypes: false, cis: false, defaultVat: null
    },
    vat: {
      title: 'VAT invoice generator',
      sub: 'A VAT invoice with the breakdown HMRC expects. Add your VAT number, pick the rate, and the maths is done for you.',
      qtyLabel: 'Qty', rateLabel: 'Rate',
      qtyPlaceholder: '1', ratePlaceholder: '0.00',
      lineTypes: false, cis: false, defaultVat: '20'
    },
    freelance: {
      title: 'Freelance invoice generator',
      sub: 'Built around day rates and hours. Put the days in, put your rate in, and send something that looks like you have done this before.',
      qtyLabel: 'Days / Hrs', rateLabel: 'Day rate',
      qtyPlaceholder: 'e.g. 5 days', ratePlaceholder: 'e.g. 350.00',
      lineTypes: false, cis: false, defaultVat: null
    },
    contractor: {
      title: 'Contractor invoice generator',
      sub: 'Labour and materials separated the way main contractors want them, with CIS deducted from labour only if it applies to you.',
      qtyLabel: 'Qty', rateLabel: 'Rate',
      qtyPlaceholder: '1', ratePlaceholder: '0.00',
      lineTypes: true, cis: true, defaultVat: null
    }
  };

  function activeTemplate() {
    try {
      var t = new URLSearchParams(location.search).get('template');
      if (t && TEMPLATES[t]) return TEMPLATES[t];
    } catch (e) { /* ancient browser */ }
    return TEMPLATES.blank;
  }
  var TPL = activeTemplate();

  /* ------------------------------------------------------------- */
  /* Injected styles                                                */
  /* ------------------------------------------------------------- */
  var GRID_PLAIN = '2.4fr .7fr 1fr auto';
  var GRID_TYPED = '2fr .9fr .7fr 1fr auto';
  var GRID = TPL.lineTypes ? GRID_TYPED : GRID_PLAIN;

  var CSS = [
    '.gen-line{display:grid;grid-template-columns:' + GRID + ';grid-column-gap:10px;align-items:center;margin-bottom:10px}',
    '.gen-line-remove{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:8px;border:1px solid #e6eaf1;background:#fff;color:#8b95a5;cursor:pointer;font-size:18px;line-height:1;user-select:none}',
    '.gen-line-remove:hover{border-color:#d8dee8;color:#14181f}',
    '.gen-line-head{display:grid;grid-template-columns:' + GRID + ';grid-column-gap:10px;margin-bottom:8px;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#8b95a5}',
    '.gen-line-head span:last-child{width:34px}',
    '@media (max-width:767px){.gen-line{grid-template-columns:1fr 1fr 34px}.gen-line [data-desc]{grid-column:1/-1}' + (TPL.lineTypes ? '.gen-line [data-type]{grid-column:1/-1}' : '') + '.gen-line-head{grid-template-columns:1fr 1fr 34px}.gen-line-head [data-h-desc]' + (TPL.lineTypes ? ',.gen-line-head [data-h-type]' : '') + '{display:none}}',

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
    '.iv-group{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#2563eb;padding:14px 0 4px}',
    '.iv-table{width:100%;border-collapse:collapse}',
    '.iv-table th{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8b95a5;text-align:left;padding:0 0 8px;border-bottom:1px solid #e6eaf1}',
    '.iv-table th.iv-r,.iv-table td.iv-r{text-align:right}',
    '.iv-table td{padding:11px 0;border-bottom:1px solid #f1f4f9;vertical-align:top}',
    '.iv-table td.iv-r{white-space:nowrap;padding-left:12px}',
    '.iv-totals{display:flex;justify-content:flex-end;padding-top:16px}',
    '.iv-totals-inner{width:240px}',
    '.iv-trow{display:flex;justify-content:space-between;padding:6px 0;color:#5b6472}',
    '.iv-trow-total{border-top:2px solid #14181f;margin-top:8px;padding-top:12px;color:#14181f;font-weight:700;font-size:16px}',
    '.iv-trow-cis{color:#b4232a}',
    '.iv-terms{margin-top:32px;padding-top:20px;border-top:1px solid #e6eaf1}'
  ].join('');

  function injectStyles() {
    if ($('invoiceit-gen-styles')) return;
    var s = document.createElement('style');
    s.id = 'invoiceit-gen-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------- */
  /* Helpers                                                        */
  /* ------------------------------------------------------------- */
  function money(n) {
    var v = Number(n) || 0;
    var sign = v < 0 ? '-' : '';
    return sign + '\u00A3' + Math.abs(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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

  /* ------------------------------------------------------------- */
  /* Page heading + template-specific controls                      */
  /* ------------------------------------------------------------- */
  function buildPaymentFields() {
    var termsField = $('payment-terms') && $('payment-terms').closest('.gen-field');
    if (!termsField || $('pay-account-name')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="gen-row-2">' +
        '<div class="gen-field"><div class="gen-label">Account name</div>' +
        '<input id="pay-account-name" type="text" class="gen-input" placeholder="Your Business Ltd"></div>' +
        '<div class="gen-field"><div class="gen-label">Sort code</div>' +
        '<input id="pay-sort" type="text" class="gen-input" placeholder="00-00-00" inputmode="numeric"></div>' +
      '</div>' +
      '<div class="gen-row-2">' +
        '<div class="gen-field"><div class="gen-label">Account number</div>' +
        '<input id="pay-account" type="text" class="gen-input" placeholder="12345678" inputmode="numeric"></div>' +
        '<div class="gen-field"><div class="gen-label">Payment link (optional)</div>' +
        '<input id="pay-link" type="text" class="gen-input" placeholder="https://pay.stripe.com/..."></div>' +
      '</div>';
    while (wrap.firstChild) termsField.parentNode.insertBefore(wrap.firstChild, termsField);
    var lbl = termsField.querySelector('.gen-label');
    if (lbl) lbl.textContent = 'Payment terms / notes';
    var inp = $('payment-terms');
    if (inp) inp.placeholder = 'Payment within 30 days';
  }

  function applyTemplateChrome() {
    var h1 = document.querySelector('.gen-title');
    var sub = document.querySelector('.gen-sub');
    if (h1) h1.textContent = TPL.title;
    if (sub) sub.textContent = TPL.sub;
    document.title = TPL.title + ' | InvoiceIt';

    if (TPL.defaultVat && $('vat-rate') && !$('vat-rate').dataset.userSet) {
      $('vat-rate').value = TPL.defaultVat;
    }

    // CIS control, contractor only — added next to the VAT select's field.
    if (TPL.cis && $('vat-rate')) {
      var vatField = $('vat-rate').closest('.gen-field');
      if (vatField && !$('cis-rate')) {
        var f = document.createElement('div');
        f.className = 'gen-field';
        f.innerHTML =
          '<div class="gen-label">CIS deduction (labour only)</div>' +
          '<select id="cis-rate" class="gen-input">' +
          '<option value="0">Not CIS registered</option>' +
          '<option value="20">20% (verified subcontractor)</option>' +
          '<option value="30">30% (unverified)</option>' +
          '</select>';
        vatField.parentNode.insertBefore(f, vatField.nextSibling);
      }
    }
  }

  /* ------------------------------------------------------------- */
  /* Line items                                                     */
  /* ------------------------------------------------------------- */
  function lineRow() {
    var row = document.createElement('div');
    row.className = 'gen-line';
    var typeSelect = TPL.lineTypes
      ? '<select class="gen-input" data-type><option value="labour">Labour</option><option value="materials">Materials</option></select>'
      : '';
    row.innerHTML =
      '<input type="text" class="gen-input" data-desc placeholder="What are you billing for?">' +
      typeSelect +
      '<input type="text" class="gen-input" data-qty placeholder="' + TPL.qtyPlaceholder + '" inputmode="decimal">' +
      '<input type="text" class="gen-input" data-rate placeholder="' + TPL.ratePlaceholder + '" inputmode="decimal">' +
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
      var typeEl = rows[i].querySelector('[data-type]');
      var qty = qtyRaw === '' ? 1 : num(qtyRaw);
      var rate = num(rateRaw);
      out.push({
        desc: desc, qty: qty, rate: rate, amount: qty * rate,
        type: typeEl ? typeEl.value : 'labour'
      });
    }
    return out;
  }

  function totals(lines) {
    var sub = 0, labour = 0, materials = 0;
    for (var i = 0; i < lines.length; i++) {
      sub += lines[i].amount;
      if (lines[i].type === 'materials') materials += lines[i].amount;
      else labour += lines[i].amount;
    }
    var vatRate = num(val('vat-rate'));
    var vat = sub * (vatRate / 100);
    var cisRate = TPL.cis ? num(val('cis-rate')) : 0;
    var cis = labour * (cisRate / 100);
    return {
      sub: sub, labour: labour, materials: materials,
      vatRate: vatRate, vat: vat,
      cisRate: cisRate, cis: cis,
      total: sub + vat - cis
    };
  }

  /* ------------------------------------------------------------- */
  /* Preview                                                        */
  /* ------------------------------------------------------------- */
  function rowHtml(l) {
    return '<tr>' +
      '<td>' + orGhost(l.desc, 'Untitled item') + '</td>' +
      '<td class="iv-r">' + l.qty + '</td>' +
      '<td class="iv-r">' + money(l.rate) + '</td>' +
      '<td class="iv-r"><strong>' + money(l.amount) + '</strong></td>' +
      '</tr>';
  }

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
    if (!lines.length) {
      rowsHtml = '<tr><td colspan="4" class="iv-ghost" style="padding:16px 0">No items yet</td></tr>';
    } else if (TPL.lineTypes) {
      var lab = lines.filter(function (l) { return l.type !== 'materials'; });
      var mat = lines.filter(function (l) { return l.type === 'materials'; });
      if (lab.length) {
        rowsHtml += '<tr><td colspan="4" class="iv-group">Labour</td></tr>' + lab.map(rowHtml).join('');
      }
      if (mat.length) {
        rowsHtml += '<tr><td colspan="4" class="iv-group">Materials</td></tr>' + mat.map(rowHtml).join('');
      }
    } else {
      rowsHtml = lines.map(rowHtml).join('');
    }

    var vatLine = t.vatRate
      ? '<div class="iv-trow"><span>VAT at ' + t.vatRate + '%</span><span>' + money(t.vat) + '</span></div>'
      : '';
    var splitLines = (TPL.lineTypes && lines.length)
      ? '<div class="iv-trow"><span>Labour</span><span>' + money(t.labour) + '</span></div>' +
        '<div class="iv-trow"><span>Materials</span><span>' + money(t.materials) + '</span></div>'
      : '';
    var cisLine = t.cisRate
      ? '<div class="iv-trow iv-trow-cis"><span>CIS deduction ' + t.cisRate + '% (labour)</span><span>' + money(-t.cis) + '</span></div>'
      : '';
    var vatNo = val('biz-vat') ? '<div class="iv-muted">VAT No. ' + esc(val('biz-vat')) + '</div>' : '';
    var email = val('biz-email') ? '<div class="iv-muted">' + esc(val('biz-email')) + '</div>' : '';
    var payBits = [];
    if (val('pay-account-name')) payBits.push('Account name: ' + esc(val('pay-account-name')));
    if (val('pay-sort')) payBits.push('Sort code: ' + esc(val('pay-sort')));
    if (val('pay-account')) payBits.push('Account number: ' + esc(val('pay-account')));
    if (val('payment-terms')) payBits.push(esc(val('payment-terms')));
    var payBtn = val('pay-link')
      ? '<div style="margin-top:10px"><span style="display:inline-block;background:#2563eb;color:#fff;font-weight:600;font-size:12px;border-radius:6px;padding:8px 14px">Pay this invoice online</span></div>'
      : '';
    var terms = (payBits.length || payBtn)
      ? '<div class="iv-terms"><div class="iv-cap">Payment details</div><div class="iv-muted">' + payBits.join('<br>') + '</div>' + payBtn + '</div>'
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
            '<div class="iv-dates-row"><div class="iv-cap">Invoice date</div>' + orGhost(val('inv-date'), '\u2014') + '</div>' +
            '<div><div class="iv-cap">Due date</div>' + orGhost(val('inv-due'), '\u2014') + '</div>' +
          '</div>' +
        '</div>' +
        '<table class="iv-table">' +
          '<thead><tr><th>Description</th><th class="iv-r">' + esc(TPL.qtyLabel) + '</th>' +
          '<th class="iv-r">' + esc(TPL.rateLabel) + '</th><th class="iv-r">Amount</th></tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
        '</table>' +
        '<div class="iv-totals"><div class="iv-totals-inner">' +
          splitLines +
          '<div class="iv-trow"><span>Subtotal</span><span>' + money(t.sub) + '</span></div>' +
          vatLine + cisLine +
          '<div class="iv-trow iv-trow-total"><span>' + (t.cisRate ? 'Amount payable' : 'Total due') + '</span><span>' + money(t.total) + '</span></div>' +
        '</div></div>' +
        terms +
        '<div style="margin-top:24px;font-size:9px;color:#c3cddd">Created free with invoiceit.io</div>' +
      '</div>';
  }

  /* ------------------------------------------------------------- */
  /* Local persistence                                              */
  /* ------------------------------------------------------------- */
  var REMEMBER = ['biz-name', 'biz-address', 'biz-vat', 'biz-email', 'payment-terms', 'pay-account-name', 'pay-sort', 'pay-account', 'pay-link'];

  function saveBusiness() {
    try {
      var data = {};
      REMEMBER.forEach(function (id) { data[id] = val(id); });
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
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

  /* ------------------------------------------------------------- */
  /* PDF                                                            */
  /* ------------------------------------------------------------- */
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

    doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(139, 149, 165);
    doc.text('BILL TO', M, y);
    doc.text('INVOICE DATE', right - 34, y);
    doc.text('DUE DATE', right, y, { align: 'right' });

    y += 5;
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(20, 24, 31);
    doc.text(val('cli-name') || '\u2014', M, y);
    doc.setFont('helvetica', 'normal').setFontSize(9);
    doc.text(val('inv-date') || '\u2014', right - 34, y);
    doc.text(val('inv-due') || '\u2014', right, y, { align: 'right' });

    y += 5;
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(91, 100, 114);
    var caddr = doc.splitTextToSize(val('cli-address') || '', 80);
    if (caddr.length && caddr[0]) { doc.text(caddr, M, y); y += caddr.length * 4; }

    y += 8;

    var colQty = right - 62, colRate = right - 38, colAmt = right;

    function tableHead() {
      doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(139, 149, 165);
      doc.text('DESCRIPTION', M, y);
      doc.text(TPL.qtyLabel.toUpperCase(), colQty, y, { align: 'right' });
      doc.text(TPL.rateLabel.toUpperCase(), colRate, y, { align: 'right' });
      doc.text('AMOUNT', colAmt, y, { align: 'right' });
      y += 2.5;
      doc.setDrawColor(230, 234, 241).setLineWidth(0.2).line(M, y, right, y);
      y += 6;
    }
    tableHead();

    function pdfRow(l) {
      if (y > 250) { doc.addPage(); y = M + 6; tableHead(); }
      var d = doc.splitTextToSize(l.desc || 'Untitled item', 95);
      doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(20, 24, 31);
      doc.text(d, M, y);
      doc.text(String(l.qty), colQty, y, { align: 'right' });
      doc.text(money(l.rate), colRate, y, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(money(l.amount), colAmt, y, { align: 'right' });
      y += Math.max(d.length * 4.2, 5) + 3;
      doc.setDrawColor(241, 244, 249).line(M, y - 2, right, y - 2);
    }
    function pdfGroup(label) {
      if (y > 250) { doc.addPage(); y = M + 6; tableHead(); }
      doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(37, 99, 235);
      doc.text(label.toUpperCase(), M, y);
      y += 5.5;
    }

    if (TPL.lineTypes) {
      var lab = lines.filter(function (l) { return l.type !== 'materials'; });
      var mat = lines.filter(function (l) { return l.type === 'materials'; });
      if (lab.length) { pdfGroup('Labour'); lab.forEach(pdfRow); }
      if (mat.length) { pdfGroup('Materials'); mat.forEach(pdfRow); }
    } else {
      lines.forEach(pdfRow);
    }

    y += 5;
    if (y > 235) { doc.addPage(); y = M + 6; }
    var labelX = right - 52;

    function totalLine(label, value, opts) {
      opts = opts || {};
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
         .setFontSize(opts.big ? 12 : 9.5);
      if (opts.red) doc.setTextColor(180, 35, 42);
      else if (opts.bold) doc.setTextColor(20, 24, 31);
      else doc.setTextColor(91, 100, 114);
      doc.text(label, labelX, y);
      doc.text(value, colAmt, y, { align: 'right' });
      y += opts.big ? 7 : 5.5;
    }

    if (TPL.lineTypes && lines.length) {
      totalLine('Labour', money(t.labour));
      totalLine('Materials', money(t.materials));
    }
    totalLine('Subtotal', money(t.sub));
    if (t.vatRate) totalLine('VAT at ' + t.vatRate + '%', money(t.vat));
    if (t.cisRate) totalLine('CIS deduction ' + t.cisRate + '% (labour)', money(-t.cis), { red: true });
    y += 1;
    doc.setDrawColor(20, 24, 31).setLineWidth(0.5).line(labelX, y, right, y);
    y += 6;
    totalLine(t.cisRate ? 'Amount payable' : 'Total due', money(t.total), { bold: true, big: true });

    var payLines = [];
    if (val('pay-account-name')) payLines.push('Account name: ' + val('pay-account-name'));
    if (val('pay-sort')) payLines.push('Sort code: ' + val('pay-sort'));
    if (val('pay-account')) payLines.push('Account number: ' + val('pay-account'));
    if (val('payment-terms')) payLines.push(val('payment-terms'));
    if (payLines.length || val('pay-link')) {
      y += 8;
      if (y > 255) { doc.addPage(); y = M + 6; }
      doc.setDrawColor(230, 234, 241).setLineWidth(0.2).line(M, y - 6, right, y - 6);
      doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(139, 149, 165);
      doc.text('PAYMENT DETAILS', M, y);
      y += 5;
      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(91, 100, 114);
      for (var pi = 0; pi < payLines.length; pi++) {
        doc.text(doc.splitTextToSize(payLines[pi], right - M), M, y);
        y += 4.5;
      }
      if (val('pay-link')) {
        y += 3;
        doc.setFillColor(37, 99, 235);
        doc.roundedRect(M, y - 4, 46, 8, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(255, 255, 255);
        doc.textWithLink('Pay this invoice online', M + 3.5, y + 1, { url: val('pay-link') });
      }
    }

    var pageCount = doc.getNumberOfPages();
    for (var pg = 1; pg <= pageCount; pg++) {
      doc.setPage(pg);
      doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(180, 187, 199);
      doc.textWithLink('Created free with invoiceit.io', M, 290, { url: 'https://invoiceit.io/free-invoice-generator' });
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
    if (!lines.length) { flash(btn, 'Add at least one item first'); return; }

    var original = btn.textContent;
    btn.textContent = 'Building your PDF\u2026';
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
        flash(btn, 'PDF failed \u2014 check your connection and try again');
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

  /* ------------------------------------------------------------- */
  /* Wiring                                                         */
  /* ------------------------------------------------------------- */
  function init() {
    if (!$('preview') || !$('line-items')) return;

    injectStyles();
    applyTemplateChrome();
    buildPaymentFields();

    var head = document.createElement('div');
    head.className = 'gen-line-head';
    head.innerHTML =
      '<span data-h-desc>Description</span>' +
      (TPL.lineTypes ? '<span data-h-type>Type</span>' : '') +
      '<span>' + esc(TPL.qtyLabel) + '</span><span>' + esc(TPL.rateLabel) + '</span><span></span>';
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

    var form = $('biz-name') && $('biz-name').closest('form');
    if (form) {
      form.setAttribute('novalidate', 'novalidate');
      form.addEventListener('submit', function (e) { e.preventDefault(); });
    }

    document.addEventListener('input', function (e) {
      if (e.target.closest && e.target.closest('.gen-panel')) render();
    });
    document.addEventListener('change', function (e) {
      if (!e.target.closest || !e.target.closest('.gen-panel')) return;
      if (e.target.id === 'vat-rate') e.target.dataset.userSet = '1';
      render();
    });

    $('add-line').addEventListener('click', function () { addLine(true); });

    $('line-items').addEventListener('click', function (e) {
      if (!e.target.hasAttribute('data-remove')) return;
      var rows = document.querySelectorAll('#line-items .gen-line');
      if (rows.length === 1) {
        rows[0].querySelectorAll('input').forEach(function (i) { i.value = ''; });
      } else {
        e.target.closest('.gen-line').remove();
      }
      render();
    });

    $('download-pdf').addEventListener('click', onDownload);

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
