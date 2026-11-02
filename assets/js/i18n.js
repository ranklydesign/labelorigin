/* LabelOrigin i18n — EN | ES toggle + /es/ page support.
 *
 * Two modes, one source of truth (/i18n/es.json):
 *  1. In-place toggle (unpaired pages): the EN | ES buttons swap every
 *     [data-i18n] element's text in place, set <html lang>, and remember
 *     the choice in localStorage (lo_lang). Untranslated strings fall back
 *     to the English already in the DOM — never blank.
 *  2. /es/ pages: the page is already Spanish (built from the same
 *     es.json). This script does NOT swap the DOM there; it only sets
 *     lang="es" and serves the string tables to the page scripts
 *     (quiz, label preview, forms) via LabelOriginI18n.t().
 *
 * Paired pages carry the toggle as links (ES -> /es/..., EN -> back);
 * unpaired pages carry it as buttons. The link clicks also record the
 * preference so it persists across the navigation.
 *
 * Other scripts read strings through window.LabelOriginI18n.t(key) with
 * an English fallback, and re-render on the 'lo-langchange' event.
 */
(function () {
    'use strict';

    var LANG_KEY = 'lo_lang';
    var CACHE_KEY = 'lo_i18n_es';
    var CACHE_VER_KEY = 'lo_i18n_es_v';
    var ES_VERSION = '2026-11-01.1';

    function storageGet(k) {
        try { return window.localStorage.getItem(k); } catch (e) { return null; }
    }
    function storageSet(k, v) {
        try { window.localStorage.setItem(k, v); } catch (e) { /* ignore */ }
    }

    function isEsPage() {
        var lang = document.documentElement.getAttribute('lang');
        if (lang === 'es') return true;
        return (window.location.pathname || '').replace(/\/+$/, '')
            .split('/').indexOf('es') === 1;
    }

    function storedLang() {
        var v = storageGet(LANG_KEY);
        return (v === 'es' || v === 'en') ? v : 'en';
    }

    function currentLang() {
        return isEsPage() ? 'es' : storedLang();
    }

    /* --- es.json loading (cache-first, background refresh) --- */
    var data = null;          // parsed es.json, or null
    var listeners = [];       // onLangChange callbacks
    var readyResolve = null;
    var readyPromise = new Promise(function (res) { readyResolve = res; });

    function esUrl() {
        try {
            var src = document.currentScript && document.currentScript.src;
            if (src) return src.replace(/assets\/js\/i18n\.js.*$/, 'i18n/es.json');
        } catch (e) { /* fall through */ }
        return '/i18n/es.json';
    }

    function loadFromCache() {
        try {
            if (storageGet(CACHE_VER_KEY) !== ES_VERSION) return false;
            var raw = storageGet(CACHE_KEY);
            if (!raw) return false;
            data = JSON.parse(raw);
            return true;
        } catch (e) { return false; }
    }

    function fetchEs() {
        return fetch(esUrl(), { credentials: 'same-origin' })
            .then(function (res) {
                if (!res.ok) throw new Error('es.json ' + res.status);
                return res.json();
            })
            .then(function (json) {
                data = json;
                try {
                    storageSet(CACHE_KEY, JSON.stringify(json));
                    storageSet(CACHE_VER_KEY, ES_VERSION);
                } catch (e) { /* storage full/blocked: in-memory only */ }
                return json;
            })
            .catch(function () { return null; });
    }

    /* --- string lookup: dotted key, null when untranslated --- */
    function lookup(key) {
        if (!data || !key) return null;
        var parts = String(key).split('.');
        var node = data;
        for (var i = 0; i < parts.length; i++) {
            if (node == null || typeof node !== 'object') return null;
            node = node[parts[i]];
        }
        return (typeof node === 'string' && node !== '') ? node : null;
    }

    function t(key) { return lookup(key); }

    /* --- href/src placeholder restore --- */
    function restoreLinks(translated, el) {
        if (translated.indexOf('__HREF') === -1 &&
            translated.indexOf('__SRC') === -1) return translated;
        var hrefs = [], srcs = [];
        el.querySelectorAll('a[href]').forEach(function (a) {
            hrefs.push(a.getAttribute('href'));
        });
        el.querySelectorAll('img[src], source[src]').forEach(function (im) {
            srcs.push(im.getAttribute('src'));
        });
        // Also the element itself may carry the link.
        if (el.tagName === 'A' && el.getAttribute('href')) {
            hrefs.unshift(el.getAttribute('href'));
        }
        var out = translated;
        hrefs.forEach(function (h, i) {
            out = out.split('__HREF' + i + '__').join(h);
        });
        srcs.forEach(function (s, i) {
            out = out.split('__SRC' + i + '__').join(s);
        });
        return out;
    }

    /* --- DOM application (English pages only; /es/ pages are pre-built) --- */
    function applyToDom() {
        if (isEsPage()) return;
        if (currentLang() !== 'es') return;
        if (!data) return;
        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            var tr = lookup(el.getAttribute('data-i18n'));
            if (tr == null) return; // fallback: leave the English in place
            el.innerHTML = restoreLinks(tr, el);
        });
        document.querySelectorAll('[data-i18n-text]').forEach(function (el) {
            var tr = lookup(el.getAttribute('data-i18n-text'));
            if (tr != null) el.textContent = tr;
        });
        document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
            var tr = lookup(el.getAttribute('data-i18n-ph'));
            if (tr != null) el.setAttribute('placeholder', tr);
        });
        document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
            var tr = lookup(el.getAttribute('data-i18n-aria'));
            if (tr != null) el.setAttribute('aria-label', tr);
        });
        document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
            var tr = lookup(el.getAttribute('data-i18n-title'));
            if (tr != null) el.setAttribute('title', tr);
        });
        document.querySelectorAll('[data-i18n-alt]').forEach(function (el) {
            var tr = lookup(el.getAttribute('data-i18n-alt'));
            if (tr != null) el.setAttribute('alt', tr);
        });
        // Legal-disclaimer note (state-rules / legal pages): filled above via
        // data-i18n; unhide it now that Spanish is showing.
        document.querySelectorAll('.lo-i18n-note').forEach(function (el) {
            el.hidden = false;
        });
    }

    function setToggleState(lang) {
        document.querySelectorAll('.lo-lang-toggle').forEach(function (box) {
            box.querySelectorAll('[data-lo-lang]').forEach(function (btn) {
                var active = btn.getAttribute('data-lo-lang') === lang;
                btn.classList.toggle('is-active', active);
                btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
        });
    }

    function fireLangChange(lang) {
        try {
            document.dispatchEvent(new CustomEvent('lo-langchange', {
                detail: { lang: lang }
            }));
        } catch (e) { /* older browsers: skip */ }
        listeners.forEach(function (cb) {
            try { cb(lang); } catch (e) { /* ignore */ }
        });
        if (window.LabelOriginConsent &&
            typeof window.LabelOriginConsent.relocalize === 'function') {
            try { window.LabelOriginConsent.relocalize(); } catch (e) { /* ignore */ }
        }
    }

    function setLang(lang, opts) {
        opts = opts || {};
        if (lang !== 'es' && lang !== 'en') lang = 'en';
        storageSet(LANG_KEY, lang);
        document.documentElement.setAttribute('lang', lang);
        setToggleState(lang);
        if (lang === 'en' && !isEsPage()) {
            // Back to English on an English page: reload so every string
            // (including JS-rendered panels) returns to the shipped text.
            if (!opts.noReload) window.location.reload();
            return;
        }
        applyToDom();
        fireLangChange(lang);
    }

    function initToggle() {
        document.querySelectorAll('.lo-lang-toggle [data-lo-lang]').forEach(function (btn) {
            if (btn.tagName === 'A') {
                // Paired-page link: record the preference, then navigate.
                btn.addEventListener('click', function () {
                    storageSet(LANG_KEY, btn.getAttribute('data-lo-lang'));
                });
                return;
            }
            btn.addEventListener('click', function () {
                var want = btn.getAttribute('data-lo-lang');
                if (want === currentLang()) return;
                setLang(want);
            });
        });
    }

    /* HOTFIX Nov 1: hide the language toggle everywhere until the per-page
     * rebuild lands. The shipped toggle renders as unstyled JS buttons on
     * unpaired pages and is invisible on the dark header. String tables
     * (t(), quiz, forms) keep working; only the control is hidden. */
    function hideToggle() {
        try {
            document.querySelectorAll('.lo-lang-toggle').forEach(function (el) {
                el.style.display = 'none';
            });
        } catch (e) { /* ignore */ }
    }

    /* --- public API --- */
    window.LabelOriginI18n = {
        lang: currentLang,
        isEs: function () { return currentLang() === 'es'; },
        t: t,
        setLang: setLang,
        apply: applyToDom,
        langTag: function () { return currentLang() === 'es' ? ' — lang=es' : ''; },
        onLangChange: function (cb) {
            if (typeof cb === 'function') listeners.push(cb);
        },
        ready: readyPromise,
        version: ES_VERSION
    };

    /* --- boot --- */
    document.documentElement.setAttribute('lang', currentLang());
    var cached = loadFromCache();
    var fetched = fetchEs().then(function () {
        if (readyResolve) { readyResolve(); readyResolve = null; }
        if (currentLang() === 'es' && !isEsPage()) {
            applyToDom();
            fireLangChange('es');
        } else if (isEsPage()) {
            fireLangChange('es');
        }
        return data;
    });
    if (!cached) {
        fetched.then(function () {
            if (document.readyState === 'loading') return;
            applyToDom();
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            hideToggle();
            if (cached) applyToDom();
            setToggleState(currentLang());
            initToggle();
        });
    } else {
        hideToggle();
        if (cached) applyToDom();
        setToggleState(currentLang());
        initToggle();
    }
})();
