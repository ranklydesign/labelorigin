/**
 * Click-to-copy for email and phone links.
 * mailto: and tel: links open a blank window on computers with no mail or phone app,
 * so every mailto: link copies the address, and every tel: link copies the number.
 * On phones, a tel: link first offers "Call" or "Copy number".
 */
(function () {
    function isPhone() {
        var ua = navigator.userAgent || '';
        if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
        return window.matchMedia && window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 900;
    }

    function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
        }
        return Promise.resolve(legacyCopy(text));
    }

    function legacyCopy(text) {
        try {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            var ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        } catch (e) {
            return false;
        }
    }

    var toastTimer;
    function toast(message) {
        var el = document.getElementById('copy-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'copy-toast';
            el.className = 'copy-toast';
            el.setAttribute('role', 'status');
            document.body.appendChild(el);
        }
        el.textContent = message;
        el.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
    }

    function copyAndToast(value, label) {
        copyText(value).then(function (ok) {
            toast(ok ? label + ' copied: ' + value : 'Copy failed. ' + label + ': ' + value);
        });
    }

    function closeSheet() {
        var sheet = document.getElementById('contact-sheet');
        if (sheet) sheet.remove();
    }

    function openPhoneSheet(display, tel) {
        closeSheet();
        var sheet = document.createElement('div');
        sheet.id = 'contact-sheet';
        sheet.className = 'contact-sheet';
        sheet.innerHTML =
            '<div class="contact-sheet-backdrop"></div>' +
            '<div class="contact-sheet-panel" role="dialog" aria-label="Phone number options">' +
            '<p class="contact-sheet-title"></p>' +
            '<a class="btn btn-primary btn-block" href="tel:' + tel + '">Call</a>' +
            '<button type="button" class="btn btn-secondary btn-block" data-act="copy">Copy number</button>' +
            '<button type="button" class="contact-sheet-cancel" data-act="cancel">Cancel</button>' +
            '</div>';
        sheet.querySelector('.contact-sheet-title').textContent = display;
        sheet.addEventListener('click', function (e) {
            var act = e.target.getAttribute && e.target.getAttribute('data-act');
            if (act === 'copy') { copyAndToast(display, 'Number'); closeSheet(); }
            else if (act === 'cancel' || e.target.classList.contains('contact-sheet-backdrop')) { closeSheet(); }
            else if (e.target.tagName === 'A') { setTimeout(closeSheet, 300); }
        });
        document.body.appendChild(sheet);
    }

    document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href^="mailto:"], a[href^="tel:"]');
        if (!a) return;
        var href = a.getAttribute('href');

        if (href.indexOf('mailto:') === 0) {
            e.preventDefault();
            var email = decodeURIComponent(href.slice(7).split('?')[0]);
            copyAndToast(email, 'Email');
            return;
        }

        e.preventDefault();
        var tel = href.slice(4);
        var display = (a.getAttribute('data-phone-display') || tel.replace(/^\+?1?(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3'));
        if (isPhone()) openPhoneSheet(display, tel);
        else copyAndToast(display, 'Number');
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeSheet();
    });

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) { a.title = 'Click to copy email'; });
        document.querySelectorAll('a[href^="tel:"]').forEach(function (a) { a.title = isPhone() ? 'Call or copy number' : 'Click to copy number'; });
    });

    // CTA clicks — GA4 event, consent-gated, no personal data.
    // Fires on any link carrying data-ga-event="<event-name>".
    // Links carrying data-door also remember the homepage door choice
    // (a UX preference, stored regardless of analytics consent).
    document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[data-ga-event]');
        if (!a) return;
        var eventName = a.getAttribute('data-ga-event');
        var door = a.getAttribute('data-door');
        if (door) {
            try { window.localStorage.setItem('lo_door', door); } catch (err) {}
        }
        if (!window.LabelOriginConsent || !window.LabelOriginConsent.accepted()) return;
        if (typeof window.gtag !== 'function') return;
        var utm = (typeof window.LabelOriginUTM === 'function') ? window.LabelOriginUTM() : {};
        window.gtag('event', eventName, Object.assign({
            page_path: window.location.pathname
        }, utm));
    });
})();

