/* LabelOrigin i18n — string tables + /es/ page support (links-only).
 *
 * The EN | ES toggle is plain links (Nov 2026 toggle fix): on a paired
 * page the other language is a real <a href> to the counterpart URL, and
 * the current language is a filled pill. The toggle NAVIGATES; it never
 * swaps text in place. The in-place string-swap mode is dead and this
 * script contains no swap path, no toggle wiring, and no stored-language
 * preference: the language is whatever page you are on.
 *
 * What this script still does:
 *  - Loads /i18n/es.json (cache-first) and serves strings to page scripts
 *    (quiz, label preview, forms, consent banner) through
 *    window.LabelOriginI18n.t(key), with an English fallback when a key
 *    is missing or this script is absent.
 *  - Sets lang="es" on /es/ pages and fires 'lo-langchange' so page
 *    scripts re-render their Spanish strings.
 *  - isEs() is purely URL-based: true on /es/ pages, false elsewhere.
 *    A stored 'es' preference from the old toggle is ignored.
 */
(function () {
    'use strict';

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

    function currentLang() {
        return isEsPage() ? 'es' : 'en';
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

    /* The toggle is links now: switching languages is a navigation, not a
       JS call. setLang is kept for API compatibility — it follows the
       page's own hreflang alternate link to the counterpart, if one
       exists, and does nothing otherwise. Nothing in the site calls it. */
    function setLang(lang) {
        if (lang !== 'es' && lang !== 'en') lang = 'en';
        if (lang === currentLang()) return;
        var link = document.querySelector(
            'link[rel="alternate"][hreflang="' + lang + '"]');
        if (link && link.getAttribute('href')) {
            window.location.href = link.getAttribute('href');
        }
    }

    /* --- public API --- */
    window.LabelOriginI18n = {
        lang: currentLang,
        isEs: function () { return currentLang() === 'es'; },
        t: t,
        setLang: setLang,
        langTag: function () { return currentLang() === 'es' ? ' — lang=es' : ''; },
        onLangChange: function (cb) {
            if (typeof cb === 'function') listeners.push(cb);
        },
        ready: readyPromise,
        version: ES_VERSION
    };

    /* --- boot --- */
    document.documentElement.setAttribute('lang', currentLang());
    loadFromCache();
    fetchEs().then(function () {
        if (readyResolve) { readyResolve(); readyResolve = null; }
        if (isEsPage()) {
            fireLangChange('es');
        }
        return data;
    });
})();
