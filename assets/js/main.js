/**
 * LabelOrigin site script
 * Handles the agency inquiry form on the home page.
 * Dispatches to ranklydesign@gmail.com via FormSubmit AJAX and keeps a copy in localStorage.
 */

const TARGET_EMAIL = 'ranklydesign@gmail.com';
const FORM_ENDPOINT = `https://formsubmit.co/ajax/${TARGET_EMAIL}`;

document.addEventListener('DOMContentLoaded', () => {
    initInquiryForm();
});

function initInquiryForm() {
    const form = document.getElementById('agency-inquiry-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        const notification = document.getElementById('agency-inquiry-notif');
        const field = (name) => {
            const el = form.querySelector(`[name="${name}"]`);
            return el ? el.value.trim() : '';
        };

        const inquiry = {
            type: 'agency_inquiry',
            company: field('company'),
            email: field('email'),
            industry: field('industry'),
            message: field('message'),
            timestamp: new Date().toISOString()
        };
        if (!inquiry.email) return;

        const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Submit';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Sending...';
        }

        saveLeadLocally('labelorigin_agency_inquiries', inquiry);

        const delivered = await dispatchLead({
            _subject: `[LabelOrigin] New agency inquiry: ${inquiry.company || inquiry.email}`,
            "Inquiry Type": "Agency Inquiry",
            "Company": inquiry.company,
            "Email": inquiry.email,
            "Industry": inquiry.industry,
            "Message": inquiry.message || '(none)',
            "Timestamp": inquiry.timestamp
        }, inquiry);

        if (notification) {
            notification.className = 'notification success';
            notification.innerHTML = delivered
                ? `<strong>Thanks, ${escapeHtml(inquiry.company || 'we got it')}.</strong> We'll reply to <em>${escapeHtml(inquiry.email)}</em> shortly.`
                : `<strong>We couldn't send that automatically.</strong> Please email us at <a href="mailto:${TARGET_EMAIL}">${TARGET_EMAIL}</a> and we'll reply right away.`;
        }

        form.reset();
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });
}

/**
 * Dispatches lead data to FormSubmit (email to ranklydesign@gmail.com)
 * and records to the local preview server (/api/submit-lead) when running on localhost.
 */
async function dispatchLead(emailPayload, rawLead) {
    const payload = {
        _template: 'table',
        _captcha: 'false',
        ...emailPayload
    };

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
        try {
            await fetch('/api/submit-lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rawLead || emailPayload)
            });
        } catch (e) {
            // Local dev server only
        }
    }

    try {
        const response = await fetch(FORM_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        console.info('[LabelOrigin Dispatch] FormSubmit Response:', result);
        return response.ok && String(result.success) === 'true';
    } catch (err) {
        console.warn('[LabelOrigin Dispatch] Remote dispatch note:', err);
        return false;
    }
}

function saveLeadLocally(storageKey, leadData) {
    try {
        const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
        existing.push(leadData);
        localStorage.setItem(storageKey, JSON.stringify(existing));
    } catch (err) {
        console.warn('[LabelOrigin] LocalStorage write failed:', err);
    }
}

function escapeHtml(string) {
    if (!string) return '';
    const div = document.createElement('div');
    div.textContent = string;
    return div.innerHTML;
}
