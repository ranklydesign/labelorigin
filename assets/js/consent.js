/* LabelOrigin consent + tag loader.
 * Default: NO tags. Accept -> inject configured tags once. Decline -> never inject.
 * Forms work identically either way; this file never touches form logic.
 * Tag IDs are PLACEHOLDERS until Robert supplies real ones. When an ID is
 * still a placeholder, that tag is skipped entirely -- no request is made
 * with a bogus ID. Storage is guarded: if localStorage throws, the banner
 * simply shows again.
 */
(function () {
    var CONSENT_KEY = 'labelorigin_consent';
    var UTM_KEY = 'labelorigin_utm';
    var GA4_ID = 'G-NHH53SXWQM';              // <-- supplied by Robert, Oct 2026
    var ADS_ID = 'AW-PLACEHOLDER';             // <-- Robert to supply
    var META_PIXEL_ID = 'PLACEHOLDER';         // <-- Robert to supply
    var GA4_CONFIGURED = GA4_ID.indexOf('PLACEHOLDER') === -1;
    var ADS_CONFIGURED = ADS_ID.indexOf('PLACEHOLDER') === -1;
    var META_CONFIGURED = META_PIXEL_ID.indexOf('PLACEHOLDER') === -1;

    function storageGet(key) {
        try { return window.localStorage.getItem(key); } catch (e) { return null; }
    }
    function storageSet(key, value) {
        try { window.localStorage.setItem(key, value); } catch (e) { /* storage unavailable: choice is not remembered */ }
    }
    function storageRemove(key) {
        try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }

    /* --- UTM capture: first-touch only, no PII --- */
    function captureUtm() {
        if (storageGet(UTM_KEY)) return;
        var params = new URLSearchParams(window.location.search);
        var utm = {};
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) {
            var v = params.get(k);
            if (v) utm[k] = v;
        });
        if (Object.keys(utm).length) storageSet(UTM_KEY, JSON.stringify(utm));
    }
    window.LabelOriginUTM = function () {
        try { return JSON.parse(storageGet(UTM_KEY) || '{}'); } catch (e) { return {}; }
    };

    /* --- Consent state --- */
    window.LabelOriginConsent = {
        accepted: function () { return storageGet(CONSENT_KEY) === 'accepted'; },
        declined: function () { return storageGet(CONSENT_KEY) === 'declined'; },
        reset: function () { storageRemove(CONSENT_KEY); showBanner(); }
    };

    /* --- Tag loading: only ever called after Accept, and only for configured IDs --- */
    var tagsLoaded = false;
    function loadScript(src, onload) {
        var s = document.createElement('script');
        s.async = true;
        s.src = src;
        if (onload) s.onload = onload;
        document.head.appendChild(s);
    }

    function loadTags() {
        if (tagsLoaded) return;
        tagsLoaded = true;
        if (!GA4_CONFIGURED && !META_CONFIGURED) return; // no real IDs configured yet: load nothing

        if (GA4_CONFIGURED) {
            window.dataLayer = window.dataLayer || [];
            window.gtag = function () { window.dataLayer.push(arguments); };
            window.gtag('js', new Date());
            window.gtag('consent', 'default', {
                ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'
            });
            loadScript('https://www.googletagmanager.com/gtag/js?id=' + GA4_ID, function () {
                window.gtag('consent', 'update', {
                    ad_storage: 'granted', analytics_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted'
                });
                window.gtag('config', GA4_ID); // sends one page-view
                if (ADS_CONFIGURED) window.gtag('config', ADS_ID); // Ads config only; conversions fire on delivered submits
            });
        }

        if (META_CONFIGURED) {
            (function (f, b, e, v, n, t, s) {
                if (f.fbq) return; n = f.fbq = function () {
                    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
                };
                if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
                t = b.createElement(e); t.async = !0; t.src = v;
                s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
            })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
            window.fbq('init', META_PIXEL_ID);
            // NOTE: no fbq('track', 'PageView') here. Page-view tracking is GA4-only.
        }
    }

    /* --- Banner --- */
    function showBanner() {
        if (document.getElementById('lo-consent-banner')) return;
        var bar = document.createElement('div');
        bar.id = 'lo-consent-banner';
        bar.setAttribute('role', 'region');
        bar.setAttribute('aria-label', 'Tracking consent');
        bar.innerHTML =
            '<p>We use analytics and advertising tags to measure visits and lead ' +
            'enquiries. Accept to allow them, or decline &mdash; the forms work ' +
            'either way. See our <a href="/privacy/">Privacy Policy</a>.</p>' +
            '<button type="button" data-lo-consent="accept">Accept</button>' +
            '<button type="button" data-lo-consent="decline">Decline</button>';
        document.body.appendChild(bar);
        document.body.classList.add('lo-consent-visible');
        bar.querySelector('[data-lo-consent="accept"]').addEventListener('click', function () {
            storageSet(CONSENT_KEY, 'accepted');
            document.body.classList.remove('lo-consent-visible');
            bar.remove();
            loadTags();
        });
        bar.querySelector('[data-lo-consent="decline"]').addEventListener('click', function () {
            storageSet(CONSENT_KEY, 'declined');
            document.body.classList.remove('lo-consent-visible');
            bar.remove();
            // Deliberately nothing else: no tags are loaded, ever, on decline.
        });
    }

    captureUtm();
    var stored = storageGet(CONSENT_KEY);
    if (stored === 'accepted') {
        loadTags();
    } else if (stored === 'declined') {
        // No banner, no tags.
    } else {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', showBanner);
        } else {
            showBanner();
        }
    }

    // Footer "Cookie / tracking choices" link: <a href="#" id="lo-consent-choices">
    document.addEventListener('click', function (e) {
        var link = e.target && e.target.closest ? e.target.closest('#lo-consent-choices') : null;
        if (link) { e.preventDefault(); window.LabelOriginConsent.reset(); }
    });
})();
