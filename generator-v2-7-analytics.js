/*
 * InvoiceIt — global invoice generator v2.7
 *
 * Changes from v1.4:
 * - More reliable Webflow startup: waits for required elements before initialising.
 * - Prevents accidental double initialisation.
 * - Sends the GA4 `pdf_downloaded` event only after the PDF save is triggered.
 * - Adds country presets, multiple currencies, local tax labels and US date format.
 * - Localises address, email and bank-payment labels for each market.
 * - Replaces single address boxes with structured multi-row address fields.
 * - Adds first-visit business-country setup.
 * - Adds logo upload, brand colour, saved clients and browser-local drafts.
 * - Keeps the market selector permanently visible.
 * - Leaves business and client country fields blank by default.
 * - Cleans legacy country-only address data saved by earlier versions.
 * - Uses native calendar date pickers and payment-term presets.
 * - Adds visible calendar buttons for Safari and mobile browsers.
 * - Removes legacy duplicate address labels and invalid saved date values.
 * - Keeps city/region/postal labels in sync with the selected market.
 * - Adds GA4 product analytics events and funnel tracking.
 *
 * Template variants via ?template= URL parameter:
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
  var CLIENTS_KEY = 'invoiceit.clients.v1';
  var DRAFT_KEY = 'invoiceit.draft.v1';
  var MARKET_KEY = 'invoiceit.market.v1';
  var BRAND_KEY = 'invoiceit.brand.v1';

  var ANALYTICS_STATE = {
    started: false,
    completed: false,
    paymentLinkTracked: false,
    logoTracked: false
  };

  function analyticsEvent(name, params) {
    params = params || {};

    params.market = marketCode();
    params.currency = currencyCode();
    params.template = (function () {
      try {
        return new URLSearchParams(location.search).get('template') || 'blank';
      } catch (e) {
        return 'blank';
      }
    })();
    params.page_path = location.pathname;
    params.device_type = window.matchMedia && window.matchMedia('(max-width: 767px)').matches
      ? 'mobile'
      : 'desktop';

    if (typeof window.gtag === 'function') {
      window.gtag('event', name, params);
    }

    if (window.dataLayer && Array.isArray(window.dataLayer)) {
      window.dataLayer.push(Object.assign({ event: name }, params));
    }
  }

  function requiredInvoiceFieldsComplete() {
    return Boolean(
      val('biz-name') &&
      val('cli-name') &&
      val('inv-number') &&
      val('inv-date') &&
      val('inv-due') &&
      readLines().length
    );
  }

  function trackInvoiceProgress() {
    if (!ANALYTICS_STATE.started) {
      var hasStarted =
        val('biz-name') ||
        val('cli-name') ||
        val('inv-number') ||
        val('inv-date') ||
        val('inv-due') ||
        readLines().length;

      if (hasStarted) {
        ANALYTICS_STATE.started = true;
        analyticsEvent('invoice_started');
      }
    }

    if (!ANALYTICS_STATE.completed && requiredInvoiceFieldsComplete()) {
      ANALYTICS_STATE.completed = true;
      analyticsEvent('invoice_completed', {
        line_item_count: readLines().length,
        tax_rate: num(val('vat-rate'))
      });
    }

    if (!ANALYTICS_STATE.paymentLinkTracked && val('pay-link')) {
      ANALYTICS_STATE.paymentLinkTracked = true;
      analyticsEvent('payment_link_added');
    }
  }

  var INITIALIZED = false;

  var $ = function (id) { return document.getElementById(id); };

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
    } catch (e) {}
    return TEMPLATES.blank;
  }

  var TPL = activeTemplate();

  var MARKETS = {
    GB: {
      label: 'United Kingdom',
      currency: 'GBP',
      locale: 'en-GB',
      taxIdLabel: 'VAT number',
      taxRateLabel: 'VAT rate',
      taxName: 'VAT',
      businessAddressPlaceholder: 'Street address\nTown or city\nPostcode\nUnited Kingdom',
      clientAddressPlaceholder: 'Street address\nTown or city\nPostcode\nUnited Kingdom',
      emailPlaceholder: 'name@business.co.uk',
      bankNameLabel: 'Account name',
      bankNamePlaceholder: 'Your Business Ltd',
      bankCodeLabel: 'Sort code',
      bankCodePlaceholder: '00-00-00',
      bankAccountLabel: 'Account number',
      bankAccountPlaceholder: '12345678',
      regionLabel: 'State / Territory',
      postalLabel: 'Postcode',
      cityLabel: 'Suburb / City'
    },
    US: {
      label: 'United States',
      currency: 'USD',
      locale: 'en-US',
      taxIdLabel: 'Tax ID / EIN',
      taxRateLabel: 'Sales tax rate',
      taxName: 'Sales tax',
      businessAddressPlaceholder: 'Street address\nCity, State ZIP code\nUnited States',
      clientAddressPlaceholder: 'Street address\nCity, State ZIP code\nUnited States',
      emailPlaceholder: 'name@business.com',
      bankNameLabel: 'Account holder name',
      bankNamePlaceholder: 'Your Business LLC',
      bankCodeLabel: 'Routing number',
      bankCodePlaceholder: '123456789',
      bankAccountLabel: 'Account number',
      bankAccountPlaceholder: '1234567890',
      regionLabel: 'State',
      postalLabel: 'ZIP code',
      cityLabel: 'City'
    },
    CA: {
      label: 'Canada',
      currency: 'CAD',
      locale: 'en-CA',
      taxIdLabel: 'GST/HST number',
      taxRateLabel: 'GST/HST rate',
      taxName: 'GST/HST',
      businessAddressPlaceholder: 'Street address\nCity, Province Postal code\nCanada',
      clientAddressPlaceholder: 'Street address\nCity, Province Postal code\nCanada',
      emailPlaceholder: 'name@business.ca',
      bankNameLabel: 'Account holder name',
      bankNamePlaceholder: 'Your Business Inc.',
      bankCodeLabel: 'Transit / institution number',
      bankCodePlaceholder: '12345 / 001',
      bankAccountLabel: 'Account number',
      bankAccountPlaceholder: '1234567',
      regionLabel: 'Province',
      postalLabel: 'Postal code',
      cityLabel: 'City'
    },
    AU: {
      label: 'Australia',
      currency: 'AUD',
      locale: 'en-AU',
      taxIdLabel: 'ABN',
      taxRateLabel: 'GST rate',
      taxName: 'GST',
      businessAddressPlaceholder: 'Street address\nSuburb State Postcode\nAustralia',
      clientAddressPlaceholder: 'Street address\nSuburb State Postcode\nAustralia',
      emailPlaceholder: 'name@business.com.au',
      bankNameLabel: 'Account name',
      bankNamePlaceholder: 'Your Business Pty Ltd',
      bankCodeLabel: 'BSB',
      bankCodePlaceholder: '000-000',
      bankAccountLabel: 'Account number',
      bankAccountPlaceholder: '12345678'
    },
    NZ: {
      label: 'New Zealand',
      currency: 'NZD',
      locale: 'en-NZ',
      taxIdLabel: 'GST number',
      taxRateLabel: 'GST rate',
      taxName: 'GST',
      businessAddressPlaceholder: 'Street address\nSuburb, City Postcode\nNew Zealand',
      clientAddressPlaceholder: 'Street address\nSuburb, City Postcode\nNew Zealand',
      emailPlaceholder: 'name@business.co.nz',
      bankNameLabel: 'Account name',
      bankNamePlaceholder: 'Your Business Ltd',
      bankCodeLabel: 'Bank / branch number',
      bankCodePlaceholder: '00-0000',
      bankAccountLabel: 'Account number',
      bankAccountPlaceholder: '0000000-00',
      regionLabel: 'Region',
      postalLabel: 'Postcode',
      cityLabel: 'Suburb / City'
    },
    EU: {
      label: 'Euro area',
      currency: 'EUR',
      locale: 'en-IE',
      taxIdLabel: 'VAT number',
      taxRateLabel: 'VAT rate',
      taxName: 'VAT',
      businessAddressPlaceholder: 'Street address\nPostal code City\nCountry',
      clientAddressPlaceholder: 'Street address\nPostal code City\nCountry',
      emailPlaceholder: 'name@business.com',
      bankNameLabel: 'Account holder name',
      bankNamePlaceholder: 'Your Business',
      bankCodeLabel: 'IBAN / BIC',
      bankCodePlaceholder: 'IBAN and BIC',
      bankAccountLabel: 'Bank reference',
      bankAccountPlaceholder: 'Optional',
      regionLabel: 'Region / Province',
      postalLabel: 'Postal code',
      cityLabel: 'City'
    }
  };

  function marketCode() {
    return $('market-country') ? $('market-country').value : 'GB';
  }

  function market() {
    return MARKETS[marketCode()] || MARKETS.GB;
  }

  function currencyCode() {
    return $('market-currency') ? $('market-currency').value : market().currency;
  }
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
    '.invoiceit-setup{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.62)}',
    '.invoiceit-setup-card{width:100%;max-width:620px;background:#fff;border-radius:20px;padding:30px;box-shadow:0 24px 90px rgba(0,0,0,.28)}',
    '.invoiceit-market-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:20px}',
    '.invoiceit-market-btn{border:1px solid #dbe2ea;background:#fff;border-radius:12px;padding:15px;text-align:left;font:inherit;font-weight:600;cursor:pointer}',
    '.invoiceit-market-btn:hover{border-color:#2563eb;background:#f8fbff}',
    '.invoiceit-tools{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}',
    '.invoiceit-mini-btn{border:1px solid #dbe2ea;background:#fff;border-radius:9px;padding:10px 12px;font:inherit;font-weight:600;cursor:pointer}',
    '.invoiceit-stepbar{display:none;gap:8px;overflow:auto;margin-bottom:16px;padding-bottom:4px}',
    '.invoiceit-stepbtn{white-space:nowrap;border:1px solid #dbe2ea;background:#fff;border-radius:999px;padding:8px 12px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}',
    '.invoiceit-stepbtn.is-active{background:#2563eb;border-color:#2563eb;color:#fff}',
    '.invoiceit-date-wrap{position:relative}',
    '.invoiceit-date-wrap .gen-input{padding-right:54px}',
    '.invoiceit-calendar-btn{position:absolute;right:7px;top:50%;transform:translateY(-50%);width:40px;height:38px;border:0;border-radius:8px;background:#f1f5f9;color:#14181f;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center}',
    '[data-address-group]{margin-bottom:18px}',
    '[data-address-group] .gen-label{margin-bottom:7px}',
    '@media(max-width:767px){[data-address-group] .gen-row-2{grid-template-columns:1fr!important;gap:8px!important}}',
    '@media(max-width:767px){.invoiceit-market-grid{grid-template-columns:1fr}.invoiceit-stepbar{display:flex}.invoiceit-step-section{display:none}.invoiceit-step-section.is-active{display:block}}'
  ].join('');

  function injectStyles() {
    if ($('invoiceit-gen-styles')) return;
    var s = document.createElement('style');
    s.id = 'invoiceit-gen-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function money(n) {
    var value = Number(n) || 0;
    try {
      return new Intl.NumberFormat(market().locale, {
        style: 'currency',
        currency: currencyCode(),
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    } catch (e) {
      return value.toFixed(2) + ' ' + currencyCode();
    }
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

  function isoDate(d) {
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
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

      if (marketCode() === 'US') {
        return new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]));
      }

      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    }

    return null;
  }

  function isValidDateValue(value) {
    if (!value) return false;
    var parsed = parseDateValue(value);
    return Boolean(parsed && !isNaN(parsed.getTime()));
  }

  function cleanLegacyDates() {
    var invoiceInput = $('inv-date');
    var dueInput = $('inv-due');

    if (invoiceInput && invoiceInput.value && !isValidDateValue(invoiceInput.value)) {
      invoiceInput.value = '';
    }

    if (dueInput && dueInput.value && !isValidDateValue(dueInput.value)) {
      dueInput.value = '';
    }
  }

  function displayDate(value) {
    var date = parseDateValue(value);
    if (!date || isNaN(date.getTime())) return value || '';

    try {
      return new Intl.DateTimeFormat(market().locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(date);
    } catch (e) {
      return value || '';
    }
  }

  function val(id) {
    var el = $(id);
    return el ? el.value.trim() : '';
  }

  function addressFieldHtml(prefix, title) {
    return (
      '<div class="gen-field" data-address-group="' + prefix + '">' +
        '<div class="gen-label">' + title + '</div>' +
        '<input id="' + prefix + '-address-1" type="text" class="gen-input" placeholder="Address line 1" autocomplete="address-line1">' +
        '<input id="' + prefix + '-address-2" type="text" class="gen-input" placeholder="Address line 2 (optional)" autocomplete="address-line2" style="margin-top:8px">' +
        '<div class="gen-row-2" style="margin-top:8px">' +
          '<div class="gen-field" style="margin-bottom:0">' +
            '<div class="gen-label" id="' + prefix + '-city-label">Town or city</div>' +
            '<input id="' + prefix + '-city" type="text" class="gen-input" autocomplete="address-level2">' +
          '</div>' +
          '<div class="gen-field" style="margin-bottom:0">' +
            '<div class="gen-label" id="' + prefix + '-region-label">County</div>' +
            '<input id="' + prefix + '-region" type="text" class="gen-input" autocomplete="address-level1">' +
          '</div>' +
        '</div>' +
        '<div class="gen-row-2" style="margin-top:8px">' +
          '<div class="gen-field" style="margin-bottom:0">' +
            '<div class="gen-label" id="' + prefix + '-postal-label">Postcode</div>' +
            '<input id="' + prefix + '-postal" type="text" class="gen-input" autocomplete="postal-code">' +
          '</div>' +
          '<div class="gen-field" style="margin-bottom:0">' +
            '<div class="gen-label">Country</div>' +
            '<input id="' + prefix + '-country" type="text" class="gen-input" autocomplete="country-name" placeholder="Enter country">' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function composeAddress(prefix) {
    var parts = [];
    var line1 = val(prefix + '-address-1');
    var line2 = val(prefix + '-address-2');
    var city = val(prefix + '-city');
    var region = val(prefix + '-region');
    var postal = val(prefix + '-postal');
    var country = val(prefix + '-country');

    if (line1) parts.push(line1);
    if (line2) parts.push(line2);

    var locality = '';
    if (marketCode() === 'US') {
      locality = city;
      if (region) locality += (locality ? ', ' : '') + region;
      if (postal) locality += (locality ? ' ' : '') + postal;
    } else {
      locality = city;
      if (region) locality += (locality ? ', ' : '') + region;
      if (postal) locality += (locality ? ' ' : '') + postal;
    }

    if (locality) parts.push(locality);
    if (country) parts.push(country);

    return parts.join('\n');
  }

  function syncAddress(prefix, targetId) {
    var target = $(targetId);
    if (target) target.value = composeAddress(prefix);
  }

  function isLegacyCountryOnlyAddress(value) {
    var cleaned = String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    if (!cleaned) return false;

    var names = Object.keys(MARKETS).map(function (key) {
      return MARKETS[key].label.toLowerCase();
    });

    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      if (
        cleaned === name ||
        cleaned === name + name ||
        cleaned === name + ' ' + name
      ) {
        return true;
      }
    }

    return false;
  }

  function clearStructuredAddress(prefix, targetId) {
    [
      'address-1', 'address-2', 'city', 'region', 'postal', 'country'
    ].forEach(function (suffix) {
      var field = $(prefix + '-' + suffix);
      if (field) field.value = '';
    });

    var target = $(targetId);
    if (target) target.value = '';
  }

  function cleanLegacyAddress(prefix, targetId) {
    var target = $(targetId);
    if (!target) return;

    if (isLegacyCountryOnlyAddress(target.value)) {
      clearStructuredAddress(prefix, targetId);
    }
  }

  function populateAddressFields(prefix, targetId) {
    var target = $(targetId);
    if (!target || !target.value.trim()) return;

    if (isLegacyCountryOnlyAddress(target.value)) {
      clearStructuredAddress(prefix, targetId);
      return;
    }

    var lines = target.value.split(/\n+/).map(function (line) {
      return line.trim();
    }).filter(Boolean);

    if (!lines.length) return;

    if ($(prefix + '-address-1')) $(prefix + '-address-1').value = lines[0] || '';
    if ($(prefix + '-address-2')) $(prefix + '-address-2').value = lines.length > 3 ? (lines[1] || '') : '';

    var localityIndex = lines.length > 3 ? 2 : 1;
    if ($(prefix + '-city')) $(prefix + '-city').value = lines[localityIndex] || '';
    if ($(prefix + '-country')) $(prefix + '-country').value = lines[lines.length - 1] || '';
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
    original.style.display = 'none';
    original.setAttribute('aria-hidden', 'true');

    populateAddressFields(prefix, targetId);

    group.addEventListener('input', function () {
      syncAddress(prefix, targetId);
      render();
    });

    group.addEventListener('change', function () {
      syncAddress(prefix, targetId);
      render();
    });
  }

  function removeLegacyAddressArtifacts() {
    var labels = Array.prototype.slice.call(
      document.querySelectorAll('.gen-label, label, .field-label, .w-form-label, div, span')
    );

    labels.forEach(function (el) {
      var text = String(el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();

      if (text !== 'client address' && text !== 'business address') return;

      var group = el.closest('[data-address-group]');
      if (group) return;

      var field = el.closest('.gen-field');
      if (!field) return;

      var hasVisibleInput = Array.prototype.some.call(
        field.querySelectorAll('input,textarea,select'),
        function (input) {
          return input.style.display !== 'none' && input.type !== 'hidden';
        }
      );

      if (!hasVisibleInput) {
        field.style.display = 'none';
        field.setAttribute('aria-hidden', 'true');
      }
    });

    ['biz-address', 'cli-address'].forEach(function (id) {
      var original = $(id);
      if (!original) return;

      var originalField = original.closest('.gen-field');
      if (originalField) {
        originalField.style.display = 'none';
        originalField.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function buildAddressFields() {
    buildStructuredAddress('biz-address', 'biz', 'Business address');
    buildStructuredAddress('cli-address', 'cli', 'Client address');
    removeLegacyAddressArtifacts();
  }

  function applyAddressChrome() {
    var cfg = market();

    ['biz', 'cli'].forEach(function (prefix) {
      var cityLabel = $(prefix + '-city-label');
      var regionLabel = $(prefix + '-region-label');
      var postalLabel = $(prefix + '-postal-label');
      var country = $(prefix + '-country');

      if (cityLabel) cityLabel.textContent = cfg.cityLabel;
      if (regionLabel) regionLabel.textContent = cfg.regionLabel;
      if (postalLabel) postalLabel.textContent = cfg.postalLabel;

      if (country) {
        country.placeholder = 'Enter country';
        country.removeAttribute('value');
      }
    });

    syncAddress('biz', 'biz-address');
    syncAddress('cli', 'cli-address');
    removeLegacyAddressArtifacts();
  }


  function storageGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  function showMarketSetup() {
    if (document.getElementById('invoiceit-market-setup')) return;

    var saved = storageGet(MARKET_KEY, null);
    if (saved && MARKETS[saved]) {
      if ($('market-country')) $('market-country').value = saved;
      applyMarketChrome(true);
      applyAddressChrome();
      return;
    }

    var overlay = document.createElement('div');
    overlay.id = 'invoiceit-market-setup';
    overlay.className = 'invoiceit-setup';
    overlay.innerHTML =
      '<div class="invoiceit-setup-card">' +
        '<div style="font-size:12px;font-weight:700;letter-spacing:.06em;color:#2563eb">SET UP YOUR INVOICE</div>' +
        '<h2 style="margin:8px 0 8px;font-size:30px;color:#14181f">Where is your business based?</h2>' +
        '<p style="margin:0;color:#5b6472;line-height:1.55">We will tailor currency, tax, dates, address fields and bank details to your market.</p>' +
        '<div class="invoiceit-market-grid">' +
          '<button class="invoiceit-market-btn" data-market-choice="GB">🇬🇧 United Kingdom</button>' +
          '<button class="invoiceit-market-btn" data-market-choice="US">🇺🇸 United States</button>' +
          '<button class="invoiceit-market-btn" data-market-choice="CA">🇨🇦 Canada</button>' +
          '<button class="invoiceit-market-btn" data-market-choice="AU">🇦🇺 Australia</button>' +
          '<button class="invoiceit-market-btn" data-market-choice="NZ">🇳🇿 New Zealand</button>' +
          '<button class="invoiceit-market-btn" data-market-choice="EU">🇪🇺 Euro area</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-market-choice]');
      if (!btn) return;

      var choice = btn.getAttribute('data-market-choice');
      storageSet(MARKET_KEY, choice);
      analyticsEvent('country_selected', {
        selected_country: choice,
        selection_source: 'initial_setup'
      });

      if ($('market-country')) $('market-country').value = choice;
      if ($('market-currency')) {
        $('market-currency').value = MARKETS[choice].currency;
        delete $('market-currency').dataset.userSet;
      }

      applyMarketChrome(true);
      applyAddressChrome();
      overlay.remove();
    });
  }

  function buildBrandFields() {
    if ($('invoiceit-logo-input')) return;

    var anchor = $('biz-email') && $('biz-email').closest('.gen-field');
    if (!anchor || !anchor.parentNode) return;

    var wrap = document.createElement('div');
    wrap.className = 'gen-row-2';
    wrap.innerHTML =
      '<div class="gen-field">' +
        '<div class="gen-label">Business logo</div>' +
        '<input id="invoiceit-logo-input" type="file" accept="image/png,image/jpeg,image/webp" class="gen-input">' +
        '<div class="gen-hint">PNG, JPG or WebP. Stored in this browser.</div>' +
      '</div>' +
      '<div class="gen-field">' +
        '<div class="gen-label">Brand colour</div>' +
        '<input id="invoiceit-brand-colour" type="color" value="#2563eb" class="gen-input" style="height:48px;padding:5px">' +
      '</div>';

    anchor.parentNode.insertBefore(wrap, anchor.nextSibling);

    var saved = storageGet(BRAND_KEY, {});
    if (saved.colour && $('invoiceit-brand-colour')) {
      $('invoiceit-brand-colour').value = saved.colour;
    }

    $('invoiceit-logo-input').addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function () {
        var brand = storageGet(BRAND_KEY, {});
        brand.logo = reader.result;
        storageSet(BRAND_KEY, brand);
        render();

        if (!ANALYTICS_STATE.logoTracked) {
          ANALYTICS_STATE.logoTracked = true;
          analyticsEvent('logo_uploaded', {
            file_type: file.type || 'unknown'
          });
        }
      };
      reader.readAsDataURL(file);
    });

    $('invoiceit-brand-colour').addEventListener('input', function () {
      var brand = storageGet(BRAND_KEY, {});
      brand.colour = this.value;
      storageSet(BRAND_KEY, brand);
      render();
    });
  }

  function clientRecordFromForm() {
    return {
      name: val('cli-name'),
      address1: val('cli-address-1'),
      address2: val('cli-address-2'),
      city: val('cli-city'),
      region: val('cli-region'),
      postal: val('cli-postal'),
      country: val('cli-country')
    };
  }

  function loadClientRecord(record) {
    if (!record) return;

    if ($('cli-name')) $('cli-name').value = record.name || '';
    if ($('cli-address-1')) $('cli-address-1').value = record.address1 || '';
    if ($('cli-address-2')) $('cli-address-2').value = record.address2 || '';
    if ($('cli-city')) $('cli-city').value = record.city || '';
    if ($('cli-region')) $('cli-region').value = record.region || '';
    if ($('cli-postal')) $('cli-postal').value = record.postal || '';
    if ($('cli-country')) $('cli-country').value = record.country || '';

    syncAddress('cli', 'cli-address');
    render();
  }

  function refreshClientSelect() {
    var select = $('invoiceit-client-select');
    if (!select) return;

    var clients = storageGet(CLIENTS_KEY, []);
    select.innerHTML = '<option value="">Load a saved client</option>';

    clients.forEach(function (client, index) {
      var option = document.createElement('option');
      option.value = String(index);
      option.textContent = client.name || ('Client ' + (index + 1));
      select.appendChild(option);
    });
  }

  function buildClientTools() {
    if ($('invoiceit-client-select')) return;

    var anchor = $('cli-name') && $('cli-name').closest('.gen-field');
    if (!anchor || !anchor.parentNode) return;

    var wrap = document.createElement('div');
    wrap.className = 'invoiceit-tools';
    wrap.innerHTML =
      '<select id="invoiceit-client-select" class="gen-input"><option value="">Load a saved client</option></select>' +
      '<button type="button" id="invoiceit-save-client" class="invoiceit-mini-btn">Save this client</button>';

    anchor.parentNode.insertBefore(wrap, anchor);
    refreshClientSelect();

    $('invoiceit-client-select').addEventListener('change', function () {
      if (this.value === '') return;
      var clients = storageGet(CLIENTS_KEY, []);
      loadClientRecord(clients[parseInt(this.value, 10)]);
    });

    $('invoiceit-save-client').addEventListener('click', function () {
      var record = clientRecordFromForm();
      if (!record.name) {
        flash($('download-pdf'), 'Add a client name before saving');
        return;
      }

      var clients = storageGet(CLIENTS_KEY, []);
      var existing = clients.findIndex(function (client) {
        return String(client.name).toLowerCase() === String(record.name).toLowerCase();
      });

      if (existing >= 0) clients[existing] = record;
      else clients.push(record);

      storageSet(CLIENTS_KEY, clients);
      analyticsEvent('client_saved', {
        saved_client_count: clients.length
      });
      refreshClientSelect();
      this.textContent = 'Client saved';
      var btn = this;
      setTimeout(function () { btn.textContent = 'Save this client'; }, 1600);
    });
  }

  function serialiseDraft() {
    var ids = [
      'biz-name','biz-address','biz-vat','biz-email','inv-number','inv-date','inv-due',
      'cli-name','cli-address','vat-rate','payment-terms','pay-account-name',
      'pay-sort','pay-account','pay-link','market-country','market-currency'
    ];

    var values = {};
    ids.forEach(function (id) {
      if ($(id)) values[id] = $(id).value;
    });

    var structured = {};
    ['biz','cli'].forEach(function (prefix) {
      ['address-1','address-2','city','region','postal','country'].forEach(function (suffix) {
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

    applyMarketChrome(false);
    applyAddressChrome();
    buildDateControls();
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
      if (!draft) {
        flash($('download-pdf'), 'No saved draft found in this browser');
        return;
      }
      restoreDraft(draft);
      analyticsEvent('draft_loaded');
    });
  }

  function buildMobileSteps() {
    if (document.getElementById('invoiceit-stepbar')) return;

    var panel = document.querySelector('.gen-panel');
    if (!panel) return;

    var candidates = Array.prototype.slice.call(panel.children).filter(function (node) {
      return node.nodeType === 1 && !node.classList.contains('invoiceit-stepbar');
    });

    if (candidates.length < 4) return;

    var labels = ['Business', 'Client', 'Invoice', 'Items', 'Preview'];
    var stepbar = document.createElement('div');
    stepbar.id = 'invoiceit-stepbar';
    stepbar.className = 'invoiceit-stepbar';

    var groups = [];
    var groupSize = Math.ceil(candidates.length / Math.min(labels.length, candidates.length));

    for (var i = 0; i < candidates.length; i += groupSize) {
      var section = document.createElement('div');
      section.className = 'invoiceit-step-section';
      if (!groups.length) section.classList.add('is-active');

      var slice = candidates.slice(i, i + groupSize);
      panel.insertBefore(section, slice[0]);
      slice.forEach(function (node) { section.appendChild(node); });
      groups.push(section);
    }

    groups.forEach(function (group, index) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'invoiceit-stepbtn' + (index === 0 ? ' is-active' : '');
      button.textContent = labels[index] || ('Step ' + (index + 1));

      button.addEventListener('click', function () {
        groups.forEach(function (g) { g.classList.remove('is-active'); });
        stepbar.querySelectorAll('.invoiceit-stepbtn').forEach(function (b) {
          b.classList.remove('is-active');
        });

        group.classList.add('is-active');
        button.classList.add('is-active');
        group.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      stepbar.appendChild(button);
    });

    panel.insertBefore(stepbar, panel.firstChild);
  }

  function addDays(date, days) {
    var next = new Date(date.getTime());
    next.setDate(next.getDate() + Number(days || 0));
    return next;
  }

  function updateDueDateFromTerms(force) {
    var invoiceInput = $('inv-date');
    var dueInput = $('inv-due');
    var terms = $('invoiceit-payment-terms');

    if (!invoiceInput || !dueInput || !terms) return;
    if (!force && dueInput.dataset.userSet === '1') return;

    var invoiceDate = parseDateValue(invoiceInput.value) || new Date();
    var days = Number(terms.value);

    dueInput.value = isoDate(addDays(invoiceDate, days));
    dueInput.dataset.autoCalculated = '1';
    render();
  }

  function migrateDateInput(input) {
    if (!input) return;

    var parsed = parseDateValue(input.value);
    input.type = 'date';

    if (parsed && !isNaN(parsed.getTime())) {
      input.value = isoDate(parsed);
    } else {
      input.value = '';
    }
  }

  function openNativeDatePicker(input) {
    if (!input) return;

    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
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
    button.textContent = '📅';

    button.addEventListener('click', function (event) {
      event.preventDefault();
      openNativeDatePicker(input);
    });

    wrap.appendChild(button);
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
            '<option value="90">Net 90 days</option>' +
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

  function buildMarketFields() {
    if ($('market-country')) return;

    var panel = document.querySelector('.gen-panel');
    var anchor = $('biz-name') && $('biz-name').closest('.gen-field');
    if (!anchor) anchor = $('biz-vat') && $('biz-vat').closest('.gen-field');
    if (!anchor) anchor = $('vat-rate') && $('vat-rate').closest('.gen-field');
    if (!anchor || !anchor.parentNode) return;

    var section = document.createElement('div');
    section.id = 'invoiceit-market-controls';
    section.style.marginBottom = '18px';
    section.innerHTML =
      '<div class="gen-label" style="margin-bottom:8px">Where is your business based?</div>' +
      '<div class="gen-row-2">' +
        '<div class="gen-field" style="margin-bottom:0">' +
          '<select id="market-country" class="gen-input" aria-label="Business country or market">' +
            '<option value="GB">United Kingdom</option>' +
            '<option value="US">United States</option>' +
            '<option value="CA">Canada</option>' +
            '<option value="AU">Australia</option>' +
            '<option value="NZ">New Zealand</option>' +
            '<option value="EU">Euro area</option>' +
          '</select>' +
        '</div>' +
        '<div class="gen-field" style="margin-bottom:0">' +
          '<select id="market-currency" class="gen-input" aria-label="Invoice currency">' +
            '<option value="GBP">GBP — £</option>' +
            '<option value="USD">USD — $</option>' +
            '<option value="EUR">EUR — €</option>' +
            '<option value="CAD">CAD — $</option>' +
            '<option value="AUD">AUD — $</option>' +
            '<option value="NZD">NZD — $</option>' +
          '</select>' +
        '</div>' +
      '</div>';

    anchor.parentNode.insertBefore(section, anchor);

    var saved = storageGet(MARKET_KEY, null);
    if (saved && MARKETS[saved]) {
      $('market-country').value = saved;
      $('market-currency').value = MARKETS[saved].currency;
    }
  }

  function applyMarketChrome(resetDates) {
    var cfg = market();

    if ($('market-currency') && !$('market-currency').dataset.userSet) {
      $('market-currency').value = cfg.currency;
    }

    var taxId = $('biz-vat');
    if (taxId) {
      var taxIdField = taxId.closest('.gen-field');
      var taxIdLabel = taxIdField && taxIdField.querySelector('.gen-label');
      if (taxIdLabel) taxIdLabel.textContent = cfg.taxIdLabel;
      taxId.placeholder = cfg.taxIdLabel;
    }

    var taxRate = $('vat-rate');
    if (taxRate) {
      var taxRateField = taxRate.closest('.gen-field');
      var taxRateLabel = taxRateField && taxRateField.querySelector('.gen-label');
      if (taxRateLabel) taxRateLabel.textContent = cfg.taxRateLabel;
    }

    var businessAddress = $('biz-address');
    if (businessAddress) businessAddress.placeholder = cfg.businessAddressPlaceholder;

    var clientAddress = $('cli-address');
    if (clientAddress) clientAddress.placeholder = cfg.clientAddressPlaceholder;

    var businessEmail = $('biz-email');
    if (businessEmail) businessEmail.placeholder = cfg.emailPlaceholder;

    var accountNameLabel = $('pay-account-name-label');
    if (accountNameLabel) accountNameLabel.textContent = cfg.bankNameLabel;

    var accountName = $('pay-account-name');
    if (accountName) accountName.placeholder = cfg.bankNamePlaceholder;

    var bankCodeLabel = $('pay-sort-label');
    if (bankCodeLabel) bankCodeLabel.textContent = cfg.bankCodeLabel;

    var bankCode = $('pay-sort');
    if (bankCode) bankCode.placeholder = cfg.bankCodePlaceholder;

    var bankAccountLabel = $('pay-account-label');
    if (bankAccountLabel) bankAccountLabel.textContent = cfg.bankAccountLabel;

    var bankAccount = $('pay-account');
    if (bankAccount) bankAccount.placeholder = cfg.bankAccountPlaceholder;

    if (resetDates) {
      var now = new Date();
      var due = new Date();
      due.setDate(due.getDate() + 30);
      if ($('inv-date')) $('inv-date').value = isoDate(now);
      if ($('inv-due')) $('inv-due').value = isoDate(due);
    }

    render();
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
      var descEl = rows[i].querySelector('[data-desc]');
      var qtyEl = rows[i].querySelector('[data-qty]');
      var rateEl = rows[i].querySelector('[data-rate]');
      if (!descEl || !qtyEl || !rateEl) continue;

      var desc = descEl.value.trim();
      var qtyRaw = qtyEl.value.trim();
      var rateRaw = rateEl.value.trim();

      if (!desc && !qtyRaw && !rateRaw) continue;

      var typeEl = rows[i].querySelector('[data-type]');
      var qty = qtyRaw === '' ? 1 : num(qtyRaw);
      var rate = num(rateRaw);

      out.push({
        desc: desc,
        qty: qty,
        rate: rate,
        amount: qty * rate,
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
      sub: sub,
      labour: labour,
      materials: materials,
      vatRate: vatRate,
      vat: vat,
      cisRate: cisRate,
      cis: cis,
      total: sub + vat - cis
    };
  }

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

    var brand = storageGet(BRAND_KEY, {});
    var brandColour = brand.colour || '#2563eb';
    var logoHtml = brand.logo
      ? '<img src="' + brand.logo + '" alt="" style="display:block;max-width:120px;max-height:54px;object-fit:contain;margin-bottom:10px">'
      : '';

    box.innerHTML =
      '<div class="iv-doc">' +
        '<div class="iv-head">' +
          '<div>' +
            logoHtml +
            '<div class="iv-biz">' + orGhost(val('biz-name'), 'Your business name') + '</div>' +
            '<div class="iv-muted">' + orGhost(val('biz-address'), 'Your address') + '</div>' +
            vatNo + email +
          '</div>' +
          '<div>' +
            '<div class="iv-word" style="color:' + brandColour + '">Invoice</div>' +
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

  var REMEMBER = [
    'biz-name', 'biz-address', 'biz-vat', 'biz-email', 'payment-terms',
    'pay-account-name', 'pay-sort', 'pay-account', 'pay-link',
    'market-country', 'market-currency'
  ];

  function saveBusiness() {
    try {
      var data = {};
      REMEMBER.forEach(function (id) { data[id] = val(id); });
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function loadBusiness() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;

      var data = JSON.parse(raw);
      REMEMBER.forEach(function (id) {
        if (data[id] && $(id)) $(id).value = data[id];
      });
    } catch (e) {}
  }

  function nextInvoiceNumber() {
    var n = 1;

    try {
      var stored = parseInt(localStorage.getItem(SEQ_KEY), 10);
      if (!isNaN(stored)) n = stored + 1;
    } catch (e) {}

    return 'INV-' + String(n).padStart(4, '0');
  }

  function bumpSequence() {
    var m = /(\d+)\s*$/.exec(val('inv-number'));
    if (!m) return;

    try {
      localStorage.setItem(SEQ_KEY, String(parseInt(m[1], 10)));
    } catch (e) {}
  }

  function loadJsPDF() {
    return new Promise(function (resolve, reject) {
      if (window.jspdf && window.jspdf.jsPDF) return resolve(window.jspdf.jsPDF);

      var s = document.createElement('script');
      s.src = JSPDF_CDN;
      s.onload = function () {
        if (window.jspdf && window.jspdf.jsPDF) resolve(window.jspdf.jsPDF);
        else reject(new Error('jsPDF loaded but not found on window'));
      };
      s.onerror = function () {
        reject(new Error('Could not load the PDF library'));
      };

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
    var brand = storageGet(BRAND_KEY, {});
    var brandColour = brand.colour || '#2563eb';
    var rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(brandColour);
    var brandRgb = rgb ? [parseInt(rgb[1], 16), parseInt(rgb[2], 16), parseInt(rgb[3], 16)] : [37, 99, 235];

    if (brand.logo) {
      try {
        doc.addImage(brand.logo, 'PNG', M, y - 6, 30, 14, undefined, 'FAST');
        y += 12;
      } catch (e) {}
    }

    doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(20, 24, 31);
    doc.text(val('biz-name') || 'Your business', M, y);

    doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(brandRgb[0], brandRgb[1], brandRgb[2]);
    doc.text('INVOICE', right, y, { align: 'right' });

    y += 6;
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(91, 100, 114);

    var addr = doc.splitTextToSize(val('biz-address') || '', 80);
    if (addr.length && addr[0]) {
      doc.text(addr, M, y);
      y += addr.length * 4;
    }

    if (val('biz-vat')) {
      doc.text(market().taxIdLabel + ': ' + val('biz-vat'), M, y);
      y += 4;
    }

    if (val('biz-email')) {
      doc.text(val('biz-email'), M, y);
      y += 4;
    }

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
    doc.text(displayDate(val('inv-date')) || '\u2014', right - 34, y);
    doc.text(displayDate(val('inv-due')) || '\u2014', right, y, { align: 'right' });

    y += 5;
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(91, 100, 114);

    var caddr = doc.splitTextToSize(val('cli-address') || '', 80);
    if (caddr.length && caddr[0]) {
      doc.text(caddr, M, y);
      y += caddr.length * 4;
    }

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
      if (y > 250) {
        doc.addPage();
        y = M + 6;
        tableHead();
      }

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
      if (y > 250) {
        doc.addPage();
        y = M + 6;
        tableHead();
      }

      doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(37, 99, 235);
      doc.text(label.toUpperCase(), M, y);
      y += 5.5;
    }

    if (TPL.lineTypes) {
      var lab = lines.filter(function (l) { return l.type !== 'materials'; });
      var mat = lines.filter(function (l) { return l.type === 'materials'; });

      if (lab.length) {
        pdfGroup('Labour');
        lab.forEach(pdfRow);
      }

      if (mat.length) {
        pdfGroup('Materials');
        mat.forEach(pdfRow);
      }
    } else {
      lines.forEach(pdfRow);
    }

    y += 5;

    if (y > 235) {
      doc.addPage();
      y = M + 6;
    }

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

    if (t.vatRate) {
      totalLine(market().taxName + ' at ' + t.vatRate + '%', money(t.vat));
    }

    if (t.cisRate) {
      totalLine('CIS deduction ' + t.cisRate + '% (labour)', money(-t.cis), { red: true });
    }

    y += 1;
    doc.setDrawColor(20, 24, 31).setLineWidth(0.5).line(labelX, y, right, y);
    y += 6;

    totalLine(
      t.cisRate ? 'Amount payable' : 'Total due',
      money(t.total),
      { bold: true, big: true }
    );

    var payLines = [];

    if (val('pay-account-name')) payLines.push(market().bankNameLabel + ': ' + val('pay-account-name'));
    if (val('pay-sort')) payLines.push(market().bankCodeLabel + ': ' + val('pay-sort'));
    if (val('pay-account')) payLines.push(market().bankAccountLabel + ': ' + val('pay-account'));
    if (val('payment-terms')) payLines.push(val('payment-terms'));

    if (payLines.length || val('pay-link')) {
      y += 8;

      if (y > 255) {
        doc.addPage();
        y = M + 6;
      }

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
        doc.textWithLink('Pay this invoice online', M + 3.5, y + 1, {
          url: val('pay-link')
        });
      }
    }

    var pageCount = doc.getNumberOfPages();

    for (var pg = 1; pg <= pageCount; pg++) {
      doc.setPage(pg);
      doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(180, 187, 199);
      doc.textWithLink('Created free with invoiceit.io', M, 290, {
        url: 'https://invoiceit.io/free-invoice-generator'
      });
    }

    return doc;
  }

  function filename() {
    var n = (val('inv-number') || 'invoice').replace(/[^a-z0-9\-_]/gi, '-');
    var c = val('cli-name')
      .replace(/[^a-z0-9\-_ ]/gi, '')
      .trim()
      .replace(/\s+/g, '-');

    return (c ? n + '-' + c : n).toLowerCase() + '.pdf';
  }

  function trackPdfDownload() {
    analyticsEvent('pdf_downloaded', {
      line_item_count: readLines().length,
      invoice_total: totals(readLines()).total,
      tax_rate: num(val('vat-rate'))
    });
  }

  function onDownload() {
    var btn = $('download-pdf');
    var lines = readLines();

    if (!lines.length) {
      flash(btn, 'Add at least one item first');
      return;
    }

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

        if (window.console) {
          console.error('[InvoiceIt]', err);
        }
      });
  }

  function flash(btn, message) {
    if (!btn) return;

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
    note._t = setTimeout(function () {
      note.textContent = '';
    }, 4000);
  }

  function requiredElementsExist() {
    return Boolean(
      $('preview') &&
      $('line-items') &&
      $('add-line') &&
      $('download-pdf') &&
      $('inv-number') &&
      $('inv-date') &&
      $('inv-due')
    );
  }

  function init() {
    if (INITIALIZED || !requiredElementsExist()) return false;
    INITIALIZED = true;

    analyticsEvent('template_selected');
    injectStyles();
    buildMarketFields();
    buildAddressFields();
    buildDateControls();
    applyTemplateChrome();
    applyMarketChrome(false);
    applyAddressChrome();
    buildPaymentFields();
    buildBrandFields();
    buildClientTools();
    buildDraftTools();

    if (!document.querySelector('.gen-line-head')) {
      var head = document.createElement('div');
      head.className = 'gen-line-head';
      head.innerHTML =
        '<span data-h-desc>Description</span>' +
        (TPL.lineTypes ? '<span data-h-type>Type</span>' : '') +
        '<span>' + esc(TPL.qtyLabel) + '</span>' +
        '<span>' + esc(TPL.rateLabel) + '</span>' +
        '<span></span>';

      $('line-items').parentNode.insertBefore(head, $('line-items'));
    }

    loadBusiness();
    cleanLegacyDates();
    cleanLegacyAddress('biz', 'biz-address');
    cleanLegacyAddress('cli', 'cli-address');
    populateAddressFields('biz', 'biz-address');
    populateAddressFields('cli', 'cli-address');
    applyAddressChrome();

    if (!val('inv-number')) $('inv-number').value = nextInvoiceNumber();
    cleanLegacyDates();

    if (!val('inv-date')) $('inv-date').value = isoDate(new Date());

    if (!val('inv-due')) {
      var due = new Date();
      due.setDate(due.getDate() + 30);
      $('inv-due').value = isoDate(due);
    }

    if (!document.querySelector('#line-items .gen-line')) {
      addLine(false);
    }

    var form = $('biz-name') && $('biz-name').closest('form');

    if (form) {
      form.setAttribute('novalidate', 'novalidate');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
      });
    }

    document.addEventListener('input', function (e) {
      if (e.target.closest && e.target.closest('.gen-panel')) {
        render();
        trackInvoiceProgress();
      }
    });

    document.addEventListener('change', function (e) {
      if (!e.target.closest || !e.target.closest('.gen-panel')) return;

      if (e.target.id === 'vat-rate') {
        e.target.dataset.userSet = '1';
        analyticsEvent('tax_type_selected', {
          tax_name: market().taxName,
          tax_rate: num(e.target.value),
          tax_enabled: num(e.target.value) > 0
        });

        if (num(e.target.value) > 0) {
          analyticsEvent('vat_enabled', {
            tax_name: market().taxName,
            tax_rate: num(e.target.value)
          });
        }
      }

      if (e.target.id === 'market-currency') {
        e.target.dataset.userSet = '1';
        analyticsEvent('currency_selected', {
          selected_currency: e.target.value
        });
        saveBusiness();
      }

      if (e.target.id === 'market-country') {
        storageSet(MARKET_KEY, e.target.value);
        analyticsEvent('country_selected', {
          selected_country: e.target.value
        });
        if ($('market-currency')) delete $('market-currency').dataset.userSet;
        cleanLegacyAddress('biz', 'biz-address');
        cleanLegacyAddress('cli', 'cli-address');
        applyMarketChrome(true);
        applyAddressChrome();
        saveBusiness();
        return;
      }

      render();
      trackInvoiceProgress();
    });

    $('add-line').addEventListener('click', function (e) {
      e.preventDefault();
      addLine(true);
      analyticsEvent('line_item_added', {
        line_item_count: document.querySelectorAll('#line-items .gen-line').length
      });
    });

    $('line-items').addEventListener('click', function (e) {
      if (!e.target.hasAttribute('data-remove')) return;

      var rows = document.querySelectorAll('#line-items .gen-line');

      if (rows.length === 1) {
        rows[0].querySelectorAll('input').forEach(function (i) {
          i.value = '';
        });

        var type = rows[0].querySelector('[data-type]');
        if (type) type.value = 'labour';
      } else {
        e.target.closest('.gen-line').remove();
      }

      analyticsEvent('line_item_removed', {
        line_item_count: document.querySelectorAll('#line-items .gen-line').length
      });
      render();
    });

    $('download-pdf').addEventListener('click', function (e) {
      e.preventDefault();
      onDownload();
    });

    REMEMBER.forEach(function (id) {
      if ($(id)) $(id).addEventListener('blur', saveBusiness);
    });

    render();
    trackInvoiceProgress();
    showMarketSetup();
    return true;
  }

  function bootInvoiceGenerator(attempt) {
    attempt = attempt || 0;

    if (init()) return;

    if (attempt < 50) {
      window.setTimeout(function () {
        bootInvoiceGenerator(attempt + 1);
      }, 100);
      return;
    }

    if (window.console) {
      console.error(
        '[InvoiceIt] Generator could not start because required Webflow elements were not found.',
        {
          preview: Boolean($('preview')),
          lineItems: Boolean($('line-items')),
          addLine: Boolean($('add-line')),
          downloadPdf: Boolean($('download-pdf')),
          invoiceNumber: Boolean($('inv-number')),
          invoiceDate: Boolean($('inv-date')),
          dueDate: Boolean($('inv-due'))
        }
      );
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      bootInvoiceGenerator(0);
    });
  } else {
    bootInvoiceGenerator(0);
  }
})();
