/**
 * LabelOrigin High-Converting Funnel Engine
 * Handles multi-step progression, logic gating (high-volume vs low-volume waitlist),
 * back-step navigation, lead ID generation, webhook dispatch, and local persistence.
 */

(function () {
    const state = {
        history: ['step-1'],
        leadData: {
            partnerSlug: 'renaud',
            businessType: '',
            volumeTier: '',
            volumeLabel: '',
            interestArea: '',
            submittedAt: null,
            leadId: null
        }
    };

    const config = window.FunnelConfig || {
        partnerName: 'Renaud Naturals',
        partnerPrefix: 'RN',
        // Optional webhook URL (Formspree, Zapier, Make, Google Apps Script, etc.)
        webhookUrl: '',
        storageKey: 'labelorigin_renaud_leads',
        waitlistKey: 'labelorigin_small_batch_waitlist'
    };

    function initFunnel() {
        // Set partner slug from config
        if (config.partnerSlug) {
            state.leadData.partnerSlug = config.partnerSlug;
        }

        // Setup option selection listeners
        document.querySelectorAll('[data-select-type]').forEach(btn => {
            btn.addEventListener('click', () => {
                selectType(btn.dataset.selectType);
            });
        });

        document.querySelectorAll('[data-select-volume]').forEach(btn => {
            btn.addEventListener('click', () => {
                selectVolume(btn.dataset.selectVolume, btn.textContent.trim());
            });
        });

        document.querySelectorAll('[data-select-interest]').forEach(btn => {
            btn.addEventListener('click', () => {
                selectInterest(btn.dataset.selectInterest);
            });
        });

        // Back button triggers
        document.querySelectorAll('.funnel-back-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                goBack();
            });
        });

        // Form submission triggers
        const qualifiedForm = document.getElementById('qualified-lead-form');
        if (qualifiedForm) {
            qualifiedForm.addEventListener('submit', handleQualifiedSubmit);
        }

        const waitlistForm = document.getElementById('waitlist-lead-form');
        if (waitlistForm) {
            waitlistForm.addEventListener('submit', handleWaitlistSubmit);
        }

        updateProgressBar('step-1');
    }

    function showStep(stepId, pushHistory = true) {
        const currentActive = document.querySelector('.step.active');
        if (currentActive) {
            currentActive.classList.remove('active');
        }

        const nextStep = document.getElementById(stepId);
        if (nextStep) {
            nextStep.classList.add('active');
            if (pushHistory && state.history[state.history.length - 1] !== stepId) {
                state.history.push(stepId);
            }
            updateProgressBar(stepId);
            // Smooth scroll up to form card on mobile
            const card = document.querySelector('.form-card');
            if (card && window.innerWidth < 768) {
                card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }

    function goBack() {
        if (state.history.length > 1) {
            state.history.pop(); // Remove current
            const previousStep = state.history[state.history.length - 1];
            showStep(previousStep, false);
        }
    }

    function updateProgressBar(stepId) {
        const bar = document.getElementById('funnel-progress-fill');
        const count = document.getElementById('step-current-number');
        if (!bar) return;

        let percent = 25;
        let stepNum = 1;

        switch (stepId) {
            case 'step-1':
                percent = 25;
                stepNum = 1;
                break;
            case 'step-2':
                percent = 50;
                stepNum = 2;
                break;
            case 'step-3-interest':
                percent = 75;
                stepNum = 3;
                break;
            case 'step-qualified':
                percent = 90;
                stepNum = 4;
                break;
            case 'step-waitlist':
                percent = 90;
                stepNum = 3;
                break;
            case 'step-success-qualified':
            case 'step-success-waitlist':
                percent = 100;
                stepNum = 4;
                break;
            default:
                percent = 25;
                stepNum = 1;
        }

        bar.style.width = percent + '%';
        if (count) count.textContent = stepNum;
    }

    function selectType(type) {
        state.leadData.businessType = type;
        showStep('step-2');
    }

    function selectVolume(tier, label) {
        state.leadData.volumeTier = tier;
        state.leadData.volumeLabel = label;

        if (tier === 'low') {
            // Logic Gate: Filter low volume into LabelOrigin small-batch incubator waitlist
            showStep('step-waitlist');
        } else {
            // High volume commercial qualification
            showStep('step-3-interest');
        }
    }

    function selectInterest(interest) {
        state.leadData.interestArea = interest;
        showStep('step-qualified');
    }

    function generateLeadId(prefix) {
        const randomHex = Math.floor(1000 + Math.random() * 9000);
        const year = new Date().getFullYear();
        return `${prefix || 'LO'}-${year}-${randomHex}`;
    }

    async function handleQualifiedSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const origBtnText = submitBtn.innerHTML;

        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Routing to Lab Facility...';

        const leadId = generateLeadId(config.partnerPrefix || 'RN');
        state.leadData.leadId = leadId;
        state.leadData.submittedAt = new Date().toISOString();
        state.leadData.leadCategory = 'commercial_qualified';

        // Extract form values
        state.leadData.contactName = (document.getElementById('q-name') || {}).value || '';
        state.leadData.companyName = (document.getElementById('q-company') || {}).value || '';
        state.leadData.email = (document.getElementById('q-email') || {}).value || '';
        state.leadData.phone = (document.getElementById('q-phone') || {}).value || '';
        state.leadData.notes = (document.getElementById('q-notes') || {}).value || '';

        // Anti-spam honeypot
        const honeypot = document.getElementById('q-website-hp');
        if (honeypot && honeypot.value) {
            console.warn('Bot detected via honeypot.');
            return;
        }

        // Save locally
        saveLead(config.storageKey || 'labelorigin_leads', state.leadData);

        // Attempt webhook dispatch if configured
        if (config.webhookUrl) {
            try {
                await fetch(config.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(state.leadData),
                    mode: 'no-cors'
                });
            } catch (err) {
                console.warn('Webhook dispatch skipped or failed (lead is preserved locally):', err);
            }
        }

        // Show Success Step with Lead Summary
        renderQualifiedSuccess();
        showStep('step-success-qualified');
    }

    async function handleWaitlistSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');

        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Enrolling in Small-Batch Queue...';

        const leadId = generateLeadId('SB');
        state.leadData.leadId = leadId;
        state.leadData.submittedAt = new Date().toISOString();
        state.leadData.leadCategory = 'small_batch_waitlist';
        state.leadData.email = (document.getElementById('w-email') || {}).value || '';
        state.leadData.brandConcept = (document.getElementById('w-concept') || {}).value || '';

        saveLead(config.waitlistKey || 'labelorigin_small_batch_waitlist', state.leadData);

        if (config.webhookUrl) {
            try {
                await fetch(config.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(state.leadData),
                    mode: 'no-cors'
                });
            } catch (err) {
                console.warn('Waitlist webhook error:', err);
            }
        }

        renderWaitlistSuccess();
        showStep('step-success-waitlist');
    }

    function renderQualifiedSuccess() {
        const idDisplay = document.getElementById('success-lead-id');
        const summaryDisplay = document.getElementById('success-summary');

        if (idDisplay) idDisplay.textContent = state.leadData.leadId;
        if (summaryDisplay) {
            const facilityInfo = config.facilityAddress ? `${config.partnerName} &bull; ${config.facilityAddress}` : `${config.partnerName} (Direct Lab)`;
            summaryDisplay.innerHTML = `
                <div class="summary-line"><span>Facility Routed:</span> <strong>${facilityInfo}</strong></div>
                <div class="summary-line"><span>Business Entity:</span> <strong>${escapeHtml(state.leadData.companyName)} (${escapeHtml(state.leadData.businessType)})</strong></div>
                <div class="summary-line"><span>Target Program:</span> <strong>${escapeHtml(state.leadData.interestArea)}</strong></div>
                <div class="summary-line"><span>Order Volume:</span> <strong>${escapeHtml(state.leadData.volumeLabel)}</strong></div>
                <div class="summary-line"><span>Primary Contact:</span> <strong>${escapeHtml(state.leadData.contactName)} &bull; ${escapeHtml(state.leadData.phone)}</strong></div>
                <div class="summary-line"><span>Email:</span> <strong>${escapeHtml(state.leadData.email)}</strong></div>
            `;
        }
    }

    function renderWaitlistSuccess() {
        const waitlistEmailEl = document.getElementById('waitlist-success-email');
        if (waitlistEmailEl) {
            waitlistEmailEl.textContent = state.leadData.email;
        }
    }

    function saveLead(key, lead) {
        try {
            const list = JSON.parse(localStorage.getItem(key) || '[]');
            list.push(lead);
            localStorage.setItem(key, JSON.stringify(list));
            console.info(`[Funnel] Saved lead to localStorage[${key}]:`, lead);
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Public API
    window.LabelOriginFunnel = {
        init: initFunnel,
        getState: () => ({ ...state }),
        goBack: goBack
    };

    document.addEventListener('DOMContentLoaded', initFunnel);
})();
