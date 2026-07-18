/*
 * InvoiceIt — free invoice generator v3.1: full multi-market support with custom tax rates, persistent currency overrides, locale currency/date formatting, market-aware tax and banking labels, international addresses, drafts and backward-compatible analytics. Saved clients, logo and brand colour remain reserved for Pro.
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
  var DRAFT_KEY = 'invoiceit.draft.v1';
  var MARKET_KEY = 'invoiceit.market.v1';

  var INITIALIZED = false;

  function storageGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  var ANALYTICS_STATE = { started: false, completed: false, paymentLinkTracked: false };

  function analyticsEvent(name, params) {
    params = params || {};
    params.template = (function () {
      try { return new URLSearchParams(location.search).get('template') || 'blank'; }
      catch (e) { return 'blank'; }
    })();
    params.market = marketCode();
    params.currency = currencyCode();
    params.page_path = location.pathname;
    params.device_type = window.matchMedia && window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop';
    if (typeof window.gtag === 'function') window.gtag('event', name, params);
    if (window.dataLayer && Array.isArray(window.dataLayer)) {
      window.dataLayer.push(Object.assign({ event: name }, params));
    }
  }

  // "Started" means the user typed something - never auto-filled fields.
  function userHasEnteredContent() {
    if (val('biz-name') || val('cli-name')) return true;
    var inputs = document.querySelectorAll('#line-items .gen-line input');
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].value.trim()) return true;
    }
    return false;
  }

  function trackInvoiceProgress() {
    if (!ANALYTICS_STATE.started && userHasEnteredContent()) {
      ANALYTICS_STATE.started = true;
      analyticsEvent('invoice_started');
    }
    if (!ANALYTICS_STATE.completed && val('biz-name') && val('cli-name') && readLines().length) {
      ANALYTICS_STATE.completed = true;
      analyticsEvent('invoice_completed', {
        line_item_count: readLines().length,
        tax_rate: taxRateValue(),
      invoice_theme: themeCode()
      });
    }
    if (!ANALYTICS_STATE.paymentLinkTracked && val('pay-link')) {
      ANALYTICS_STATE.paymentLinkTracked = true;
      analyticsEvent('payment_link_added');
    }
  }

  function requiredElementsExist() {
    return Boolean(
      $('preview') && $('line-items') && $('add-line') &&
      $('download-pdf') && $('inv-number') && $('inv-date') && $('inv-due')
    );
  }

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

  var MARKETS = {
    GB:{label:'United Kingdom',currency:'GBP',locale:'en-GB',taxIdLabel:'VAT number',taxRateLabel:'VAT rate',taxName:'VAT',taxRates:[['0','No VAT'],['20','20% standard'],['5','5% reduced']],emailPlaceholder:'name@business.co.uk',bankNameLabel:'Account name',bankNamePlaceholder:'Your Business Ltd',bankCodeLabel:'Sort code',bankCodePlaceholder:'00-00-00',bankAccountLabel:'Account number',bankAccountPlaceholder:'12345678',cityLabel:'Town or city',regionLabel:'County',postalLabel:'Postcode'},
    US:{label:'United States',currency:'USD',locale:'en-US',taxIdLabel:'Tax ID / EIN',taxRateLabel:'Sales tax rate',taxName:'Sales tax',taxRates:[['0','No sales tax'],['4','4%'],['5','5%'],['6','6%'],['6.25','6.25%'],['7','7%'],['8','8%'],['8.875','8.875%'],['9.5','9.5%'],['10','10%']],emailPlaceholder:'name@business.com',bankNameLabel:'Account holder name',bankNamePlaceholder:'Your Business LLC',bankCodeLabel:'Routing number',bankCodePlaceholder:'123456789',bankAccountLabel:'Account number',bankAccountPlaceholder:'1234567890',cityLabel:'City',regionLabel:'State',postalLabel:'ZIP code'},
    CA:{label:'Canada',currency:'CAD',locale:'en-CA',taxIdLabel:'Tax registration number',taxRateLabel:'Tax rate',taxName:'Tax',taxRates:[['0','No tax'],['5','5% GST'],['13','13% HST'],['15','15% HST']],emailPlaceholder:'name@business.ca',bankNameLabel:'Account holder name',bankNamePlaceholder:'Your Business Inc.',bankCodeLabel:'Transit / institution number',bankCodePlaceholder:'12345 / 001',bankAccountLabel:'Account number',bankAccountPlaceholder:'1234567',cityLabel:'City',regionLabel:'Province',postalLabel:'Postal code'},
    AU:{label:'Australia',currency:'AUD',locale:'en-AU',taxIdLabel:'ABN',taxRateLabel:'GST rate',taxName:'GST',taxRates:[['0','No GST'],['10','10% GST']],emailPlaceholder:'name@business.com.au',bankNameLabel:'Account name',bankNamePlaceholder:'Your Business Pty Ltd',bankCodeLabel:'BSB',bankCodePlaceholder:'000-000',bankAccountLabel:'Account number',bankAccountPlaceholder:'12345678',cityLabel:'Suburb',regionLabel:'State / Territory',postalLabel:'Postcode'},
    NZ:{label:'New Zealand',currency:'NZD',locale:'en-NZ',taxIdLabel:'GST number',taxRateLabel:'GST rate',taxName:'GST',taxRates:[['0','No GST'],['15','15% GST']],emailPlaceholder:'name@business.co.nz',bankNameLabel:'Account name',bankNamePlaceholder:'Your Business Ltd',bankCodeLabel:'Bank details',bankCodePlaceholder:'Bank / branch details',bankAccountLabel:'Account number',bankAccountPlaceholder:'00-0000-0000000-00',cityLabel:'Suburb / City',regionLabel:'Region',postalLabel:'Postcode'},
    EU:{label:'Europe / EUR',currency:'EUR',locale:'en-IE',taxIdLabel:'VAT number',taxRateLabel:'VAT rate',taxName:'VAT',taxRates:[['0','No VAT'],['9','9% reduced'],['19','19%'],['20','20%'],['21','21%'],['23','23%']],emailPlaceholder:'name@business.com',bankNameLabel:'Account holder name',bankNamePlaceholder:'Your Business',bankCodeLabel:'BIC / SWIFT',bankCodePlaceholder:'ABCDEFGH',bankAccountLabel:'IBAN',bankAccountPlaceholder:'IE00 BANK 0000 0000 0000 00',cityLabel:'City',regionLabel:'Region / Province',postalLabel:'Postal code'}
  };
  function marketCode(){var e=$('market-country');if(e&&MARKETS[e.value])return e.value;var x=storageGet(MARKET_KEY,null);return x&&MARKETS[x]?x:'GB';}
  function market(){return MARKETS[marketCode()]||MARKETS.GB;}
  function currencyCode(){var e=$('market-currency');return e&&e.value?e.value:market().currency;}


  var REGION_OPTIONS = {
    US: [['','Select state'],['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming']],
    CA: [['','Select province or territory'],['AB','Alberta'],['BC','British Columbia'],['MB','Manitoba'],['NB','New Brunswick'],['NL','Newfoundland and Labrador'],['NS','Nova Scotia'],['NT','Northwest Territories'],['NU','Nunavut'],['ON','Ontario'],['PE','Prince Edward Island'],['QC','Quebec'],['SK','Saskatchewan'],['YT','Yukon']],
    AU: [['','Select state or territory'],['ACT','Australian Capital Territory'],['NSW','New South Wales'],['NT','Northern Territory'],['QLD','Queensland'],['SA','South Australia'],['TAS','Tasmania'],['VIC','Victoria'],['WA','Western Australia']]
  };

  var THEMES = {
    professional: { label: 'Professional', accent: [37,99,235], dark: [20,24,31] },
    modern: { label: 'Modern', accent: [13,148,136], dark: [15,23,42] },
    minimal: { label: 'Minimal', accent: [71,85,105], dark: [30,41,59] },
    corporate: { label: 'Corporate', accent: [30,64,175], dark: [17,24,39] }
  };
  function themeCode(){var e=$('invoice-theme');return e&&THEMES[e.value]?e.value:'professional';}
  function theme(){return THEMES[themeCode()]||THEMES.professional;}

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
    '.iv-terms{margin-top:32px;padding-top:20px;border-top:1px solid #e6eaf1}',
    '.invoiceit-tools{display:grid;grid-template-columns:1fr 1fr;grid-column-gap:10px;margin:12px 0}',
    '.invoiceit-mini-btn{border:1px solid #dbe2ea;background:#fff;border-radius:9px;padding:10px 12px;font:inherit;font-weight:600;cursor:pointer}',
    '.invoiceit-date-wrap{position:relative}',
    '.invoiceit-date-wrap .gen-input{padding-right:54px}',
    '.invoiceit-calendar-btn{position:absolute;right:7px;top:50%;transform:translateY(-50%);width:40px;height:38px;border:0;border-radius:8px;background:#f1f5f9;color:#14181f;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center}',
    '[data-address-group]{margin-bottom:18px}',
    '[data-address-group] .gen-label{margin-bottom:7px}',
    '@media(max-width:767px){[data-address-group] .gen-row-2{grid-template-columns:1fr!important;grid-row-gap:8px}}',
    '#invoiceit-market-controls .gen-input{min-height:46px}',
    '.iv-doc[data-theme="modern"] .iv-head{border-bottom-color:#0d9488}.iv-doc[data-theme="modern"] .iv-word,.iv-doc[data-theme="modern"] .iv-group{color:#0d9488}',
    '.iv-doc[data-theme="minimal"] .iv-head{border-bottom-width:1px}.iv-doc[data-theme="minimal"] .iv-word{color:#475569;letter-spacing:.03em}.iv-doc[data-theme="minimal"] .iv-table th{font-weight:600}',
    '.iv-doc[data-theme="corporate"] .iv-head{background:#f8fafc;padding:20px;border:1px solid #e2e8f0;border-bottom:4px solid #1e40af}.iv-doc[data-theme="corporate"] .iv-word,.iv-doc[data-theme="corporate"] .iv-group{color:#1e40af}',
    '@media(max-width:767px){.gen-input,.invoiceit-mini-btn{min-height:46px}.invoiceit-tools{grid-template-columns:1fr;grid-row-gap:10px}.iv-meta{grid-template-columns:1fr;gap:18px}.iv-dates{text-align:left;display:grid;grid-template-columns:1fr 1fr;gap:12px}.iv-head{gap:14px}.iv-word{font-size:22px}.iv-totals-inner{width:100%}}'
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
    var value=Number(n)||0;
    try{return new Intl.NumberFormat(market().locale,{style:'currency',currency:currencyCode(),minimumFractionDigits:2,maximumFractionDigits:2}).format(value);}
    catch(e){return value.toFixed(2)+' '+currencyCode();}
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

  function isoDate(d) {
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function parseDateValue(value) {
    if (!value) return null;
    var iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    var parts = String(value).split(/[\/\-.]/);
    if (parts.length === 3) {
      if (String(parts[0]).length === 4) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      }
      if (marketCode() === 'US') return new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]));
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    }
    return null;
  }

  function displayDate(value) {
    var date = parseDateValue(value);
    if (!date || isNaN(date.getTime())) return value || '';
    try{return new Intl.DateTimeFormat(market().locale,{day:'2-digit',month:'2-digit',year:'numeric'}).format(date);}
    catch(e){return ukDate(date);}
  }

  function addDays(date, days) {
    var next = new Date(date.getTime());
    next.setDate(next.getDate() + Number(days || 0));
    return next;
  }
  function val(id) {
    var el = $(id);
    return el ? el.value.trim() : '';
  }

  /* ------------------------------------------------------------- */
  /* Page heading + template-specific controls                      */
  /* ------------------------------------------------------------- */
  function taxRateValue() {
    return val('vat-rate') === 'custom' ? num(val('custom-tax-rate')) : num(val('vat-rate'));
  }
  function ensureCustomTaxField() {
    var select = $('vat-rate');
    if (!select || $('custom-tax-rate')) return;
    var field = select.closest('.gen-field');
    if (!field) return;
    var input = document.createElement('input');
    input.id = 'custom-tax-rate';
    input.type = 'text';
    input.className = 'gen-input';
    input.placeholder = 'Enter custom percentage';
    input.inputMode = 'decimal';
    input.style.marginTop = '8px';
    input.style.display = 'none';
    input.setAttribute('aria-label', 'Custom tax rate percentage');
    field.appendChild(input);
  }
  function updateCustomTaxVisibility() {
    var input = $('custom-tax-rate');
    if (!input) return;
    var custom = val('vat-rate') === 'custom';
    input.style.display = custom ? '' : 'none';
    input.disabled = !custom;
  }
  function rebuildTaxRateOptions(reset) {
    var select = $('vat-rate');
    if (!select) return;
    ensureCustomTaxField();
    var cfg = market();
    var current = reset ? '0' : select.value;
    select.innerHTML = '';
    cfg.taxRates.forEach(function (pair) {
      var option = document.createElement('option');
      option.value = pair[0];
      option.textContent = pair[1];
      select.appendChild(option);
    });
    var customOption = document.createElement('option');
    customOption.value = 'custom';
    customOption.textContent = 'Custom rate…';
    select.appendChild(customOption);
    var valid = cfg.taxRates.some(function (pair) { return pair[0] === current; }) || current === 'custom';
    select.value = valid ? current : cfg.taxRates[0][0];
    if (reset && $('custom-tax-rate')) $('custom-tax-rate').value = '';
    updateCustomTaxVisibility();
  }
  function buildMarketFields() {
    if ($('market-country')) return;
    var anchor = $('biz-name') && $('biz-name').closest('.gen-field');
    if (!anchor || !anchor.parentNode) return;
    var section = document.createElement('div');
    section.id = 'invoiceit-market-controls';
    section.style.marginBottom = '18px';
    section.innerHTML =
      '<div class="gen-row-2">' +
        '<div class="gen-field" style="margin-bottom:0"><div class="gen-label">Where is your business based?</div>' +
          '<select id="market-country" class="gen-input">' +
            '<option value="GB">🇬🇧 United Kingdom</option><option value="US">🇺🇸 United States</option>' +
            '<option value="CA">🇨🇦 Canada</option><option value="AU">🇦🇺 Australia</option>' +
            '<option value="NZ">🇳🇿 New Zealand</option><option value="EU">🇪🇺 Europe / EUR</option>' +
          '</select></div>' +
        '<div class="gen-field" style="margin-bottom:0"><div class="gen-label">Currency</div>' +
          '<select id="market-currency" class="gen-input"><option value="GBP">GBP</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="CAD">CAD</option><option value="AUD">AUD</option><option value="NZD">NZD</option></select></div>' +
      '</div>' +
      '<div class="gen-field" style="margin:12px 0 0"><div class="gen-label">Invoice style</div>' +
        '<select id="invoice-theme" class="gen-input"><option value="professional">Professional</option><option value="modern">Modern</option><option value="minimal">Minimal</option><option value="corporate">Corporate</option></select></div>';
    anchor.parentNode.insertBefore(section, anchor);
    var saved = storageGet(MARKET_KEY, null);
    if (saved && MARKETS[saved]) $('market-country').value = saved;
    $('market-currency').value = market().currency;
  }

  function rebuildRegionField(prefix) {
    var current = $(prefix + '-region');
    if (!current || !current.parentNode) return;
    var options = REGION_OPTIONS[marketCode()] || null;
    var value = current.value || '';
    var replacement;
    if (options) {
      replacement = document.createElement('select');
      options.forEach(function (pair) {
        var option = document.createElement('option');
        option.value = pair[0]; option.textContent = pair[1]; replacement.appendChild(option);
      });
      replacement.value = value;
    } else {
      replacement = document.createElement('input');
      replacement.type = 'text'; replacement.value = value;
      replacement.setAttribute('autocomplete', 'address-level1');
    }
    replacement.id = prefix + '-region';
    replacement.className = 'gen-input';
    replacement.setAttribute('aria-label', market().regionLabel);
    current.parentNode.replaceChild(replacement, current);
  }

  function applyTheme() {
    var box = $('preview');
    if (box) box.setAttribute('data-invoice-theme', themeCode());
  }

  function applyMarketChrome(reset){var c=market();rebuildTaxRateOptions(!!reset);var x=$('biz-vat'),f,l;if(x){f=x.closest('.gen-field');l=f&&f.querySelector('.gen-label');if(l)l.textContent=c.taxIdLabel;x.placeholder=c.taxIdLabel;}x=$('vat-rate');if(x){f=x.closest('.gen-field');l=f&&f.querySelector('.gen-label');if(l)l.textContent=c.taxRateLabel;}x=$('biz-email');if(x)x.placeholder=c.emailPlaceholder;['biz','cli'].forEach(function(p){if($(p+'-city-label'))$(p+'-city-label').textContent=c.cityLabel;if($(p+'-region-label'))$(p+'-region-label').textContent=c.regionLabel;if($(p+'-postal-label'))$(p+'-postal-label').textContent=c.postalLabel;});if($('pay-account-name-label'))$('pay-account-name-label').textContent=c.bankNameLabel;if($('pay-account-name'))$('pay-account-name').placeholder=c.bankNamePlaceholder;if($('pay-sort-label'))$('pay-sort-label').textContent=c.bankCodeLabel;if($('pay-sort')){$('pay-sort').placeholder=c.bankCodePlaceholder;$('pay-sort').inputMode=(marketCode()==='GB'||marketCode()==='US')?'numeric':'text';}if($('pay-account-label'))$('pay-account-label').textContent=c.bankAccountLabel;if($('pay-account')){$('pay-account').placeholder=c.bankAccountPlaceholder;$('pay-account').inputMode=(marketCode()==='GB'||marketCode()==='US')?'numeric':'text';}['biz','cli'].forEach(rebuildRegionField);applyTheme();x=$('cis-rate');if(x){f=x.closest('.gen-field');if(marketCode()==='GB'){if(f)f.style.display='';}else{x.value='0';if(f)f.style.display='none';}}}

  function addressFieldHtml(prefix, title) {
    return (
      '<div class="gen-field" data-address-group="' + prefix + '">' +
        '<div class="gen-label">' + title + '</div>' +
        '<input id="' + prefix + '-address-1" type="text" class="gen-input" placeholder="Address line 1" autocomplete="address-line1">' +
        '<input id="' + prefix + '-address-2" type="text" class="gen-input" placeholder="Address line 2 (optional)" autocomplete="address-line2" style="margin-top:8px">' +
        '<div class="gen-row-2" style="margin-top:8px">' +
          '<div class="gen-field" style="margin-bottom:0"><div class="gen-label" id="' + prefix + '-city-label">Town or city</div><input id="' + prefix + '-city" type="text" class="gen-input" autocomplete="address-level2"></div>' +
          '<div class="gen-field" style="margin-bottom:0"><div class="gen-label" id="' + prefix + '-region-label">County</div><input id="' + prefix + '-region" type="text" class="gen-input" autocomplete="address-level1"></div>' +
        '</div><div class="gen-row-2" style="margin-top:8px">' +
          '<div class="gen-field" style="margin-bottom:0"><div class="gen-label" id="' + prefix + '-postal-label">Postcode</div><input id="' + prefix + '-postal" type="text" class="gen-input" autocomplete="postal-code"></div>' +
          '<div class="gen-field" style="margin-bottom:0"><div class="gen-label">Country</div><input id="' + prefix + '-country" type="text" class="gen-input" placeholder="Optional" autocomplete="country-name"></div>' +
        '</div>' +
      '</div>'
    );
  }

  function composeAddress(prefix) {
    var parts = [];
    if (val(prefix + '-address-1')) parts.push(val(prefix + '-address-1'));
    if (val(prefix + '-address-2')) parts.push(val(prefix + '-address-2'));
    var locality = val(prefix + '-city');
    if (val(prefix + '-region')) locality += (locality ? ', ' : '') + val(prefix + '-region');
    if (val(prefix + '-postal')) locality += (locality ? ' ' : '') + val(prefix + '-postal');
    if (locality) parts.push(locality);
    if (val(prefix + '-country')) parts.push(val(prefix + '-country'));
    return parts.join('\n');
  }

  function syncAddress(prefix, targetId) {
    var target = $(targetId);
    if (target) target.value = composeAddress(prefix);
  }

  function populateAddressFields(prefix, targetId) {
    var target = $(targetId);
    if (!target || !target.value.trim()) return;
    var lines = target.value.split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) return;
    if ($(prefix + '-address-1')) $(prefix + '-address-1').value = lines[0] || '';
    if (lines.length > 1 && $(prefix + '-city')) $(prefix + '-city').value = lines[lines.length - 1] || '';
    if (lines.length > 2 && $(prefix + '-address-2')) $(prefix + '-address-2').value = lines.slice(1, -1).join(', ');
  }

  function buildStructuredAddress(targetId, prefix, title) {
    var original = $(targetId);
    if (!original || document.querySelector('[data-address-group="' + prefix + '"]')) return;
    var field = original.closest('.gen-field');
    if (!field || !field.parentNode) return;

    var wrap = document.createElement('div');
    wrap.innerHTML = addressFieldHtml(prefix, title);
    var group = wrap.firstElementChild;
    field.parentNode.insertBefore(group, field);
    field.style.display = 'none';
    field.setAttribute('aria-hidden', 'true');

    populateAddressFields(prefix, targetId);

    group.addEventListener('input', function () { syncAddress(prefix, targetId); render(); });
    group.addEventListener('change', function () { syncAddress(prefix, targetId); render(); });
  }

  function buildAddressFields() {
    buildStructuredAddress('biz-address', 'biz', 'Business address');
    buildStructuredAddress('cli-address', 'cli', 'Client address');
  }

  function migrateDateInput(input) {
    if (!input) return;
    var parsed = parseDateValue(input.value);
    input.type = 'date';
    if (parsed && !isNaN(parsed.getTime())) input.value = isoDate(parsed);
    else input.value = '';
  }

  function openNativeDatePicker(input) {
    if (!input) return;
    try {
      if (typeof input.showPicker === 'function') { input.showPicker(); return; }
    } catch (e) {}
    input.focus();
    input.click();
  }

  function addCalendarButton(input) {
    if (!input || input.dataset.calendarReady === '1') return;
    input.dataset.calendarReady = '1';
    var parent = input.parentNode;
    if (!parent) return;
    var wrap = document.createElement('div');
    wrap.className = 'invoiceit-date-wrap';
    parent.insertBefore(wrap, input);
    wrap.appendChild(input);
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'invoiceit-calendar-btn';
    button.setAttribute('aria-label', 'Open calendar');
    button.textContent = '\uD83D\uDCC5';
    button.addEventListener('click', function (event) {
      event.preventDefault();
      openNativeDatePicker(input);
    });
    wrap.appendChild(button);
  }

  function updateDueDateFromTerms(force) {
    var invoiceInput = $('inv-date');
    var dueInput = $('inv-due');
    var terms = $('invoiceit-payment-terms');
    if (!invoiceInput || !dueInput || !terms) return;
    if (!force && dueInput.dataset.userSet === '1') return;
    var invoiceDate = parseDateValue(invoiceInput.value) || new Date();
    dueInput.value = isoDate(addDays(invoiceDate, Number(terms.value)));
    render();
  }

  function buildDateControls() {
    var invoiceInput = $('inv-date');
    var dueInput = $('inv-due');
    if (!invoiceInput || !dueInput) return;

    migrateDateInput(invoiceInput);
    migrateDateInput(dueInput);
    invoiceInput.setAttribute('autocomplete', 'off');
    dueInput.setAttribute('autocomplete', 'off');
    addCalendarButton(invoiceInput);
    addCalendarButton(dueInput);

    if (!$('invoiceit-payment-terms')) {
      var dueField = dueInput.closest('.gen-field');
      if (dueField && dueField.parentNode) {
        var field = document.createElement('div');
        field.className = 'gen-field';
        field.innerHTML =
          '<div class="gen-label">Payment terms</div>' +
          '<select id="invoiceit-payment-terms" class="gen-input">' +
            '<option value="0">Due on receipt</option>' +
            '<option value="7">Net 7 days</option>' +
            '<option value="14">Net 14 days</option>' +
            '<option value="30" selected>Net 30 days</option>' +
            '<option value="60">Net 60 days</option>' +
          '</select>';
        dueField.parentNode.insertBefore(field, dueField);
      }
    }

    if (invoiceInput.dataset.dateEventsBound !== '1') {
      invoiceInput.dataset.dateEventsBound = '1';
      invoiceInput.addEventListener('change', function () {
        updateDueDateFromTerms(false);
        render();
      });
    }
    if (dueInput.dataset.dateEventsBound !== '1') {
      dueInput.dataset.dateEventsBound = '1';
      dueInput.addEventListener('change', function () {
        this.dataset.userSet = '1';
        render();
      });
    }
    var terms = $('invoiceit-payment-terms');
    if (terms && terms.dataset.dateEventsBound !== '1') {
      terms.dataset.dateEventsBound = '1';
      terms.addEventListener('change', function () {
        delete dueInput.dataset.userSet;
        updateDueDateFromTerms(true);
      });
    }
  }

  function serialiseDraft() {
    var ids = ['biz-name', 'biz-address', 'biz-vat', 'biz-email', 'inv-number', 'inv-date', 'inv-due',
      'cli-name', 'cli-address', 'vat-rate', 'custom-tax-rate', 'cis-rate', 'payment-terms', 'pay-account-name', 'market-country', 'market-currency',
      'pay-sort', 'pay-account', 'pay-link', 'invoice-theme'];
    var values = {};
    ids.forEach(function (id) { if ($(id)) values[id] = $(id).value; });

    var structured = {};
    ['biz', 'cli'].forEach(function (prefix) {
      ['address-1', 'address-2', 'city', 'region', 'postal', 'country'].forEach(function (suffix) {
        var id = prefix + '-' + suffix;
        if ($(id)) structured[id] = $(id).value;
      });
    });

    var lines = [];
    document.querySelectorAll('#line-items .gen-line').forEach(function (row) {
      lines.push({
        desc: row.querySelector('[data-desc]') ? row.querySelector('[data-desc]').value : '',
        qty: row.querySelector('[data-qty]') ? row.querySelector('[data-qty]').value : '',
        rate: row.querySelector('[data-rate]') ? row.querySelector('[data-rate]').value : '',
        type: row.querySelector('[data-type]') ? row.querySelector('[data-type]').value : ''
      });
    });

    return { values: values, structured: structured, lines: lines };
  }

  function restoreDraft(draft) {
    if (!draft) return;
    Object.keys(draft.values || {}).forEach(function (id) {
      if ($(id)) $(id).value = draft.values[id];
    });
    Object.keys(draft.structured || {}).forEach(function (id) {
      if ($(id)) $(id).value = draft.structured[id];
    });
    if ($('line-items')) $('line-items').innerHTML = '';
    (draft.lines || []).forEach(function (line) {
      var row = lineRow();
      $('line-items').appendChild(row);
      if (row.querySelector('[data-desc]')) row.querySelector('[data-desc]').value = line.desc || '';
      if (row.querySelector('[data-qty]')) row.querySelector('[data-qty]').value = line.qty || '';
      if (row.querySelector('[data-rate]')) row.querySelector('[data-rate]').value = line.rate || '';
      if (row.querySelector('[data-type]') && line.type) row.querySelector('[data-type]').value = line.type;
    });
    if (!document.querySelector('#line-items .gen-line')) addLine(false);
    if ($('market-country') && draft.values && draft.values['market-country']) storageSet(MARKET_KEY,draft.values['market-country']);
    applyMarketChrome(false);
    render();
  }

  function buildDraftTools() {
    if ($('invoiceit-save-draft')) return;
    var anchor = $('download-pdf');
    if (!anchor || !anchor.parentNode) return;
    var tools = document.createElement('div');
    tools.className = 'invoiceit-tools';
    tools.innerHTML =
      '<button type="button" id="invoiceit-save-draft" class="invoiceit-mini-btn">Save draft</button>' +
      '<button type="button" id="invoiceit-load-draft" class="invoiceit-mini-btn">Load saved draft</button>';
    anchor.parentNode.insertBefore(tools, anchor);

    $('invoiceit-save-draft').addEventListener('click', function () {
      storageSet(DRAFT_KEY, serialiseDraft());
      analyticsEvent('draft_saved');
      this.textContent = 'Draft saved';
      var btn = this;
      setTimeout(function () { btn.textContent = 'Save draft'; }, 1600);
    });

    $('invoiceit-load-draft').addEventListener('click', function () {
      var draft = storageGet(DRAFT_KEY, null);
      if (!draft) { flash($('download-pdf'), 'No saved draft found in this browser'); return; }
      restoreDraft(draft);
      analyticsEvent('draft_loaded');
    });
  }

  function trackPdfDownload() {
    analyticsEvent('pdf_downloaded', {
      line_item_count: readLines().length,
      invoice_total: totals(readLines()).total,
      tax_rate: taxRateValue()
    });
  }

  function buildPaymentFields() {
    var termsField = $('payment-terms') && $('payment-terms').closest('.gen-field');
    if (!termsField || $('pay-account-name')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="gen-row-2">' +
        '<div class="gen-field"><div class="gen-label" id="pay-account-name-label">Account name</div>' +
        '<input id="pay-account-name" type="text" class="gen-input" placeholder="Your Business Ltd"></div>' +
        '<div class="gen-field"><div class="gen-label" id="pay-sort-label">Sort code</div>' +
        '<input id="pay-sort" type="text" class="gen-input" placeholder="00-00-00"></div>' +
      '</div>' +
      '<div class="gen-row-2">' +
        '<div class="gen-field"><div class="gen-label" id="pay-account-label">Account number</div>' +
        '<input id="pay-account" type="text" class="gen-input" placeholder="12345678"></div>' +
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
    var vatRate = taxRateValue();
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
    var palette = theme();
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
      ? '<div class="iv-trow"><span>' + esc(market().taxName) + ' at ' + t.vatRate + '%</span><span>' + money(t.vat) + '</span></div>'
      : '';
    var splitLines = (TPL.lineTypes && lines.length)
      ? '<div class="iv-trow"><span>Labour</span><span>' + money(t.labour) + '</span></div>' +
        '<div class="iv-trow"><span>Materials</span><span>' + money(t.materials) + '</span></div>'
      : '';
    var cisLine = t.cisRate
      ? '<div class="iv-trow iv-trow-cis"><span>CIS deduction ' + t.cisRate + '% (labour)</span><span>' + money(-t.cis) + '</span></div>'
      : '';
    var vatNo = val('biz-vat') ? '<div class="iv-muted">' + esc(market().taxIdLabel) + ': ' + esc(val('biz-vat')) + '</div>' : '';
    var email = val('biz-email') ? '<div class="iv-muted">' + esc(val('biz-email')) + '</div>' : '';
    var payBits = [];
    if (val('pay-account-name')) payBits.push(esc(market().bankNameLabel) + ': ' + esc(val('pay-account-name')));
    if (val('pay-sort')) payBits.push(esc(market().bankCodeLabel) + ': ' + esc(val('pay-sort')));
    if (val('pay-account')) payBits.push(esc(market().bankAccountLabel) + ': ' + esc(val('pay-account')));
    if (val('payment-terms')) payBits.push(esc(val('payment-terms')));
    var payBtn = val('pay-link')
      ? '<div style="margin-top:10px"><span style="display:inline-block;background:#2563eb;color:#fff;font-weight:600;font-size:12px;border-radius:6px;padding:8px 14px">Pay this invoice online</span></div>'
      : '';
    var terms = (payBits.length || payBtn)
      ? '<div class="iv-terms"><div class="iv-cap">Payment details</div><div class="iv-muted">' + payBits.join('<br>') + '</div>' + payBtn + '</div>'
      : '';

    box.innerHTML =
      '<div class="iv-doc" data-theme="' + esc(themeCode()) + '">' +
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
            '<div class="iv-dates-row"><div class="iv-cap">Invoice date</div>' + orGhost(displayDate(val('inv-date')), '\u2014') + '</div>' +
            '<div><div class="iv-cap">Due date</div>' + orGhost(displayDate(val('inv-due')), '\u2014') + '</div>' +
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
  var REMEMBER = ['biz-name', 'biz-address', 'biz-vat', 'biz-email', 'payment-terms', 'pay-account-name', 'pay-sort', 'pay-account', 'pay-link', 'market-currency', 'invoice-theme'];

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
    var palette = theme();

    doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(palette.dark[0], palette.dark[1], palette.dark[2]);
    doc.text(val('biz-name') || 'Your business', M, y);
    doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(palette.accent[0], palette.accent[1], palette.accent[2]);
    doc.text('INVOICE', right, y, { align: 'right' });

    y += 6;
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(91, 100, 114);
    var addr = doc.splitTextToSize(val('biz-address') || '', 80);
    if (addr.length && addr[0]) { doc.text(addr, M, y); y += addr.length * 4; }
    if (val('biz-vat')) { doc.text(market().taxIdLabel + ': ' + val('biz-vat'), M, y); y += 4; }
    if (val('biz-email')) { doc.text(val('biz-email'), M, y); y += 4; }

    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(palette.dark[0], palette.dark[1], palette.dark[2]);
    doc.text(val('inv-number') || 'INV-0001', right, M + 12, { align: 'right' });

    y = Math.max(y, M + 20) + 6;
    doc.setDrawColor(20, 24, 31).setLineWidth(0.5).line(M, y, right, y);
    y += 9;

    doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(139, 149, 165);
    doc.text('BILL TO', M, y);
    doc.text('INVOICE DATE', right - 34, y);
    doc.text('DUE DATE', right, y, { align: 'right' });

    y += 5;
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(palette.dark[0], palette.dark[1], palette.dark[2]);
    doc.text(val('cli-name') || '\u2014', M, y);
    doc.setFont('helvetica', 'normal').setFontSize(9);
    doc.text(displayDate(val('inv-date')) || '\u2014', right - 34, y);
    doc.text(displayDate(val('inv-due')) || '\u2014', right, y, { align: 'right' });

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
      doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(palette.dark[0], palette.dark[1], palette.dark[2]);
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
      doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(palette.accent[0], palette.accent[1], palette.accent[2]);
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
      else if (opts.bold) doc.setTextColor(palette.dark[0], palette.dark[1], palette.dark[2]);
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
    if (t.vatRate) totalLine(market().taxName + ' at ' + t.vatRate + '%', money(t.vat));
    if (t.cisRate) totalLine('CIS deduction ' + t.cisRate + '% (labour)', money(-t.cis), { red: true });
    y += 1;
    doc.setDrawColor(20, 24, 31).setLineWidth(0.5).line(labelX, y, right, y);
    y += 6;
    totalLine(t.cisRate ? 'Amount payable' : 'Total due', money(t.total), { bold: true, big: true });

    var payLines = [];
    if (val('pay-account-name')) payLines.push(market().bankNameLabel + ': ' + val('pay-account-name'));
    if (val('pay-sort')) payLines.push(market().bankCodeLabel + ': ' + val('pay-sort'));
    if (val('pay-account')) payLines.push(market().bankAccountLabel + ': ' + val('pay-account'));
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
        doc.setFillColor(palette.accent[0], palette.accent[1], palette.accent[2]);
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
        trackPdfDownload();
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
    if (INITIALIZED || !requiredElementsExist()) return false;
    INITIALIZED = true;

    analyticsEvent('generator_loaded');

    injectStyles();
    buildMarketFields();
    buildDateControls();
    applyTemplateChrome();
    buildPaymentFields();
    buildDraftTools();

    var head = document.createElement('div');
    head.className = 'gen-line-head';
    head.innerHTML =
      '<span data-h-desc>Description</span>' +
      (TPL.lineTypes ? '<span data-h-type>Type</span>' : '') +
      '<span>' + esc(TPL.qtyLabel) + '</span><span>' + esc(TPL.rateLabel) + '</span><span></span>';
    $('line-items').parentNode.insertBefore(head, $('line-items'));

    loadBusiness();
    if ($('market-currency') && $('market-currency').value !== market().currency) $('market-currency').dataset.userSet='1';
    buildAddressFields();
    applyMarketChrome(false);
    applyTheme();

    if (!val('inv-number')) $('inv-number').value = nextInvoiceNumber();
    if (!val('inv-date')) $('inv-date').value = isoDate(new Date());
    if (!val('inv-due')) {
      var due = new Date();
      due.setDate(due.getDate() + 30);
      $('inv-due').value = isoDate(due);
    }

    addLine(false);

    var form = $('biz-name') && $('biz-name').closest('form');
    if (form) {
      form.setAttribute('novalidate', 'novalidate');
      form.addEventListener('submit', function (e) { e.preventDefault(); });
    }

    document.addEventListener('input', function (e) {
      if (!e.target.closest || !e.target.closest('.gen-panel')) return;
      render();
      trackInvoiceProgress();
    });
    document.addEventListener('change', function (e) {
      if (!e.target.closest || !e.target.closest('.gen-panel')) return;
      if (e.target.id === 'vat-rate') {
        e.target.dataset.userSet = '1';
        updateCustomTaxVisibility();
        analyticsEvent('tax_rate_selected', { tax_name: market().taxName, tax_rate: taxRateValue(), custom_rate: e.target.value === 'custom' });
        // Keep the original event while GA4/Looker dashboards migrate to tax_rate_selected.
        analyticsEvent('vat_rate_selected', { tax_rate: taxRateValue() });
      }
      if (e.target.id === 'custom-tax-rate') {
        analyticsEvent('custom_tax_rate_entered', { tax_name: market().taxName, tax_rate: taxRateValue() });
      }
      if (e.target.id === 'market-currency') {
        e.target.dataset.userSet = '1';
        analyticsEvent('currency_selected', { selected_currency: e.target.value });
        saveBusiness();
      }
      if (e.target.id === 'invoice-theme') {
        applyTheme();
        analyticsEvent('theme_selected', { selected_theme: e.target.value });
        saveBusiness();
      }
      if (e.target.id === 'market-country') {
        storageSet(MARKET_KEY, e.target.value);
        analyticsEvent('country_selected', { selected_country: e.target.value });
        if ($('market-currency') && !$('market-currency').dataset.userSet) {
          $('market-currency').value = market().currency;
        }
        applyMarketChrome(true);
        saveBusiness();
        render();
        trackInvoiceProgress();
        return;
      }
      render();
      trackInvoiceProgress();
    });

    $('add-line').addEventListener('click', function () {
      addLine(true);
      analyticsEvent('line_item_added', {
        line_item_count: document.querySelectorAll('#line-items .gen-line').length
      });
    });

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
    trackInvoiceProgress();
    return true;
  }

  function bootInvoiceGenerator(attempt) {
    attempt = attempt || 0;
    if (init()) return;
    if (attempt < 50) {
      window.setTimeout(function () { bootInvoiceGenerator(attempt + 1); }, 100);
      return;
    }
    if (window.console) {
      console.error('[InvoiceIt] Generator could not start: required elements not found.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { bootInvoiceGenerator(0); });
  } else {
    bootInvoiceGenerator(0);
  }
})();
