/* LabelOrigin HubSpot wiring.
 *
 * Two jobs, kept separate:
 *
 * 1. NEWSLETTER SIGNUP (native form). The signup form is plain HTML in
 *    the page (footer + the state-rules/report sections). It renders
 *    immediately -- no cookie decision, no third-party embed script, no
 *    cookies set, no hutk tracking. Submit posts straight to HubSpot's
 *    public Forms submissions endpoint for the "LabelOrigin Newsletter
 *    Signup" form (double opt-in is OFF by decision; the form carries
 *    the explicit consent checkbox tied to the Marketing Information
 *    subscription). Consent is recorded with the submission: the payload
 *    carries legalConsentOptions with consentToProcess + the privacy text
 *    and the exact marketing-checkbox label text. There is NO auto-reply
 *    on the newsletter form (the free plan's one follow-up email goes on
 *    Lead Capture), so on success the PDF opens in a new tab immediately
 *    (inside the submit gesture, so no popup block) and the form is replaced
 *    with a thank-you carrying a big download button for the hosted checklist
 *    PDF (CHECKLIST_PDF_URL below -- the verified HubSpot-hosted URL).
 *    Copy says the checklist downloads instantly -- nobody waits for an
 *    email the free plan cannot send.
 *
 * 2. LEAD CAPTURE (dual submit). A fire-and-forget POST of the same four
 *    fields to HubSpot's public submissions endpoint, sent in parallel
 *    with the FormSubmit flow on /wholesale/ and /contact/. It never
 *    blocks, delays, or changes the FormSubmit success panel or lead
 *    reference: it is not awaited, and every failure is swallowed.
 *    The fetch uses default credentials, so no cookies are sent or
 *    stored; the dual submit is form delivery, not tracking, and is
 *    not consent-gated -- same treatment as FormSubmit.
 */
