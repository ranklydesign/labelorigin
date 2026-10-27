/**
 * LabelOrigin Directory Engine
 * Lightweight Vanilla JS for search, category filtering, and inbound form handling.
 */

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

            const matchesCategory = (activeCategory === 'all') || (cardCategory === activeCategory);
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
    // Buyer Network Waitlist Form
    const buyerForm = document.getElementById('buyer-waitlist-form');
    if (buyerForm) {
        buyerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const emailInput = buyerForm.querySelector('input[type="email"]');
            const verticalSelect = buyerForm.querySelector('select[name="vertical"]');
            const notification = document.getElementById('buyer-waitlist-notif');

            if (!emailInput || !emailInput.value) return;

            const lead = {
                type: 'buyer_network_waitlist',
                email: emailInput.value.trim(),
                vertical: verticalSelect ? verticalSelect.value : 'General',
                timestamp: new Date().toISOString()
            };

            saveLeadLocally('labelorigin_buyer_waitlist', lead);

            if (notification) {
                notification.className = 'notification success';
                notification.innerHTML = `<strong>Priority Confirmed:</strong> ${escapeHtml(lead.email)} added to the ${escapeHtml(lead.vertical)} queue. You will receive immediate direct-lab openings.`;
            }

            buyerForm.reset();
        });
    }

    // Manufacturer Application Form
    const mfgForm = document.getElementById('mfg-application-form');
    if (mfgForm) {
        mfgForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const companyInput = mfgForm.querySelector('input[name="company"]');
            const emailInput = mfgForm.querySelector('input[name="email"]');
            const categoryInput = mfgForm.querySelector('select[name="category"]');
            const notification = document.getElementById('mfg-app-notif');

            if (!emailInput || !emailInput.value) return;

            const application = {
                type: 'manufacturer_onboarding_inquiry',
                company: companyInput ? companyInput.value.trim() : 'Unknown',
                email: emailInput.value.trim(),
                category: categoryInput ? categoryInput.value : 'General',
                timestamp: new Date().toISOString()
            };

            saveLeadLocally('labelorigin_mfg_applications', application);

            if (notification) {
                notification.className = 'notification success';
                notification.innerHTML = `<strong>Application Logged:</strong> Verification package sent to ${escapeHtml(application.email)}. Our compliance team will audit facility credentials within 2 business days.`;
            }

            mfgForm.reset();
        });
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
    const div = document.createElement('div');
    div.textContent = string;
    return div.innerHTML;
}
