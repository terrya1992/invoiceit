/*
 * InvoiceIt — SEO content module
 * ---------------------------------------------------------------------------
 * Adds unique, crawlable body copy to each of the 42 programmatic landing
 * pages (country / profession / template-format). Every page shares one
 * script, so the content is keyed by URL slug: each slug gets its own intro,
 * an itemised "what to put on this invoice" list, a tax/CIS/currency note,
 * and a short FAQ. The FAQ is also emitted as FAQPage JSON-LD.
 *
 * HOW TO SHIP THIS
 *   Option A (preferred): paste the SEO_CONTENT object + renderSeoContent()
 *   into invoiceit-seo-pages.js and call renderSeoContent() after that script
 *   builds the page, so the copy sits below the generator.
 *   Option B (quick): commit this file to the repo and add a second footer
 *   tag after the main one:
 *     <script src="https://cdn.jsdelivr.net/gh/terrya1992/invoiceit@main/invoiceit-seo-content.js?v=1" defer></script>
 *
 * It is self-contained and safe to load standalone: it waits for DOM ready,
 * matches the slug, injects once (guarded), and no-ops on any page without a
 * matching slug (home, generator, legal, etc.).
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';

  // Shared building blocks kept DRY without making pages read identically.
  var VAT_IF_REG = 'If you are VAT-registered, show your VAT number and a separate VAT line; if you are not, leave VAT off entirely and the total is simply the sum of your lines.';
  var CIS_NOTE = 'If you work as a subcontractor in construction, the Construction Industry Scheme (CIS) may apply: contractors deduct 20% (verified) or 30% (unverified) from the labour portion of your invoice and pay it to HMRC on your behalf. Materials are never subject to CIS, which is why keeping labour and materials on separate lines matters.';

  var SEO_CONTENT = {

    /* ===================== COUNTRIES ===================== */

    'uk-invoice-generator': {
      h1: 'Creating an invoice in the UK',
      intro: 'A UK invoice needs to identify both businesses, describe the work, and show the amount due clearly enough that your client — and their accountant — can pay it without coming back with questions. This generator lays all of that out for you and produces a clean PDF in about a minute.',
      includeTitle: 'What to put on a UK invoice',
      include: [
        'Your business name and address (and company number if you are a limited company)',
        'Your VAT number, if you are VAT-registered',
        'The client\u2019s name and address',
        'A unique, sequential invoice number',
        'The invoice date and the payment due date',
        'A clear description of the goods or services, with quantities and unit prices',
        'The subtotal, any VAT, and the total due',
        'How to pay you \u2014 bank name, sort code and account number'
      ],
      taxTitle: 'VAT in the UK',
      tax: 'The standard UK VAT rate is 20%, with a reduced 5% rate on some goods and services and a 0% rate on others. ' + VAT_IF_REG + ' You must register for VAT once your taxable turnover crosses the registration threshold, though many businesses register voluntarily before then.',
      faqs: [
        { q: 'Do I need to be VAT-registered to send an invoice?', a: 'No. Anyone can invoice for work \u2014 sole traders, freelancers and small businesses invoice without VAT all the time. You only add VAT once you are registered.' },
        { q: 'Does my invoice number have to follow a format?', a: 'It just has to be unique and sequential so each invoice can be told apart. Many people use INV-0001, INV-0002 and so on; this generator numbers them for you.' },
        { q: 'How long should I give a client to pay?', a: 'Thirty days is the common default in the UK, but you can set any terms you like \u2014 14 days, 7 days, or due on receipt. State the date clearly so there is no ambiguity.' }
      ]
    },

    'us-invoice-generator': {
      h1: 'Creating an invoice in the US',
      intro: 'US invoices work a little differently from most of the world: there is no federal VAT, so tax depends on your state and sometimes your city. This generator handles the layout, dollar totals and an optional sales-tax line, then gives you a professional PDF to send.',
      includeTitle: 'What to put on a US invoice',
      include: [
        'Your business name, address and (if you have one) EIN',
        'The client\u2019s name and billing address',
        'A unique invoice number and the invoice date',
        'An itemised list of products or services with quantities and rates',
        'Any sales tax, shown as its own line',
        'The total amount due and the payment due date',
        'Accepted payment methods \u2014 bank transfer (ACH), card, or check'
      ],
      taxTitle: 'Sales tax in the US',
      tax: 'There is no national sales tax. Rates are set at the state and local level, so what you charge depends on where the sale takes place and whether you have nexus there. If you are unsure whether to charge sales tax on a given invoice, check your state\u2019s rules \u2014 many services are exempt while most goods are taxable.',
      faqs: [
        { q: 'Do I have to charge sales tax on every invoice?', a: 'No. It depends on your state, what you\u2019re selling, and whether you have a tax obligation (nexus) there. Many freelance and consulting services aren\u2019t taxable at all.' },
        { q: 'What\u2019s an EIN and do I need one on the invoice?', a: 'An EIN is your federal Employer Identification Number. It\u2019s optional on an invoice \u2014 sole proprietors often use their SSN or nothing \u2014 but it looks more professional and keeps your SSN private.' },
        { q: 'Can I use this for 1099 contractor invoicing?', a: 'Yes. Independent contractors bill clients with exactly this kind of invoice; keep copies for your records at tax time.' }
      ]
    },

    'canada-invoice-generator': {
      h1: 'Creating an invoice in Canada',
      intro: 'Canadian invoicing hinges on which sales tax applies where you and your client are \u2014 GST, HST, or GST plus a provincial tax. This generator sets up the invoice cleanly, in Canadian dollars, with tax shown as its own line.',
      includeTitle: 'What to put on a Canadian invoice',
      include: [
        'Your business name and address',
        'Your GST/HST number, if you are registered',
        'The client\u2019s name and address',
        'A unique invoice number and date',
        'An itemised description of the work with amounts',
        'The correct sales tax (GST, HST or GST + PST/QST) on its own line',
        'The total due and how to pay you'
      ],
      taxTitle: 'GST, HST and provincial tax',
      tax: 'Federal GST is 5%. Some provinces combine it with their provincial tax into a single HST (commonly 13% or 15%); others charge GST plus a separate PST or QST. Which one you apply usually depends on where your customer is located. You generally must register for GST/HST once your revenue crosses the small-supplier threshold.',
      faqs: [
        { q: 'Which province\u2019s tax do I charge?', a: 'As a rule, the tax that applies is based on the province where the goods or service are supplied to the customer \u2014 the "place of supply". Check the specific rules if you sell across provinces.' },
        { q: 'Do I need a GST/HST number to invoice?', a: 'No. Below the small-supplier threshold you can invoice without charging or registering for GST/HST. Once registered, you must show your number and charge the tax.' },
        { q: 'Can I invoice in a currency other than CAD?', a: 'Yes, if you and your client agree \u2014 but showing Canadian dollar equivalents helps with your own bookkeeping and tax reporting.' }
      ]
    },

    'india-invoice-generator': {
      h1: 'Creating a GST invoice in India',
      intro: 'In India a proper tax invoice is a GST document: it needs your GSTIN, the right GST rate, and \u2014 depending on where your client is \u2014 the tax split correctly between central and state components. This generator produces a clean, GST-ready invoice in rupees.',
      includeTitle: 'What to put on an Indian GST invoice',
      include: [
        'Your business name, address and GSTIN',
        'The client\u2019s name, address and GSTIN (for B2B)',
        'A unique, sequential invoice number and date',
        'HSN or SAC codes for the goods or services',
        'The taxable value and the GST rate applied',
        'CGST + SGST (intra-state) or IGST (inter-state), shown separately',
        'The total amount payable including tax'
      ],
      taxTitle: 'GST in India',
      tax: 'GST is charged at 5%, 12%, 18% or 28% depending on the goods or service. For a sale within the same state you split it into CGST and SGST; for a sale to another state you charge IGST instead. You must register for GST once your turnover crosses the applicable threshold, and a registered business must issue a tax invoice showing its GSTIN.',
      faqs: [
        { q: 'What\u2019s the difference between CGST/SGST and IGST?', a: 'For a sale within your own state, GST splits into CGST (central) and SGST (state). For a sale to a different state, you charge a single IGST at the combined rate instead.' },
        { q: 'Do I need HSN or SAC codes?', a: 'Yes \u2014 goods use HSN codes and services use SAC codes on a GST invoice. The number of digits required depends on your turnover.' },
        { q: 'Can I invoice without a GSTIN?', a: 'If you\u2019re below the registration threshold you can issue a plain bill of supply, but you can\u2019t charge GST or call it a tax invoice until you\u2019re registered.' }
      ]
    },

    'australia-invoice-generator': {
      h1: 'Creating a tax invoice in Australia',
      intro: 'An Australian tax invoice needs your ABN and, if you\u2019re registered, GST shown correctly. Leave the ABN off and clients may be required to withhold tax from your payment \u2014 so this generator makes it easy to include everything a compliant invoice needs.',
      includeTitle: 'What to put on an Australian tax invoice',
      include: [
        'The words \u201cTax invoice\u201d if you\u2019re charging GST',
        'Your business or trading name and your ABN',
        'The client\u2019s name (and ABN for larger invoices)',
        'A unique invoice number and the date',
        'A description of each item with quantities and prices',
        '10% GST shown as its own line, if you\u2019re registered',
        'The total amount payable in Australian dollars'
      ],
      taxTitle: 'GST and your ABN',
      tax: 'GST in Australia is a flat 10%. You must register for GST once your turnover reaches the registration threshold, and only then do you charge it. Always quote your ABN: without it on your invoice, a business client may have to withhold tax at the top rate from your payment.',
      faqs: [
        { q: 'Do I need an ABN to invoice?', a: 'You can invoice without one, but you really shouldn\u2019t \u2014 without an ABN a business paying you may be required to withhold 47% and remit it to the ATO. An ABN is free to apply for.' },
        { q: 'When do I have to charge GST?', a: 'Only once you\u2019re registered for GST, which is mandatory above the turnover threshold and optional below it. If you\u2019re not registered, don\u2019t add GST and don\u2019t label it a "tax invoice".' },
        { q: 'What makes it a "tax invoice" rather than an invoice?', a: 'A tax invoice includes GST and those exact words. If you\u2019re not registered for GST, it\u2019s just an invoice.' }
      ]
    },

    'new-zealand-invoice-generator': {
      h1: 'Creating a tax invoice in New Zealand',
      intro: 'New Zealand invoicing is refreshingly simple: one GST rate, and a GST number if you\u2019re registered. This generator sets out your invoice cleanly in New Zealand dollars and handles the 15% GST line for you.',
      includeTitle: 'What to put on a New Zealand invoice',
      include: [
        'Your business name and your GST number, if registered',
        'The client\u2019s name and details',
        'A unique invoice number and date',
        'A clear description of the goods or services',
        '15% GST shown separately, if you\u2019re registered',
        'The total amount due in NZD',
        'Your bank account number for payment'
      ],
      taxTitle: 'GST in New Zealand',
      tax: 'GST is a single flat 15%. You must register once your turnover passes the threshold, and a GST-registered business shows its GST number and charges 15% on taxable supplies. Below the threshold you invoice without GST.',
      faqs: [
        { q: 'Do I need to register for GST?', a: 'Only once your turnover crosses the registration threshold. Below it, registration is optional \u2014 some businesses register voluntarily to claim GST on expenses.' },
        { q: 'What\u2019s required for a valid tax invoice?', a: 'For GST-registered sellers: your name and GST number, the date, a description of the supply, and the GST amount or a note that GST is included. This generator covers those.' },
        { q: 'Can I invoice overseas clients in NZD?', a: 'Yes. Exports of services to overseas clients are often zero-rated for GST \u2014 check the specifics, but you can still present the invoice in NZD.' }
      ]
    },

    'ireland-invoice-generator': {
      h1: 'Creating a VAT invoice in Ireland',
      intro: 'Irish invoices follow EU-style VAT rules, with a 23% standard rate and a couple of reduced rates. This generator produces a clean, euro-denominated invoice with your VAT number and the correct VAT breakdown.',
      includeTitle: 'What to put on an Irish invoice',
      include: [
        'Your business name and address',
        'Your VAT number, if registered',
        'The client\u2019s name and address (and VAT number for B2B)',
        'A unique invoice number and date',
        'A description of the goods or services with amounts',
        'The VAT rate and VAT amount, shown separately',
        'The total due in euro'
      ],
      taxTitle: 'VAT in Ireland',
      tax: 'The standard Irish VAT rate is 23%, with reduced rates of 13.5% and 9% on certain goods and services. ' + VAT_IF_REG + ' For B2B sales to other EU countries, reverse-charge rules may apply, in which case you note the customer\u2019s VAT number and that VAT is accounted for by the customer.',
      faqs: [
        { q: 'Which VAT rate should I use?', a: 'It depends on what you\u2019re selling \u2014 23% is the standard rate, but hospitality, certain services and some goods fall under 13.5% or 9%. Check the category if you\u2019re unsure.' },
        { q: 'What about selling to other EU countries?', a: 'For B2B sales within the EU, the reverse charge often applies: you don\u2019t charge Irish VAT, you note the customer\u2019s VAT number, and they account for the VAT. This generator lets you set a 0% line for that.' },
        { q: 'Do I need to be VAT-registered?', a: 'Only above the registration thresholds, which differ for goods and services. Below them you can invoice without VAT.' }
      ]
    },

    'south-africa-invoice-generator': {
      h1: 'Creating a tax invoice in South Africa',
      intro: 'A South African tax invoice needs your VAT number and 15% VAT shown correctly once you\u2019re registered. This generator lays it out cleanly in rand and handles the VAT line for you.',
      includeTitle: 'What to put on a South African invoice',
      include: [
        'The words \u201cTax invoice\u201d, if you\u2019re VAT-registered',
        'Your business name, address and VAT number',
        'The client\u2019s name and address',
        'A unique invoice number and the date',
        'A description of the goods or services supplied',
        '15% VAT shown separately',
        'The total amount due in rand'
      ],
      taxTitle: 'VAT in South Africa',
      tax: 'South African VAT is a flat 15%. Registration is compulsory once your taxable turnover crosses the threshold and voluntary below it. A VAT-registered business must issue a tax invoice showing its VAT number and the VAT charged.',
      faqs: [
        { q: 'When must I register for VAT?', a: 'Registration is mandatory once your taxable turnover exceeds the compulsory threshold in a 12-month period, and optional above a lower voluntary threshold.' },
        { q: 'What counts as a valid tax invoice?', a: 'Above a small-value limit it must say "tax invoice", carry both parties\u2019 details, your VAT number, a description, and the VAT amount. This generator includes those fields.' },
        { q: 'Can I invoice without charging VAT?', a: 'Yes, if you\u2019re not VAT-registered \u2014 issue a normal invoice with no VAT line and no VAT number.' }
      ]
    },

    'singapore-invoice-generator': {
      h1: 'Creating a tax invoice in Singapore',
      intro: 'Singapore invoicing centres on GST: if you\u2019re registered, you charge it and show your GST registration number. This generator produces a clean invoice in Singapore dollars with the GST line handled.',
      includeTitle: 'What to put on a Singapore invoice',
      include: [
        'The words \u201cTax invoice\u201d, if GST-registered',
        'Your business name and GST registration number',
        'The client\u2019s name and details',
        'A unique invoice number and date',
        'A description of the goods or services with amounts',
        'GST shown as its own line, if registered',
        'The total payable in SGD'
      ],
      taxTitle: 'GST in Singapore',
      tax: 'Singapore charges GST on taxable supplies. Registration is compulsory once your turnover crosses the threshold and optional below it. A GST-registered business issues a tax invoice showing its registration number and the GST charged; if you\u2019re not registered, you issue a normal invoice with no GST.',
      faqs: [
        { q: 'Do I have to register for GST?', a: 'It\u2019s compulsory once your taxable turnover exceeds the registration threshold, and voluntary below it. Only registered businesses charge GST.' },
        { q: 'What\u2019s the difference between a tax invoice and a normal invoice?', a: 'A tax invoice is issued by a GST-registered business and shows the GST. If you\u2019re not registered, you issue a plain invoice without GST.' },
        { q: 'Can I bill overseas clients?', a: 'Yes \u2014 exported services may be zero-rated for GST. You can still present the invoice in SGD or another agreed currency.' }
      ]
    },

    'uae-invoice-generator': {
      h1: 'Creating a tax invoice in the UAE',
      intro: 'In the UAE, a tax invoice needs your Tax Registration Number (TRN) and 5% VAT shown clearly once you\u2019re registered. This generator lays it out cleanly in dirhams and handles the VAT line.',
      includeTitle: 'What to put on a UAE tax invoice',
      include: [
        'The words \u201cTax invoice\u201d',
        'Your business name, address and TRN',
        'The client\u2019s name and address (and TRN for B2B)',
        'A unique invoice number and the date',
        'A description of the goods or services with amounts',
        '5% VAT shown as its own line',
        'The total payable in AED'
      ],
      taxTitle: 'VAT in the UAE',
      tax: 'UAE VAT is a flat 5%. Registration is mandatory once your taxable supplies cross the threshold and voluntary above a lower one. A registered business must issue a tax invoice showing its TRN and the VAT charged. Some supplies are zero-rated or exempt.',
      faqs: [
        { q: 'What\u2019s a TRN and do I need it on the invoice?', a: 'A TRN is your Tax Registration Number, issued when you register for VAT. A VAT-registered business must show it on every tax invoice.' },
        { q: 'When must I register for VAT?', a: 'Registration is mandatory once your taxable supplies and imports exceed the mandatory threshold, and optional above a lower voluntary threshold.' },
        { q: 'Do I charge VAT to overseas clients?', a: 'Exports of goods and some services can be zero-rated. Check the specific rules; this generator lets you set a 0% line where it applies.' }
      ]
    },

    'germany-invoice-generator': {
      h1: 'Creating an invoice in Germany',
      intro: 'A German invoice (Rechnung) follows EU VAT rules, with a 19% standard rate and a 7% reduced rate. This generator produces a clean, euro invoice with your VAT ID and the correct VAT breakdown.',
      includeTitle: 'What to put on a German invoice',
      include: [
        'Your business name and address',
        'Your VAT ID (USt-IdNr) or tax number',
        'The client\u2019s name and address',
        'A unique, sequential invoice number and the date',
        'A description of the goods or services with amounts',
        '19% or 7% VAT (MwSt/USt) shown separately',
        'The total due in euro'
      ],
      taxTitle: 'VAT (Umsatzsteuer) in Germany',
      tax: 'The standard German VAT rate is 19%, with a reduced 7% rate on some goods and services. ' + VAT_IF_REG + ' Small businesses using the Kleinunternehmer rule don\u2019t charge VAT and should note that on the invoice. For B2B sales to other EU countries, the reverse charge may apply.',
      faqs: [
        { q: 'What\u2019s the Kleinunternehmer rule?', a: 'It\u2019s a small-business scheme: if you qualify, you don\u2019t charge VAT and instead add a note stating you\u2019re exempt under \u00a719 UStG. This generator lets you set VAT to 0% for that.' },
        { q: 'Do invoice numbers need to be sequential?', a: 'Yes \u2014 German rules require a unique, consecutive invoice number. The generator numbers them in order for you.' },
        { q: 'Selling to another EU business \u2014 do I charge German VAT?', a: 'Often not: the reverse charge shifts the VAT to the customer, and you note their VAT ID. Check the rules for your situation.' }
      ]
    },

    'france-invoice-generator': {
      h1: 'Creating an invoice in France',
      intro: 'A French invoice (facture) follows EU VAT rules, with a 20% standard rate and reduced rates below that. This generator produces a clean euro invoice with your VAT number and the correct TVA breakdown.',
      includeTitle: 'What to put on a French invoice',
      include: [
        'Your business name and address (and SIRET if applicable)',
        'Your VAT number (num\u00e9ro de TVA), if registered',
        'The client\u2019s name and address',
        'A unique, sequential invoice number and the date',
        'A description of the goods or services with amounts',
        'TVA at 20%, 10% or 5.5% shown separately',
        'The total due in euro, and payment terms'
      ],
      taxTitle: 'VAT (TVA) in France',
      tax: 'The standard French VAT rate is 20%, with reduced rates of 10% and 5.5% on certain goods and services. ' + VAT_IF_REG + ' Micro-entrepreneurs below the VAT threshold don\u2019t charge TVA and add the note \u201cTVA non applicable, art. 293 B du CGI\u201d. Reverse-charge rules may apply for B2B sales within the EU.',
      faqs: [
        { q: 'I\u2019m a micro-entrepreneur \u2014 do I charge VAT?', a: 'Not while you\u2019re below the VAT threshold (franchise en base). You add the standard note that TVA doesn\u2019t apply and set VAT to 0% here.' },
        { q: 'Are late-payment penalties required?', a: 'French invoices normally must state payment terms and mention late-payment penalties and the recovery indemnity for B2B. Add these to your payment terms field.' },
        { q: 'Which TVA rate applies?', a: 'It depends on the product or service \u2014 20% is standard, with 10% and 5.5% for specific categories. Check the category if unsure.' }
      ]
    },

    'netherlands-invoice-generator': {
      h1: 'Creating an invoice in the Netherlands',
      intro: 'A Dutch invoice (factuur) follows EU VAT rules, with a 21% standard BTW rate and a 9% reduced rate. This generator produces a clean euro invoice with your VAT number and the correct BTW breakdown.',
      includeTitle: 'What to put on a Dutch invoice',
      include: [
        'Your business name, address and KvK number',
        'Your VAT number (btw-nummer), if registered',
        'The client\u2019s name and address',
        'A unique, sequential invoice number and the date',
        'A description of the goods or services with amounts',
        'BTW at 21% or 9% shown separately',
        'The total due in euro'
      ],
      taxTitle: 'VAT (BTW) in the Netherlands',
      tax: 'The standard Dutch VAT rate is 21%, with a reduced 9% rate on some goods and services. ' + VAT_IF_REG + ' The small-businesses scheme (KOR) can exempt you from charging BTW if you qualify. Reverse-charge rules may apply for B2B sales within the EU.',
      faqs: [
        { q: 'What\u2019s the KOR?', a: 'The kleineondernemersregeling is a small-business scheme: if you opt in and qualify, you don\u2019t charge BTW. Set VAT to 0% and note the scheme on the invoice.' },
        { q: 'Do I need my KvK number on the invoice?', a: 'Including your Chamber of Commerce (KvK) number is standard practice and expected on Dutch invoices, alongside your VAT number.' },
        { q: 'Selling B2B to another EU country?', a: 'The reverse charge often applies, so you don\u2019t charge Dutch BTW and instead note the customer\u2019s VAT number. Check the specifics for your case.' }
      ]
    },

    /* ===================== PROFESSIONS ===================== */

    'plumber-invoice-generator': {
      h1: 'Invoicing for plumbing work',
      intro: 'Plumbing invoices are clearest when labour and parts are separated, so a client can see the callout, the hours, and each fitting or fixture used. This generator keeps those lines distinct and produces a professional PDF you can send from the van.',
      includeTitle: 'What to put on a plumber\u2019s invoice',
      include: [
        'Your business name and contact details',
        'The client\u2019s name and the job address',
        'The date of the work and an invoice number',
        'A callout or minimum charge, if you apply one',
        'Labour \u2014 hours worked and your hourly or day rate',
        'Materials \u2014 each pipe, fitting or fixture with its cost',
        'VAT if you\u2019re registered, and the total due'
      ],
      taxTitle: 'VAT and CIS for plumbers',
      tax: VAT_IF_REG + ' ' + CIS_NOTE + ' Emergency callouts and after-hours work are usually charged as a separate premium line so the breakdown stays transparent.',
      faqs: [
        { q: 'How do I charge for an emergency callout?', a: 'List the callout fee as its own line and, if you charge a higher out-of-hours labour rate, show that separately too. Clients accept premiums far more readily when they can see the breakdown.' },
        { q: 'Should I mark up materials?', a: 'Many plumbers add a handling markup on parts. You can build it into the unit price or leave materials at cost \u2014 either is fine, just be consistent.' },
        { q: 'Does CIS apply to me?', a: 'It can, if you subcontract on construction sites. CIS is deducted from labour only, never materials \u2014 which is why this generator keeps them on separate lines.' }
      ]
    },

    'electrician-invoice-generator': {
      h1: 'Invoicing for electrical work',
      intro: 'Electrical invoices should make labour, parts and any testing or certification easy to read at a glance. This generator separates those lines and gives you a clean PDF, whether it\u2019s a single socket or a full rewire.',
      includeTitle: 'What to put on an electrician\u2019s invoice',
      include: [
        'Your business name and contact details',
        'The client\u2019s name and the job address',
        'The date of work and an invoice number',
        'Labour \u2014 hours or a fixed price for the job',
        'Materials \u2014 cable, accessories and fittings, itemised',
        'Any testing, inspection or certificate fees',
        'VAT if registered, and the total due'
      ],
      taxTitle: 'VAT and CIS for electricians',
      tax: VAT_IF_REG + ' ' + CIS_NOTE + ' Certification and testing are often listed as their own line so the client sees exactly what the compliance work cost.',
      faqs: [
        { q: 'Should certification be a separate line?', a: 'Yes \u2014 listing testing, inspection or an EICR/EIC certificate separately makes the invoice clearer and justifies the charge.' },
        { q: 'Do I need to show CIS on the invoice?', a: 'If you\u2019re subcontracting in construction, show the CIS deduction against the labour line so the net "amount payable" is unambiguous. Materials aren\u2019t affected.' },
        { q: 'Fixed price or hourly?', a: 'Either works \u2014 use a single fixed-price labour line for defined jobs, or hours \u00d7 rate for open-ended work. The generator supports both.' }
      ]
    },

    'builder-invoice-generator': {
      h1: 'Invoicing for building work',
      intro: 'Building jobs run across stages, labour and a long list of materials, so the invoice needs room to break all of that out clearly \u2014 and to handle CIS where it applies. This generator separates labour and materials and calculates the deduction for you.',
      includeTitle: 'What to put on a builder\u2019s invoice',
      include: [
        'Your business name, contact details and UTR',
        'The client\u2019s name and the site address',
        'The invoice date, number and any PO reference',
        'Labour \u2014 by stage, day rate or fixed price',
        'Materials \u2014 itemised, kept separate from labour',
        'The CIS deduction (20% or 30%) on the labour portion, where it applies',
        'VAT if registered, and the amount payable'
      ],
      taxTitle: 'CIS and VAT for builders',
      tax: CIS_NOTE + ' ' + VAT_IF_REG + ' For VAT-registered construction work between businesses, the domestic reverse charge may also apply \u2014 in which case the customer accounts for the VAT and you note that on the invoice.',
      faqs: [
        { q: 'How is CIS calculated on my invoice?', a: 'The deduction applies to the labour total only \u2014 20% for verified subcontractors, 30% if unverified. Materials are excluded, so the generator splits them out and deducts from labour alone.' },
        { q: 'What\u2019s the VAT reverse charge for construction?', a: 'For VAT-registered B2B construction services, you often don\u2019t charge VAT \u2014 the customer accounts for it instead. You add a note to that effect and leave the VAT line at zero.' },
        { q: 'Should I invoice by stage?', a: 'For larger jobs, staged invoices (deposit, first fix, completion) keep cash flow steady. Each can be its own invoice with a clear description.' }
      ]
    },

    'carpenter-invoice-generator': {
      h1: 'Invoicing for carpentry and joinery',
      intro: 'Carpentry invoices work best when labour, timber and fittings are itemised, so a client sees the craft time separately from the materials. This generator keeps those lines clean and gives you a professional PDF.',
      includeTitle: 'What to put on a carpenter\u2019s invoice',
      include: [
        'Your business name and contact details',
        'The client\u2019s name and the job address',
        'The date of work and an invoice number',
        'Labour \u2014 hours or a fixed price for the piece or job',
        'Materials \u2014 timber, boards, fixings and fittings, itemised',
        'Any finishing, delivery or fitting charges',
        'VAT if registered, and the total due'
      ],
      taxTitle: 'VAT and CIS for carpenters',
      tax: VAT_IF_REG + ' ' + CIS_NOTE + ' Bespoke joinery is often quoted as a fixed labour price with materials listed underneath, which keeps the invoice easy to follow.',
      faqs: [
        { q: 'Fixed price or hourly for bespoke work?', a: 'Bespoke pieces are usually a fixed labour price agreed up front, with materials itemised below. Repairs and smaller jobs suit an hourly rate.' },
        { q: 'Does CIS apply to carpentry?', a: 'If you subcontract on construction sites, yes \u2014 CIS is deducted from labour only. Keeping materials separate is what lets the generator calculate it correctly.' },
        { q: 'Should delivery be a separate line?', a: 'For larger pieces, yes \u2014 listing delivery or fitting separately keeps the labour and material costs clean.' }
      ]
    },

    'painter-decorator-invoice-generator': {
      h1: 'Invoicing for painting and decorating',
      intro: 'Decorating invoices are clearest when prep, labour and materials are laid out separately \u2014 clients want to see the days on site as well as the paint and sundries. This generator keeps those lines distinct and produces a tidy PDF.',
      includeTitle: 'What to put on a decorator\u2019s invoice',
      include: [
        'Your business name and contact details',
        'The client\u2019s name and the job address',
        'The date of work and an invoice number',
        'Labour \u2014 days on site or a fixed job price',
        'Materials \u2014 paint, fillers, coverings and sundries',
        'Any prep, scaffolding or waste-removal charges',
        'VAT if registered, and the total due'
      ],
      taxTitle: 'VAT and CIS for decorators',
      tax: VAT_IF_REG + ' ' + CIS_NOTE + ' Prep work \u2014 sanding, filling, masking \u2014 is worth showing so clients understand what the days on site covered.',
      faqs: [
        { q: 'Should I price by day or by room?', a: 'Both are common. Day rates suit open-ended jobs; a fixed price per room or for the whole job suits well-defined work. The generator handles either.' },
        { q: 'Do I list paint separately?', a: 'Yes \u2014 itemising paint and materials separately from labour keeps the invoice transparent and makes any client-supplied materials easy to handle.' },
        { q: 'Does CIS apply to decorating?', a: 'It can, when you subcontract on construction projects. CIS comes off labour only, so keep materials on their own lines.' }
      ]
    },

    'cleaner-invoice-generator': {
      h1: 'Invoicing for cleaning services',
      intro: 'Cleaning invoices can be one-off or regular, hourly or per visit \u2014 the key is a clear description and a simple total. This generator handles both domestic and commercial cleaning and gives you a professional PDF in a minute.',
      includeTitle: 'What to put on a cleaner\u2019s invoice',
      include: [
        'Your business name and contact details',
        'The client\u2019s name and the address cleaned',
        'The date(s) of service and an invoice number',
        'A description \u2014 regular clean, deep clean, end of tenancy',
        'Hours or a fixed rate per visit',
        'Any extras \u2014 materials, carpets, windows',
        'VAT if registered, and the total due'
      ],
      taxTitle: 'VAT and recurring invoices',
      tax: VAT_IF_REG + ' For regular contracts, many cleaners invoice weekly or monthly with the same lines each time \u2014 keep an invoice-number sequence so each one is distinct and easy to reconcile.',
      faqs: [
        { q: 'Hourly or per visit?', a: 'Domestic cleans are often per visit at a fixed rate; commercial and deep cleans may be hourly. State clearly which you\u2019re charging.' },
        { q: 'How do I invoice a regular client?', a: 'Issue one invoice per period (weekly or monthly) with the visits listed, each with its own sequential number so your records stay clean.' },
        { q: 'Should I charge for materials?', a: 'If you supply products or equipment for a deep clean, list them separately; for routine cleans they\u2019re usually built into the rate.' }
      ]
    },

    'gardener-invoice-generator': {
      h1: 'Invoicing for gardening and landscaping',
      intro: 'Garden work spans quick maintenance visits and larger landscaping jobs, so the invoice needs to handle both labour and materials like plants, turf and aggregates. This generator keeps them separate and produces a clean PDF.',
      includeTitle: 'What to put on a gardener\u2019s invoice',
      include: [
        'Your business name and contact details',
        'The client\u2019s name and the job address',
        'The date of work and an invoice number',
        'Labour \u2014 hours or a fixed price for the job',
        'Materials \u2014 plants, turf, compost, aggregates',
        'Any green-waste removal or disposal charges',
        'VAT if registered, and the total due'
      ],
      taxTitle: 'VAT and CIS for gardeners',
      tax: VAT_IF_REG + ' Most garden maintenance falls outside CIS, but hard landscaping and groundworks on construction projects can bring it into scope \u2014 in which case CIS is deducted from labour only.',
      faqs: [
        { q: 'Do I charge for green-waste removal?', a: 'Yes, it\u2019s usually a separate line \u2014 disposal has real cost and clients expect to see it itemised.' },
        { q: 'Maintenance visits \u2014 how do I invoice them?', a: 'Regular visits suit a fixed per-visit rate invoiced weekly or monthly; one-off landscaping suits a job price with materials listed.' },
        { q: 'Does CIS ever apply?', a: 'For routine gardening, rarely. For hard landscaping or groundworks as a construction subcontractor, it can \u2014 keep materials and labour on separate lines just in case.' }
      ]
    },

    'handyman-invoice-generator': {
      h1: 'Invoicing for handyman work',
      intro: 'Handyman jobs cover a bit of everything, so the invoice needs to itemise varied tasks and any materials cleanly. This generator lets you list labour and parts separately and produces a professional PDF in a minute.',
      includeTitle: 'What to put on a handyman\u2019s invoice',
      include: [
        'Your business name and contact details',
        'The client\u2019s name and the job address',
        'The date of work and an invoice number',
        'Labour \u2014 hours, a half-day/day rate, or per task',
        'Materials \u2014 any parts or fittings supplied',
        'A minimum callout charge, if you apply one',
        'VAT if registered, and the total due'
      ],
      taxTitle: 'VAT and CIS for handymen',
      tax: VAT_IF_REG + ' ' + CIS_NOTE + ' Because handyman work is varied, a short line describing each task keeps the invoice clear and helps avoid queries.',
      faqs: [
        { q: 'Should I set a minimum charge?', a: 'Many handymen do \u2014 a minimum callout or half-day rate covers travel and small jobs. List it as its own line.' },
        { q: 'How detailed should the description be?', a: 'A short line per task (e.g. "hung two doors", "sealed bathroom") reads far better than one vague "labour" line and reduces disputes.' },
        { q: 'Does CIS apply?', a: 'Only if the work is construction operations and you\u2019re subcontracting. General odd jobs usually aren\u2019t caught, but keep labour and materials separate to be safe.' }
      ]
    },

    'mechanic-invoice-generator': {
      h1: 'Invoicing for vehicle repairs',
      intro: 'A mechanic\u2019s invoice needs parts and labour clearly separated, plus the vehicle details for the client\u2019s records. This generator itemises everything and produces a clean PDF for the customer.',
      includeTitle: 'What to put on a mechanic\u2019s invoice',
      include: [
        'Your business name and contact details',
        'The client\u2019s name and the vehicle (make, model, reg)',
        'The date of work and an invoice number',
        'Labour \u2014 hours worked and your hourly rate',
        'Parts \u2014 each component with its cost',
        'Any diagnostic, MOT or disposal fees',
        'VAT if registered, and the total due'
      ],
      taxTitle: 'VAT for mechanics',
      tax: VAT_IF_REG + ' Recording the vehicle registration and mileage on the invoice is good practice \u2014 it ties the work to the vehicle and helps with warranty or service-history queries later.',
      faqs: [
        { q: 'Should I list each part separately?', a: 'Yes \u2014 itemising parts with a standard markup is normal, and a clear parts-and-labour split reassures customers the bill is fair.' },
        { q: 'Do I put the vehicle registration on the invoice?', a: 'It\u2019s worth doing \u2014 make, model, reg and mileage tie the invoice to the vehicle and are useful for service history.' },
        { q: 'How do I handle diagnostics?', a: 'List a diagnostic fee as its own line; if the customer proceeds with the repair, you can note whether it\u2019s absorbed into the job.' }
      ]
    },

    'photographer-invoice-generator': {
      h1: 'Invoicing for photography',
      intro: 'Photography invoices span shoot time, editing, prints and licensing \u2014 and clients like to see those broken out. This generator lets you itemise the day, the deliverables and any usage rights, then produces a clean PDF.',
      includeTitle: 'What to put on a photographer\u2019s invoice',
      include: [
        'Your business or studio name and contact details',
        'The client\u2019s name and the project or shoot',
        'The date and an invoice number',
        'Shoot fee \u2014 day rate, half day, or per session',
        'Editing / retouching, and prints or albums',
        'Any licensing or usage-rights fee',
        'VAT if registered, and the total due (note any deposit paid)'
      ],
      taxTitle: 'VAT, deposits and licensing',
      tax: VAT_IF_REG + ' Deposits are common in photography \u2014 show the deposit already paid and the balance due so the client sees exactly what\u2019s outstanding. Licensing or usage rights are best listed as their own line.',
      faqs: [
        { q: 'How do I show a deposit?', a: 'List the full fee, then a deposit-paid line, so the balance due is clear. It keeps your records straight and avoids confusion at final payment.' },
        { q: 'Should licensing be separate from the shoot fee?', a: 'Yes \u2014 separating the creative fee from usage rights makes it easy to charge for extended or commercial licensing later.' },
        { q: 'Day rate or per project?', a: 'Both are common \u2014 day rates for shoots, project pricing for defined deliverables. The generator supports either with clear line items.' }
      ]
    },

    'graphic-designer-invoice-generator': {
      h1: 'Invoicing for design work',
      intro: 'Design invoices can be per project, per day or per hour, and often include revisions or a licensing note. This generator lets you present the work clearly and produces a clean, on-brand-looking PDF in a minute.',
      includeTitle: 'What to put on a designer\u2019s invoice',
      include: [
        'Your name or studio and contact details',
        'The client\u2019s name and the project',
        'The date and an invoice number',
        'The work \u2014 by project, day rate or hours',
        'Any revisions or extra rounds beyond the scope',
        'A deposit paid, if applicable, and the balance',
        'VAT if registered, and the total due'
      ],
      taxTitle: 'VAT, deposits and scope',
      tax: VAT_IF_REG + ' Many designers take a deposit up front on project work \u2014 show it as a paid line with the balance outstanding. Listing out-of-scope revisions separately keeps expectations clear.',
      faqs: [
        { q: 'Project fee or day rate?', a: 'Defined deliverables suit a project fee; ongoing or open-ended work suits a day rate. State clearly which you\u2019re billing.' },
        { q: 'How do I bill extra revisions?', a: 'If the client goes beyond the agreed rounds, add the extra revisions as their own line so the scope creep is visible and chargeable.' },
        { q: 'Should I keep ownership until paid?', a: 'A short note that final files or rights transfer on full payment is common practice \u2014 add it to your payment terms.' }
      ]
    },

    'consultant-invoice-generator': {
      h1: 'Invoicing for consulting',
      intro: 'Consulting invoices are usually about time or a fixed engagement fee, kept clean and professional. This generator lets you bill by day, hour or project and produces a polished PDF that suits corporate clients.',
      includeTitle: 'What to put on a consultant\u2019s invoice',
      include: [
        'Your name or company and contact details',
        'The client\u2019s name and any PO or reference',
        'The date and an invoice number',
        'The engagement \u2014 day rate, hours, or a fixed fee',
        'The period covered, for ongoing work',
        'Expenses, if you pass them on',
        'VAT if registered, and the total due with payment terms'
      ],
      taxTitle: 'VAT, POs and expenses',
      tax: VAT_IF_REG + ' Corporate clients often require a purchase-order number on the invoice before they\u2019ll pay \u2014 add it near the top. Pass-through expenses are clearest as their own itemised lines.',
      faqs: [
        { q: 'Do I need a PO number?', a: 'Many larger clients won\u2019t process an invoice without a matching purchase-order number. Ask for it up front and put it on the invoice.' },
        { q: 'How do I bill expenses?', a: 'List reimbursable expenses (travel, subsistence) as separate lines from your fee, and keep receipts in case they\u2019re queried.' },
        { q: 'Day rate or fixed fee?', a: 'Advisory work often runs on a day rate; defined deliverables suit a fixed fee. The generator handles both.' }
      ]
    },

    'freelancer-invoice-generator': {
      h1: 'Invoicing as a freelancer',
      intro: 'Freelance invoices need to look professional, state clear payment terms, and be quick to produce between jobs. This generator lets you bill by project, day or hour and gives you a clean PDF in about a minute.',
      includeTitle: 'What to put on a freelancer\u2019s invoice',
      include: [
        'Your name or trading name and contact details',
        'The client\u2019s name and the project',
        'The date and a sequential invoice number',
        'The work \u2014 by project, day rate or hours',
        'Any deposit paid, and the balance due',
        'Clear payment terms and how to pay you',
        'VAT if registered, and the total due'
      ],
      taxTitle: 'VAT and getting paid on time',
      tax: VAT_IF_REG + ' Clear, short payment terms \u2014 and stating the due date rather than just "30 days" \u2014 tend to get freelancers paid faster. Keep your invoice numbers sequential for your own records and any tax return.',
      faqs: [
        { q: 'What payment terms should I set?', a: 'Whatever suits you \u2014 14 or 30 days is common, and "due on receipt" is fine for smaller jobs. Always state the actual due date.' },
        { q: 'Do I need to register as self-employed?', a: 'In most countries, yes, once you\u2019re trading. Keep every invoice \u2014 they\u2019re the backbone of your tax return.' },
        { q: 'How do I chase a late invoice?', a: 'A polite reminder referencing the invoice number and due date usually does it. Sequential numbering makes them easy to track.' }
      ]
    },

    'personal-trainer-invoice-generator': {
      h1: 'Invoicing for personal training',
      intro: 'PT invoices tend to cover sessions, blocks or monthly plans, sometimes with an online-coaching element. This generator lets you present those clearly and produces a clean PDF for clients.',
      includeTitle: 'What to put on a personal trainer\u2019s invoice',
      include: [
        'Your name or business and contact details',
        'The client\u2019s name',
        'The date and an invoice number',
        'What\u2019s billed \u2014 single sessions, a block, or a monthly plan',
        'The period covered, for ongoing coaching',
        'Any extras \u2014 nutrition plans, assessments',
        'VAT if registered, and the total due'
      ],
      taxTitle: 'VAT and recurring plans',
      tax: VAT_IF_REG + ' Many trainers sell blocks or monthly memberships \u2014 invoice each period with its own number, and state clearly what the plan includes so there\u2019s no ambiguity about sessions used.',
      faqs: [
        { q: 'How do I invoice a block of sessions?', a: 'Bill the block as a single line (e.g. "10-session PT block") with the total, or list sessions individually \u2014 whichever your client prefers.' },
        { q: 'Monthly memberships \u2014 one invoice each month?', a: 'Yes \u2014 a recurring monthly invoice with its own sequential number keeps your records clean and makes payments easy to reconcile.' },
        { q: 'Should nutrition plans be separate?', a: 'If you charge for them on top of training, list them separately so the value is clear.' }
      ]
    },

    'dj-invoice-generator': {
      h1: 'Invoicing for DJ and event work',
      intro: 'DJ invoices cover a performance fee and often a deposit, travel, and extra hours \u2014 all worth showing clearly. This generator lets you itemise the booking and produces a professional PDF to confirm the gig.',
      includeTitle: 'What to put on a DJ\u2019s invoice',
      include: [
        'Your name or act and contact details',
        'The client\u2019s name and the event / venue',
        'The event date and an invoice number',
        'The performance fee \u2014 set length or hourly',
        'Any deposit paid, and the balance due',
        'Travel, equipment hire or overtime, if applicable',
        'VAT if registered, and the total due'
      ],
      taxTitle: 'VAT, deposits and cancellations',
      tax: VAT_IF_REG + ' A booking deposit is standard \u2014 show it paid, with the balance due before or on the event date. It\u2019s also worth stating your cancellation terms in the payment-terms field.',
      faqs: [
        { q: 'How do I handle the deposit?', a: 'Invoice the deposit to secure the booking, then show it as paid on the final invoice with the balance outstanding.' },
        { q: 'Should I charge for travel?', a: 'For events outside your usual area, yes \u2014 list travel as its own line so it\u2019s transparent.' },
        { q: 'What about overtime on the night?', a: 'Agree an hourly overtime rate up front and add it as a line if the set runs long. Stating it in advance avoids awkward conversations.' }
      ]
    },

    'music-producer-invoice-generator': {
      h1: 'Invoicing for music production',
      intro: 'Producer invoices span studio time, per-track work, mixing, mastering and sometimes royalties or licensing. This generator lets you itemise the work clearly and produces a clean PDF for the artist or label.',
      includeTitle: 'What to put on a producer\u2019s invoice',
      include: [
        'Your name or studio and contact details',
        'The client\u2019s name (artist or label) and the project',
        'The date and an invoice number',
        'The work \u2014 per track, session/day rate, or a project fee',
        'Mixing and mastering, if billed separately',
        'Any deposit paid, and the balance due',
        'VAT if registered, and the total due'
      ],
      taxTitle: 'VAT, deposits and rights',
      tax: VAT_IF_REG + ' Production work often takes a deposit up front \u2014 show it paid with the balance due. If your fee is separate from any royalty or master-rights arrangement, keep that clear on the invoice and in your agreement.',
      faqs: [
        { q: 'Per track or per day?', a: 'Both are common \u2014 per-track pricing suits defined deliverables, day/session rates suit open studio time. The generator supports either.' },
        { q: 'Should mixing and mastering be separate lines?', a: 'Yes \u2014 splitting production, mixing and mastering makes the invoice clear and lets clients pick and choose services.' },
        { q: 'Does the invoice cover rights?', a: 'An invoice bills for work done; ownership, royalties and master rights should be set out in your agreement, not assumed from the invoice.' }
      ]
    },

    'web-designer-invoice-generator': {
      h1: 'Invoicing for web design',
      intro: 'Web design invoices usually cover a project fee or milestones, sometimes with hosting or ongoing care. This generator lets you present the work and any stages clearly, then produces a clean PDF.',
      includeTitle: 'What to put on a web designer\u2019s invoice',
      include: [
        'Your name or studio and contact details',
        'The client\u2019s name and the project',
        'The date and an invoice number',
        'The work \u2014 project fee, milestone, day rate or hours',
        'Any deposit paid, and the balance due',
        'Ongoing items \u2014 hosting, maintenance, retainer',
        'VAT if registered, and the total due'
      ],
      taxTitle: 'VAT, deposits and milestones',
      tax: VAT_IF_REG + ' Web projects commonly bill in stages \u2014 a deposit, a milestone, and completion. Invoice each stage with its own number, and if handover of files or code depends on final payment, note that in your terms.',
      faqs: [
        { q: 'Should I bill in milestones?', a: 'For larger builds, yes \u2014 a deposit, a mid-point milestone and a completion invoice keep cash flow steady and reduce risk.' },
        { q: 'How do I invoice hosting or maintenance?', a: 'List recurring items (hosting, care plans) separately from the build, and invoice them on their own cycle.' },
        { q: 'Can I withhold the site until paid?', a: 'A clause that the live site or final files transfer on full payment is common \u2014 put it in your payment terms.' }
      ]
    },

    'web-developer-invoice-generator': {
      h1: 'Invoicing for web development',
      intro: 'Developer invoices run on day rates, sprints, milestones or retainers, and often reference a project or ticket. This generator lets you bill however you work and produces a clean, professional PDF.',
      includeTitle: 'What to put on a developer\u2019s invoice',
      include: [
        'Your name or company and contact details',
        'The client\u2019s name and the project or reference',
        'The date and an invoice number',
        'The work \u2014 day rate, hours, sprint, or fixed milestone',
        'The period covered, for ongoing or retainer work',
        'Any deposit paid, and the balance due',
        'VAT if registered, and the total due'
      ],
      taxTitle: 'VAT, retainers and POs',
      tax: VAT_IF_REG + ' Retainers and sprint-based work are best invoiced per period with the dates covered. Agency and corporate clients may need a purchase-order number on the invoice before they can pay.',
      faqs: [
        { q: 'How do I invoice a retainer?', a: 'Bill a fixed amount per period (monthly is common) with the dates covered, and note what the retainer includes.' },
        { q: 'Sprint or fixed price?', a: 'Ongoing work suits day rates or sprints; defined features suit a fixed milestone price. The generator handles both.' },
        { q: 'Do I need a PO number?', a: 'Agencies and larger clients often do \u2014 ask for it up front and add it to the invoice so payment isn\u2019t held up.' }
      ]
    },

    'copywriter-invoice-generator': {
      h1: 'Invoicing for copywriting',
      intro: 'Copywriting invoices can be per project, per word, per day or on a retainer, sometimes with revision rounds. This generator lets you present the work clearly and produces a clean PDF in a minute.',
      includeTitle: 'What to put on a copywriter\u2019s invoice',
      include: [
        'Your name or trading name and contact details',
        'The client\u2019s name and the project',
        'The date and an invoice number',
        'The work \u2014 by project, per word, day rate or retainer',
        'Any revision rounds beyond the agreed scope',
        'A deposit paid, if applicable, and the balance',
        'VAT if registered, and the total due'
      ],
      taxTitle: 'VAT, retainers and scope',
      tax: VAT_IF_REG + ' Retainer clients are best invoiced monthly with the period stated. If a project runs past its agreed revisions, list the extra rounds as their own line so the additional work is visible and billable.',
      faqs: [
        { q: 'Per word or per project?', a: 'Per-project pricing is usually clearer for clients and better paid; per-word suits high-volume work. State clearly which you\u2019re using.' },
        { q: 'How do I bill extra revisions?', a: 'If the client exceeds the agreed rounds, add the additional revisions as a separate line so the scope creep is chargeable.' },
        { q: 'How do retainers work on an invoice?', a: 'Invoice a fixed monthly amount with the period and what it covers \u2014 a set number of pieces or hours \u2014 stated on the invoice.' }
      ]
    },

    'virtual-assistant-invoice-generator': {
      h1: 'Invoicing as a virtual assistant',
      intro: 'VA invoices usually cover hours, retainer packages or task bundles, often across several small jobs. This generator lets you total everything cleanly and produces a professional PDF for the client.',
      includeTitle: 'What to put on a VA\u2019s invoice',
      include: [
        'Your name or business and contact details',
        'The client\u2019s name',
        'The date and an invoice number',
        'The work \u2014 hours, a retainer package, or tasks',
        'The period covered, for ongoing support',
        'Any extras beyond the agreed package',
        'VAT if registered, and the total due'
      ],
      taxTitle: 'VAT and retainer packages',
      tax: VAT_IF_REG + ' Retainer packages are best invoiced per period with the hours or scope stated. If you go over the agreed hours, list the overage separately so it\u2019s transparent and easy to approve.',
      faqs: [
        { q: 'Hourly or retainer?', a: 'Ad-hoc support suits hourly billing; regular clients often prefer a monthly retainer for a set number of hours. State which applies.' },
        { q: 'How do I handle extra hours?', a: 'If you exceed the retainer, add the additional hours as their own line at your agreed overage rate.' },
        { q: 'Should I itemise tasks?', a: 'A short summary of what the period covered reassures the client and reduces queries \u2014 you don\u2019t need a line per email, just clear groupings.' }
      ]
    },

    'tutor-invoice-generator': {
      h1: 'Invoicing for tutoring',
      intro: 'Tutoring invoices cover lessons \u2014 per hour, per session or monthly \u2014 and sometimes materials or exam prep. This generator lets you present them clearly and produces a clean PDF for parents or students.',
      includeTitle: 'What to put on a tutor\u2019s invoice',
      include: [
        'Your name or business and contact details',
        'The client\u2019s name (student or parent)',
        'The date and an invoice number',
        'Lessons \u2014 dates, hours, and your rate',
        'The subject or level, for clarity',
        'Any materials or exam-prep charges',
        'VAT if registered, and the total due'
      ],
      taxTitle: 'VAT and recurring lessons',
      tax: VAT_IF_REG + ' Regular tuition is often invoiced monthly with the lessons listed \u2014 keep each invoice numbered in sequence. Many private tutors fall below the VAT threshold and invoice without VAT.',
      faqs: [
        { q: 'How do I invoice regular lessons?', a: 'List the lesson dates and hours for the period on one monthly invoice, each with its own number, so parents can see exactly what they\u2019re paying for.' },
        { q: 'Per hour or per session?', a: 'Both work \u2014 hourly is common for one-to-one tuition, while fixed session or block pricing suits courses. State the rate clearly.' },
        { q: 'Do I charge VAT?', a: 'Only if you\u2019re VAT-registered, which most independent tutors aren\u2019t. If you\u2019re under the threshold, simply invoice without VAT.' }
      ]
    },

    /* ===================== TEMPLATE FORMATS ===================== */

    'invoice-template': {
      h1: 'Using a free invoice template',
      intro: 'A good invoice template saves you rebuilding the same layout every time \u2014 but a static template still leaves you doing the numbering, the maths and the VAT by hand. This tool fills that gap: fill in the fields online, and it handles the calculations and gives you a finished PDF.',
      includeTitle: 'What a complete invoice includes',
      include: [
        'Your business name and contact details',
        'The client\u2019s name and address',
        'A unique invoice number and the date',
        'A clear description of goods or services with amounts',
        'The subtotal, any tax, and the total due',
        'The payment due date and how to pay',
        'Your tax/VAT number, if you have one'
      ],
      taxTitle: 'Template vs generator',
      tax: 'A downloadable template (Word, Excel or PDF) is fine for the occasional invoice, but you maintain the formulas and formatting yourself. An online generator keeps the layout consistent, numbers invoices for you, and calculates totals and VAT automatically \u2014 which is faster and less error-prone once you\u2019re invoicing regularly.',
      faqs: [
        { q: 'Is this a template or a generator?', a: 'Both, really \u2014 you get a professionally laid-out template that fills itself in as you type, then exports a clean PDF. No formulas to maintain.' },
        { q: 'Do I need to sign up?', a: 'No. You can fill in and download a PDF without an account; your details are remembered on your own device to speed up the next one.' },
        { q: 'Can I reuse it for every invoice?', a: 'Yes \u2014 your business details carry over, the invoice number increments, and you just change the client and lines each time.' }
      ]
    },

    'freelance-invoice-template': {
      h1: 'A free freelance invoice template',
      intro: 'Freelancers need an invoice that handles day rates and hours cleanly and looks professional to any client. This template lays that out for you and fills in the numbering, totals and payment terms as you type.',
      includeTitle: 'What a freelance invoice should include',
      include: [
        'Your name or trading name and contact details',
        'The client\u2019s name and the project',
        'A sequential invoice number and the date',
        'Day rate or hours \u00d7 rate, laid out clearly',
        'Any deposit paid, and the balance due',
        'Clear payment terms and the due date',
        'VAT if you\u2019re registered'
      ],
      taxTitle: 'Day rates and getting paid',
      tax: 'The freelance template puts day rates and hours in dedicated columns so the maths is obvious to your client. Stating an actual due date, rather than just "30 days", tends to get freelancers paid faster. Add VAT only if you\u2019re registered.',
      faqs: [
        { q: 'Does it handle day rates and hours?', a: 'Yes \u2014 the freelance layout has day/hours and rate columns built in, so multi-day and hourly work both read clearly.' },
        { q: 'Do I need to sign up to use it?', a: 'No \u2014 fill in and download the PDF without an account. Your details are saved on your device for next time.' },
        { q: 'Can I add a deposit?', a: 'Yes \u2014 show the deposit already paid so the balance due is clear on the final invoice.' }
      ]
    },

    'contractor-invoice-template': {
      h1: 'A free contractor invoice template with CIS',
      intro: 'Contractors and subcontractors need an invoice that separates labour from materials and handles CIS deductions correctly. This template does exactly that, calculating the deduction and the net amount payable for you.',
      includeTitle: 'What a contractor invoice should include',
      include: [
        'Your business name, contact details and UTR',
        'The client / contractor\u2019s name and the site',
        'An invoice number, date and any PO reference',
        'Labour and materials on separate lines',
        'The CIS deduction (20% or 30%) on labour only',
        'The net amount payable after CIS',
        'VAT if registered'
      ],
      taxTitle: 'How CIS works on the template',
      tax: CIS_NOTE + ' The template applies the deduction to the labour total and shows a clear "amount payable" once it\u2019s taken off. ' + VAT_IF_REG,
      faqs: [
        { q: 'Does it calculate CIS for me?', a: 'Yes \u2014 choose 20% or 30% and it deducts from the labour portion only, leaving materials untouched, then shows the net amount payable.' },
        { q: 'Why keep labour and materials separate?', a: 'Because CIS is deducted from labour only. Keeping them on separate lines is what makes the deduction correct and defensible.' },
        { q: 'Do I need to sign up?', a: 'No \u2014 fill it in and download the PDF for free, no account needed.' }
      ]
    },

    'vat-invoice-template': {
      h1: 'A free VAT invoice template',
      intro: 'A VAT invoice has specific requirements \u2014 your VAT number, the rate, and a correct breakdown \u2014 and getting them wrong causes problems at return time. This template lays them out the way HMRC expects and calculates the VAT for you.',
      includeTitle: 'What a VAT invoice must include',
      include: [
        'Your business name, address and VAT number',
        'The client\u2019s name and address',
        'A unique, sequential invoice number and the date',
        'A description of the goods or services',
        'The rate of VAT applied to each line',
        'The net amount, the VAT amount, and the gross total',
        'The time of supply (tax point), where relevant'
      ],
      taxTitle: 'VAT done correctly',
      tax: 'The standard UK VAT rate is 20%, with 5% and 0% rates on some items. The template shows the net, the VAT and the gross clearly, with your VAT number in place. ' + VAT_IF_REG,
      faqs: [
        { q: 'What makes an invoice a valid VAT invoice?', a: 'It needs your VAT number, a sequential number, the date, the VAT rate and a net/VAT/gross breakdown. This template includes each of those.' },
        { q: 'Can I use it if I\u2019m not VAT-registered?', a: 'You can, but leave the VAT number blank and set VAT to 0% \u2014 without registration you can\u2019t charge VAT or call it a VAT invoice.' },
        { q: 'Do I need to sign up?', a: 'No \u2014 it\u2019s free and needs no account. Download the PDF straight away.' }
      ]
    },

    'blank-invoice-template': {
      h1: 'A free blank invoice template',
      intro: 'Sometimes you just want a clean, blank invoice you can shape around whatever you do. This template gives you a well-set starting point and still does the numbering, totals and VAT for you \u2014 so "blank" doesn\u2019t mean "start from scratch".',
      includeTitle: 'What to add to a blank invoice',
      include: [
        'Your business name and contact details',
        'The client\u2019s name and address',
        'A unique invoice number and the date',
        'Your own line items \u2014 whatever you\u2019re billing for',
        'The subtotal, any tax, and the total due',
        'Payment terms and how to pay',
        'Your VAT/tax number, if you have one'
      ],
      taxTitle: 'Flexible, but still calculated',
      tax: 'A blank template is the most flexible option \u2014 you decide the line items \u2014 but this one still totals everything and handles VAT automatically. ' + VAT_IF_REG,
      faqs: [
        { q: 'What\u2019s "blank" about it?', a: 'The line items are yours to define \u2014 there\u2019s no preset structure like day rates or CIS. Everything else (numbering, totals, VAT) is still handled.' },
        { q: 'Can I use it for any kind of work?', a: 'Yes \u2014 that\u2019s the point. Describe whatever you\u2019re billing for and the template does the maths.' },
        { q: 'Is it free with no signup?', a: 'Yes \u2014 fill in and download a PDF for free, no account needed.' }
      ]
    },

    'pdf-invoice-template': {
      h1: 'A free PDF invoice template',
      intro: 'PDF is the format clients actually want \u2014 it looks the same on every device and can\u2019t be edited by accident. This tool fills in a professional invoice online and exports a clean, text-based PDF you can attach to any email.',
      includeTitle: 'What a good PDF invoice includes',
      include: [
        'Your business name and contact details',
        'The client\u2019s name and address',
        'A unique invoice number and the date',
        'A clear description of the work with amounts',
        'The subtotal, any tax, and the total due',
        'The payment due date and how to pay',
        'Your VAT/tax number, if you have one'
      ],
      taxTitle: 'Why PDF beats Word or Excel',
      tax: 'A PDF renders identically everywhere and can\u2019t be altered in transit, which is why clients and accountants prefer it. This tool builds the invoice online \u2014 handling numbering, totals and VAT \u2014 and gives you a crisp, text-based PDF rather than a screenshot or a fragile spreadsheet. ' + VAT_IF_REG,
      faqs: [
        { q: 'Is the PDF text-based or an image?', a: 'Text-based \u2014 so it\u2019s crisp to read, small to email, and the text can be selected or searched.' },
        { q: 'Do I need design software?', a: 'No \u2014 you fill in fields online and the finished PDF is generated for you. No InDesign, no Word wrangling.' },
        { q: 'Is it free?', a: 'Yes \u2014 unlimited PDF invoices, no signup, no watermark beyond a small credit line on free invoices.' }
      ]
    },

    'word-invoice-template': {
      h1: 'A free alternative to Word invoice templates',
      intro: 'Word invoice templates always seem to fight back \u2014 misaligned tables, broken formatting, and totals you have to add up yourself. This tool gives you the same clean layout without the wrestling, and exports a professional PDF instead.',
      includeTitle: 'What your invoice needs',
      include: [
        'Your business name and contact details',
        'The client\u2019s name and address',
        'A unique invoice number and the date',
        'A description of goods or services with amounts',
        'The subtotal, any tax, and the total due',
        'The payment due date and how to pay',
        'Your VAT/tax number, if you have one'
      ],
      taxTitle: 'Why skip the Word template',
      tax: 'Word templates look fine until a table shifts or a formula is missing \u2014 and Word can\u2019t total your lines or work out VAT for you. This tool keeps the layout stable, numbers your invoices, calculates everything, and outputs a PDF that always looks right. ' + VAT_IF_REG,
      faqs: [
        { q: 'Can I still get a document I can send?', a: 'Yes \u2014 you get a clean PDF, which is what clients prefer anyway. It can\u2019t break formatting the way a shared Word file can.' },
        { q: 'Does it do the maths?', a: 'Yes \u2014 unlike a Word table, it totals your lines and calculates VAT automatically.' },
        { q: 'Is it free and signup-free?', a: 'Yes \u2014 fill in and download without an account.' }
      ]
    },

    'excel-invoice-template': {
      h1: 'A free alternative to Excel invoice templates',
      intro: 'Excel invoice templates rely on formulas that break the moment a row is inserted or a cell is overwritten. This tool gives you the calculation without the spreadsheet fragility \u2014 fill in the lines and it totals everything and exports a clean PDF.',
      includeTitle: 'What your invoice needs',
      include: [
        'Your business name and contact details',
        'The client\u2019s name and address',
        'A unique invoice number and the date',
        'Line items with quantities and rates',
        'The subtotal, any tax, and the total due',
        'The payment due date and how to pay',
        'Your VAT/tax number, if you have one'
      ],
      taxTitle: 'Why skip the Excel template',
      tax: 'Spreadsheets are powerful but brittle: one overwritten formula and your totals are wrong without you noticing. This tool does the calculations reliably \u2014 line totals, subtotal and VAT \u2014 and gives you a professional PDF rather than a spreadsheet a client has to open and could edit. ' + VAT_IF_REG,
      faqs: [
        { q: 'Will it total my lines like Excel does?', a: 'Yes \u2014 it calculates line totals, the subtotal and VAT automatically, with no formulas for you to maintain or accidentally break.' },
        { q: 'Do I send the client a spreadsheet?', a: 'No \u2014 you send a clean PDF, which looks professional and can\u2019t be altered like an editable spreadsheet.' },
        { q: 'Is it free?', a: 'Yes \u2014 unlimited invoices, no signup, no formulas.' }
      ]
    }
  };

  /* ---------------------------------------------------------------------- */

  function slugFromPath() {
    var path = (location.pathname || '').replace(/\/+$/, '');
    var last = path.split('/').pop() || '';
    return last.toLowerCase();
  }

  function el(tag, text) {
    var node = document.createElement(tag);
    if (text != null) node.textContent = text;
    return node;
  }

  function injectStyles() {
    if (document.getElementById('invoiceit-seo-styles')) return;
    var css =
      '.invoiceit-seo{max-width:1140px;margin:56px auto 8px;padding:0 24px;' +
      'font-family:Inter,"DM Sans",system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#2b3240;line-height:1.6}' +
      '.invoiceit-seo h2{font-size:26px;line-height:1.25;font-weight:700;color:#1a1f2b;margin:40px 0 14px}' +
      '.invoiceit-seo h3{font-size:18px;font-weight:600;color:#1a1f2b;margin:28px 0 10px}' +
      '.invoiceit-seo p{margin:0 0 14px;font-size:16px}' +
      '.invoiceit-seo ul{margin:0 0 14px;padding-left:22px}' +
      '.invoiceit-seo li{margin:0 0 7px;font-size:16px}' +
      '.invoiceit-seo .invoiceit-seo-faq{border-top:1px solid #e7eaf0;padding-top:16px;margin-top:10px}' +
      '.invoiceit-seo .invoiceit-seo-faq h3{margin-top:16px}' +
      '@media(max-width:767px){.invoiceit-seo{margin-top:36px;padding:0 18px}.invoiceit-seo h2{font-size:22px}}';
    var style = el('style');
    style.id = 'invoiceit-seo-styles';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  function insertionPoint() {
    // Prefer an explicit hook if the page has one, then main, then before the
    // footer, then the body as a last resort.
    return document.getElementById('seo-content-mount') ||
      document.querySelector('main') ||
      document.querySelector('footer') ||
      document.body;
  }

  function buildFaqJsonLd(h1, faqs) {
    var data = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(function (f) {
        return {
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a }
        };
      })
    };
    var s = el('script');
    s.type = 'application/ld+json';
    s.id = 'invoiceit-seo-faq-schema';
    s.appendChild(document.createTextNode(JSON.stringify(data)));
    document.head.appendChild(s);
  }

  function renderSeoContent() {
    if (document.getElementById('invoiceit-seo-block')) return; // guard: once only
    var content = SEO_CONTENT[slugFromPath()];
    if (!content) return; // no matching slug -> do nothing

    injectStyles();

    var section = el('section');
    section.id = 'invoiceit-seo-block';
    section.className = 'invoiceit-seo';
    section.setAttribute('aria-label', 'About this invoice');

    section.appendChild(el('h2', content.h1));
    if (content.intro) section.appendChild(el('p', content.intro));

    if (content.include && content.include.length) {
      section.appendChild(el('h3', content.includeTitle || 'What to include'));
      var ul = el('ul');
      content.include.forEach(function (item) { ul.appendChild(el('li', item)); });
      section.appendChild(ul);
    }

    if (content.tax) {
      section.appendChild(el('h3', content.taxTitle || 'Tax'));
      section.appendChild(el('p', content.tax));
    }

    if (content.faqs && content.faqs.length) {
      var faqWrap = el('div');
      faqWrap.className = 'invoiceit-seo-faq';
      faqWrap.appendChild(el('h2', 'Frequently asked questions'));
      content.faqs.forEach(function (f) {
        faqWrap.appendChild(el('h3', f.q));
        faqWrap.appendChild(el('p', f.a));
      });
      section.appendChild(faqWrap);
      buildFaqJsonLd(content.h1, content.faqs);
    }

    var point = insertionPoint();
    if (point && point.tagName === 'FOOTER' && point.parentNode) {
      point.parentNode.insertBefore(section, point); // sit just above the footer
    } else if (point) {
      point.appendChild(section);
    }
  }

  // Expose for Option A (call it yourself after the page builds).
  window.renderInvoiceItSeoContent = renderSeoContent;

  // Option B: run standalone once the DOM is ready.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderSeoContent);
  } else {
    renderSeoContent();
  }
})();
