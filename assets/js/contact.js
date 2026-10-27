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
})();
