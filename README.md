# LabelOrigin: B2B Lead-Generation Agency

**LabelOrigin** is a B2B lead-generation agency for manufacturers and white-label brands. This repo is the agency site plus the client funnels (Renaud Naturals is the flagship client), built with plain HTML5, CSS3, and Vanilla JavaScript. Pages load fast with no framework bloat. The default theme is light, with a dark theme available through the toggle in the bottom-right corner (`assets/js/theme.js`; all colors are tokens at the top of `style.css`).

---

## 1. Directory & File Structure

This architecture is optimized for 100% free static hosting on platforms like **Cloudflare Pages**, **GitHub Pages**, **Vercel**, or standard Nginx/Apache servers while guaranteeing clean URLs:

```text
website/
├── index.html                   # Root B2B Marketplace & Verified Category Directory
├── style.css                    # Shared Global Dark-Neon Design System
├── 404.html                     # Styled 404 fallback page
│
├── renaud/                      # Isolated Client Funnel (labelorigin.com/renaud)
│   ├── index.html               # Multi-step qualification funnel
│   └── renaud.css               # Funnel-specific layout & micro-animations
│
├── supplements/                 # Expansion Vertical Portal (labelorigin.com/supplements)
│   └── index.html               # Contract nutraceutical qualification & priority queue
│
├── apparel/                     # Expansion Vertical Portal (labelorigin.com/apparel)
│   └── index.html               # Cut & sew blank apparel qualification portal
│
├── assets/
│   └── js/
│       ├── main.js              # Real-time search, category filters, and dual inbound forms
│       └── funnel.js            # Modular logic gate engine (step navigation, webhook dispatch)
│
└── README.md                    # Architecture, Webhook Integration, & Clone-and-Deploy Manual
```

---

## 2. Core Strategic Mechanics

### A. Zero Ad-Spend Leakage on Partner Funnels
When Renaud Naturals runs paid traffic (Meta Ads, Google Search, LinkedIn B2B) to `labelorigin.com/renaud`, the visitor lands on an isolated commercial funnel:
- **No global header menu** that lets prospective buyers wander off to competitor labs.
- Every pixel focuses on building trust and moving the buyer through the 4-step pre-qualification gate.

### B. Automated Two-Bucket Lead Routing Logic Gate
Commercial manufacturing facilities waste significant operational time handling non-viable inquiries. With Renaud Naturals' verified wholesale minimum of **12+ units** for stock formulas and **250+ units** for custom formulation, LabelOrigin routes prospects programmatically:

1. **Bucket A (Commercial Qualified — 12+ units):**
   - User selects `12 – 48 units` (Starter Stock Wholesale), `50 – 249 units`, `250 – 1,000+ units` (Custom Formulation), or `Bulk Gallons & Backbar (0.5 oz to 5 gal)`.
   - Moves to Step 3 (Program Selection: Stock Formula + Your Label, Custom Formulation, Massage & Spa Backbar, or Sass-ee Sunless).
   - Reaches the Commercial Application Form (Step 4).
   - Generates a unique lead reference ID (e.g., `RN-2026-9812`).
   - Dispatches the lead via Webhook directly to Arch Jain's desk (`Arch@RenaudNaturals.com`) while preserving a copy locally.

2. **Bucket B (Sub-Wholesale / Consumer Exploration — < 12 units):**
   - User selects `Under 12 units / Consumer inquiry`.
   - The engine automatically routes them to the **Small-Batch Founder Waitlist** (or direct retail purchase at `RenaudNaturals.com`).
   - Renaud's wholesale desk never receives non-viable retail inquiries.
   - **LabelOrigin** captures the founder email and concept into its owned database for lower-MOQ pooled runs.

### C. UX Improvements Over Crude Alerts
- Standard browser `alert()` dialogs have been eliminated.
- Replaced with **native confirmation cards** displaying:
  - Custom Reference Lead ID
  - Routed Facility Name
  - Selected Volume Tier and Program
  - Summary of contact details
  - SLA expectation ("Lab account manager reviews within 1 business day")
- **Step Navigation History ("← Previous Step")**: Buyers can navigate backward without restarting the questionnaire.
- **Visual Progress Bar**: Step indicators dynamically update as users advance.

---

## 3. Webhook Integration Guide (Make, Zapier, Formspree, or Google Sheets)

Every funnel page includes a configuration object:

```html
<script>
    window.FunnelConfig = {
        partnerName: 'Renaud Naturals',
        partnerPrefix: 'RN',
        partnerSlug: 'renaud',
        storageKey: 'labelorigin_renaud_leads',
        waitlistKey: 'labelorigin_small_batch_waitlist',
        webhookUrl: 'https://formspree.io/f/YOUR_ENDPOINT_ID' // Paste your webhook here!
    };
</script>
<script src="../assets/js/funnel.js"></script>
```

### Supported Webhook Services:
1. **Formspree / Getform**: Simply paste your form endpoint into `webhookUrl`. Leads will be emailed directly to your inbox.
2. **Make.com / Zapier**: Create a Webhook trigger, copy the webhook URL into `webhookUrl`. In Make/Zapier, map fields to:
   - Email notifications to the manufacturer (e.g. `ranklydesign@gmail.com` or partner contact).
   - Google Sheet row appending.
   - Slack / Discord commercial alert channels.
3. **Local Storage Fallback**: Even without an active webhook, leads are automatically persisted in the browser's `localStorage` (`labelorigin_renaud_leads` or `labelorigin_small_batch_waitlist`), so no testing lead is ever lost.

---

## 4. Clone-and-Deploy Expansion Manual

When onboarding a new manufacturing partner:

1. **Duplicate the Funnel Directory**:
   - Copy `/renaud/` to `/your-partner-slug/` (e.g., `/botanicals/`).
2. **Update Partner Metadata**:
   - In `/your-partner-slug/index.html`, adjust the page title, trust specs (e.g., `Est. 2012`, `Organic Hemp`, `Facility Location`), and the configuration block:
   ```javascript
   window.FunnelConfig = {
       partnerName: 'Apex Botanical Labs',
       partnerPrefix: 'AB',
       partnerSlug: 'botanicals',
       storageKey: 'labelorigin_botanicals_leads',
       waitlistKey: 'labelorigin_small_batch_waitlist',
       webhookUrl: 'https://your-webhook-endpoint.com'
   };
   ```
3. **Activate the Vertical on the Root Directory (`index.html`)**:
   - Open `/index.html`.
   - Update the status tag from `status-soon` to `status-active` (`🟢 Active Partner Portal`).
   - Change the button link to `./your-partner-slug/`.

---

## 5. Deployment Options

### Deploying to Cloudflare Pages (Recommended)
1. Push this directory to a GitHub repository.
2. In Cloudflare Pages, select **Create Application** &rarr; **Connect to Git**.
3. Set **Build command** to blank (none needed).
4. Set **Build output directory** to `/` (root).
5. Clean URLs will work automatically (`https://labelorigin.com/renaud`).

### Deploying to GitHub Pages
1. Go to repository **Settings** &rarr; **Pages**.
2. Select `Deploy from a branch` &rarr; `main` &rarr; `/(root)`.
3. Save.

---

## 6. Ownership & Inquiries
- **Operational Ownership**: [www.ranklydesign.com](https://www.ranklydesign.com)
- **Manufacturer Inquiries & Commercial Liaison**: [ranklydesign@gmail.com](mailto:ranklydesign@gmail.com)
- **Copyright**: &copy; 2026 LabelOrigin.
