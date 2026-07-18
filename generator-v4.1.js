/*
 * InvoiceIt — invoice generator v4.1: global business and client country support with localised priority-market presets, generic fallbacks and custom tax rates, persistent currency overrides, locale currency/date formatting, market-aware tax and banking labels, international addresses, drafts and backward-compatible analytics. Includes searchable countries, accessible controls, guarded validation, autosave and production analytics. Saved clients, logo and brand colour remain reserved for Pro.
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
  var CLIENT_MARKET_KEY = 'invoiceit.client-market.v1';

  var GENERATOR_VERSION = '4.1';
  var INITIALIZED = false;
  var RENDER_TIMER = null;

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
    params.generator_version = GENERATOR_VERSION;
    params.market = marketCode();
    params.market_name = market().label;
    params.currency = currencyCode();
    params.invoice_theme = themeCode();
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
        invoice_theme: themeCode(),
        client_country: clientMarketCode()
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

  var COUNTRY_DATA = [["AF","Afghanistan","AFN"],["AL","Albania","ALL"],["DZ","Algeria","DZD"],["AS","American Samoa","USD"],["AD","Andorra","EUR"],["AO","Angola","AOA"],["AI","Anguilla","XCD"],["AQ","Antarctica","USD"],["AG","Antigua and Barbuda","XCD"],["AR","Argentina","ARS"],["AM","Armenia","AMD"],["AW","Aruba","AWG"],["AU","Australia","AUD"],["AT","Austria","EUR"],["AZ","Azerbaijan","AZN"],["BS","Bahamas","BSD"],["BH","Bahrain","BHD"],["BD","Bangladesh","BDT"],["BB","Barbados","BBD"],["BY","Belarus","BYN"],["BE","Belgium","EUR"],["BZ","Belize","BZD"],["BJ","Benin","XOF"],["BM","Bermuda","BMD"],["BT","Bhutan","INR"],["BO","Bolivia","BOB"],["BQ","Bonaire, Sint Eustatius and Saba","USD"],["BA","Bosnia and Herzegovina","BAM"],["BW","Botswana","BWP"],["BV","Bouvet Island","NOK"],["BR","Brazil","BRL"],["IO","British Indian Ocean Territory","USD"],["BN","Brunei Darussalam","BND"],["BG","Bulgaria","BGN"],["BF","Burkina Faso","XOF"],["BI","Burundi","BIF"],["CV","Cabo Verde","CVE"],["KH","Cambodia","KHR"],["CM","Cameroon","XAF"],["CA","Canada","CAD"],["KY","Cayman Islands","KYD"],["CF","Central African Republic","XAF"],["TD","Chad","XAF"],["CL","Chile","CLP"],["CN","China","CNY"],["CX","Christmas Island","AUD"],["CC","Cocos (Keeling) Islands","AUD"],["CO","Colombia","COP"],["KM","Comoros","KMF"],["CG","Congo","XAF"],["CD","Congo, The Democratic Republic of the","CDF"],["CK","Cook Islands","NZD"],["CR","Costa Rica","CRC"],["HR","Croatia","EUR"],["CU","Cuba","CUP"],["CW","Curaçao","XCG"],["CY","Cyprus","EUR"],["CZ","Czechia","CZK"],["CI","Côte d'Ivoire","XOF"],["DK","Denmark","DKK"],["DJ","Djibouti","DJF"],["DM","Dominica","XCD"],["DO","Dominican Republic","DOP"],["EC","Ecuador","USD"],["EG","Egypt","EGP"],["SV","El Salvador","USD"],["GQ","Equatorial Guinea","XAF"],["ER","Eritrea","ERN"],["EE","Estonia","EUR"],["SZ","Eswatini","SZL"],["ET","Ethiopia","ETB"],["FK","Falkland Islands (Malvinas)","FKP"],["FO","Faroe Islands","DKK"],["FJ","Fiji","FJD"],["FI","Finland","EUR"],["FR","France","EUR"],["GF","French Guiana","EUR"],["PF","French Polynesia","XPF"],["TF","French Southern Territories","EUR"],["GA","Gabon","XAF"],["GM","Gambia","GMD"],["GE","Georgia","GEL"],["DE","Germany","EUR"],["GH","Ghana","GHS"],["GI","Gibraltar","GIP"],["GR","Greece","EUR"],["GL","Greenland","DKK"],["GD","Grenada","XCD"],["GP","Guadeloupe","EUR"],["GU","Guam","USD"],["GT","Guatemala","GTQ"],["GG","Guernsey","GBP"],["GN","Guinea","GNF"],["GW","Guinea-Bissau","XOF"],["GY","Guyana","GYD"],["HT","Haiti","HTG"],["HM","Heard Island and McDonald Islands","AUD"],["VA","Holy See (Vatican City State)","EUR"],["HN","Honduras","HNL"],["HK","Hong Kong","HKD"],["HU","Hungary","HUF"],["IS","Iceland","ISK"],["IN","India","INR"],["ID","Indonesia","IDR"],["IR","Iran","IRR"],["IQ","Iraq","IQD"],["IE","Ireland","EUR"],["IM","Isle of Man","GBP"],["IL","Israel","ILS"],["IT","Italy","EUR"],["JM","Jamaica","JMD"],["JP","Japan","JPY"],["JE","Jersey","GBP"],["JO","Jordan","JOD"],["KZ","Kazakhstan","KZT"],["KE","Kenya","KES"],["KI","Kiribati","AUD"],["KP","North Korea","KPW"],["KR","South Korea","KRW"],["KW","Kuwait","KWD"],["KG","Kyrgyzstan","KGS"],["LA","Laos","LAK"],["LV","Latvia","EUR"],["LB","Lebanon","LBP"],["LS","Lesotho","ZAR"],["LR","Liberia","LRD"],["LY","Libya","LYD"],["LI","Liechtenstein","CHF"],["LT","Lithuania","EUR"],["LU","Luxembourg","EUR"],["MO","Macao","MOP"],["MG","Madagascar","MGA"],["MW","Malawi","MWK"],["MY","Malaysia","MYR"],["MV","Maldives","MVR"],["ML","Mali","XOF"],["MT","Malta","EUR"],["MH","Marshall Islands","USD"],["MQ","Martinique","EUR"],["MR","Mauritania","MRU"],["MU","Mauritius","MUR"],["YT","Mayotte","EUR"],["MX","Mexico","MXN"],["FM","Micronesia, Federated States of","USD"],["MD","Moldova","MDL"],["MC","Monaco","EUR"],["MN","Mongolia","MNT"],["ME","Montenegro","EUR"],["MS","Montserrat","XCD"],["MA","Morocco","MAD"],["MZ","Mozambique","MZN"],["MM","Myanmar","MMK"],["NA","Namibia","ZAR"],["NR","Nauru","AUD"],["NP","Nepal","NPR"],["NL","Netherlands","EUR"],["NC","New Caledonia","XPF"],["NZ","New Zealand","NZD"],["NI","Nicaragua","NIO"],["NE","Niger","XOF"],["NG","Nigeria","NGN"],["NU","Niue","NZD"],["NF","Norfolk Island","AUD"],["MK","North Macedonia","MKD"],["MP","Northern Mariana Islands","USD"],["NO","Norway","NOK"],["OM","Oman","OMR"],["PK","Pakistan","PKR"],["PW","Palau","USD"],["PS","Palestine, State of","ILS"],["PA","Panama","PAB"],["PG","Papua New Guinea","PGK"],["PY","Paraguay","PYG"],["PE","Peru","PEN"],["PH","Philippines","PHP"],["PN","Pitcairn","NZD"],["PL","Poland","PLN"],["PT","Portugal","EUR"],["PR","Puerto Rico","USD"],["QA","Qatar","QAR"],["RO","Romania","RON"],["RU","Russian Federation","RUB"],["RW","Rwanda","RWF"],["RE","Réunion","EUR"],["BL","Saint Barthélemy","EUR"],["SH","Saint Helena, Ascension and Tristan da Cunha","SHP"],["KN","Saint Kitts and Nevis","XCD"],["LC","Saint Lucia","XCD"],["MF","Saint Martin (French part)","EUR"],["PM","Saint Pierre and Miquelon","EUR"],["VC","Saint Vincent and the Grenadines","XCD"],["WS","Samoa","WST"],["SM","San Marino","EUR"],["ST","Sao Tome and Principe","STN"],["SA","Saudi Arabia","SAR"],["SN","Senegal","XOF"],["RS","Serbia","RSD"],["SC","Seychelles","SCR"],["SL","Sierra Leone","SLE"],["SG","Singapore","SGD"],["SX","Sint Maarten (Dutch part)","XCG"],["SK","Slovakia","EUR"],["SI","Slovenia","EUR"],["SB","Solomon Islands","SBD"],["SO","Somalia","SOS"],["ZA","South Africa","ZAR"],["GS","South Georgia and the South Sandwich Islands","GBP"],["SS","South Sudan","SSP"],["ES","Spain","EUR"],["LK","Sri Lanka","LKR"],["SD","Sudan","SDG"],["SR","Suriname","SRD"],["SJ","Svalbard and Jan Mayen","NOK"],["SE","Sweden","SEK"],["CH","Switzerland","CHF"],["SY","Syria","SYP"],["TW","Taiwan","TWD"],["TJ","Tajikistan","TJS"],["TZ","Tanzania","TZS"],["TH","Thailand","THB"],["TL","Timor-Leste","USD"],["TG","Togo","XOF"],["TK","Tokelau","NZD"],["TO","Tonga","TOP"],["TT","Trinidad and Tobago","TTD"],["TN","Tunisia","TND"],["TM","Turkmenistan","TMT"],["TC","Turks and Caicos Islands","USD"],["TV","Tuvalu","AUD"],["TR","Türkiye","TRY"],["UG","Uganda","UGX"],["UA","Ukraine","UAH"],["AE","United Arab Emirates","AED"],["GB","United Kingdom","GBP"],["US","United States","USD"],["UM","United States Minor Outlying Islands","USD"],["UY","Uruguay","UYU"],["UZ","Uzbekistan","UZS"],["VU","Vanuatu","VUV"],["VE","Venezuela","VES"],["VN","Vietnam","VND"],["VG","Virgin Islands, British","USD"],["VI","Virgin Islands, U.S.","USD"],["WF","Wallis and Futuna","XPF"],["EH","Western Sahara","MAD"],["YE","Yemen","YER"],["ZM","Zambia","ZMW"],["ZW","Zimbabwe","USD"],["AX","Åland Islands","EUR"]];
  var CURRENCIES = ["AED","AFN","ALL","AMD","AOA","ARS","AUD","AWG","AZN","BAM","BBD","BDT","BGN","BHD","BIF","BMD","BND","BOB","BRL","BSD","BWP","BYN","BZD","CAD","CDF","CHF","CLP","CNY","COP","CRC","CUP","CVE","CZK","DJF","DKK","DOP","DZD","EGP","ERN","ETB","EUR","FJD","FKP","GBP","GEL","GHS","GIP","GMD","GNF","GTQ","GYD","HKD","HNL","HTG","HUF","IDR","ILS","INR","IQD","IRR","ISK","JMD","JOD","JPY","KES","KGS","KHR","KMF","KPW","KRW","KWD","KYD","KZT","LAK","LBP","LKR","LRD","LYD","MAD","MDL","MGA","MKD","MMK","MNT","MOP","MRU","MUR","MVR","MWK","MXN","MYR","MZN","NGN","NIO","NOK","NPR","NZD","OMR","PAB","PEN","PGK","PHP","PKR","PLN","PYG","QAR","RON","RSD","RUB","RWF","SAR","SBD","SCR","SDG","SEK","SGD","SHP","SLE","SOS","SRD","SSP","STN","SYP","SZL","THB","TJS","TMT","TND","TOP","TRY","TTD","TWD","TZS","UAH","UGX","USD","UYU","UZS","VES","VND","VUV","WST","XAF","XCD","XCG","XOF","XPF","YER","ZAR","ZMW"];

  var MARKET_PRESETS = {
    GB:{label:'United Kingdom',currency:'GBP',locale:'en-GB',taxIdLabel:'VAT number',taxRateLabel:'VAT rate',taxName:'VAT',taxRates:[['0','No VAT'],['20','20% standard'],['5','5% reduced']],emailPlaceholder:'name@business.co.uk',bankNameLabel:'Account name',bankNamePlaceholder:'Your Business Ltd',bankCodeLabel:'Sort code',bankCodePlaceholder:'00-00-00',bankAccountLabel:'Account number',bankAccountPlaceholder:'12345678',cityLabel:'Town or city',regionLabel:'County',postalLabel:'Postcode'},
    US:{label:'United States',currency:'USD',locale:'en-US',taxIdLabel:'Tax ID / EIN',taxRateLabel:'Sales tax rate',taxName:'Sales tax',taxRates:[['0','No sales tax'],['4','4%'],['5','5%'],['6','6%'],['6.25','6.25%'],['7','7%'],['8','8%'],['8.875','8.875%'],['9.5','9.5%'],['10','10%']],emailPlaceholder:'name@business.com',bankNameLabel:'Account holder name',bankNamePlaceholder:'Your Business LLC',bankCodeLabel:'Routing number',bankCodePlaceholder:'123456789',bankAccountLabel:'Account number',bankAccountPlaceholder:'1234567890',cityLabel:'City',regionLabel:'State',postalLabel:'ZIP code'},
    CA:{label:'Canada',currency:'CAD',locale:'en-CA',taxIdLabel:'Tax registration number',taxRateLabel:'Tax rate',taxName:'Tax',taxRates:[['0','No tax'],['5','5% GST'],['13','13% HST'],['15','15% HST']],emailPlaceholder:'name@business.ca',bankNameLabel:'Account holder name',bankNamePlaceholder:'Your Business Inc.',bankCodeLabel:'Transit / institution number',bankCodePlaceholder:'12345 / 001',bankAccountLabel:'Account number',bankAccountPlaceholder:'1234567',cityLabel:'City',regionLabel:'Province',postalLabel:'Postal code'},
    AU:{label:'Australia',currency:'AUD',locale:'en-AU',taxIdLabel:'ABN',taxRateLabel:'GST rate',taxName:'GST',taxRates:[['0','No GST'],['10','10% GST']],emailPlaceholder:'name@business.com.au',bankNameLabel:'Account name',bankNamePlaceholder:'Your Business Pty Ltd',bankCodeLabel:'BSB',bankCodePlaceholder:'000-000',bankAccountLabel:'Account number',bankAccountPlaceholder:'12345678',cityLabel:'Suburb',regionLabel:'State / Territory',postalLabel:'Postcode'},
    NZ:{label:'New Zealand',currency:'NZD',locale:'en-NZ',taxIdLabel:'GST number',taxRateLabel:'GST rate',taxName:'GST',taxRates:[['0','No GST'],['15','15% GST']],emailPlaceholder:'name@business.co.nz',bankNameLabel:'Account name',bankNamePlaceholder:'Your Business Ltd',bankCodeLabel:'Bank details',bankCodePlaceholder:'Bank / branch details',bankAccountLabel:'Account number',bankAccountPlaceholder:'00-0000-0000000-00',cityLabel:'Suburb / City',regionLabel:'Region',postalLabel:'Postcode'},
    IN:{label:'India',currency:'INR',locale:'en-IN',taxIdLabel:'GSTIN',taxRateLabel:'GST rate',taxName:'GST',taxRates:[['0','No GST'],['5','5% GST'],['12','12% GST'],['18','18% GST'],['28','28% GST']],emailPlaceholder:'name@business.in',bankNameLabel:'Account holder name',bankNamePlaceholder:'Your Business',bankCodeLabel:'IFSC code',bankCodePlaceholder:'ABCD0123456',bankAccountLabel:'Account number',bankAccountPlaceholder:'123456789012',cityLabel:'City / Town',regionLabel:'State / Union Territory',postalLabel:'PIN code'},
    IE:{label:'Ireland',currency:'EUR',locale:'en-IE',taxIdLabel:'VAT number',taxRateLabel:'VAT rate',taxName:'VAT',taxRates:[['0','No VAT'],['23','23% standard'],['13.5','13.5% reduced'],['9','9% reduced']],emailPlaceholder:'name@business.ie',bankNameLabel:'Account holder name',bankNamePlaceholder:'Your Business Ltd',bankCodeLabel:'BIC / SWIFT',bankCodePlaceholder:'ABCDEFGH',bankAccountLabel:'IBAN',bankAccountPlaceholder:'IE00 BANK 0000 0000 0000 00',cityLabel:'Town / City',regionLabel:'County',postalLabel:'Eircode'},
    ZA:{label:'South Africa',currency:'ZAR',locale:'en-ZA',taxIdLabel:'VAT number',taxRateLabel:'VAT rate',taxName:'VAT',taxRates:[['0','No VAT'],['15','15% VAT']],emailPlaceholder:'name@business.co.za',bankNameLabel:'Account holder name',bankNamePlaceholder:'Your Business (Pty) Ltd',bankCodeLabel:'Branch code',bankCodePlaceholder:'000000',bankAccountLabel:'Account number',bankAccountPlaceholder:'1234567890',cityLabel:'City / Town',regionLabel:'Province',postalLabel:'Postal code'},
    SG:{label:'Singapore',currency:'SGD',locale:'en-SG',taxIdLabel:'GST registration number',taxRateLabel:'GST rate',taxName:'GST',taxRates:[['0','No GST'],['9','9% GST']],emailPlaceholder:'name@business.sg',bankNameLabel:'Account holder name',bankNamePlaceholder:'Your Business Pte Ltd',bankCodeLabel:'Bank / branch code',bankCodePlaceholder:'Bank and branch code',bankAccountLabel:'Account number',bankAccountPlaceholder:'1234567890',cityLabel:'City',regionLabel:'District / Region',postalLabel:'Postal code'},
    AE:{label:'United Arab Emirates',currency:'AED',locale:'en-AE',taxIdLabel:'TRN',taxRateLabel:'VAT rate',taxName:'VAT',taxRates:[['0','No VAT'],['5','5% VAT']],emailPlaceholder:'name@business.ae',bankNameLabel:'Account holder name',bankNamePlaceholder:'Your Business LLC',bankCodeLabel:'SWIFT / BIC',bankCodePlaceholder:'ABCDEFGH',bankAccountLabel:'IBAN',bankAccountPlaceholder:'AE00 0000 0000 0000 0000 000',cityLabel:'City',regionLabel:'Emirate',postalLabel:'Postal code'},
    DE:{label:'Germany',currency:'EUR',locale:'de-DE',taxIdLabel:'VAT ID',taxRateLabel:'VAT rate',taxName:'VAT',taxRates:[['0','No VAT'],['19','19% standard'],['7','7% reduced']],emailPlaceholder:'name@business.de',bankNameLabel:'Account holder name',bankNamePlaceholder:'Your Business',bankCodeLabel:'BIC / SWIFT',bankCodePlaceholder:'ABCDEFGH',bankAccountLabel:'IBAN',bankAccountPlaceholder:'DE00 0000 0000 0000 0000 00',cityLabel:'City',regionLabel:'State / Region',postalLabel:'Postal code'},
    FR:{label:'France',currency:'EUR',locale:'fr-FR',taxIdLabel:'VAT number',taxRateLabel:'VAT rate',taxName:'VAT',taxRates:[['0','No VAT'],['20','20% standard'],['10','10% reduced'],['5.5','5.5% reduced']],emailPlaceholder:'name@business.fr',bankNameLabel:'Account holder name',bankNamePlaceholder:'Your Business',bankCodeLabel:'BIC / SWIFT',bankCodePlaceholder:'ABCDEFGH',bankAccountLabel:'IBAN',bankAccountPlaceholder:'FR00 0000 0000 0000 0000 0000 000',cityLabel:'City',regionLabel:'Region / Department',postalLabel:'Postal code'},
    NL:{label:'Netherlands',currency:'EUR',locale:'nl-NL',taxIdLabel:'VAT number',taxRateLabel:'VAT rate',taxName:'VAT',taxRates:[['0','No VAT'],['21','21% standard'],['9','9% reduced']],emailPlaceholder:'name@business.nl',bankNameLabel:'Account holder name',bankNamePlaceholder:'Your Business',bankCodeLabel:'BIC / SWIFT',bankCodePlaceholder:'ABCDEFGH',bankAccountLabel:'IBAN',bankAccountPlaceholder:'NL00 BANK 0000 0000 00',cityLabel:'City',regionLabel:'Province',postalLabel:'Postal code'}
  };

  function countryRecord(code) {
    for (var i = 0; i < COUNTRY_DATA.length; i++) if (COUNTRY_DATA[i][0] === code) return COUNTRY_DATA[i];
    return ['GB','United Kingdom','GBP'];
  }
  function marketCode() {
    var el = $('market-country');
    if (el && el.value) return el.value;
    var saved = storageGet(MARKET_KEY, null);
    if (saved === 'EU') saved = 'IE';
    return saved || 'GB';
  }
  function genericMarket(code) {
    var row = countryRecord(code);
    return {
      label: row[1], currency: row[2] || 'USD', locale: 'en',
      taxIdLabel: 'Tax registration number', taxRateLabel: 'Tax rate', taxName: 'Tax',
      taxRates: [['0','No tax']],
      emailPlaceholder: 'name@business.com',
      bankNameLabel: 'Account holder name', bankNamePlaceholder: 'Your business',
      bankCodeLabel: 'Bank / branch code', bankCodePlaceholder: 'Bank or branch details',
      bankAccountLabel: 'Account number / IBAN', bankAccountPlaceholder: 'Account number or IBAN',
      cityLabel: 'City / Town', regionLabel: 'State / Province / Region', postalLabel: 'Postal code'
    };
  }
  function market() { return MARKET_PRESETS[marketCode()] || genericMarket(marketCode()); }
  function currencyCode() { var el=$('market-currency'); return el&&el.value?el.value:market().currency; }

  function clientMarketCode() {
    var same = $('client-same-country');
    if (same && same.checked) return marketCode();
    var el = $('client-country');
    if (el && el.value) return el.value;
    return storageGet(CLIENT_MARKET_KEY, marketCode()) || marketCode();
  }

  function clientCountryLabel() {
    return countryRecord(clientMarketCode())[1];
  }

  function clientProfile() {
    return MARKET_PRESETS[clientMarketCode()] || genericMarket(clientMarketCode());
  }


  var REGION_OPTIONS = {
    US: [['','Select state'],['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming']],
    CA: [['','Select province or territory'],['AB','Alberta'],['BC','British Columbia'],['MB','Manitoba'],['NB','New Brunswick'],['NL','Newfoundland and Labrador'],['NS','Nova Scotia'],['NT','Northwest Territories'],['NU','Nunavut'],['ON','Ontario'],['PE','Prince Edward Island'],['QC','Quebec'],['SK','Saskatchewan'],['YT','Yukon']],
    AU: [['','Select state or territory'],['ACT','Australian Capital Territory'],['NSW','New South Wales'],['NT','Northern Territory'],['QLD','Queensland'],['SA','South Australia'],['TAS','Tasmania'],['VIC','Victoria'],['WA','Western Australia']],
    IN: [['','Select state or union territory'],['AN','Andaman and Nicobar Islands'],['AP','Andhra Pradesh'],['AR','Arunachal Pradesh'],['AS','Assam'],['BR','Bihar'],['CH','Chandigarh'],['CG','Chhattisgarh'],['DH','Dadra and Nagar Haveli and Daman and Diu'],['DL','Delhi'],['GA','Goa'],['GJ','Gujarat'],['HR','Haryana'],['HP','Himachal Pradesh'],['JK','Jammu and Kashmir'],['JH','Jharkhand'],['KA','Karnataka'],['KL','Kerala'],['LA','Ladakh'],['LD','Lakshadweep'],['MP','Madhya Pradesh'],['MH','Maharashtra'],['MN','Manipur'],['ML','Meghalaya'],['MZ','Mizoram'],['NL','Nagaland'],['OD','Odisha'],['PY','Puducherry'],['PB','Punjab'],['RJ','Rajasthan'],['SK','Sikkim'],['TN','Tamil Nadu'],['TS','Telangana'],['TR','Tripura'],['UP','Uttar Pradesh'],['UK','Uttarakhand'],['WB','West Bengal']],
    ZA: [['','Select province'],['EC','Eastern Cape'],['FS','Free State'],['GP','Gauteng'],['KZN','KwaZulu-Natal'],['LP','Limpopo'],['MP','Mpumalanga'],['NC','Northern Cape'],['NW','North West'],['WC','Western Cape']]

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
    '.invoiceit-country-search{margin-bottom:8px}',
    '.invoiceit-invalid{border-color:#b4232a!important;box-shadow:0 0 0 3px rgba(180,35,42,.10)!important}',
    '.gen-line-remove{appearance:none;-webkit-appearance:none}',

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

  function scheduleRender() {
    window.clearTimeout(RENDER_TIMER);
    RENDER_TIMER = window.setTimeout(function () {
      render();
      trackInvoiceProgress();
    }, 40);
  }

  function setInvalid(id, invalid) {
    var el = $(id);
    if (!el) return;
    if (invalid) {
      el.setAttribute('aria-invalid', 'true');
      el.classList.add('invoiceit-invalid');
    } else {
      el.removeAttribute('aria-invalid');
      el.classList.remove('invoiceit-invalid');
    }
  }

  function validateForDownload() {
    var missing = [];
    var checks = [
      ['biz-name', 'Add your business name'],
      ['cli-name', 'Add your client name'],
      ['inv-number', 'Add an invoice number']
    ];
    checks.forEach(function (pair) {
      var invalid = !val(pair[0]);
      setInvalid(pair[0], invalid);
      if (invalid) missing.push({ id: pair[0], message: pair[1] });
    });

    var lines = readLines();
    if (!lines.length) missing.push({ id: 'line-items', message: 'Add at least one invoice item' });

    if (val('vat-rate') === 'custom') {
      var customInvalid = !val('custom-tax-rate') || taxRateValue() < 0 || taxRateValue() > 100;
      setInvalid('custom-tax-rate', customInvalid);
      if (customInvalid) missing.push({ id: 'custom-tax-rate', message: 'Enter a valid custom tax rate between 0 and 100' });
    } else {
      setInvalid('custom-tax-rate', false);
    }

    if (!missing.length) return true;
    var first = $(missing[0].id);
    if (first && typeof first.focus === 'function') first.focus();
    flash($('download-pdf'), missing[0].message);
    analyticsEvent('invoice_validation_failed', {
      missing_field: missing[0].id,
      error_count: missing.length
    });
    return false;
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
  function countryFlag(code) {
    if (!code || code.length !== 2) return '';
    return String.fromCodePoint(code.charCodeAt(0) + 127397, code.charCodeAt(1) + 127397);
  }

  function populateCountryAndCurrencyOptions() {
    var country = $('market-country');
    var currency = $('market-currency');
    if (country && !country.options.length) {
      COUNTRY_DATA.forEach(function (row) {
        var option = document.createElement('option');
        option.value = row[0];
        option.textContent = countryFlag(row[0]) + ' ' + row[1];
        country.appendChild(option);
      });
    }
    if (currency && !currency.options.length) {
      CURRENCIES.forEach(function (code) {
        var option = document.createElement('option');
        option.value = code;
        option.textContent = code;
        currency.appendChild(option);
      });
    }
  }

  function renderCountryOptions(query, preserveValue) {
    var select = $('market-country');
    if (!select) return;
    query = String(query || '').trim().toLowerCase();
    var selected = preserveValue || select.value || marketCode();
    select.innerHTML = '';

    COUNTRY_DATA.forEach(function (row) {
      if (query && row[1].toLowerCase().indexOf(query) === -1 && row[0].toLowerCase().indexOf(query) === -1) return;
      var option = document.createElement('option');
      option.value = row[0];
      option.textContent = countryFlag(row[0]) + ' ' + row[1];
      select.appendChild(option);
    });

    if (!select.options.length) {
      var empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'No countries found';
      select.appendChild(empty);
      return;
    }

    var hasSelected = Array.prototype.some.call(select.options, function (option) {
      return option.value === selected;
    });
    if (hasSelected) select.value = selected;
  }

  function bindCountrySearch() {
    var search = $('market-country-search');
    var select = $('market-country');
    if (!search || !select || search.dataset.bound === '1') return;
    search.dataset.bound = '1';

    search.addEventListener('input', function () {
      renderCountryOptions(this.value, select.value);
    });

    search.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (select.options.length && select.options[0].value) {
        select.selectedIndex = 0;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        this.value = '';
        renderCountryOptions('', select.value);
      }
    });

    select.addEventListener('change', function () {
      search.value = '';
      renderCountryOptions('', select.value);
    });
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
          '<input id="market-country-search" class="gen-input invoiceit-country-search" type="search" placeholder="Search countries" autocomplete="off" aria-label="Search countries">' +
          '<select id="market-country" class="gen-input" aria-label="Business country"></select></div>' +
        '<div class="gen-field" style="margin-bottom:0"><div class="gen-label">Invoice currency</div>' +
          '<select id="market-currency" class="gen-input"></select></div>' +
      '</div>' +
      '<div class="gen-hint" style="margin-top:7px">Your business country controls address, tax and bank labels. Invoice currency can be changed separately.</div>' +
      '<div class="gen-field" style="margin:12px 0 0"><div class="gen-label">Invoice style</div>' +
        '<select id="invoice-theme" class="gen-input"><option value="professional">Professional</option><option value="modern">Modern</option><option value="minimal">Minimal</option><option value="corporate">Corporate</option></select></div>';
    anchor.parentNode.insertBefore(section, anchor);
    populateCountryAndCurrencyOptions();
    bindCountrySearch();
    var saved = storageGet(MARKET_KEY, null);
    if (saved === 'EU') saved = 'IE';
    if (saved && countryRecord(saved)) $('market-country').value = saved;
    if (!$('market-country').value) $('market-country').value = 'GB';
    $('market-currency').value = market().currency;
  }

  function rebuildRegionFieldForCountry(prefix, countryCode, cfg) {
    var current = $(prefix + '-region');
    if (!current || !current.parentNode) return;
    var options = REGION_OPTIONS[countryCode] || null;
    var value = current.value || '';
    var replacement;
    if (options) {
      replacement = document.createElement('select');
      options.forEach(function (pair) {
        var option = document.createElement('option');
        option.value = pair[0];
        option.textContent = pair[1];
        replacement.appendChild(option);
      });
      replacement.value = value;
    } else {
      replacement = document.createElement('input');
      replacement.type = 'text';
      replacement.value = value;
      replacement.setAttribute('autocomplete', 'address-level1');
    }
    replacement.id = prefix + '-region';
    replacement.className = 'gen-input';
    replacement.setAttribute('aria-label', (cfg && cfg.regionLabel) || 'State / Province / Region');
    current.parentNode.replaceChild(replacement, current);
  }

  function rebuildRegionField(prefix) {
    rebuildRegionFieldForCountry(prefix, marketCode(), market());
  }

  function applyTheme() {
    var box = $('preview');
    if (box) box.setAttribute('data-invoice-theme', themeCode());
  }

  function applyMarketChrome(reset){var c=market();rebuildTaxRateOptions(!!reset);var x=$('biz-vat'),f,l;if(x){f=x.closest('.gen-field');l=f&&f.querySelector('.gen-label');if(l)l.textContent=c.taxIdLabel;x.placeholder=c.taxIdLabel;}x=$('vat-rate');if(x){f=x.closest('.gen-field');l=f&&f.querySelector('.gen-label');if(l)l.textContent=c.taxRateLabel;}x=$('biz-email');if(x)x.placeholder=c.emailPlaceholder;['biz'].forEach(function(p){if($(p+'-city-label'))$(p+'-city-label').textContent=c.cityLabel;if($(p+'-region-label'))$(p+'-region-label').textContent=c.regionLabel;if($(p+'-postal-label'))$(p+'-postal-label').textContent=c.postalLabel;});if($('pay-account-name-label'))$('pay-account-name-label').textContent=c.bankNameLabel;if($('pay-account-name'))$('pay-account-name').placeholder=c.bankNamePlaceholder;if($('pay-sort-label'))$('pay-sort-label').textContent=c.bankCodeLabel;if($('pay-sort')){$('pay-sort').placeholder=c.bankCodePlaceholder;$('pay-sort').inputMode=(marketCode()==='GB'||marketCode()==='US')?'numeric':'text';}if($('pay-account-label'))$('pay-account-label').textContent=c.bankAccountLabel;if($('pay-account')){$('pay-account').placeholder=c.bankAccountPlaceholder;$('pay-account').inputMode=(marketCode()==='GB'||marketCode()==='US')?'numeric':'text';}['biz'].forEach(rebuildRegionField);applyTheme();x=$('cis-rate');if(x){f=x.closest('.gen-field');if(marketCode()==='GB'){if(f)f.style.display='';}else{x.value='0';if(f)f.style.display='none';}}}

  function renderClientCountryOptions(query, preserveValue) {
    var select = $('client-country');
    if (!select) return;
    query = String(query || '').trim().toLowerCase();
    var selected = preserveValue || select.value || clientMarketCode();
    select.innerHTML = '';

    COUNTRY_DATA.forEach(function (row) {
      if (query && row[1].toLowerCase().indexOf(query) === -1 && row[0].toLowerCase().indexOf(query) === -1) return;
      var option = document.createElement('option');
      option.value = row[0];
      option.textContent = countryFlag(row[0]) + ' ' + row[1];
      select.appendChild(option);
    });

    if (!select.options.length) {
      var empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'No countries found';
      select.appendChild(empty);
      return;
    }

    var hasSelected = Array.prototype.some.call(select.options, function (option) {
      return option.value === selected;
    });
    if (hasSelected) select.value = selected;
  }

  function buildClientCountryFields() {
    if ($('client-country')) return;
    var clientName = $('cli-name');
    var anchor = clientName && clientName.closest('.gen-field');
    if (!anchor || !anchor.parentNode) return;

    var wrap = document.createElement('div');
    wrap.id = 'invoiceit-client-country-controls';
    wrap.className = 'gen-field';
    wrap.innerHTML =
      '<div class="gen-label">Bill to country</div>' +
      '<label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:14px;color:#4b5563">' +
        '<input id="client-same-country" type="checkbox" checked> Same as business country' +
      '</label>' +
      '<div id="client-country-picker" style="display:none">' +
        '<input id="client-country-search" class="gen-input invoiceit-country-search" type="search" placeholder="Search countries" autocomplete="off" aria-label="Search client countries">' +
        '<select id="client-country" class="gen-input" aria-label="Client country"></select>' +
      '</div>';

    anchor.parentNode.insertBefore(wrap, anchor);
    renderClientCountryOptions('', marketCode());

    var same = $('client-same-country');
    var picker = $('client-country-picker');
    var search = $('client-country-search');
    var select = $('client-country');

    same.addEventListener('change', function () {
      picker.style.display = this.checked ? 'none' : '';
      if (this.checked) {
        select.value = marketCode();
        storageSet(CLIENT_MARKET_KEY, marketCode());
      }
      applyClientCountryChrome();
      analyticsEvent('client_country_mode_changed', { same_as_business: this.checked });
      saveBusiness();
      render();
    });

    search.addEventListener('input', function () {
      renderClientCountryOptions(this.value, select.value);
    });

    search.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (select.options.length && select.options[0].value) {
        select.selectedIndex = 0;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    select.addEventListener('change', function () {
      storageSet(CLIENT_MARKET_KEY, this.value);
      search.value = '';
      renderClientCountryOptions('', this.value);
      applyClientCountryChrome();
      analyticsEvent('client_country_selected', { selected_country: this.value });
      saveBusiness();
      render();
    });
  }

  function applyClientCountryChrome() {
    var cfg = clientProfile();
    if ($('cli-city-label')) $('cli-city-label').textContent = cfg.cityLabel || 'City';
    if ($('cli-region-label')) $('cli-region-label').textContent = cfg.regionLabel || 'State / Province / Region';
    if ($('cli-postal-label')) $('cli-postal-label').textContent = cfg.postalLabel || 'Postal code';
    rebuildRegionFieldForCountry('cli', clientMarketCode(), cfg);
    if ($('cli-country') && !$('cli-country').dataset.userSet) $('cli-country').value = clientCountryLabel();
    syncAddress('cli', 'cli-address');
  }

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
      'pay-sort', 'pay-account', 'pay-link', 'invoice-theme', 'client-country', 'client-same-country'];
    var values = {};
    ids.forEach(function (id) {
      if (!$(id)) return;
      values[id] = $(id).type === 'checkbox' ? $(id).checked : $(id).value;
    });

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
      if (!$(id)) return;
      if ($(id).type === 'checkbox') $(id).checked = Boolean(draft.values[id]);
      else $(id).value = draft.values[id];
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
    if ($('client-country-picker') && $('client-same-country')) $('client-country-picker').style.display = $('client-same-country').checked ? 'none' : '';
    applyClientCountryChrome();
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
      tax_rate: taxRateValue(),
      business_country: marketCode(),
      client_country: clientMarketCode(),
      invoice_theme: themeCode()
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
      '<button type="button" class="gen-line-remove" data-remove aria-label="Remove this line" title="Remove this line">\u00D7</button>';
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
  var REMEMBER = ['biz-name', 'biz-address', 'biz-vat', 'biz-email', 'payment-terms', 'pay-account-name', 'pay-sort', 'pay-account', 'pay-link', 'market-currency', 'invoice-theme', 'client-country', 'client-same-country'];

  function saveBusiness() {
    try {
      var data = {};
      REMEMBER.forEach(function (id) {
        if (!$(id)) return;
        data[id] = $(id).type === 'checkbox' ? $(id).checked : val(id);
      });
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }
  function loadBusiness() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      REMEMBER.forEach(function (id) {
        if (!$(id) || data[id] == null) return;
        if ($(id).type === 'checkbox') $(id).checked = Boolean(data[id]);
        else if (data[id] !== '') $(id).value = data[id];
      });
      if ($('client-same-country') && $('client-country-picker')) {
        $('client-country-picker').style.display = $('client-same-country').checked ? 'none' : '';
      }
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
    if (!validateForDownload()) return;

    var original = btn.textContent;
    btn.textContent = 'Building your PDF\u2026';
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');

    loadJsPDF()
      .then(function (jsPDF) {
        buildPdf(jsPDF).save(filename());
        trackPdfDownload();
        bumpSequence();
        saveBusiness();
        btn.textContent = original;
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        var capture = document.querySelector('.capture');
        if (capture && capture.scrollIntoView) {
          capture.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      })
      .catch(function (err) {
        btn.textContent = original;
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
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
      note.setAttribute('role', 'alert');
      note.setAttribute('aria-live', 'polite');
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
    buildClientCountryFields();
    buildDraftTools();

    [
      ['biz-name', 'organization'],
      ['biz-email', 'email'],
      ['cli-name', 'organization'],
      ['pay-link', 'url']
    ].forEach(function (pair) {
      if ($(pair[0])) $(pair[0]).setAttribute('autocomplete', pair[1]);
    });
    if ($('download-pdf')) $('download-pdf').setAttribute('aria-describedby', 'gen-flash');

    var head = document.createElement('div');
    head.className = 'gen-line-head';
    head.innerHTML =
      '<span data-h-desc>Description</span>' +
      (TPL.lineTypes ? '<span data-h-type>Type</span>' : '') +
      '<span>' + esc(TPL.qtyLabel) + '</span><span>' + esc(TPL.rateLabel) + '</span><span></span>';
    $('line-items').parentNode.insertBefore(head, $('line-items'));

    loadBusiness();
    if ($('market-currency') && $('market-currency').value !== market().currency) $('market-currency').dataset.userSet='1';
    if ($('client-country')) {
      var savedClient = storageGet(CLIENT_MARKET_KEY, marketCode());
      $('client-country').value = countryRecord(savedClient)[0];
    }
    buildAddressFields();
    applyMarketChrome(false);
    applyClientCountryChrome();
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
      if (e.target.id === 'biz-name' || e.target.id === 'cli-name' || e.target.id === 'inv-number' || e.target.id === 'custom-tax-rate') {
        setInvalid(e.target.id, false);
      }
      if (e.target.id === 'biz-country' || e.target.id === 'cli-country') e.target.dataset.userSet = '1';
      scheduleRender();
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
        if ($('client-same-country') && $('client-same-country').checked && $('client-country')) {
          $('client-country').value = e.target.value;
          storageSet(CLIENT_MARKET_KEY, e.target.value);
        }
        applyMarketChrome(true);
        applyClientCountryChrome();
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
      var remove = e.target.closest && e.target.closest('[data-remove]');
      if (!remove) return;
      var rows = document.querySelectorAll('#line-items .gen-line');
      if (rows.length === 1) {
        rows[0].querySelectorAll('input').forEach(function (i) { i.value = ''; });
      } else {
        remove.closest('.gen-line').remove();
      }
      render();
    });

    $('download-pdf').addEventListener('click', onDownload);

    REMEMBER.forEach(function (id) {
      if ($(id)) $(id).addEventListener('blur', saveBusiness);
    });

    window.addEventListener('pagehide', saveBusiness);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') saveBusiness();
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
