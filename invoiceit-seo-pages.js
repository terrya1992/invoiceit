
/*
 * InvoiceIt SEO Pages v1.0
 * Automatically renders country and profession landing pages in Webflow.
 * Supported paths:
 * /uk-invoice-generator
 * /us-invoice-generator
 * /canada-invoice-generator
 * /electrician-invoice-generator
 * /plumber-invoice-generator
 */
(function () {
  'use strict';

  var SITE_URL = 'https://invoiceit.io';
  var GENERATOR_URL = '/free-invoice-generator';

  var PAGES = {
    '/uk-invoice-generator': {
      title: 'Free UK Invoice Generator | InvoiceIt',
      description: 'Create a professional UK invoice online. Add VAT, payment details and line items, then download your invoice as a PDF.',
      eyebrow: 'United Kingdom',
      h1: 'Free UK Invoice Generator',
      intro: 'Create a professional UK invoice in minutes. Add your business, client, VAT and payment details, then download a polished PDF without creating an account.',
      bullets: ['UK VAT-ready', 'GBP currency formatting', 'Instant PDF download'],
      sections: [
        {
          h2: 'Create a professional UK invoice online',
          html: '<p>InvoiceIt helps freelancers, contractors, sole traders and small businesses create clear UK invoices without complicated accounting software. Enter your details, add the products or services supplied, choose the appropriate VAT rate and download the finished invoice as a PDF.</p><p>The generator is designed for quick, practical invoicing. It supports UK date formatting, pounds sterling, VAT numbers, sort codes and account numbers, so the finished document feels familiar to both you and your client.</p>'
        },
        {
          h2: 'What should a UK invoice include?',
          html: '<p>A typical UK invoice should clearly identify the seller and customer, explain what was supplied and show how much is due. Include your business name and address, the client name and address, a unique invoice number, invoice and due dates, a description of each item, the net amount, VAT where applicable and the final total.</p><p>If your business is VAT registered, include your VAT registration number and show the VAT rate and amount separately. Keep invoice numbers sequential and avoid reusing the same number.</p>'
        },
        {
          h2: 'Useful UK invoice line items',
          list: ['Professional services', 'Labour charges', 'Materials supplied', 'Call-out fees', 'Travel or delivery costs', 'Project deposits or milestone payments']
        },
        {
          h2: 'Why use InvoiceIt for UK invoices?',
          list: ['No account required to start', 'Automatic subtotal and VAT calculations', 'Professional PDF export', 'UK banking labels and address fields', 'Works on desktop, tablet and mobile']
        }
      ],
      faqs: [
        ['Can I create a UK invoice without VAT?', 'Yes. Choose the no-VAT option when VAT does not apply. Only show VAT when your business is registered and the transaction is taxable.'],
        ['Can I add my VAT number?', 'Yes. The UK version includes a VAT number field and VAT rate options.'],
        ['Can I use InvoiceIt as a sole trader?', 'Yes. Sole traders, freelancers, contractors and limited companies can all use the generator.'],
        ['Does the invoice download as a PDF?', 'Yes. Once your line items are complete, you can download a PDF ready to email or print.'],
        ['Can I add payment details?', 'Yes. You can add an account name, sort code, account number, payment notes and an optional payment link.']
      ],
      related: [
        ['/electrician-invoice-generator', 'Electrician Invoice Generator'],
        ['/plumber-invoice-generator', 'Plumber Invoice Generator'],
        ['/free-invoice-generator', 'Free Invoice Generator']
      ]
    },

    '/us-invoice-generator': {
      title: 'Free US Invoice Generator | InvoiceIt',
      description: 'Create a professional US invoice with USD, sales tax, routing details and PDF download. No account required.',
      eyebrow: 'United States',
      h1: 'Free US Invoice Generator',
      intro: 'Build a professional US invoice with dollars, state fields, sales tax and US banking details. Add your information and download the invoice as a PDF.',
      bullets: ['USD formatting', 'Sales tax support', 'US state selector'],
      sections: [
        {
          h2: 'Create a US invoice in minutes',
          html: '<p>InvoiceIt gives freelancers, independent contractors and small businesses a straightforward way to create US invoices. Select the United States market and the form adapts to US terminology, including dollars, ZIP codes, states, sales tax, routing numbers and account-holder details.</p><p>You can create the invoice directly in your browser, review the live preview and export a clean PDF for your customer.</p>'
        },
        {
          h2: 'What should a US invoice include?',
          html: '<p>Include your business name and contact details, the customer details, a unique invoice number, the invoice date, payment due date, an itemized description of services or products, quantities, rates, applicable sales tax and the total amount due.</p><p>Sales tax rules differ by state and location, so confirm the correct rate and whether the transaction is taxable. InvoiceIt includes common rates and a custom-rate option.</p>'
        },
        {
          h2: 'Common US invoice items',
          list: ['Hourly or project fees', 'Consulting services', 'Products or materials', 'Shipping or delivery', 'Travel expenses', 'Deposits and retainers']
        },
        {
          h2: 'Built for US businesses',
          list: ['US date formatting', 'USD currency display', 'State dropdowns', 'ZIP code labels', 'Sales tax calculations', 'Routing and account-number fields']
        }
      ],
      faqs: [
        ['Can I add sales tax?', 'Yes. Select a common sales-tax rate or enter a custom percentage.'],
        ['Can I change the currency?', 'Yes. USD is the default for the United States, but the currency selector can be changed.'],
        ['Does InvoiceIt support all states?', 'Yes. The US address section includes all 50 states and the District of Columbia.'],
        ['Do I need to create an account?', 'No. You can start creating the invoice without registration.'],
        ['Can I download the invoice?', 'Yes. Finished invoices can be downloaded as PDFs.']
      ],
      related: [
        ['/free-invoice-generator', 'Free Invoice Generator'],
        ['/canada-invoice-generator', 'Canada Invoice Generator'],
        ['/electrician-invoice-generator', 'Electrician Invoice Generator']
      ]
    },

    '/canada-invoice-generator': {
      title: 'Free Canada Invoice Generator | InvoiceIt',
      description: 'Create a Canadian invoice with CAD, GST/HST, province fields and PDF download. Fast and easy to use.',
      eyebrow: 'Canada',
      h1: 'Free Canada Invoice Generator',
      intro: 'Create a professional Canadian invoice with CAD formatting, province fields and flexible tax rates. Complete the form and download your PDF.',
      bullets: ['CAD formatting', 'GST/HST support', 'Province selector'],
      sections: [
        {
          h2: 'Create a Canadian invoice online',
          html: '<p>InvoiceIt makes it easy for Canadian freelancers, contractors and small businesses to prepare clear invoices. Select Canada and the generator updates to Canadian dollars, province fields, postal codes and Canadian tax terminology.</p><p>Add your business and customer details, describe the work or goods supplied, select the relevant tax rate and download a finished PDF.</p>'
        },
        {
          h2: 'What should a Canadian invoice include?',
          html: '<p>A professional Canadian invoice normally includes the supplier and customer details, a unique invoice number, invoice and payment dates, an itemized description, quantities, prices, tax amounts and the total due.</p><p>If you are registered to collect GST, HST, PST or QST, include the relevant registration details and clearly show the applicable tax. Because rules differ by province and transaction, confirm the correct tax treatment for your business.</p>'
        },
        {
          h2: 'Common invoice items in Canada',
          list: ['Professional services', 'Hourly labour', 'Products and materials', 'Mileage or travel', 'Delivery charges', 'Deposits and progress payments']
        },
        {
          h2: 'Canadian invoice features',
          list: ['Canadian dollar formatting', 'Province and territory dropdown', 'Postal-code fields', 'GST/HST and custom tax rates', 'Professional PDF download']
        }
      ],
      faqs: [
        ['Can I add GST or HST?', 'Yes. Canada includes common GST and HST rates, plus a custom-rate option.'],
        ['Can I choose a province?', 'Yes. The address form includes all Canadian provinces and territories.'],
        ['Can I add my tax registration number?', 'Yes. Use the tax registration field to include the relevant number.'],
        ['Can I invoice in another currency?', 'Yes. CAD is the default, but you can choose another supported currency.'],
        ['Is a PDF available?', 'Yes. You can download the completed invoice as a PDF.']
      ],
      related: [
        ['/us-invoice-generator', 'US Invoice Generator'],
        ['/free-invoice-generator', 'Free Invoice Generator'],
        ['/plumber-invoice-generator', 'Plumber Invoice Generator']
      ]
    },

    '/electrician-invoice-generator': {
      title: 'Free Electrician Invoice Generator | InvoiceIt',
      description: 'Create professional electrician invoices for labour, materials, call-outs and electrical work. Download as a PDF.',
      eyebrow: 'For electricians',
      h1: 'Free Electrician Invoice Generator',
      intro: 'Create clear electrician invoices for labour, materials, call-outs and completed electrical work. Add your details and download a professional PDF.',
      bullets: ['Labour and materials', 'Tax calculations', 'Professional PDF'],
      sections: [
        {
          h2: 'Create an electrician invoice quickly',
          html: '<p>Electrical jobs often combine labour, materials, testing and call-out charges. InvoiceIt helps you separate those costs clearly so clients can understand exactly what they are paying for.</p><p>Use the generator for domestic, commercial or subcontracting work. Add each service as a separate line item, enter the quantity or hours, apply the correct rate and include any relevant tax.</p>'
        },
        {
          h2: 'What should an electrician invoice include?',
          html: '<p>Include your trading name, address and contact details, the customer name and job address, a unique invoice number, invoice and due dates, a description of the work, labour hours, material costs, tax where relevant and the final amount payable.</p><p>Where useful, reference the quote, purchase order, job number, property address or electrical certificate connected to the work.</p>'
        },
        {
          h2: 'Example electrician invoice items',
          list: ['Call-out charge', 'Fault finding and diagnosis', 'Labour hours', 'Consumer unit installation', 'Socket or light fitting installation', 'Cable and electrical materials', 'Testing and certification', 'Emergency or out-of-hours work']
        },
        {
          h2: 'Invoice tips for electricians',
          list: ['Separate labour and materials', 'Use clear descriptions instead of vague wording', 'Reference the property or job number', 'State the due date clearly', 'Include payment details', 'Keep invoice numbers sequential']
        }
      ],
      faqs: [
        ['Can I separate labour and materials?', 'Yes. Use separate line items, or open the contractor version of the generator for dedicated labour and materials categories.'],
        ['Can I add VAT or sales tax?', 'Yes. Tax options adapt to the selected country.'],
        ['Can I include a call-out charge?', 'Yes. Add it as its own line item so the customer can see it clearly.'],
        ['Can I invoice for testing and certification?', 'Yes. Add testing, inspection or certification as separate services.'],
        ['Can I download the electrician invoice?', 'Yes. The completed invoice can be exported as a PDF.']
      ],
      related: [
        ['/plumber-invoice-generator', 'Plumber Invoice Generator'],
        ['/uk-invoice-generator', 'UK Invoice Generator'],
        ['/free-invoice-generator', 'Free Invoice Generator']
      ]
    },

    '/plumber-invoice-generator': {
      title: 'Free Plumber Invoice Generator | InvoiceIt',
      description: 'Create professional plumbing invoices for labour, parts, call-outs and repairs. Download your invoice as a PDF.',
      eyebrow: 'For plumbers',
      h1: 'Free Plumber Invoice Generator',
      intro: 'Create professional plumbing invoices for labour, call-outs, parts and repairs. Add each charge clearly and download the finished PDF.',
      bullets: ['Labour and parts', 'Call-out charges', 'Instant PDF'],
      sections: [
        {
          h2: 'Create a plumbing invoice online',
          html: '<p>Plumbing work can include diagnosis, labour, replacement parts, emergency call-outs and follow-up work. InvoiceIt lets you list each charge separately, calculate totals automatically and give customers a clear record of the work completed.</p><p>The generator works for self-employed plumbers, plumbing companies, heating engineers and subcontractors.</p>'
        },
        {
          h2: 'What should a plumber invoice include?',
          html: '<p>Include your business details, the customer and job address, invoice number, invoice and due dates, a clear breakdown of labour and materials, applicable tax, payment details and the total due.</p><p>For larger jobs, reference the estimate, work order or project stage. For emergency work, show the call-out fee separately from labour and parts.</p>'
        },
        {
          h2: 'Example plumber invoice items',
          list: ['Emergency call-out', 'Leak diagnosis', 'Labour hours', 'Pipework and fittings', 'Tap or toilet repair', 'Boiler or heating work', 'Drain clearance', 'Travel or parking costs']
        },
        {
          h2: 'Invoice tips for plumbers',
          list: ['Show labour and parts separately', 'Describe the completed repair', 'Include the job address', 'State whether a deposit has already been paid', 'Set a clear payment deadline', 'Keep supporting receipts for materials']
        }
      ],
      faqs: [
        ['Can I add a call-out fee?', 'Yes. Add the call-out as a separate invoice item.'],
        ['Can I list parts and labour separately?', 'Yes. Separate line items make the invoice easier for customers to understand.'],
        ['Can I add tax?', 'Yes. VAT, GST, sales tax and custom rates are supported depending on the selected market.'],
        ['Can I use it for emergency plumbing work?', 'Yes. Add the emergency call-out, labour and parts as separate charges.'],
        ['Can I download a PDF?', 'Yes. Completed plumbing invoices can be downloaded as PDFs.']
      ],
      related: [
        ['/electrician-invoice-generator', 'Electrician Invoice Generator'],
        ['/uk-invoice-generator', 'UK Invoice Generator'],
        ['/free-invoice-generator', 'Free Invoice Generator']
      ]
    }
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pathKey() {
    var path = window.location.pathname.replace(/\/+$/, '') || '/';
    return path.toLowerCase();
  }

  function setMeta(page, path) {
    document.title = page.title;

    var meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = page.description;

    var canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = SITE_URL + path;

    var robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = 'index,follow,max-image-preview:large';

    var og = {
      'og:title': page.title,
      'og:description': page.description,
      'og:type': 'website',
      'og:url': SITE_URL + path,
      'twitter:card': 'summary_large_image',
      'twitter:title': page.title,
      'twitter:description': page.description
    };

    Object.keys(og).forEach(function (property) {
      var attr = property.indexOf('twitter:') === 0 ? 'name' : 'property';
      var tag = document.querySelector('meta[' + attr + '="' + property + '"]');
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attr, property);
        document.head.appendChild(tag);
      }
      tag.content = og[property];
    });
  }

  function addSchema(page, path) {
    var old = document.getElementById('invoiceit-seo-schema');
    if (old) old.remove();

    var schema = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': SITE_URL + path + '#webpage',
          url: SITE_URL + path,
          name: page.title,
          description: page.description,
          isPartOf: { '@id': SITE_URL + '/#website' }
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
            { '@type': 'ListItem', position: 2, name: page.h1, item: SITE_URL + path }
          ]
        },
        {
          '@type': 'FAQPage',
          mainEntity: page.faqs.map(function (faq) {
            return {
              '@type': 'Question',
              name: faq[0],
              acceptedAnswer: { '@type': 'Answer', text: faq[1] }
            };
          })
        }
      ]
    };

    var script = document.createElement('script');
    script.id = 'invoiceit-seo-schema';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  }

  function styles() {
    if (document.getElementById('invoiceit-seo-styles')) return;
    var style = document.createElement('style');
    style.id = 'invoiceit-seo-styles';
    style.textContent =
      '.it-seo{font-family:Inter,Arial,sans-serif;color:#111827;background:#fff;line-height:1.65}' +
      '.it-seo *{box-sizing:border-box}' +
      '.it-seo a{text-decoration:none}' +
      '.it-wrap{width:min(1120px,calc(100% - 40px));margin:0 auto}' +
      '.it-nav{border-bottom:1px solid #e5e7eb;background:#fff;position:sticky;top:0;z-index:20}' +
      '.it-nav-inner{height:72px;display:flex;align-items:center;justify-content:space-between;gap:24px}' +
      '.it-brand{font-size:22px;font-weight:800;color:#111827;letter-spacing:-.04em}' +
      '.it-nav-links{display:flex;gap:24px;align-items:center}' +
      '.it-nav-links a{color:#4b5563;font-size:14px;font-weight:600}' +
      '.it-btn{display:inline-flex;align-items:center;justify-content:center;background:#2563eb;color:#fff!important;border-radius:10px;padding:13px 20px;font-weight:700;box-shadow:0 8px 24px rgba(37,99,235,.18)}' +
      '.it-hero{padding:84px 0 68px;background:linear-gradient(180deg,#f8fbff 0%,#fff 100%);border-bottom:1px solid #eef2f7}' +
      '.it-eyebrow{display:inline-flex;padding:6px 10px;border-radius:999px;background:#eaf2ff;color:#1d4ed8;font-size:13px;font-weight:700;margin-bottom:18px}' +
      '.it-hero h1{font-size:clamp(38px,6vw,64px);line-height:1.04;letter-spacing:-.05em;margin:0 0 20px;max-width:850px}' +
      '.it-lead{font-size:20px;color:#4b5563;max-width:760px;margin:0 0 28px}' +
      '.it-pills{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}' +
      '.it-pill{background:#fff;border:1px solid #dbe3ef;border-radius:999px;padding:8px 12px;font-size:13px;font-weight:650;color:#374151}' +
      '.it-main{padding:70px 0}' +
      '.it-grid{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:64px;align-items:start}' +
      '.it-content section{margin-bottom:54px}' +
      '.it-content h2{font-size:32px;line-height:1.2;letter-spacing:-.03em;margin:0 0 18px}' +
      '.it-content p{font-size:17px;color:#4b5563;margin:0 0 16px}' +
      '.it-content ul{padding-left:22px;color:#374151;font-size:17px}' +
      '.it-content li{margin:8px 0}' +
      '.it-side{position:sticky;top:96px;border:1px solid #e5e7eb;border-radius:16px;padding:22px;background:#f9fafb}' +
      '.it-side h3{margin:0 0 10px;font-size:20px}' +
      '.it-side p{color:#6b7280;font-size:14px;margin:0 0 16px}' +
      '.it-side .it-btn{width:100%}' +
      '.it-faq{border-top:1px solid #e5e7eb}' +
      '.it-faq-item{padding:20px 0;border-bottom:1px solid #e5e7eb}' +
      '.it-faq-item h3{font-size:18px;margin:0 0 8px}' +
      '.it-faq-item p{margin:0;color:#4b5563}' +
      '.it-related{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}' +
      '.it-related a{border:1px solid #e5e7eb;border-radius:12px;padding:16px;color:#1f2937;font-weight:700;background:#fff}' +
      '.it-final{padding:64px 0;background:#111827;color:#fff;text-align:center}' +
      '.it-final h2{font-size:36px;margin:0 0 12px}' +
      '.it-final p{color:#cbd5e1;margin:0 0 24px}' +
      '.it-footer{padding:28px 0;border-top:1px solid #e5e7eb;color:#6b7280;font-size:14px}' +
      '@media(max-width:800px){.it-nav-links a:not(.it-btn){display:none}.it-grid{grid-template-columns:1fr;gap:24px}.it-side{position:static}.it-related{grid-template-columns:1fr}.it-hero{padding:58px 0 48px}.it-main{padding:48px 0}.it-wrap{width:min(100% - 28px,1120px)}}';
    document.head.appendChild(style);
  }

  function render(page, path) {
    styles();

    var root = document.getElementById('invoiceit-seo-page');
    if (!root) {
      root = document.createElement('div');
      root.id = 'invoiceit-seo-page';
      document.body.appendChild(root);
    }

    var sections = page.sections.map(function (section) {
      var content = section.html || '';
      if (section.list) {
        content += '<ul>' + section.list.map(function (item) {
          return '<li>' + esc(item) + '</li>';
        }).join('') + '</ul>';
      }
      return '<section><h2>' + esc(section.h2) + '</h2>' + content + '</section>';
    }).join('');

    var faqs = page.faqs.map(function (faq) {
      return '<div class="it-faq-item"><h3>' + esc(faq[0]) + '</h3><p>' + esc(faq[1]) + '</p></div>';
    }).join('');

    var related = page.related.map(function (link) {
      return '<a href="' + esc(link[0]) + '">' + esc(link[1]) + ' →</a>';
    }).join('');

    root.innerHTML =
      '<div class="it-seo">' +
        '<nav class="it-nav"><div class="it-wrap it-nav-inner">' +
          '<a class="it-brand" href="/">InvoiceIt</a>' +
          '<div class="it-nav-links">' +
            '<a href="/free-invoice-generator">Invoice Generator</a>' +
            '<a href="/free-invoice-generator?template=freelance">Freelance</a>' +
            '<a href="/free-invoice-generator?template=contractor">Contractor</a>' +
            '<a class="it-btn" href="' + GENERATOR_URL + '">Create an invoice</a>' +
          '</div>' +
        '</div></nav>' +

        '<header class="it-hero"><div class="it-wrap">' +
          '<div class="it-eyebrow">' + esc(page.eyebrow) + '</div>' +
          '<h1>' + esc(page.h1) + '</h1>' +
          '<p class="it-lead">' + esc(page.intro) + '</p>' +
          '<a class="it-btn" href="' + GENERATOR_URL + '">Create your invoice</a>' +
          '<div class="it-pills">' + page.bullets.map(function (item) {
            return '<span class="it-pill">✓ ' + esc(item) + '</span>';
          }).join('') + '</div>' +
        '</div></header>' +

        '<main class="it-main"><div class="it-wrap it-grid">' +
          '<article class="it-content">' +
            sections +
            '<section><h2>Frequently asked questions</h2><div class="it-faq">' + faqs + '</div></section>' +
            '<section><h2>Related invoice pages</h2><div class="it-related">' + related + '</div></section>' +
          '</article>' +
          '<aside class="it-side">' +
            '<h3>Create your invoice now</h3>' +
            '<p>Add your business, client and line items, then download a professional PDF.</p>' +
            '<a class="it-btn" href="' + GENERATOR_URL + '">Open the generator</a>' +
          '</aside>' +
        '</div></main>' +

        '<section class="it-final"><div class="it-wrap">' +
          '<h2>Ready to create your invoice?</h2>' +
          '<p>Build a professional invoice and download it as a PDF.</p>' +
          '<a class="it-btn" href="' + GENERATOR_URL + '">Start invoicing</a>' +
        '</div></section>' +

        '<footer class="it-footer"><div class="it-wrap">© ' + new Date().getFullYear() + ' InvoiceIt. Professional invoicing made simple.</div></footer>' +
      '</div>';
  }

  function init() {
    var path = pathKey();
    var page = PAGES[path];
    if (!page) return;
    setMeta(page, path);
    addSchema(page, path);
    render(page, path);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