(function () {
    /* i18n (ES): strings from /i18n/es.json via LabelOriginI18n;
       every lookup falls back to the shipped English. */
    function hT(key, fallback) {
        try {
            if (typeof window !== 'undefined' && window.LabelOriginI18n && typeof window.LabelOriginI18n.isEs === 'function' &&
                    window.LabelOriginI18n.isEs() && typeof window.LabelOriginI18n.t === 'function') {
                var v = window.LabelOriginI18n.t(key);
                if (v) return v;
            }
        } catch (e) { /* ignore */ }
        return fallback;
    }
    function hEs() {
        try {
            return !!(window.LabelOriginI18n && typeof window.LabelOriginI18n.isEs === 'function' && window.LabelOriginI18n.isEs());
        } catch (e) { return false; }
    }
    var PORTAL_ID = '247855692';
    var NEWSLETTER_FORM_ID = '90f597fb-0644-4e26-9cfb-6d02dcba52aa';
    var LEAD_FORM_ID = 'c8a97138-af1f-48bc-9d57-ebaf02026cd7';
    var UNDERMINIMUM_FORM_ID = '75d37a69-7e6a-45ab-8333-67a846f37d5b'; // LabelOrigin Under-minimum Lead (email required only)
    // HubSpot-hosted state-rules checklist PDF (Files API, public file,
    // verified 200 + application/pdf). Linked from the newsletter thank-you.
    var CHECKLIST_PDF_URL = 'https://247855692.fs1.hubspotusercontent-na2.net/hubfs/247855692/labelorigin/state-rules-checklist.pdf';
    function thankYouHtml() {
        return hT('hubspot.thankYou', '<p><strong>Thanks \u2014 your checklist downloads instantly.</strong></p>' +
            '<p><a class="btn btn-primary" href="{url}" target="_blank" rel="noopener">Download your checklist (PDF)</a></p>' +
            '<p>No email to wait for \u2014 if the download didn\u2019t start, tap the button.</p>')
            .split('{url}').join(CHECKLIST_PDF_URL);
    }

    /* --- Newsletter signup (native form) --- */
    // Privacy text shown on the form (plain-text form of the privacy line;
    // the visible line links "Privacy Policy" to /privacy/). Recorded with
    // every submission as the consent-to-process text.
    var PRIVACY_TEXT = 'By submitting this form, you agree to our Privacy Policy.';
    // PRIVACY_TEXT is the English fallback; the live value at submit time
    // comes from hT() below, so a Spanish submission records Spanish text.
    var MARKETING_SUBSCRIPTION_ID = 4030947730; // Marketing Information
    var MARKETING_LABEL_FALLBACK = 'I agree to receive marketing emails from LabelOrigin';
    var SUBMIT_URL = 'https://api.hsforms.com/submissions/v3/integration/submit/' +
        PORTAL_ID + '/' + NEWSLETTER_FORM_ID;

    function setStatus(form, message) {
        var status = form.querySelector('[data-newsletter-status]');
        if (!status) return;
        status.textContent = message;
        status.hidden = false;
    }

    function submitNewsletter(form) {
        var email = form.querySelector('input[name="email"]');
        var firstname = form.querySelector('input[name="firstname"]');
        var consent = form.querySelector('input[name="marketing_consent"]');
        var button = form.querySelector('button[type="submit"]');
        if (!email || !email.value || email.value.indexOf('@') === -1) {
            setStatus(form, hT('hubspot.invalidEmail', 'Please enter a valid email address.'));
            if (email) email.focus();
            return;
        }
        // Record the exact label text shown next to the checkbox.
        var consentLabel = hT('hubspot.marketingLabelFallback', MARKETING_LABEL_FALLBACK);
        if (consent && consent.closest) {
            var label = consent.closest('label');
            if (label) {
                var text = label.textContent.replace(/\s+/g, ' ').trim();
                if (text) consentLabel = text;
            }
        }
        var payload = {
            fields: [
                { objectTypeId: '0-1', name: 'email', value: email.value.trim() },
                { objectTypeId: '0-1', name: 'firstname', value: firstname ? firstname.value.trim() : '' },
                { objectTypeId: '0-1', name: 'hs_lead_status', value: 'NEW' },
            ],
            context: {
                pageUri: window.location.href,
                pageName: document.title
            },
            legalConsentOptions: {
                consent: {
                    consentToProcess: true,
                    text: hT('hubspot.privacyText', PRIVACY_TEXT),
                    communications: [{
                        value: !!(consent && consent.checked),
                        subscriptionTypeId: MARKETING_SUBSCRIPTION_ID,
                        text: consentLabel
                    }]
                }
            }
        };
        if (button) button.disabled = true;
        /* The checklist downloads instantly: open the hosted PDF in a new
           tab right here, inside the submit gesture (a later async callback
           would be popup-blocked), and the thank-you below carries the same
           link as a big button if the tab did not open. Cross-origin, so
           the `download` attribute cannot force a save — the PDF opens in
           the viewer, where the reader can save it. */
        var dl = document.createElement('a');
        dl.href = CHECKLIST_PDF_URL;
        dl.target = '_blank';
        dl.rel = 'noopener';
        document.body.appendChild(dl);
        dl.click();
        document.body.removeChild(dl);
        fetch(SUBMIT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(function (res) {
            if (!res.ok) throw new Error('submit failed: ' + res.status);
            form.innerHTML =
                '<div class="notification success" role="status">' + thankYouHtml() + '</div>';
        }).catch(function () {
            if (button) button.disabled = false;
            setStatus(form, hT('hubspot.submitError', 'Something went wrong \u2014 please try again. Your details are still filled in.'));
        });
    }

    Array.prototype.slice.call(
        document.querySelectorAll('form[data-newsletter-native]')).forEach(function (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            submitNewsletter(form);
        });
    });

    /* --- Lead capture dual submit (fail-open, never awaited) --- */
    window.LabelOriginHubSpot = {
        submitLead: function (fields) {
            try {
                var payload = {
                    fields: [
                        { objectTypeId: '0-1', name: 'firstname', value: fields.firstname || '' },
                        { objectTypeId: '0-1', name: 'email', value: fields.email || '' },
                        { objectTypeId: '0-1', name: 'company', value: fields.company || '' },
                        { objectTypeId: '0-1', name: 'website', value: fields.website || '' },
                        { objectTypeId: '0-1', name: 'lead_message', value: (fields.lead_message || '') + ((typeof window !== 'undefined' && window.LabelOriginI18n && typeof window.LabelOriginI18n.langTag === 'function') ? window.LabelOriginI18n.langTag() : '') },
                        { objectTypeId: '0-1', name: 'hs_lead_status', value: 'NEW' },
                    ],
                    context: {
                        pageUri: fields.pageUri || window.location.href,
                        pageName: fields.pageName || document.title
                    }
                };
                fetch('https://api.hsforms.com/submissions/v3/integration/submit/' +
                    PORTAL_ID + '/' + LEAD_FORM_ID, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).catch(function () { /* fail-open: the lead flow never depends on HubSpot */ });
            } catch (err) {
                /* fail-open: the lead flow never depends on HubSpot */
            }
        },
        submitNotYetFit: function (fields) {
            // Under-minimum funnel leads (no name/company collected): posts to the
            // dedicated under-minimum form, email required only. Same fail-open
            // pattern as submitLead — never awaited, every failure swallowed.
            try {
                var payload = {
                    fields: [
                        { objectTypeId: '0-1', name: 'email', value: fields.email || '' },
                        { objectTypeId: '0-1', name: 'lead_message', value: (fields.lead_message || '') + ((typeof window !== 'undefined' && window.LabelOriginI18n && typeof window.LabelOriginI18n.langTag === 'function') ? window.LabelOriginI18n.langTag() : '') },
                        { objectTypeId: '0-1', name: 'hs_lead_status', value: 'NEW' },
                    ],
                    context: {
                        pageUri: fields.pageUri || window.location.href,
                        pageName: fields.pageName || document.title
                    }
                };
                fetch('https://api.hsforms.com/submissions/v3/integration/submit/' +
                    PORTAL_ID + '/' + UNDERMINIMUM_FORM_ID, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).catch(function () { /* fail-open: the lead flow never depends on HubSpot */ });
            } catch (err) {
                /* fail-open: the lead flow never depends on HubSpot */
            }
        }
    };
})();

