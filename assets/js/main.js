/**
 * LabelOrigin Directory Engine
 * Lightweight Vanilla JS for search, category filtering, and inbound form handling.
 * Direct dispatch to ranklydesign@gmail.com via FormSubmit AJAX + local JSON persistence.
 */

const TARGET_EMAIL = 'ranklydesign@gmail.com';
const FORM_ENDPOINT = `https://formsubmit.co/ajax/${TARGET_EMAIL}`;

document.addEventListener('DOMContentLoaded', () => {
    initDirectoryFilters();
    initMiniForms();
    updateLiveMetrics();
});

function initDirectoryFilters() {
    const searchInput = document.getElementById('vertical-search');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const cards = document.querySelectorAll('.grid .card');
    const countDisplay = document.getElementById('results-count');

    function applyFilters() {
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const activeFilterBtn = document.querySelector('.filter-btn.active');
        const activeCategory = activeFilterBtn ? activeFilterBtn.dataset.filter : 'all';

        let visibleCount = 0;

        cards.forEach(card => {
            const cardCategory = card.dataset.category || '';
            const cardTitle = (card.querySelector('h3') ? card.querySelector('h3').textContent : '').toLowerCase();
            const cardDesc = (card.querySelector('p') ? card.querySelector('p').textContent : '').toLowerCase();
            const cardChips = Array.from(card.querySelectorAll('.chip')).map(c => c.textContent.toLowerCase()).join(' ');

            const matchesCategory = (activeCategory === 'all') || (cardCategory.includes(activeCategory));
            const matchesSearch = !query || 
                cardTitle.includes(query) || 
                cardDesc.includes(query) || 
                cardChips.includes(query);

            if (matchesCategory && matchesSearch) {
                card.style.display = 'flex';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });

        if (countDisplay) {
            countDisplay.textContent = `Showing ${visibleCount} verified vertical${visibleCount === 1 ? '' : 's'}`;
        }
    }

    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }

    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyFilters();
        });
    });
}

function initMiniForms() {
    // 1. Buyer Network Waitlist Form
    const buyerForm = document.getElementById('buyer-waitlist-form');
    if (buyerForm) {
        buyerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = buyerForm.querySelector('input[type="email"]');
            const verticalSelect = buyerForm.querySelector('select[name="vertical"]');
            const submitBtn = buyerForm.querySelector('button[type="submit"]');
            const notification = document.getElementById('buyer-waitlist-notif');

            if (!emailInput || !emailInput.value) return;

            const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Submit';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = 'Connecting to Network...';
            }

            const lead = {
                type: 'buyer_network_waitlist',
                email: emailInput.value.trim(),
                vertical: verticalSelect ? verticalSelect.value : 'General',
                timestamp: new Date().toISOString()
            };

            // Always save locally to browser storage
            saveLeadLocally('labelorigin_buyer_waitlist', lead);

            // Dispatch to email and local server
            await dispatchLead({
                _subject: `[LabelOrigin Directory] Buyer Network Waitlist: ${lead.email}`,
                "Inquiry Type": "Buyer Network Waitlist",
                "Buyer Email": lead.email,
                "Requested Vertical": lead.vertical,
                "Timestamp": lead.timestamp
            }, lead);

            if (notification) {
                notification.className = 'notification success';
                notification.innerHTML = `<strong>Priority Confirmed:</strong> <em>${escapeHtml(lead.email)}</em> enrolled in the ${escapeHtml(lead.vertical)} queue. Lead dispatched to facility desk.`;
            }

            buyerForm.reset();
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        });
    }

    // 2. Manufacturer Application Form
    const mfgForm = document.getElementById('mfg-application-form');
    if (mfgForm) {
        mfgForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const companyInput = mfgForm.querySelector('input[name="company"]');
            const emailInput = mfgForm.querySelector('input[name="email"]');
            const categoryInput = mfgForm.querySelector('select[name="category"]');
            const submitBtn = mfgForm.querySelector('button[type="submit"]');
            const notification = document.getElementById('mfg-app-notif');

            if (!emailInput || !emailInput.value) return;

            const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Submit';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = 'Auditing Application...';
            }

            const application = {
                type: 'manufacturer_onboarding_inquiry',
                company: companyInput ? companyInput.value.trim() : 'Unknown',
                email: emailInput.value.trim(),
                category: categoryInput ? categoryInput.value : 'General',
                timestamp: new Date().toISOString()
            };

            // Save locally
            saveLeadLocally('labelorigin_mfg_applications', application);

            // Dispatch to email and local server
            await dispatchLead({
                _subject: `[LabelOrigin Audit] New Facility Listing Application: ${application.company}`,
                "Inquiry Type": "Facility Verification Application",
                "Facility Legal Name": application.company,
                "Director Email": application.email,
                "Manufacturing Sector": application.category,
                "Timestamp": application.timestamp
            }, application);

            if (notification) {
                notification.className = 'notification success';
                notification.innerHTML = `<strong>Application Logged:</strong> Verification package dispatched to <em>${escapeHtml(application.email)}</em>. Operational audit initiated.`;
            }

            mfgForm.reset();
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        });
    }
}

/**
 * Dispatches lead data to FormSubmit (email to ranklydesign@gmail.com)
 * and records to local preview server (/api/submit-lead) if available.
 */
async function dispatchLead(emailPayload, rawLead) {
    const payload = {
        _template: 'table',
        _captcha: 'false',
        ...emailPayload
    };

    // 1. Post to local server if running in dev mode
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

    // 2. Dispatch to FormSubmit for live inbox delivery
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
    } catch (err) {
        console.warn('[LabelOrigin Dispatch] Remote dispatch note:', err);
    }
}

function saveLeadLocally(storageKey, leadData) {
    try {
        const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
        existing.push(leadData);
        localStorage.setItem(storageKey, JSON.stringify(existing));
        console.info(`[LabelOrigin] Stored lead under ${storageKey}:`, leadData);
    } catch (err) {
        console.warn('[LabelOrigin] LocalStorage write failed:', err);
    }
}

function updateLiveMetrics() {
    const timeEl = document.getElementById('live-timestamp');
    if (timeEl) {
        const now = new Date();
        timeEl.textContent = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
}

function escapeHtml(string) {
    if (!string) return '';
    const div = document.createElement('div');
    div.textContent = string;
    return div.innerHTML;
}
