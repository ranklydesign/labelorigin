/*
 * State-rules page: per-state embed generator + correction report form.
 *
 * Embed generator reads the verified table above it, so the snippet it builds
 * can never drift from the live rows. The snippet is plain HTML with inline
 * styles — no JavaScript on the embedding site, no account needed.
 *
 * Correction reports post to FormSubmit (ranklydesign@gmail.com) with the same
 * AJAX pattern as the /wholesale/ sample-request form: localStorage copy, a
 * CR- reference, and a delivered-only success panel. No HubSpot dual-submit:
 * Lead Capture requires firstname + email + company, and this form collects
 * no firstname or company (email is optional) — faking a firstname is not
 * an option, so corrections stay FormSubmit-only. NOTE: FormSubmit
 * _autoresponse does NOT fire for AJAX forms with reCAPTCHA disabled
 * (verified Nov 1) — do not add it.
 */
(function () {
    'use strict';

    /* ---------- shared helpers ---------- */

    function esc(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function copyText(text, btn, emptyLabel) {
        if (!text) {
            var origEmpty = btn.textContent;
            btn.textContent = emptyLabel;
            setTimeout(function () { btn.textContent = origEmpty; }, 2000);
            return;
        }
        function done() {
            var orig = btn.textContent;
            btn.textContent = 'Copied \u2713';
            setTimeout(function () { btn.textContent = orig; }, 2000);
        }
        function fallback() {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); done(); } catch (e) { /* leave */ }
            document.body.removeChild(ta);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, fallback);
        } else {
            fallback();
        }
    }

    /* ---------- embed generator ---------- */

    (function embedKit() {
        var select = document.getElementById('embed-state');
        var codeBox = document.getElementById('embed-code');
        var preview = document.getElementById('embed-preview');
        var copyBtn = document.getElementById('embed-copy');
        var linkCopyBtn = document.getElementById('embed-link-copy');
        var linkCodeBox = document.getElementById('embed-link-code');
        if (!select || !codeBox || !preview) return;

        var table = document.querySelector('.table-wrap table tbody');
        if (!table) return;

        var data = {};
        var rows = table.querySelectorAll('tr');
        rows.forEach(function (tr) {
            var cells = tr.querySelectorAll('td');
            if (cells.length < 5) return;
            var state = cells[0].textContent.trim();
            var sources = [];
            cells[4].querySelectorAll('a').forEach(function (a) {
                sources.push({ href: a.getAttribute('href'), text: a.textContent.trim() });
            });
            data[state] = {
                body: cells[1].textContent.trim(),
                retail: cells[2].textContent.trim(),
                tax: cells[3].textContent.trim(),
                sources: sources
            };
        });

        Object.keys(data).sort().forEach(function (name) {
            var o = document.createElement('option');
            o.value = name;
            o.textContent = name;
            select.appendChild(o);
        });

        function buildSnippet(state) {
            var row = data[state];
            if (!row) return '';
            var srcLinks = row.sources.map(function (s) {
                return '<a href="' + esc(s.href) + '">' + esc(s.text) + '</a>';
            }).join(' &middot; ');
            var lines = [];
            lines.push('<div style="border:1px solid #d8d2c4;border-radius:12px;padding:16px 18px;font-family:Georgia,\'Times New Roman\',serif;color:#222;max-width:640px;background:#fff;">');
            lines.push('<p style="margin:0 0 6px;font-size:15px;font-weight:bold;">' + esc(state) + ' &mdash; selling skincare in your spa</p>');
            lines.push('<p style="margin:0 0 6px;font-size:14px;line-height:1.5;"><strong>Licensing body:</strong> ' + esc(row.body) + '</p>');
            lines.push('<p style="margin:0 0 6px;font-size:14px;line-height:1.5;"><strong>Separate retail license?</strong> ' + esc(row.retail) + '</p>');
            lines.push('<p style="margin:0 0 8px;font-size:14px;line-height:1.5;"><strong>Sales-tax permit?</strong> ' + esc(row.tax) + '</p>');
            lines.push('<p style="margin:0;font-size:13px;line-height:1.5;">Sources: ' + srcLinks + ' | Last verified 1 November 2026 | <a href="https://labelorigin.com/guides/state-rules-selling-skincare-med-spa/">Source: LabelOrigin &mdash; State Rules for Selling Skincare</a></p>');
            lines.push('</div>');
            return lines.join('\n');
        }

        select.addEventListener('change', function () {
            var snippet = buildSnippet(select.value);
            codeBox.value = snippet;
            preview.innerHTML = snippet || '<p>Choose a state above to preview the embed.</p>';
        });

        if (copyBtn) {
            copyBtn.addEventListener('click', function () {
                copyText(codeBox.value, copyBtn, 'Choose a state first');
            });
        }
        if (linkCopyBtn && linkCodeBox) {
            linkCopyBtn.addEventListener('click', function () {
                copyText(linkCodeBox.value, linkCopyBtn, 'Nothing to copy');
            });
        }
    })();

    /* ---------- correction report form ---------- */

    (function correctionForm() {
        var TARGET_EMAIL = 'ranklydesign@gmail.com';
        var FORM_ENDPOINT = 'https://formsubmit.co/ajax/' + TARGET_EMAIL;
        var STORAGE_KEY = 'labelorigin_correction_report';

        var form = document.getElementById('correction-form');
        if (!form) return;

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var submitBtn = document.getElementById('cr-submit');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending\u2026';

            var honeypot = document.getElementById('cr-website-hp');
            if (honeypot && honeypot.value) {
                return;
            }

            var leadId = generateLeadId('CR');
            var state = document.getElementById('cr-state').value || '';
            var what = document.getElementById('cr-what').value || '';
            var sourceUrl = document.getElementById('cr-source').value || '';
            var email = document.getElementById('cr-email').value || '';
            var submittedAt = new Date().toISOString();

            saveLead({
                leadId: leadId,
                state: state,
                correction: what,
                sourceUrl: sourceUrl,
                email: email,
                submittedAt: submittedAt,
                source: 'state-rules-corrections'
            });

            var emailPayload = {
                _subject: '[LabelOrigin] State-rules correction: ' + state,
                _template: 'table',
                _captcha: 'false',
                'Report ID': leadId,
                'State': state,
                'What needs correcting': what,
                'Source URL': sourceUrl || 'Not provided',
                'Reporter email': email || 'Not provided',
                'Source page': 'https://labelorigin.com/guides/state-rules-selling-skincare-med-spa/',
                'Submission Timestamp': submittedAt
            };
            // Reply-To is the reporter only when they left an email.
            if (email) {
                emailPayload._replyto = email;
                emailPayload.email = email;
            }

            dispatchLead(emailPayload).then(function (delivered) {
                document.getElementById('cr-ref').textContent = leadId;
                document.getElementById('cr-ref-fail').textContent = leadId;
                if (delivered) {
                    form.style.display = 'none';
                    document.getElementById('cr-success').classList.add('success');
                } else {
                    form.style.display = 'none';
                    document.getElementById('cr-failure').style.display = 'block';
                }
            });
        });

        function generateLeadId(prefix) {
            var randomHex = Math.floor(1000 + Math.random() * 9000);
            var year = new Date().getFullYear();
            return prefix + '-' + year + '-' + randomHex;
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
            }).catch(function (err) {
                console.warn('[Correction Report] Dispatch note:', err);
                return false;
            });
        }

        function saveLead(lead) {
            try {
                var list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
                list.push(lead);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
            } catch (err) {
                console.error('Failed to save to localStorage:', err);
            }
        }
    })();
})();
