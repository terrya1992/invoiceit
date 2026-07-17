/*
 * InvoiceIt — pricing page enhancements v1.0
 *
 * What this script does:
 * - Updates the Free, Pro and Business plan feature lists.
 * - Changes coming-soon buttons to "Join the waitlist".
 * - Opens a simple waitlist modal.
 * - Uses a mailto fallback so enquiries can be collected immediately.
 *
 * IMPORTANT:
 * Change WAITLIST_EMAIL below if you want enquiries sent elsewhere.
 */
(function () {
  'use strict';

  var WAITLIST_EMAIL = 'hello@invoiceit.io';
  var INITIALIZED = false;

  var PLANS = {
    free: {
      name: 'FREE',
      price: '£0',
      suffix: '/month',
      description: 'For creating and downloading professional invoices.',
      features: [
        'Unlimited invoices',
        'PDF export',
        'Standard invoice templates'
      ],
      button: 'Get started free',
      href: '/free-invoice-generator'
    },
    pro: {
      name: 'PRO',
      price: '£9',
      suffix: '/month',
      description: 'For freelancers and sole traders billing regularly.',
      badge: 'EARLY ACCESS',
      features: [
        'Everything in Free',
        'Unlimited saved clients',
        'Recurring invoices',
        'Logo and brand colours',
        'Payment links',
        'Invoice history',
        'Email invoices',
        'Full VAT support',
        'Quotes to invoices',
        'Remove InvoiceIt branding'
      ],
      button: 'Join the Pro waitlist',
      waitlist: 'Pro'
    },
    business: {
      name: 'BUSINESS',
      price: '£19',
      suffix: '/month',
      description: 'For small teams and growing companies.',
      badge: 'EARLY ACCESS',
      features: [
        'Everything in Pro',
        'Multiple users',
        'Team permissions',
        'Dashboard analytics',
        'Custom templates',
        'Company branding',
        'Approval workflows',
        'Priority support',
        'API access'
      ],
      button: 'Join the Business waitlist',
      waitlist: 'Business'
    }
  };

  function normalise(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  function textElements(root) {
    return Array.prototype.slice.call(
      root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,div,span,strong')
    );
  }

  function findExactText(root, value) {
    var target = normalise(value);
    var els = textElements(root);

    for (var i = 0; i < els.length; i++) {
      if (normalise(els[i].textContent) === target) return els[i];
    }

    return null;
  }

  function findCardFromHeading(heading) {
    if (!heading) return null;

    var node = heading;
    var best = null;

    for (var i = 0; i < 8 && node && node !== document.body; i++) {
      var txt = normalise(node.textContent);

      if (
        txt.indexOf('£0') !== -1 ||
        txt.indexOf('£9') !== -1 ||
        txt.indexOf('£19') !== -1
      ) {
        best = node;
      }

      node = node.parentElement;
    }

    return best || heading.parentElement;
  }

  function findPlanCard(name) {
    var heading = findExactText(document, name);
    return findCardFromHeading(heading);
  }

  function findPriceElement(card) {
    var els = textElements(card);

    for (var i = 0; i < els.length; i++) {
      var text = String(els[i].textContent || '').trim();
      if (/^£\d+/.test(text)) return els[i];
    }

    return null;
  }

  function findDescription(card, planName) {
    var els = Array.prototype.slice.call(card.querySelectorAll('p,div'));
    var name = normalise(planName);

    for (var i = 0; i < els.length; i++) {
      var text = normalise(els[i].textContent);

      if (
        text &&
        text !== name &&
        text.indexOf('£') === -1 &&
        text.indexOf('EVERYTHING IN') === -1 &&
        text.length > 20 &&
        text.length < 160 &&
        els[i].children.length === 0
      ) {
        return els[i];
      }
    }

    return null;
  }

  function findFeatureContainer(card) {
    var list = card.querySelector('ul,ol');
    if (list) return list;

    var candidates = Array.prototype.slice.call(card.querySelectorAll('div'));
    var best = null;
    var bestCount = 0;

    for (var i = 0; i < candidates.length; i++) {
      var directChildren = Array.prototype.slice.call(candidates[i].children);
      var count = directChildren.filter(function (child) {
        var t = String(child.textContent || '').trim();
        return t.length > 2 && t.length < 80;
      }).length;

      if (count >= 3 && count > bestCount) {
        best = candidates[i];
        bestCount = count;
      }
    }

    return best;
  }

  function replaceFeatures(card, features) {
    var container = findFeatureContainer(card);
    if (!container) return;

    var isList = /^(UL|OL)$/.test(container.tagName);
    var sample = container.firstElementChild;
    var sampleClass = sample ? sample.className : '';

    container.innerHTML = '';

    features.forEach(function (feature) {
      var item = document.createElement(isList ? 'li' : 'div');
      if (sampleClass) item.className = sampleClass;
      item.textContent = feature;
      item.setAttribute('data-invoiceit-feature', 'true');
      container.appendChild(item);
    });
  }

  function findButton(card) {
    return card.querySelector('a,button,[role="button"]');
  }

  function ensureBadge(card, label) {
    if (!label) return;

    var existing = card.querySelector('[data-invoiceit-badge]');
    if (existing) {
      existing.textContent = label;
      return;
    }

    var badge = document.createElement('div');
    badge.setAttribute('data-invoiceit-badge', 'true');
    badge.textContent = label;
    badge.style.display = 'inline-block';
    badge.style.marginBottom = '14px';
    badge.style.padding = '7px 12px';
    badge.style.borderRadius = '999px';
    badge.style.background = '#2563eb';
    badge.style.color = '#ffffff';
    badge.style.fontSize = '11px';
    badge.style.fontWeight = '700';
    badge.style.letterSpacing = '.04em';

    var heading = findExactText(card, 'PRO') || findExactText(card, 'BUSINESS');
    if (heading && heading.parentNode) {
      heading.parentNode.insertBefore(badge, heading);
    } else {
      card.insertBefore(badge, card.firstChild);
    }
  }

  function updateCard(key, plan) {
    var card = findPlanCard(plan.name);
    if (!card) {
      console.warn('[InvoiceIt pricing] Could not find ' + plan.name + ' card.');
      return;
    }

    card.setAttribute('data-invoiceit-plan', key);

    var heading = findExactText(card, plan.name);
    if (heading) heading.textContent = plan.name;

    var price = findPriceElement(card);
    if (price) price.innerHTML = plan.price + '<span style="font-size:.45em;font-weight:400"> ' + plan.suffix + '</span>';

    var desc = findDescription(card, plan.name);
    if (desc) desc.textContent = plan.description;

    replaceFeatures(card, plan.features);
    ensureBadge(card, plan.badge);

    var button = findButton(card);
    if (!button) return;

    button.textContent = plan.button;

    if (plan.href) {
      button.setAttribute('href', plan.href);
      button.removeAttribute('data-waitlist-plan');
    } else {
      button.setAttribute('href', '#');
      button.setAttribute('data-waitlist-plan', plan.waitlist);
    }
  }

  function createModal() {
    if (document.getElementById('invoiceit-waitlist-modal')) return;

    var modal = document.createElement('div');
    modal.id = 'invoiceit-waitlist-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:none;align-items:center;' +
      'justify-content:center;padding:20px;background:rgba(15,23,42,.58);';

    modal.innerHTML =
      '<div role="dialog" aria-modal="true" aria-labelledby="invoiceit-waitlist-title" ' +
      'style="position:relative;width:100%;max-width:480px;border-radius:18px;background:#fff;' +
      'padding:30px;box-shadow:0 24px 80px rgba(0,0,0,.25);font-family:inherit">' +
        '<button type="button" data-waitlist-close aria-label="Close" ' +
        'style="position:absolute;right:16px;top:12px;border:0;background:transparent;' +
        'font-size:26px;cursor:pointer;color:#64748b">&times;</button>' +
        '<div style="font-size:12px;font-weight:700;letter-spacing:.06em;color:#2563eb;' +
        'margin-bottom:10px">EARLY ACCESS</div>' +
        '<h2 id="invoiceit-waitlist-title" style="margin:0 0 10px;font-size:28px;color:#14181f">' +
        'Join the InvoiceIt waitlist</h2>' +
        '<p style="margin:0 0 22px;color:#5b6472;line-height:1.55">' +
        'Tell us where to contact you when this plan is ready.</p>' +
        '<form id="invoiceit-waitlist-form">' +
          '<input type="hidden" id="invoiceit-waitlist-plan" value="Pro">' +
          '<label for="invoiceit-waitlist-email" style="display:block;margin-bottom:7px;' +
          'font-size:13px;font-weight:600;color:#14181f">Email address</label>' +
          '<input id="invoiceit-waitlist-email" type="email" required placeholder="you@example.com" ' +
          'style="box-sizing:border-box;width:100%;height:48px;border:1px solid #dbe2ea;' +
          'border-radius:9px;padding:0 13px;font:inherit;margin-bottom:14px">' +
          '<button type="submit" style="width:100%;height:48px;border:0;border-radius:9px;' +
          'background:#2563eb;color:#fff;font:inherit;font-weight:700;cursor:pointer">' +
          'Join the waitlist</button>' +
        '</form>' +
        '<p style="margin:14px 0 0;font-size:12px;color:#8b95a5;text-align:center">' +
        'No spam. We will only contact you about InvoiceIt early access.</p>' +
      '</div>';

    document.body.appendChild(modal);

    modal.addEventListener('click', function (event) {
      if (event.target === modal || event.target.hasAttribute('data-waitlist-close')) {
        closeModal();
      }
    });

    document.getElementById('invoiceit-waitlist-form').addEventListener('submit', function (event) {
      event.preventDefault();

      var email = document.getElementById('invoiceit-waitlist-email').value.trim();
      var plan = document.getElementById('invoiceit-waitlist-plan').value;

      if (!email) return;

      if (typeof window.gtag === 'function') {
        window.gtag('event', 'waitlist_signup_intent', {
          plan_name: plan,
          page_location: window.location.href
        });
      }

      var subject = encodeURIComponent('InvoiceIt ' + plan + ' waitlist');
      var body = encodeURIComponent(
        'Please add me to the InvoiceIt ' + plan + ' waitlist.\n\nEmail: ' + email
      );

      window.location.href = 'mailto:' + WAITLIST_EMAIL + '?subject=' + subject + '&body=' + body;
      closeModal();
    });
  }

  function openModal(plan) {
    var modal = document.getElementById('invoiceit-waitlist-modal');
    if (!modal) return;

    document.getElementById('invoiceit-waitlist-plan').value = plan || 'Pro';
    document.getElementById('invoiceit-waitlist-title').textContent =
      'Join the ' + (plan || 'Pro') + ' waitlist';

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');

    window.setTimeout(function () {
      var email = document.getElementById('invoiceit-waitlist-email');
      if (email) email.focus();
    }, 50);
  }

  function closeModal() {
    var modal = document.getElementById('invoiceit-waitlist-modal');
    if (!modal) return;

    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  }

  function bindWaitlistButtons() {
    document.addEventListener('click', function (event) {
      var button = event.target.closest('[data-waitlist-plan]');
      if (!button) return;

      event.preventDefault();
      openModal(button.getAttribute('data-waitlist-plan'));
    });
  }

  function init() {
    if (INITIALIZED) return;
    INITIALIZED = true;

    createModal();
    updateCard('free', PLANS.free);
    updateCard('pro', PLANS.pro);
    updateCard('business', PLANS.business);
    bindWaitlistButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
