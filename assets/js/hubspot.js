/* LabelOrigin HubSpot wiring.
 *
 * Two jobs, kept separate:
 *
 * 1. NEWSLETTER SIGNUP. HubSpot's embed script (js.hsforms.net) sets
 *    third-party cookies, so it loads ONLY after the visitor accepts
 *    cookies -- the same consent gate as the analytics tags in consent.js.
 *    Before Accept (or on Decline) each signup container shows a short
 *    note instead of the form. The form itself is HubSpot's
 *    "LabelOrigin Newsletter Signup" (double opt-in is OFF by decision;
 *    the form carries the explicit consent checkbox tied to the
 *    Marketing Information subscription). There is NO auto-reply on the
 *    newsletter form (the free plan's one follow-up email goes on Lead
 *    Capture), so on submit the container is replaced with a thank-you
 *    that links the hosted checklist PDF directly (CHECKLIST_PDF_URL
 *    below -- the verified HubSpot-hosted URL, inserted before pushing).
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
    var EMBED_SRC = 'https://js.hsforms.net/forms/embed/v2.js';
    // HubSpot-hosted state-rules checklist PDF (Files API, public file,
    // verified 200 + application/pdf). Linked from the newsletter thank-you.
    var CHECKLIST_PDF_URL = 'https://247855692.fs1.hubspotusercontent-na2.net/hubfs/247855692/labelorigin/state-rules-checklist.pdf';
    var THANK_YOU = 'Thanks \u2014 <a href="' + CHECKLIST_PDF_URL + '">' +
        'download the state-rules checklist (PDF)</a>.';

    /* --- Newsletter signup (consent-gated embed) --- */
    var containers = Array.prototype.slice.call(
        document.querySelectorAll('[data-hubspot-newsletter]'));

    function consentAccepted() {
        return !!(window.LabelOriginConsent &&
            window.LabelOriginConsent.accepted &&
            window.LabelOriginConsent.accepted());
    }

    function fallbackNote(container) {
        container.innerHTML =
            '<p class="newsletter-note">The signup form is hosted by HubSpot and sets a ' +
            'cookie, so it loads after you accept cookies. ' +
            '<a href="#" data-lo-consent-reset>Change cookie choices</a>.</p>';
    }

    var embedLoading = false;
    function loadEmbed() {
        if (embedLoading) return;
        embedLoading = true;
        if (window.hbspt && window.hbspt.forms) {
            createForms();
            return;
        }
        var s = document.createElement('script');
        s.async = true;
        s.src = EMBED_SRC;
        s.onload = createForms;
        s.onerror = function () {
            containers.forEach(function (c) {
                c.innerHTML =
                    '<p class="newsletter-note">The signup form could not be ' +
                    'loaded. Please try again later.</p>';
            });
        };
        document.head.appendChild(s);
    }

    function createForms() {
        if (!window.hbspt || !window.hbspt.forms) return;
        containers.forEach(function (container) {
            if (!container.id) return;
            if (container.getAttribute('data-hubspot-loaded')) return;
            container.setAttribute('data-hubspot-loaded', '1');
            window.hbspt.forms.create({
                region: 'na2',
                portalId: PORTAL_ID,
                formId: NEWSLETTER_FORM_ID,
                target: '#' + container.id,
                onFormSubmitted: function () {
                    container.innerHTML =
                        '<p class="notification" role="status">' + THANK_YOU + '</p>';
                }
            });
        });
    }

    if (containers.length) {
        if (consentAccepted()) {
            loadEmbed();
        } else {
            containers.forEach(fallbackNote);
            window.addEventListener('labelorigin-consent-accepted', loadEmbed);
        }
    }

    // "Change cookie choices" links inside the fallback note: re-show the banner.
    document.addEventListener('click', function (e) {
        var link = e.target && e.target.closest ?
            e.target.closest('[data-lo-consent-reset]') : null;
        if (!link) return;
        e.preventDefault();
        if (window.LabelOriginConsent && window.LabelOriginConsent.reset) {
            window.LabelOriginConsent.reset();
        }
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
        }
    };
})();
