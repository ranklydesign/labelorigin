/*
 * Manufacturer directory — "Get listed" form + "Verified on LabelOrigin"
 * badge snippet (criteria page).
 *
 * Form delivery follows the /wholesale/ sample-request pattern exactly:
 * FormSubmit AJAX to ranklydesign@gmail.com (no CC/BCC anywhere), a
 * localStorage copy, and a fail-open HubSpot Lead Capture dual submit
 * (firstname is not collected on this form, so it is sent empty — never
 * faked). The FormSubmit flow never depends on HubSpot: the dual submit
 * is sent in parallel and never awaited.
 * NOTE: FormSubmit _autoresponse does NOT fire for AJAX forms with
 * reCAPTCHA disabled (verified Nov 1) — do not add it.
 */
(function () {
    'use strict';
    var TARGET_EMAIL = 'ranklydesign@gmail.com';
    var FORM_ENDPOINT = 'https://formsubmit.co/ajax/' + TARGET_EMAIL;
    var STORAGE_KEY = 'labelorigin_directory_listing';

    /* ---------- "Verified on LabelOrigin" badge snippet ---------- */
    var codeBox = document.getElementById('dir-badge-code');
    var preview = document.getElementById('dir-badge-preview');
    var copyBtn = document.getElementById('dir-badge-copy');
    if (codeBox && preview) {
        preview.innerHTML = codeBox.value;
    }
    function copyText(text, btn, emptyLabel) {
        function done() {
            if (!btn) return;
            var original = btn.textContent;
            btn.textContent = 'Copied';
            setTimeout(function () { btn.textContent = original; }, 2000);
        }
        if (!text) {
            if (btn) btn.textContent = emptyLabel;
            return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, function () {
                try { document.execCommand('copy'); done(); } catch (e) { /* leave */ }
            });
            return;
        }
        try {
            codeBox.focus();
            codeBox.select();
            document.execCommand('copy');
            done();
        } catch (e) { /* leave */ }
    }
    if (copyBtn && codeBox) {
        copyBtn.addEventListener('click', function () {
            copyText(codeBox.value, copyBtn, 'Nothing to copy');
        });
    }

    /* ---------- "Get listed" form ---------- */
    var form = document.getElementById('dir-listing-form');
    if (!form) return;

    function syncChecks() {
        form.querySelectorAll('.dir-check').forEach(function (chip) {
            var input = chip.querySelector('input');
            if (input) chip.classList.toggle('is-selected', !!input.checked);
        });
    }
    form.querySelectorAll('input[name="category"]').forEach(function (input) {
        input.addEventListener('change', syncChecks);
    });
    syncChecks();

    function generateLeadId(prefix) {
        var randomHex = Math.floor(1000 + Math.random() * 9000);
        var year = new Date().getFullYear();
        return prefix + '-' + year + '-' + randomHex;
    }

    function saveLead(lead) {
        try {
            var list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            list.push(lead);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } catch (err) { /* localStorage is a copy only; never blocks */ }
    }

    function dispatchLead(emailPayload) {
        return fetch(FORM_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(emailPayload)
        }).then(function (res) {
            return res.json().then(function (result) {
                return res.ok && String(result.success) === 'true';
            });
        }).catch(function () { return false; });
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var submitBtn = document.getElementById('dir-submit');
        var errorEl = document.getElementById('dir-error');
        var honeypot = document.getElementById('dir-website-hp');
        if (honeypot && honeypot.value) return;

        var business = document.getElementById('dir-business').value || '';
        var website = document.getElementById('dir-website').value || '';
        var email = document.getElementById('dir-email').value || '';
        var message = document.getElementById('dir-message').value || '';
        var categories = [];
        form.querySelectorAll('input[name="category"]:checked').forEach(function (c) {
            categories.push(c.value);
        });
        if (!categories.length) {
            errorEl.textContent = 'Pick at least one category before sending your request.';
            errorEl.hidden = false;
            return;
        }
        errorEl.hidden = true;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending\u2026';

        var leadId = generateLeadId('DR');
        var submittedAt = new Date().toISOString();
        var leadMessage = 'Directory listing request \u2014 ' + business +
            ' \u2014 ' + categories.join(', ') +
            (message ? '. ' + message : '');

        saveLead({
            leadId: leadId, business: business, website: website,
            email: email, categories: categories, message: message,
            submittedAt: submittedAt, source: 'directory-get-listed'
        });
        // Dual submit to HubSpot (fail-open): sent in parallel, never
        // awaited, and the FormSubmit flow below never depends on it.
        if (window.LabelOriginHubSpot) {
            window.LabelOriginHubSpot.submitLead({
                firstname: '',
                email: email,
                company: business,
                website: website,
                lead_message: leadMessage
            });
        }

        var emailPayload = {
            _subject: '[LabelOrigin] Directory listing: ' + email,
            _template: 'table',
            _captcha: 'false',
            _replyto: email,
            'email': email,
            'Lead ID': leadId,
            'Business name': business,
            'Website': website || 'Not provided',
            'Contact email': email,
            'Categories': categories.join(', '),
            'Message': message || 'Not provided',
            'Source page': 'https://labelorigin.com/directory/get-listed/',
            'Submission Timestamp': submittedAt
        };

        dispatchLead(emailPayload).then(function (delivered) {
            document.getElementById('dir-ref').textContent = leadId;
            document.getElementById('dir-ref-fail').textContent = leadId;
            if (delivered) {
                document.getElementById('dir-email-echo').textContent = email;
                form.style.display = 'none';
                document.getElementById('dir-success').classList.add('success');
            } else {
                form.style.display = 'none';
                document.getElementById('dir-failure').style.display = 'block';
            }
        });
    });
})();
