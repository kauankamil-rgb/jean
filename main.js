/* Step by Step Pavers, site behaviour (no dependencies). Hooks are data-attributes so markup can change freely. */
(function () {
  'use strict';
  var d = document, w = window;
  var CONSENT_KEY = 'sbs_cookie_consent';
  function $(sel, root) { return (root || d).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || d).querySelectorAll(sel)); }
  function store(k, v) { try { v === undefined ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  /* ---------- Mobile navigation ---------- */
  $$('[data-nav-toggle]').forEach(function (btn) {
    var targetSel = btn.getAttribute('data-nav-toggle') || '[data-nav]';
    var nav = $(targetSel);
    if (!nav) return;
    btn.setAttribute('aria-expanded', 'false');
    function setOpen(open) {
      nav.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      d.documentElement.classList.toggle('nav-open', open);
      /* keep Tab inside the open menu: everything outside the header is inert (no-op where unsupported) */
      $$('.skip-link, .topbar, main, footer, .mobile-cta, [data-cookie-banner]').forEach(function (el) { el.inert = open; });
    }
    btn.addEventListener('click', function () { setOpen(!nav.classList.contains('is-open')); if (!nav.classList.contains('is-open')) btn.focus(); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); btn.focus(); } });
    /* widening past the nav breakpoint hides the toggle, so release the menu, the scroll lock and the inert flags */
    w.matchMedia('(min-width:1140px)').addEventListener('change', function (e) { if (e.matches && nav.classList.contains('is-open')) setOpen(false); });
  });
  /* Dropdown submenus: open on click for touch/keyboard (hover handled in CSS) */
  var deskNav = w.matchMedia('(min-width:1140px)');
  $$('[data-submenu-toggle]').forEach(function (btn) {
    var item = btn.closest('[data-has-submenu]') || btn.parentElement;
    btn.setAttribute('aria-expanded', 'false');
    /* keep the reported state matching the panel, which CSS also opens on hover/focus at desktop widths */
    function sync(open) { btn.setAttribute('aria-expanded', (open || item.classList.contains('is-open')) ? 'true' : 'false'); }
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      item.classList.toggle('is-open');
      sync(deskNav.matches); /* at desktop widths the toggle keeps focus inside, so the panel stays open */
    });
    ['focusin', 'mouseenter'].forEach(function (type) {
      item.addEventListener(type, function () { if (deskNav.matches) sync(true); });
    });
    ['focusout', 'mouseleave'].forEach(function (type) {
      item.addEventListener(type, function (e) {
        if (!deskNav.matches) return;
        if (type === 'focusout' && e.relatedTarget && item.contains(e.relatedTarget)) return;
        sync(false);
      });
    });
  });
  /* Header shadow after scroll */
  var header = $('[data-header]');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-scrolled', w.scrollY > 8); };
    onScroll(); w.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Analytics (GA4) gated by cookie consent ---------- */
  var gaId = (d.querySelector('meta[name="ga-id"]') || {}).content || '';
  var gaLoaded = false;
  w.dataLayer = w.dataLayer || [];
  function gtag() { w.dataLayer.push(arguments); }
  w.gtag = w.gtag || gtag;
  function loadGA() {
    if (gaLoaded || !gaId) return;
    gaLoaded = true;
    gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
    gtag('js', new Date());
    gtag('config', gaId, { anonymize_ip: true });
    var s = d.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId);
    d.head.appendChild(s);
  }
  function track(name, params) { if (gaLoaded) gtag('event', name, params || {}); }

  /* ---------- Cookie consent banner ---------- */
  var banner = $('[data-cookie-banner]');
  function showBanner() { if (banner) { banner.hidden = false; banner.setAttribute('aria-hidden', 'false'); } }
  function hideBanner() { if (banner) { banner.hidden = true; banner.setAttribute('aria-hidden', 'true'); } }
  function revokeGA() {
    if (!gaLoaded) return;
    w['ga-disable-' + gaId] = true;
    gtag('consent', 'update', { analytics_storage: 'denied' });
    var host = location.hostname, parts = host.split('.'), apex = parts.length > 2 ? parts.slice(-2).join('.') : host;
    d.cookie.split(';').forEach(function (c) {
      var name = c.split('=')[0].trim();
      if (name !== '_ga' && name.indexOf('_ga_') !== 0) return;
      d.cookie = name + '=; Max-Age=0; path=/';
      [host, '.' + host, '.' + apex].forEach(function (dom) { d.cookie = name + '=; Max-Age=0; path=/; domain=' + dom; });
    });
  }
  function applyConsent(value) {
    store(CONSENT_KEY, value);
    hideBanner();
    if (value === 'granted') loadGA(); else revokeGA();
  }
  var saved = read(CONSENT_KEY);
  if (saved === 'granted') loadGA();
  else if (saved !== 'denied' && gaId) showBanner();
  $$('[data-consent]').forEach(function (b) { b.addEventListener('click', function () { applyConsent(b.getAttribute('data-consent') === 'accept' ? 'granted' : 'denied'); }); });
  $$('[data-open-cookie-settings]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); store(CONSENT_KEY, undefined); showBanner(); }); });

  /* ---------- Click tracking for calls / emails / CTAs ---------- */
  $$('a[href^="tel:"]').forEach(function (a) { a.addEventListener('click', function () { track('click_call', { link_url: a.href }); }); });
  $$('a[href^="mailto:"]').forEach(function (a) { a.addEventListener('click', function () { track('click_email', { link_url: a.href }); }); });
  $$('[data-track]').forEach(function (a) { a.addEventListener('click', function () { track(a.getAttribute('data-track'), { link_text: (a.textContent || '').trim().slice(0, 60) }); }); });

  /* ---------- Estimate buttons open the LeadConnector chat ----------
     Every "Get a Free Estimate" button carries data-quote-open. Once the chat widget has loaded it
     opens the chat; before that, or if the widget is blocked, the button stays a link to /contact. */
  d.addEventListener('click', function (e) {
    var opener = e.target && e.target.closest && e.target.closest('[data-quote-open]');
    var chat = w.leadConnector && w.leadConnector.chatWidget;
    if (!opener || !chat || typeof chat.openWidget !== 'function') return;
    e.preventDefault();
    chat.openWidget();
    track('open_chat', { link_text: (opener.textContent || '').trim().slice(0, 60) });
  });

  /* ---------- Decode lazy photos as they arrive, so the before/after handle never reveals a half-decoded frame ---------- */
  $$('main img[loading="lazy"]').forEach(function (img) {
    function go() { if (img.decode) img.decode().catch(function () {}); }
    if (img.complete && img.naturalWidth) go(); else img.addEventListener('load', go, { once: true });
  });

  /* ---------- Before / after comparison slider ---------- */
  /* A div with role="slider" rather than a range input: the SMS (A2P) compliance check
     treats any input field on a page with the chat widget as a second opt-in form. */
  $$('[data-compare]').forEach(function (box) {
    var ctl = box.querySelector('[role="slider"]'), after = box.querySelector('[data-compare-after]');
    if (!ctl || !after) return;
    var set = function (v) {
      v = Math.max(0, Math.min(100, Math.round(v)));
      after.style.width = v + '%'; box.style.setProperty('--pos', v + '%');
      ctl.setAttribute('aria-valuenow', v); ctl.setAttribute('aria-valuetext', v + '%');
    };
    var fromX = function (x) { var r = box.getBoundingClientRect(); set((x - r.left) / r.width * 100); };
    var dragging = false;
    ctl.addEventListener('pointerdown', function (e) { dragging = true; if (ctl.setPointerCapture) ctl.setPointerCapture(e.pointerId); fromX(e.clientX); });
    ctl.addEventListener('pointermove', function (e) { if (dragging) fromX(e.clientX); });
    ['pointerup', 'pointercancel'].forEach(function (t) { ctl.addEventListener(t, function () { dragging = false; }); });
    ctl.addEventListener('keydown', function (e) {
      var v = Number(ctl.getAttribute('aria-valuenow')), k = e.key;
      var step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 }[k];
      if (step !== undefined) set(v + step); else if (k === 'Home') set(0); else if (k === 'End') set(100); else return;
      e.preventDefault();
    });
    set(50);
  });

  /* ---------- Contact page: show server-side error after non-JS redirect ---------- */
})();