/* ==========================================================================
   MOBILE-FIRST PASS (Nov 1 2026): mobile menu + sticky bottom CTA bar.
   - Menu: the primary nav is display:none below 900px with no replacement.
     This injects a 44px toggle into .brand-header and opens .nav-links as a
     dropdown. No-JS / no-header pages keep the old behavior (footer nav
     still works everywhere).
   - Sticky bar: mobile only (CSS hides it above 640px). Label + destination
     follow the two-door choice in localStorage (lo_door): 'manufacturer' ->
     "Get buyers" -> /for-manufacturers/; anything else (incl. no choice) ->
     "Find my product line" -> /wholesale/. Hidden while a form field is
     focused, and while the consent banner is visible (CSS). The link carries
     data-ga-event="sticky_cta_click", fired by the consent-gated listener
     already in this file. Nothing here sends data anywhere.
   ========================================================================== */
(function () {
    function storageGet(key) {
        try { return window.localStorage.getItem(key); } catch (e) { return null; }
    }
    function isFormField(el) {
        return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
    }

    function initMobileMenu() {
        var header = document.querySelector('.brand-header');
        if (!header) return;
        var nav = header.querySelector('.nav-links');
        if (!nav) return;
        if (header.querySelector('.nav-toggle')) return;
        var toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'nav-toggle';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open menu');
        toggle.innerHTML = '<span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span>';
        if (nav.id) toggle.setAttribute('aria-controls', nav.id);
        else { nav.id = 'lo-mobile-nav'; toggle.setAttribute('aria-controls', 'lo-mobile-nav'); }
        var actions = header.querySelector('.header-actions');
        if (actions) actions.appendChild(toggle);
        else header.appendChild(toggle);

        function setOpen(open) {
            header.classList.toggle('nav-open', open);
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        }
        toggle.addEventListener('click', function () {
            setOpen(!header.classList.contains('nav-open'));
        });
        nav.addEventListener('click', function (e) {
            if (e.target.closest && e.target.closest('a')) setOpen(false);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') setOpen(false);
        });
        document.addEventListener('click', function (e) {
            if (!header.classList.contains('nav-open')) return;
            if (header.contains(e.target)) return;
            setOpen(false);
        });
        if (window.matchMedia) {
            var mq = window.matchMedia('(min-width: 901px)');
            var onChange = function (m) { if (m.matches) setOpen(false); };
            if (mq.addEventListener) mq.addEventListener('change', onChange);
            else if (mq.addListener) mq.addListener(onChange);
        }
    }

    function initStickyCta() {
        if (document.getElementById('lo-sticky-cta')) return;
        var door = storageGet('lo_door');
        var isManufacturer = door === 'manufacturer';
        var bar = document.createElement('div');
        bar.className = 'lo-sticky-cta';
        bar.id = 'lo-sticky-cta';
        var link = document.createElement('a');
        link.href = isManufacturer ? '/for-manufacturers/' : '/wholesale/';
        link.setAttribute('data-ga-event', 'sticky_cta_click');
        link.textContent = isManufacturer ? 'Get buyers' : 'Find my product line';
        var arrow = document.createElement('span');
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = ' \u2192';
        link.appendChild(arrow);
        bar.appendChild(link);
        document.body.appendChild(bar);
        document.body.classList.add('has-sticky-cta');

        function hide() { bar.classList.add('is-hidden'); }
        function show() { bar.classList.remove('is-hidden'); }
        document.addEventListener('focusin', function (e) {
            if (isFormField(e.target)) hide();
        });
        document.addEventListener('focusout', function () {
            setTimeout(function () {
                if (!isFormField(document.activeElement)) show();
            }, 50);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            initMobileMenu();
            initStickyCta();
        });
    } else {
        initMobileMenu();
        initStickyCta();
    }
})();
