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
 *    Lead Capture), so on success the form is replaced with a thank-you
 *    that links the hosted checklist PDF directly (CHECKLIST_PDF_URL
 *    below -- the verified HubSpot-hosted URL).
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
    var PORTAL_ID = '247855692';
    var NEWSLETTER_FORM_ID = '90f597fb-0644-4e26-9cfb-6d02dcba52aa';
    var LEAD_FORM_ID = 'c8a97138-af1f-48bc-9d57-ebaf02026cd7';
    var UNDERMINIMUM_FORM_ID = '75d37a69-7e6a-45ab-8333-67a846f37d5b'; // LabelOrigin Under-minimum Lead (email required only)
    // HubSpot-hosted state-rules checklist PDF (Files API, public file,
    // verified 200 + application/pdf). Linked from the newsletter thank-you.
    var CHECKLIST_PDF_URL = 'https://247855692.fs1.hubspotusercontent-na2.net/hubfs/247855692/labelorigin/state-rules-checklist.pdf';
    var THANK_YOU = 'Thanks \u2014 <a href="' + CHECKLIST_PDF_URL + '">' +
        'download the state-rules checklist (PDF)</a>.';

    /* --- Newsletter signup (native form) --- */
    // Privacy text shown on the form (plain-text form of the privacy line;
    // the visible line links "Privacy Policy" to /privacy/). Recorded with
    // every submission as the consent-to-process text.
    var PRIVACY_TEXT = 'By submitting this form, you agree to our Privacy Policy.';
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
            setStatus(form, 'Please enter a valid email address.');
            if (email) email.focus();
            return;
        }
        // Record the exact label text shown next to the checkbox.
        var consentLabel = MARKETING_LABEL_FALLBACK;
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
                { objectTypeId: '0-1', name: 'firstname', value: firstname ? firstname.value.trim() : '' }
            ],
            context: {
                pageUri: window.location.href,
                pageName: document.title
            },
            legalConsentOptions: {
                consent: {
                    consentToProcess: true,
                    text: PRIVACY_TEXT,
                    communications: [{
                        value: !!(consent && consent.checked),
                        subscriptionTypeId: MARKETING_SUBSCRIPTION_ID,
                        text: consentLabel
                    }]
                }
            }
        };
        if (button) button.disabled = true;
        fetch(SUBMIT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(function (res) {
            if (!res.ok) throw new Error('submit failed: ' + res.status);
            form.innerHTML =
                '<p class="notification success" role="status">' + THANK_YOU + '</p>';
        }).catch(function () {
            if (button) button.disabled = false;
            setStatus(form, 'Something went wrong \u2014 please try again. Your details are still filled in.');
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
                        { objectTypeId: '0-1', name: 'lead_message', value: fields.lead_message || '' }
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
                        { objectTypeId: '0-1', name: 'lead_message', value: fields.lead_message || '' }
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

