/**
 * LabelOrigin High-Converting Funnel Engine
 * Handles multi-step progression, logic gating (high-volume vs low-volume waitlist),
 * back-step navigation, lead ID generation, webhook dispatch, and local persistence.
 *
 * Integrated with real email routing via FormSubmit (ranklydesign@gmail.com)
 * + local preview server recording (/api/submit-lead -> leads.json).
 */

(function () {
    const TARGET_EMAIL = 'ranklydesign@gmail.com';
    const FORM_ENDPOINT = `https://formsubmit.co/ajax/${TARGET_EMAIL}`;

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
        partnerSlug: 'renaud',
        facilityAddress: '101 East 5th Street, Loveland, CO 80537',
        facilityPhone: '970-667-1433',
        facilityEmail: 'Arch@RenaudNaturals.com',
        webhookUrl: '',
        storageKey: 'labelorigin_renaud_leads',
        waitlistKey: 'labelorigin_small_batch_waitlist'
    };

    function initFunnel() {
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
            const card = document.querySelector('.form-card');
            if (card && window.innerWidth < 768) {
                card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }

    function goBack() {
        if (state.history.length > 1) {
            state.history.pop();
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
            showStep('step-waitlist');
        } else {
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

        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Routing to Facility Desk...';

        const leadId = generateLeadId(config.partnerPrefix || 'RN');
        state.leadData.leadId = leadId;
        state.leadData.submittedAt = new Date().toISOString();
        state.leadData.leadCategory = 'commercial_qualified';

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

        // 1. Save locally to browser
        saveLead(config.storageKey || 'labelorigin_leads', state.leadData);

        // 2. Dispatch to FormSubmit (email to ranklydesign@gmail.com, cc facility if available)
        const emailPayload = {
            _subject: `[LabelOrigin Lead] ${config.partnerName} Formulation Inquiry: ${state.leadData.companyName || state.leadData.contactName}`,
            _template: 'table',
            _captcha: 'false',
            "Partner Facility": config.partnerName,
            "Vertical Slug": config.partnerSlug || 'General',
            "Lead ID": state.leadData.leadId,
            "Contact Name": state.leadData.contactName,
            "Company / Brand": state.leadData.companyName,
            "Email Address": state.leadData.email,
            "Phone Number": state.leadData.phone,
            "Business Type": state.leadData.businessType,
            "Order Volume Tier": state.leadData.volumeLabel,
            "Target Formulation Focus": state.leadData.interestArea,
            "Formulation Requirements": state.leadData.notes || 'None specified',
            "Submission Timestamp": state.leadData.submittedAt
        };

        if (config.facilityEmail) {
            emailPayload._cc = config.facilityEmail;
        }

        await dispatchLead(emailPayload, state.leadData);

        // Render Success Step
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

        const emailPayload = {
            _subject: `[LabelOrigin Waitlist] ${config.partnerName} Small-Batch Lead: ${state.leadData.email}`,
            _template: 'table',
            _captcha: 'false',
            "Partner Facility": config.partnerName,
            "Lead ID": state.leadData.leadId,
            "Inquiry Type": "Small-Batch Incubator Waitlist",
            "Contact Email": state.leadData.email,
            "Brand Concept": state.leadData.brandConcept || 'None specified',
            "Selected Volume": state.leadData.volumeLabel || 'Under MOQ',
            "Submission Timestamp": state.leadData.submittedAt
        };

        await dispatchLead(emailPayload, state.leadData);

        renderWaitlistSuccess();
        showStep('step-success-waitlist');
    }

    async function dispatchLead(emailPayload, rawLead) {
        // 1. Post to local server if running in dev mode
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocalhost) {
            try {
                await fetch('/api/submit-lead', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(rawLead)
                });
            } catch (e) {
                // Local dev server only
            }
        }

        // 2. Optional external webhook
        if (config.webhookUrl) {
            try {
                await fetch(config.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(rawLead),
                    mode: 'no-cors'
                });
            } catch (err) {
                console.warn('[Funnel] Webhook note:', err);
            }
        }

        // 3. Dispatch to FormSubmit for live inbox delivery
        try {
            const res = await fetch(FORM_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(emailPayload)
            });
            const result = await res.json();
            console.info('[Funnel Dispatch] FormSubmit Response:', result);
        } catch (err) {
            console.warn('[Funnel Dispatch] Remote dispatch note:', err);
        }
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
