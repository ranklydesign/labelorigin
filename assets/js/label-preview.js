/*
 * Label preview — "See your brand on the bottle".
 * Client-side only: nothing typed here leaves the browser until the visitor
 * submits the lead form. The mockup is an inline SVG; "Download my mockup"
 * rasterizes it to a PNG on a canvas. The CTA carries the choices to the
 * /wholesale/ sample-request form via URL params (or prefills it directly
 * when the tool sits on the same page), so the lead_message records the
 * product interest. No new form endpoint, no backend, no storage.
 *
 * GA4: preview_started (first interaction, once), preview_downloaded and
 * preview_cta. preview_cta fires through the existing contact.js listener
 * (a[data-ga-event]); the other two fire here with the same consent gate
 * and UTM merge.
 */
(function () {
    'use strict';

    var PRODUCTS = {
        serum:    { label: 'Serum dropper',      bottle: 'Facial Serum' },
        cream:    { label: 'Cream jar',          bottle: 'Face Cream' },
        cleanser: { label: 'Cleanser pump',      bottle: 'Gentle Cleanser' },
        lotion:   { label: 'Body lotion tube',   bottle: 'Body Lotion' },
        spraytan: { label: 'Spray-tan bottle',   bottle: 'Sunless Tanning Solution' }
    };

    var PALETTES = {
        'cream-gold':  { label: 'Cream / gold',  bg: '#f7f1e3', ink: '#2b2118', accent: '#8a6d3b', rule: '#8a6d3b' },
        'matte-black': { label: 'Matte black',   bg: '#1d2027', ink: '#faf8f4', accent: '#a8895a', rule: '#a8895a' },
        'white-sage':  { label: 'White / sage',  bg: '#ffffff', ink: '#3d4a3f', accent: '#7d9b7e', rule: '#7d9b7e' },
        'blush':       { label: 'Blush',         bg: '#f6e8e4', ink: '#5a2e2e', accent: '#c08a80', rule: '#c08a80' }
    };

    var PRODUCT_ORDER = ['serum', 'cream', 'cleanser', 'lotion', 'spraytan'];
    var PALETTE_ORDER = ['cream-gold', 'matte-black', 'white-sage', 'blush'];

    var BOTTLE_GLASS = '#f3efe7';
    var BOTTLE_LINE = '#cfc4ab';

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* Bottle silhouettes. viewBox 0 0 200 300. Each returns the bottle body
       + cap shapes (label drawn separately on top). No sizes or volumes. */
    function bottleShapes(key, accent) {
        switch (key) {
            case 'serum':
                return '' +
                    '<rect x="84" y="58" width="32" height="38" rx="5" fill="' + accent + '"/>' +
                    '<rect x="88" y="94" width="24" height="18" fill="' + BOTTLE_GLASS + '" stroke="' + BOTTLE_LINE + '"/>' +
                    '<rect x="75" y="110" width="50" height="152" rx="9" fill="' + BOTTLE_GLASS + '" stroke="' + BOTTLE_LINE + '"/>';
            case 'cream':
                return '' +
                    '<rect x="52" y="110" width="96" height="30" rx="8" fill="' + accent + '"/>' +
                    '<rect x="55" y="138" width="90" height="124" rx="14" fill="' + BOTTLE_GLASS + '" stroke="' + BOTTLE_LINE + '"/>';
            case 'cleanser':
                return '' +
                    '<rect x="70" y="56" width="60" height="14" rx="6" fill="' + accent + '"/>' +
                    '<rect x="96" y="68" width="8" height="28" fill="' + accent + '"/>' +
                    '<rect x="88" y="94" width="24" height="18" fill="' + BOTTLE_GLASS + '" stroke="' + BOTTLE_LINE + '"/>' +
                    '<rect x="70" y="110" width="60" height="152" rx="10" fill="' + BOTTLE_GLASS + '" stroke="' + BOTTLE_LINE + '"/>';
            case 'lotion':
                return '' +
                    '<rect x="68" y="88" width="64" height="152" rx="18" fill="' + BOTTLE_GLASS + '" stroke="' + BOTTLE_LINE + '"/>' +
                    '<rect x="78" y="240" width="44" height="22" rx="4" fill="' + accent + '"/>';
            case 'spraytan':
                return '' +
                    '<rect x="82" y="62" width="48" height="32" rx="6" fill="' + accent + '"/>' +
                    '<rect x="68" y="68" width="16" height="10" rx="3" fill="' + accent + '"/>' +
                    '<path d="M82 94 L82 78 L96 78 L96 94 Z" fill="' + accent + '"/>' +
                    '<rect x="90" y="92" width="20" height="18" fill="' + BOTTLE_GLASS + '" stroke="' + BOTTLE_LINE + '"/>' +
                    '<rect x="68" y="108" width="64" height="154" rx="10" fill="' + BOTTLE_GLASS + '" stroke="' + BOTTLE_LINE + '"/>';
            default:
                return '';
        }
    }

    /* Label placement per product: [x, y, width, height, brandY, productY]. */
    function labelBox(key) {
        switch (key) {
            case 'serum':    return [75, 148, 50, 72, 172, 196];
            case 'cream':    return [60, 162, 80, 62, 184, 206];
            case 'cleanser': return [70, 148, 60, 72, 172, 196];
            case 'lotion':   return [68, 128, 64, 82, 156, 182];
            case 'spraytan': return [68, 148, 64, 72, 172, 196];
            default:         return [70, 148, 60, 72, 172, 196];
        }
    }

    function buildSvg(brand, productKey, paletteKey) {
        var p = PALETTES[paletteKey] || PALETTES['cream-gold'];
        var prod = PRODUCTS[productKey] || PRODUCTS.serum;
        var box = labelBox(productKey);
        var name = (brand || '').trim() || 'Your Spa';
        var brandSize = name.length > 18 ? 11 : (name.length > 12 ? 14 : 16);
        var svg = '' +
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300" role="img" aria-label="Mockup of a ' + esc(prod.label) + ' labelled ' + esc(name) + '">' +
            '<g transform="translate(100 159) scale(1.24) translate(-100 -159)">' +
            bottleShapes(productKey, p.accent) +
            '<rect x="' + box[0] + '" y="' + box[1] + '" width="' + box[2] + '" height="' + box[3] + '" fill="' + p.bg + '" stroke="' + p.rule + '" stroke-width="1"/>' +
            '<text x="100" y="' + box[4] + '" text-anchor="middle" font-family="Georgia, serif" font-size="' + brandSize + '" fill="' + p.ink + '" textLength="' + (box[2] - 8) + '" lengthAdjust="spacingAndGlyphs">' + esc(name) + '</text>' +
            '<line x1="' + (100 - (box[2] / 2 - 12)) + '" y1="' + (box[4] + 10) + '" x2="' + (100 + (box[2] / 2 - 12)) + '" y2="' + (box[4] + 10) + '" stroke="' + p.rule + '" stroke-width="1"/>' +
            '<text x="100" y="' + box[5] + '" text-anchor="middle" font-family="Georgia, serif" font-size="8.5" letter-spacing="1.5" fill="' + p.ink + '" textLength="' + (box[2] - 8) + '" lengthAdjust="spacingAndGlyphs">' + esc(prod.bottle.toUpperCase()) + '</text>' +
            '</g></svg>';
        return svg;
    }

    function firePreviewEvent(name) {
        if (!window.LabelOriginConsent || !window.LabelOriginConsent.accepted()) return;
        if (typeof window.gtag !== 'function') return;
        var utm = (typeof window.LabelOriginUTM === 'function') ? window.LabelOriginUTM() : {};
        window.gtag('event', name, Object.assign({ page_path: window.location.pathname }, utm));
    }

    function params() {
        try { return new URLSearchParams(window.location.search); }
        catch (e) { return null; }
    }

    function initSection(section) {
        var brandInput = section.querySelector('.lp-brand-input');
        var previewEl = section.querySelector('.lp-preview');
        var downloadBtn = section.querySelector('.lp-download');
        var cta = section.querySelector('.lp-cta');
        var form = document.getElementById('sample-request-form');
        if (!brandInput || !previewEl) return;

        var state = { brand: '', product: 'serum', palette: 'cream-gold' };
        var started = false;

        function markStarted() {
            if (started) return;
            started = true;
            firePreviewEvent('preview_started');
        }

        function syncChips() {
            section.querySelectorAll('.lp-chip').forEach(function (chip) {
                var input = chip.querySelector('input');
                if (input) chip.classList.toggle('is-selected', !!input.checked);
            });
        }

        function currentState() {
            var product = section.querySelector('input[name="lp-product"]:checked');
            var palette = section.querySelector('input[name="lp-style"]:checked');
            return {
                brand: (brandInput.value || '').trim(),
                product: product ? product.value : 'serum',
                palette: palette ? palette.value : 'cream-gold'
            };
        }

        function render() {
            state = currentState();
            previewEl.innerHTML = buildSvg(state.brand, state.product, state.palette);
            syncChips();
            var summary = section.querySelector('.lp-summary-text');
            if (summary) {
                var prod = PRODUCTS[state.product] || PRODUCTS.serum;
                var pal = PALETTES[state.palette] || PALETTES['cream-gold'];
                summary.textContent = prod.bottle + ' · ' + pal.label;
            }
            if (cta) {
                if (form) {
                    cta.setAttribute('href', '#sample-request');
                } else {
                    var q = new URLSearchParams();
                    if (state.brand) q.set('brand', state.brand);
                    q.set('product', state.product);
                    q.set('style', state.palette);
                    var base = cta.getAttribute('data-lp-base') || '/wholesale/';
                    cta.setAttribute('href', base + '?' + q.toString());
                }
            }
        }

        function previewLine() {
            var prod = PRODUCTS[state.product] || PRODUCTS.serum;
            var pal = PALETTES[state.palette] || PALETTES['cream-gold'];
            var line = 'Label preview — ' + prod.bottle + ', ' + pal.label.toLowerCase() + ' label.';
            if (state.brand) line = 'Label preview — ' + state.brand + ': ' + prod.bottle + ', ' + pal.label.toLowerCase() + ' label.';
            return line;
        }

        function prefillForm() {
            if (!form) return;
            var company = document.getElementById('sr-company');
            var needs = document.getElementById('sr-needs');
            if (company && state.brand && !company.value) company.value = state.brand;
            if (needs) {
                var line = previewLine();
                if (!needs.value) needs.value = line;
                else if (needs.value.indexOf('Label preview') !== 0) needs.value = line + '\n' + needs.value;
            }
        }

        brandInput.addEventListener('input', function () { markStarted(); render(); });
        section.querySelectorAll('input[name="lp-product"], input[name="lp-style"]').forEach(function (input) {
            input.addEventListener('change', function () { markStarted(); render(); });
        });

        if (downloadBtn) {
            downloadBtn.addEventListener('click', function () {
                markStarted();
                firePreviewEvent('preview_downloaded');
                var svgText = buildSvg(state.brand, state.product, state.palette)
                    .replace('<svg ', '<svg width="600" height="900" ');
                var blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
                var url = URL.createObjectURL(blob);
                var img = new Image();
                img.onload = function () {
                    var canvas = document.createElement('canvas');
                    canvas.width = 600; canvas.height = 900;
                    var ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#faf8f4';
                    ctx.fillRect(0, 0, 600, 900);
                    ctx.drawImage(img, 0, 0, 600, 900);
                    URL.revokeObjectURL(url);
                    canvas.toBlob(function (png) {
                        if (!png) return;
                        var pngUrl = URL.createObjectURL(png);
                        var a = document.createElement('a');
                        a.href = pngUrl;
                        a.download = 'my-label-mockup.png';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setTimeout(function () { URL.revokeObjectURL(pngUrl); }, 5000);
                    }, 'image/png');
                };
                img.onerror = function () { URL.revokeObjectURL(url); };
                img.src = url;
            });
        }

        if (cta && form) {
            cta.addEventListener('click', function (e) {
                e.preventDefault();
                markStarted();
                prefillForm();
                var target = document.getElementById('sample-request');
                if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth' });
            });
        }

        /* Prefill from URL params (arriving from the homepage or the
           /label-preview/ page). Params win; nothing is stored anywhere. */
        var q = params();
        if (q) {
            var b = q.get('brand');
            var pr = q.get('product');
            var st = q.get('style');
            if (b) brandInput.value = b.slice(0, 40);
            if (pr && PRODUCTS[pr]) {
                var prInput = section.querySelector('input[name="lp-product"][value="' + pr + '"]');
                if (prInput) prInput.checked = true;
            }
            if (st && PALETTES[st]) {
                var stInput = section.querySelector('input[name="lp-style"][value="' + st + '"]');
                if (stInput) stInput.checked = true;
            }
            render();
            if (form && (b || pr || st)) prefillForm();
        } else {
            render();
        }
    }

    function init() {
        document.querySelectorAll('.lp-section').forEach(initSection);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* Test hook only — inert in the browser (module is undefined there). */
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { buildSvg: buildSvg, PRODUCTS: PRODUCTS, PALETTES: PALETTES };
    }
})();
