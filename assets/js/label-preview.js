/*
 * Label preview V2 — "print-on-demand style for private label".
 * Client-side only: nothing typed or uploaded here leaves the browser
 * until the visitor submits the lead form, and the form sends text only —
 * an uploaded logo file is never uploaded, fetched, or posted anywhere.
 *
 * What it does:
 *  - Category tabs (Facial / Body / Tanning) matching Renaud's catalog,
 *    13 products, each drawn as a distinct original SVG container
 *    (white-label art — nothing copied from Renaud's labels or logo).
 *  - Label layout on every product: round logo badge at top, brand name,
 *    serif product name, small botanical accent.
 *  - Upload your logo (PNG/JPG/SVG, max 2 MB): read with FileReader and
 *    rasterized to a PNG data URL through an offscreen canvas at load
 *    time, so the PNG-download canvas is never tainted. Drag to position,
 *    size slider, logo-only vs logo + name toggles.
 *  - "See your line": a 3-product row (same brand, palette, logo).
 *  - PNG download (600x900) includes the logo when one is loaded.
 *  - "Request samples" carries category + product + style + logo state
 *    into the /wholesale/ sample-request form.
 *
 * GA4: preview_started (first interaction, once), preview_downloaded,
 * preview_logo_uploaded, and preview_cta (fires through the existing
 * contact.js listener on a[data-ga-event]). All consent-gated; the
 * logo event carries no filename or file data.
 */
(function () {
    'use strict';

    var CATEGORIES = {
        facial:  { label: 'Facial',  products: ['eyecream', 'cleanser', 'exfoliant', 'moisturizer', 'serum', 'tonique'] },
        body:    { label: 'Body',    products: ['bodylotion', 'bodywash', 'bodyscrub', 'bodysouffle', 'handcream', 'barsoap'] },
        tanning: { label: 'Tanning', products: ['spraytan'] }
    };
    var CATEGORY_ORDER = ['facial', 'body', 'tanning'];

    /* label: chip text. bottle: product name printed on the label.
       box: [x, y, w, h, badgeR, brandSize, productSize] — label rect and
       type sizes in viewBox units. topView: the label is a circle seen
       from above (body soufflé). */
    var PRODUCTS = {
        eyecream:    { cat: 'facial',  label: 'Eye cream',          bottle: 'Eye Cream',                  box: [86, 128, 28, 84, 6, 7.5, 5.5] },
        cleanser:    { cat: 'facial',  label: 'Facial cleanser',     bottle: 'Facial Cleanser',            box: [70, 158, 60, 72, 10, 12, 7] },
        exfoliant:   { cat: 'facial',  label: 'Exfoliant / masque',  bottle: 'Exfoliant Masque',          box: [74, 128, 52, 72, 9, 11, 6.5] },
        moisturizer: { cat: 'facial',  label: 'Moisturizer',         bottle: 'Moisturizer',                box: [60, 148, 80, 74, 11, 13, 7.5] },
        serum:       { cat: 'facial',  label: 'Serum',               bottle: 'Facial Serum',               box: [74, 138, 52, 82, 10, 12, 7] },
        tonique:     { cat: 'facial',  label: 'Tonique',             bottle: 'Tonique',                    box: [72, 138, 56, 82, 10, 12, 7] },
        bodylotion:  { cat: 'body',    label: 'Body lotion',         bottle: 'Body Lotion',                box: [72, 138, 56, 84, 10, 12, 7] },
        bodywash:    { cat: 'body',    label: 'Body wash',           bottle: 'Body Wash',                  box: [72, 148, 56, 74, 10, 12, 7] },
        bodyscrub:   { cat: 'body',    label: 'Body scrub',          bottle: 'Body Scrub',                 box: [60, 158, 80, 62, 9, 12, 7] },
        bodysouffle: { cat: 'body',    label: 'Body soufflé',        bottle: 'Body Soufflé',               box: [0, 0, 0, 0, 9, 11, 6.5], topView: true },
        handcream:   { cat: 'body',    label: 'Hand cream',          bottle: 'Hand Cream',                 box: [68, 178, 64, 50, 7, 9, 6] },
        barsoap:     { cat: 'body',    label: 'Bar soap',            bottle: 'Bar Soap',                   box: [62, 148, 76, 72, 10, 12, 7] },
        spraytan:    { cat: 'tanning', label: 'Spray-tan solution',  bottle: 'Spray-tan solution',   box: [70, 138, 60, 82, 10, 12, 7] }
    };
    var PRODUCT_ORDER = ['eyecream', 'cleanser', 'exfoliant', 'moisturizer', 'serum', 'tonique',
                         'bodylotion', 'bodywash', 'bodyscrub', 'bodysouffle', 'handcream', 'barsoap',
                         'spraytan'];

    /* Old v1 product keys, for links/params built before V2. */
    var LEGACY_PRODUCT_MAP = { cream: 'moisturizer', lotion: 'bodylotion' };

    var PALETTES = {
        'cream-gold':  { label: 'Cream / gold',  bg: '#f7f1e3', ink: '#2b2118', accent: '#8a6d3b', rule: '#8a6d3b' },
        'matte-black': { label: 'Matte black',   bg: '#1d2027', ink: '#faf8f4', accent: '#a8895a', rule: '#a8895a' },
        'white-sage':  { label: 'White / sage',  bg: '#ffffff', ink: '#3d4a3f', accent: '#7d9b7e', rule: '#7d9b7e' },
        'blush':       { label: 'Blush',         bg: '#f6e8e4', ink: '#5a2e2e', accent: '#c08a80', rule: '#c08a80' }
    };
    var PALETTE_ORDER = ['cream-gold', 'matte-black', 'white-sage', 'blush'];

    var LINE_TRIO = {
        facial:  ['cleanser', 'serum', 'moisturizer'],
        body:    ['bodylotion', 'bodywash', 'bodyscrub'],
        /* Tanning has one product — the row shows that one bottle, and the
           note under it (see render) says the full SASS-EE range is wider. */
        tanning: ['spraytan']
    };

    var MAX_LOGO_BYTES = 2 * 1024 * 1024;
    var LOGO_TYPES = { 'image/png': 1, 'image/jpeg': 1, 'image/svg+xml': 1 };

    var BOTTLE_LINE = '#cfc4ab';
    var GLASS_EDGE = '#d8d2c4';

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* ---- SVG pieces -------------------------------------------------- */

    /* Gradient defs, ids suffixed with uid so several SVGs can share a page. */
    function defs(uid) {
        return '<defs>' +
            '<linearGradient id="lp-silver-' + uid + '" x1="0" y1="0" x2="1" y2="0">' +
                '<stop offset="0" stop-color="#e9eaec"/><stop offset="0.35" stop-color="#b7bac0"/>' +
                '<stop offset="0.6" stop-color="#f5f6f7"/><stop offset="1" stop-color="#979aa0"/></linearGradient>' +
            '<linearGradient id="lp-silver-d-' + uid + '" x1="0" y1="0" x2="1" y2="0">' +
                '<stop offset="0" stop-color="#c9ccd1"/><stop offset="0.5" stop-color="#878b92"/>' +
                '<stop offset="1" stop-color="#c2c5ca"/></linearGradient>' +
            '<linearGradient id="lp-amber-' + uid + '" x1="0" y1="0" x2="0" y2="1">' +
                '<stop offset="0" stop-color="#eab968" stop-opacity="0.92"/>' +
                '<stop offset="1" stop-color="#c07f22" stop-opacity="0.92"/></linearGradient>' +
            '<linearGradient id="lp-frost-' + uid + '" x1="0" y1="0" x2="0" y2="1">' +
                '<stop offset="0" stop-color="#ffffff" stop-opacity="0.96"/>' +
                '<stop offset="1" stop-color="#ebe8e2" stop-opacity="0.96"/></linearGradient>' +
            '<linearGradient id="lp-kraft-' + uid + '" x1="0" y1="0" x2="1" y2="0">' +
                '<stop offset="0" stop-color="#d3b586"/><stop offset="0.55" stop-color="#c2a172"/>' +
                '<stop offset="1" stop-color="#b08d5c"/></linearGradient>' +
            '<linearGradient id="lp-scrub-' + uid + '" x1="0" y1="0" x2="0" y2="1">' +
                '<stop offset="0" stop-color="#efe4cb"/><stop offset="1" stop-color="#dcc9a0"/></linearGradient>' +
            '<radialGradient id="lp-rim-' + uid + '" cx="0.5" cy="0.5" r="0.5">' +
                '<stop offset="0.72" stop-color="#f2f3f4"/><stop offset="0.92" stop-color="#c6c9cd"/>' +
                '<stop offset="1" stop-color="#9a9da3"/></radialGradient>' +
            '</defs>';
    }

    function silver(uid) { return 'url(#lp-silver-' + uid + ')'; }
    function silverDark(uid) { return 'url(#lp-silver-d-' + uid + ')'; }

    /* Small botanical sprig, centred at (cx, cy), drawn in the accent. */
    function sprig(cx, cy, accent, s) {
        return '<g transform="translate(' + cx + ' ' + cy + ') scale(' + s + ')" stroke="' + accent + '" stroke-width="1" fill="none">' +
            '<path d="M0 5 C 0 1, 0 -1, 0 -5"/>' +
            '<path d="M0 -1 C -3 -3, -5 -3, -6 0 C -4 1, -2 1, 0 -1 Z" fill="' + accent + '" stroke="none"/>' +
            '<path d="M0 -2 C 3 -4, 5 -4, 6 -1 C 4 0, 2 0, 0 -2 Z" fill="' + accent + '" stroke="none"/></g>';
    }

    /* Container silhouettes. viewBox 0 0 200 300; shapes span roughly
       y 48–266 unscaled (the 1.24 scale about (100,159) brings them to
       ~85% of the box height). Original drawings — no label art copied. */
    function bottleShapes(key, uid) {
        switch (key) {
            case 'eyecream': /* slim silver airless pump */
                return '' +
                    '<ellipse cx="100" cy="268" rx="26" ry="4" fill="#000" opacity="0.07"/>' +
                    '<rect x="91" y="50" width="18" height="12" rx="2" fill="' + silver(uid) + '"/>' +
                    '<rect x="104" y="52" width="16" height="7" rx="2" fill="' + silverDark(uid) + '"/>' +
                    '<rect x="94" y="62" width="12" height="12" fill="' + silverDark(uid) + '"/>' +
                    '<rect x="85" y="74" width="30" height="188" rx="5" fill="' + silver(uid) + '"/>' +
                    '<rect x="88" y="80" width="4" height="176" rx="2" fill="#fff" opacity="0.45"/>' +
                    '<rect x="110" y="80" width="3" height="176" fill="#000" opacity="0.08"/>';
            case 'cleanser': /* clear foaming-pump bottle, amber liquid */
                return '' +
                    '<ellipse cx="100" cy="268" rx="46" ry="4" fill="#000" opacity="0.07"/>' +
                    '<rect x="64" y="52" width="72" height="14" rx="7" fill="#fbfaf7" stroke="' + GLASS_EDGE + '"/>' +
                    '<rect x="64" y="56" width="26" height="10" rx="4" fill="#fbfaf7" stroke="' + GLASS_EDGE + '"/>' +
                    '<circle cx="66" cy="70" r="3" fill="#fff" opacity="0.9"/><circle cx="73" cy="72" r="2.2" fill="#fff" opacity="0.9"/>' +
                    '<rect x="96" y="66" width="8" height="20" fill="#fbfaf7" stroke="' + GLASS_EDGE + '"/>' +
                    '<rect x="88" y="86" width="24" height="10" rx="2" fill="' + silver(uid) + '"/>' +
                    '<rect x="66" y="96" width="68" height="166" rx="12" fill="#fff" fill-opacity="0.22" stroke="' + GLASS_EDGE + '"/>' +
                    '<path d="M70 148 L70 252 Q70 258 76 258 L124 258 Q130 258 130 252 L130 148 Q130 142 124 142 L76 142 Q70 142 70 148 Z" fill="url(#lp-amber-' + uid + ')"/>' +
                    '<ellipse cx="100" cy="142" rx="30" ry="4" fill="#eab968" opacity="0.9"/>' +
                    '<rect x="74" y="100" width="8" height="150" rx="4" fill="#fff" opacity="0.5"/>' +
                    '<rect x="124" y="104" width="4" height="146" fill="#000" opacity="0.05"/>';
            case 'exfoliant': /* white squeeze tube standing on a flip cap */
                return '' +
                    '<ellipse cx="100" cy="268" rx="42" ry="4" fill="#000" opacity="0.07"/>' +
                    '<rect x="72" y="58" width="56" height="10" rx="3" fill="#e9e6df" stroke="' + GLASS_EDGE + '"/>' +
                    '<path d="M72 68 L128 68 L131 236 L69 236 Z" fill="#fdfcf9" stroke="' + GLASS_EDGE + '"/>' +
                    '<path d="M78 72 L82 232 L88 232 L84 72 Z" fill="#fff" opacity="0.7"/>' +
                    '<path d="M120 72 L124 232 L118 232 L116 72 Z" fill="#000" opacity="0.04"/>' +
                    '<rect x="76" y="236" width="48" height="24" rx="4" fill="' + silver(uid) + '"/>' +
                    '<rect x="76" y="236" width="48" height="4" fill="#000" opacity="0.1"/>';
            case 'moisturizer': /* frosted white wide jar, silver lid */
                return '' +
                    '<ellipse cx="100" cy="268" rx="52" ry="4" fill="#000" opacity="0.07"/>' +
                    '<rect x="52" y="94" width="96" height="26" rx="6" fill="' + silver(uid) + '"/>' +
                    '<rect x="52" y="94" width="96" height="6" rx="3" fill="#fff" opacity="0.5"/>' +
                    '<rect x="52" y="116" width="96" height="4" fill="#000" opacity="0.12"/>' +
                    '<rect x="56" y="120" width="88" height="132" rx="14" fill="url(#lp-frost-' + uid + ')" stroke="' + GLASS_EDGE + '"/>' +
                    '<rect x="62" y="128" width="10" height="116" rx="5" fill="#fff" opacity="0.55"/>' +
                    '<rect x="132" y="128" width="6" height="116" fill="#000" opacity="0.04"/>';
            case 'serum': /* white pump bottle */
                return '' +
                    '<ellipse cx="100" cy="268" rx="40" ry="4" fill="#000" opacity="0.07"/>' +
                    '<rect x="74" y="52" width="52" height="12" rx="6" fill="#fbfaf7" stroke="' + GLASS_EDGE + '"/>' +
                    '<rect x="74" y="55" width="20" height="8" rx="3" fill="#fbfaf7" stroke="' + GLASS_EDGE + '"/>' +
                    '<rect x="96" y="64" width="8" height="16" fill="#fbfaf7" stroke="' + GLASS_EDGE + '"/>' +
                    '<rect x="90" y="80" width="20" height="12" fill="' + silver(uid) + '"/>' +
                    '<rect x="72" y="92" width="56" height="170" rx="10" fill="#fdfcf9" stroke="' + GLASS_EDGE + '"/>' +
                    '<rect x="76" y="98" width="7" height="158" rx="3.5" fill="#e9e6df" opacity="0.7"/>' +
                    '<rect x="120" y="98" width="6" height="158" fill="#000" opacity="0.05"/>';
            case 'tonique': /* white bottle, mist / disc top */
                return '' +
                    '<ellipse cx="100" cy="268" rx="44" ry="4" fill="#000" opacity="0.07"/>' +
                    '<rect x="84" y="50" width="32" height="18" rx="5" fill="#fbfaf7" stroke="' + GLASS_EDGE + '"/>' +
                    '<circle cx="100" cy="59" r="2.5" fill="' + silverDark(uid) + '"/>' +
                    '<rect x="86" y="68" width="28" height="8" rx="4" fill="' + silver(uid) + '"/>' +
                    '<rect x="90" y="76" width="20" height="12" fill="#fbfaf7" stroke="' + GLASS_EDGE + '"/>' +
                    '<rect x="68" y="88" width="64" height="174" rx="16" fill="#fdfcf9" stroke="' + GLASS_EDGE + '"/>' +
                    '<rect x="73" y="94" width="8" height="160" rx="4" fill="#e9e6df" opacity="0.7"/>' +
                    '<rect x="124" y="94" width="6" height="160" fill="#000" opacity="0.05"/>';
            case 'bodylotion': /* tall white pump bottle, silver pump */
                return '' +
                    '<ellipse cx="100" cy="268" rx="42" ry="4" fill="#000" opacity="0.07"/>' +
                    '<rect x="72" y="48" width="56" height="12" rx="6" fill="' + silver(uid) + '"/>' +
                    '<rect x="72" y="51" width="22" height="8" rx="3" fill="' + silverDark(uid) + '"/>' +
                    '<rect x="96" y="60" width="8" height="18" fill="' + silver(uid) + '"/>' +
                    '<rect x="90" y="78" width="20" height="12" fill="' + silverDark(uid) + '"/>' +
                    '<rect x="70" y="90" width="60" height="172" rx="12" fill="#fdfcf9" stroke="' + GLASS_EDGE + '"/>' +
                    '<rect x="75" y="96" width="7" height="160" rx="3.5" fill="#e9e6df" opacity="0.7"/>' +
                    '<rect x="122" y="96" width="6" height="160" fill="#000" opacity="0.05"/>';
            case 'bodywash': /* white bullet bottle, silver disc cap */
                return '' +
                    '<ellipse cx="100" cy="268" rx="44" ry="4" fill="#000" opacity="0.07"/>' +
                    '<rect x="86" y="52" width="28" height="20" rx="9" fill="' + silver(uid) + '"/>' +
                    '<rect x="86" y="52" width="28" height="5" rx="2.5" fill="#fff" opacity="0.5"/>' +
                    '<rect x="90" y="72" width="20" height="10" fill="#fdfcf9" stroke="' + GLASS_EDGE + '"/>' +
                    '<path d="M70 262 L70 130 C70 96 84 82 100 82 C116 82 130 96 130 130 L130 262 Z" fill="#fdfcf9" stroke="' + GLASS_EDGE + '"/>' +
                    '<path d="M77 254 L77 132 C77 108 85 94 95 90 L95 254 Z" fill="#e9e6df" opacity="0.55"/>' +
                    '<path d="M123 254 L123 132 C123 108 116 94 108 90 L108 254 Z" fill="#000" opacity="0.04"/>';
            case 'bodyscrub': /* wide clear jar */
                return '' +
                    '<ellipse cx="100" cy="268" rx="52" ry="4" fill="#000" opacity="0.07"/>' +
                    '<rect x="50" y="108" width="100" height="22" rx="6" fill="#fbfaf7" stroke="' + GLASS_EDGE + '"/>' +
                    '<rect x="50" y="126" width="100" height="4" fill="' + silver(uid) + '"/>' +
                    '<rect x="54" y="130" width="92" height="122" rx="12" fill="#fff" fill-opacity="0.2" stroke="' + GLASS_EDGE + '"/>' +
                    '<rect x="58" y="150" width="84" height="98" rx="9" fill="url(#lp-scrub-' + uid + ')"/>' +
                    '<circle cx="72" cy="170" r="2" fill="#b99a67"/><circle cx="92" cy="188" r="2.4" fill="#8a6d3b"/>' +
                    '<circle cx="112" cy="166" r="2" fill="#b99a67"/><circle cx="128" cy="196" r="2.2" fill="#8a6d3b"/>' +
                    '<circle cx="84" cy="216" r="2" fill="#b99a67"/><circle cx="118" cy="228" r="2.4" fill="#8a6d3b"/>' +
                    '<rect x="60" y="136" width="7" height="108" rx="3.5" fill="#fff" opacity="0.5"/>';
            case 'bodysouffle': /* round jar seen from the top */
                return '' +
                    '<circle cx="100" cy="172" r="64" fill="url(#lp-rim-' + uid + ')" stroke="' + GLASS_EDGE + '"/>' +
                    '<circle cx="100" cy="172" r="56" fill="#fbf6ec"/>' +
                    '<path d="M62 158 C 78 146, 92 176, 108 162 C 122 150, 132 168, 140 158" fill="none" stroke="#e8dcc4" stroke-width="3" stroke-linecap="round"/>' +
                    '<path d="M66 186 C 82 176, 96 194, 112 184 C 124 176, 132 188, 138 182" fill="none" stroke="#e8dcc4" stroke-width="3" stroke-linecap="round"/>';
            case 'handcream': /* aluminum screw-lid tin */
                return '' +
                    '<ellipse cx="100" cy="268" rx="46" ry="4" fill="#000" opacity="0.07"/>' +
                    '<rect x="60" y="146" width="80" height="22" rx="8" fill="' + silver(uid) + '"/>' +
                    '<rect x="60" y="146" width="80" height="5" rx="2.5" fill="#fff" opacity="0.5"/>' +
                    '<line x1="64" y1="156" x2="136" y2="156" stroke="#979aa0" stroke-width="1"/>' +
                    '<line x1="64" y1="161" x2="136" y2="161" stroke="#979aa0" stroke-width="1"/>' +
                    '<rect x="64" y="168" width="72" height="72" rx="10" fill="' + silverDark(uid) + '"/>' +
                    '<rect x="68" y="174" width="6" height="60" rx="3" fill="#fff" opacity="0.5"/>' +
                    '<rect x="128" y="174" width="5" height="60" fill="#000" opacity="0.08"/>';
            case 'barsoap': /* kraft box */
                return '' +
                    '<ellipse cx="100" cy="268" rx="48" ry="4" fill="#000" opacity="0.07"/>' +
                    '<rect x="58" y="108" width="84" height="142" rx="4" fill="url(#lp-kraft-' + uid + ')"/>' +
                    '<rect x="58" y="108" width="84" height="18" rx="4" fill="#a8895a" opacity="0.35"/>' +
                    '<line x1="58" y1="126" x2="142" y2="126" stroke="#8a6d3b" stroke-width="1" opacity="0.5"/>' +
                    '<rect x="62" y="114" width="6" height="130" fill="#fff" opacity="0.18"/>';
            case 'spraytan': /* spray-tan solution bottle (SASS-EE) */
                return '' +
                    '<ellipse cx="100" cy="268" rx="46" ry="4" fill="#000" opacity="0.07"/>' +
                    '<rect x="78" y="50" width="44" height="16" rx="4" fill="#34383f"/>' +
                    '<rect x="78" y="50" width="44" height="4" rx="2" fill="#fff" opacity="0.25"/>' +
                    '<rect x="78" y="62" width="44" height="4" fill="' + silver(uid) + '"/>' +
                    '<rect x="88" y="66" width="24" height="12" fill="#fdfcf9" stroke="' + GLASS_EDGE + '"/>' +
                    '<rect x="66" y="78" width="68" height="184" rx="10" fill="#fdfaf3" stroke="' + GLASS_EDGE + '"/>' +
                    '<rect x="71" y="84" width="7" height="172" rx="3.5" fill="#e9e6df" opacity="0.7"/>' +
                    '<rect x="126" y="84" width="6" height="172" fill="#000" opacity="0.05"/>';
            default:
                return '';
        }
    }

    /* Logo geometry. mode 'logo-name': logo sits in the badge, clipped to
       the badge circle. mode 'logo-only': logo spans the label, brand
       name hidden. Returns {x, y, w, h} in viewBox units, or null. */
    function logoRect(state, prod, uid) {
        var logo = state.logo;
        if (!logo || !logo.dataUrl) return null;
        var box = prod.box;
        var size = (logo.size || 100) / 100;
        var w, h, cx, cy;
        if (prod.topView) {
            cx = 100; cy = 172;
            var base = 68 * size;
            if (logo.mode === 'logo-only') base *= 1.25;
            w = base; h = base / logo.aspect;
            if (h > 68) { h = 68; w = h * logo.aspect; }
        } else if (logo.mode === 'logo-only') {
            cx = 100; cy = box[1] + box[3] / 2 - 6;
            var baseW = box[2] * 0.72 * size;
            w = baseW; h = baseW / logo.aspect;
            var maxH = box[3] * 0.55;
            if (h > maxH) { h = maxH; w = h * logo.aspect; }
        } else {
            cx = 100; cy = box[1] + 6 + box[4];
            var d = box[4] * 2 * size;
            w = d; h = d / logo.aspect;
            if (h > d * 1.15) { h = d * 1.15; w = h * logo.aspect; }
        }
        /* Dragged position wins over the default centre. Positions are
           stored per mode, so switching between logo + name and logo only
           restores each mode's own spot instead of resetting it. The plain
           cx/cy pair is kept as a legacy fallback. */
        var storedCx = (logo.mode === 'logo-only') ? logo.cxOnly : logo.cxName;
        var storedCy = (logo.mode === 'logo-only') ? logo.cyOnly : logo.cyName;
        if (typeof storedCx === 'number' && typeof storedCy === 'number') { cx = storedCx; cy = storedCy; }
        else if (typeof logo.cx === 'number' && typeof logo.cy === 'number') { cx = logo.cx; cy = logo.cy; }
        return { x: cx - w / 2, y: cy - h / 2, w: w, h: h, cx: cx, cy: cy };
    }

    /* The label: badge, brand, rule, serif product name, botanical accent.
       uid suffixes the clip-path id so several SVGs can share a page. */
    function labelArt(state, prod, p, uid) {
        var name = (state.brand || '').trim() || 'Your Spa';
        var out = '';
        if (prod.topView) {
            var badgeR = prod.box[4];
            out += '<circle cx="100" cy="172" r="34" fill="' + p.bg + '" stroke="' + p.rule + '" stroke-width="1"/>';
            if (state.logo && state.logo.dataUrl && state.logo.mode !== 'logo-only') {
                var r = logoRect(state, prod, uid);
                out += '<clipPath id="lp-badge-' + uid + '"><circle cx="100" cy="152" r="' + badgeR + '"/></clipPath>' +
                    '<circle cx="100" cy="152" r="' + badgeR + '" fill="' + p.bg + '" stroke="' + p.rule + '" stroke-width="1"/>' +
                    '<image class="lp-logo-img" href="' + state.logo.dataUrl + '" xlink:href="' + state.logo.dataUrl + '" x="' + r.x.toFixed(1) + '" y="' + r.y.toFixed(1) + '" width="' + r.w.toFixed(1) + '" height="' + r.h.toFixed(1) + '" clip-path="url(#lp-badge-' + uid + ')" preserveAspectRatio="xMidYMid meet"/>';
            } else if (state.logo && state.logo.dataUrl) {
                var r2 = logoRect(state, prod, uid);
                out += '<image class="lp-logo-img" href="' + state.logo.dataUrl + '" xlink:href="' + state.logo.dataUrl + '" x="' + r2.x.toFixed(1) + '" y="' + r2.y.toFixed(1) + '" width="' + r2.w.toFixed(1) + '" height="' + r2.h.toFixed(1) + '" preserveAspectRatio="xMidYMid meet"/>';
            } else {
                out += '<circle cx="100" cy="152" r="' + badgeR + '" fill="' + p.bg + '" stroke="' + p.rule + '" stroke-width="1"/>' + sprig(100, 152, p.accent, 1);
            }
            if (!(state.logo && state.logo.dataUrl && state.logo.mode === 'logo-only')) {
                var brandSize = prod.box[5];
                if (name.length > 14) brandSize *= 0.85;
                if (name.length > 20) brandSize *= 0.82;
                out += '<text x="100" y="173" text-anchor="middle" font-family="Georgia, serif" font-size="' + brandSize.toFixed(1) + '" fill="' + p.ink + '" textLength="56" lengthAdjust="spacingAndGlyphs">' + esc(name) + '</text>';
            }
            out += '<line x1="78" y1="179" x2="122" y2="179" stroke="' + p.rule + '" stroke-width="1"/>' +
                '<text x="100" y="189.5" text-anchor="middle" font-family="Georgia, serif" font-size="' + prod.box[6] + '" letter-spacing="1" fill="' + p.ink + '" textLength="56" lengthAdjust="spacingAndGlyphs">' + esc(prod.bottle.toUpperCase()) + '</text>';
            return out;
        }
        var box = prod.box;
        var bx = box[0], by = box[1], bw = box[2], bh = box[3], badgeR = box[4];
        var brandSize = box[5];
        if (name.length > 14) brandSize *= 0.85;
        if (name.length > 20) brandSize *= 0.82;
        var badgeCy = by + 6 + badgeR;
        var brandY = badgeCy + badgeR + brandSize + 2;
        var ruleY = brandY + 6;
        var productY = ruleY + box[6] + 4;
        out += '<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" fill="' + p.bg + '" stroke="' + p.rule + '" stroke-width="1"/>';
        var logoOnly = state.logo && state.logo.dataUrl && state.logo.mode === 'logo-only';
        if (state.logo && state.logo.dataUrl && !logoOnly) {
            var r = logoRect(state, prod, uid);
            out += '<clipPath id="lp-badge-' + uid + '"><circle cx="100" cy="' + badgeCy + '" r="' + badgeR + '"/></clipPath>' +
                '<circle cx="100" cy="' + badgeCy + '" r="' + badgeR + '" fill="' + p.bg + '" stroke="' + p.rule + '" stroke-width="1"/>' +
                '<image class="lp-logo-img" href="' + state.logo.dataUrl + '" xlink:href="' + state.logo.dataUrl + '" x="' + r.x.toFixed(1) + '" y="' + r.y.toFixed(1) + '" width="' + r.w.toFixed(1) + '" height="' + r.h.toFixed(1) + '" clip-path="url(#lp-badge-' + uid + ')" preserveAspectRatio="xMidYMid meet"/>';
        } else if (logoOnly) {
            var r2 = logoRect(state, prod, uid);
            out += '<image class="lp-logo-img" href="' + state.logo.dataUrl + '" xlink:href="' + state.logo.dataUrl + '" x="' + r2.x.toFixed(1) + '" y="' + r2.y.toFixed(1) + '" width="' + r2.w.toFixed(1) + '" height="' + r2.h.toFixed(1) + '" preserveAspectRatio="xMidYMid meet"/>';
        } else {
            out += '<circle cx="100" cy="' + badgeCy + '" r="' + badgeR + '" fill="' + p.bg + '" stroke="' + p.rule + '" stroke-width="1"/>' + sprig(100, badgeCy, p.accent, badgeR / 11);
        }
        if (!logoOnly) {
            out += '<text x="100" y="' + brandY.toFixed(1) + '" text-anchor="middle" font-family="Georgia, serif" font-size="' + brandSize.toFixed(1) + '" fill="' + p.ink + '" textLength="' + (bw - 8) + '" lengthAdjust="spacingAndGlyphs">' + esc(name) + '</text>' +
                '<line x1="' + (100 - (bw / 2 - 12)) + '" y1="' + ruleY.toFixed(1) + '" x2="' + (100 + (bw / 2 - 12)) + '" y2="' + ruleY.toFixed(1) + '" stroke="' + p.rule + '" stroke-width="1"/>';
        }
        out += '<text x="100" y="' + productY.toFixed(1) + '" text-anchor="middle" font-family="Georgia, serif" font-size="' + box[6] + '" letter-spacing="1" fill="' + p.ink + '" textLength="' + (bw - 8) + '" lengthAdjust="spacingAndGlyphs">' + esc(prod.bottle.toUpperCase()) + '</text>';
        if (by + bh - productY > 12) out += sprig(100, by + bh - 5, p.accent, 0.9);
        return out;
    }

    var svgCounter = 0;
    function buildSvg(brand, productKey, paletteKey, logo) {
        var p = PALETTES[paletteKey] || PALETTES['cream-gold'];
        var prod = PRODUCTS[productKey] || PRODUCTS.cleanser;
        var state = { brand: brand, logo: logo || null };
        var uid = productKey + '-' + (svgCounter++);
        var logoOnlyAria = !!(logo && logo.dataUrl && logo.mode === 'logo-only');
        var svg = '' +
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 200 300" role="img" aria-label="Mockup of a ' + esc(prod.label) + (logoOnlyAria ? ' with your logo' : ' labelled ' + esc((brand || '').trim() || 'Your Spa')) + '">' +
            defs(uid) +
            '<g transform="translate(100 159) scale(1.24) translate(-100 -159)">' +
            bottleShapes(productKey, uid) +
            labelArt(state, prod, p, uid) +
            '</g></svg>';
        return svg;
    }

    /* The 3-product "your line" row: three single SVGs, same brand /
       palette / logo. A view only — the PNG download stays single-product. */
    function buildLineSvgs(state) {
        var trio = LINE_TRIO[state.category] || LINE_TRIO.facial;
        return trio.map(function (key) {
            return buildSvg(state.brand, key, state.palette, state.logo);
        });
    }

    function formatPreviewLine(state) {
        var prod = PRODUCTS[state.product] || PRODUCTS.cleanser;
        var pal = PALETTES[state.palette] || PALETTES['cream-gold'];
        var cat = (CATEGORIES[prod.cat] || CATEGORIES.facial).label;
        var line = 'Label preview — ' + cat + ' — ' + prod.bottle + ', ' + pal.label.toLowerCase() + ' label.';
        if ((state.brand || '').trim()) {
            line = 'Label preview — ' + state.brand.trim() + ': ' + cat + ' — ' + prod.bottle + ', ' + pal.label.toLowerCase() + ' label.';
        }
        if (state.logo) {
            var bits = [];
            if (state.logo.mode === 'logo-only') bits.push('logo only');
            if (state.logo.size && state.logo.size !== 100) bits.push(state.logo.size + '%');
            line += ' Logo uploaded: yes' + (bits.length ? ' (' + bits.join(', ') + ')' : '') + '.';
        }
        return line;
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

    /* Rasterize an uploaded logo to a PNG data URL through an offscreen
       canvas. This is what keeps the PNG-download canvas untainted: the
       export path only ever draws PNG data URLs, never the raw file.
       SVGs without width/height get them injected from their viewBox
       (or a square default) before rasterizing. Calls back with
       {dataUrl, aspect} or an error string. */
    function normalizeLogo(dataUrl, type, done) {
        function rasterize(img) {
            try {
                var maxSide = 800;
                var w = img.naturalWidth || img.width;
                var h = img.naturalHeight || img.height;
                if (!w || !h) { done(null, 'That image could not be read — please try a PNG or JPG.'); return; }
                var scale = Math.min(1, maxSide / Math.max(w, h));
                var canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(w * scale));
                canvas.height = Math.max(1, Math.round(h * scale));
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                done({ dataUrl: canvas.toDataURL('image/png'), aspect: canvas.width / canvas.height }, null);
            } catch (e) {
                done(null, 'That image could not be read — please try a PNG or JPG.');
            }
        }
        var img = new Image();
        img.onload = function () {
            if ((img.naturalWidth || 0) > 0) { rasterize(img); return; }
            /* SVG with no usable intrinsic size — inject width/height. */
            if (type === 'image/svg+xml') {
                try {
                    var text = atob(dataUrl.split(',')[1] || '');
                    var vb = text.match(/viewBox\s*=\s*["']([\d.\s]+)["']/);
                    var w = 800, h = 800;
                    if (vb) {
                        var parts = vb[1].trim().split(/\s+/);
                        var vw = parseFloat(parts[2]), vh = parseFloat(parts[3]);
                        if (vw > 0 && vh > 0) { h = Math.round(800 * vh / vw); }
                    }
                    if (!/\swidth\s*=/.test(text)) {
                        text = text.replace(/<svg/i, '<svg width="' + w + '" height="' + h + '"');
                    }
                    if (!/\sheight\s*=/.test(text)) {
                        text = text.replace(/<svg/i, '<svg height="' + h + '"');
                    }
                    var blob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' });
                    var url = URL.createObjectURL(blob);
                    var img2 = new Image();
                    img2.onload = function () { URL.revokeObjectURL(url); rasterize(img2); };
                    img2.onerror = function () { URL.revokeObjectURL(url); done(null, 'That SVG could not be read — please try a PNG or JPG.'); };
                    img2.src = url;
                } catch (e) {
                    done(null, 'That SVG could not be read — please try a PNG or JPG.');
                }
            } else {
                done(null, 'That image could not be read — please try a PNG or JPG.');
            }
        };
        img.onerror = function () { done(null, 'That file could not be read — please try a PNG, JPG or SVG.'); };
        img.src = dataUrl;
    }

    function initSection(section) {
        var brandInput = section.querySelector('.lp-brand-input');
        var previewEl = section.querySelector('.lp-preview');
        var downloadBtn = section.querySelector('.lp-download');
        var cta = section.querySelector('.lp-cta');
        var logoInput = section.querySelector('.lp-logo-input');
        var logoStatus = section.querySelector('.lp-logo-status');
        var logoControls = section.querySelector('.lp-logo-controls');
        var logoSize = section.querySelector('.lp-logo-size');
        var logoRemove = section.querySelector('.lp-logo-remove');
        var lineToggle = section.querySelector('.lp-line-toggle');
        var lineRow = section.querySelector('.lp-line-row');
        var form = document.getElementById('sample-request-form');
        if (!brandInput || !previewEl) return;

        var state = {
            brand: '', category: 'facial', product: 'cleanser', palette: 'cream-gold',
            logo: null, lineOpen: false
        };
        var lastProductByCat = { facial: 'cleanser', body: 'bodylotion', tanning: 'spraytan' };
        var started = false;

        function markStarted() {
            if (started) return;
            started = true;
            firePreviewEvent('preview_started');
        }

        function setStatus(msg) {
            if (logoStatus) logoStatus.textContent = msg;
        }

        function syncChips() {
            section.querySelectorAll('.lp-chip, .lp-tab').forEach(function (chip) {
                var input = chip.querySelector('input');
                if (input) chip.classList.toggle('is-selected', !!input.checked);
            });
            section.querySelectorAll('.lp-cat-group').forEach(function (group) {
                group.hidden = group.getAttribute('data-cat') !== state.category;
            });
            section.querySelectorAll('.lp-cat-note').forEach(function (note) {
                note.hidden = note.getAttribute('data-cat') !== state.category;
            });
        }

        /* "See your line" names the products, so the visitor knows
           exactly what the row will show before opening it. Tanning has
           a single product, so the button says so. */
        function trioLabel() {
            var trio = LINE_TRIO[state.category] || LINE_TRIO.facial;
            var names = trio.map(function (key) { return (PRODUCTS[key] || PRODUCTS.cleanser).bottle; });
            if (names.length === 1) return names[0];
            return names[0] + ', ' + names[1] + ' & ' + names[2];
        }

        function syncLineToggle() {
            if (!lineToggle) return;
            var trio = LINE_TRIO[state.category] || LINE_TRIO.facial;
            var single = trio.length === 1;
            lineToggle.setAttribute('aria-expanded', state.lineOpen ? 'true' : 'false');
            lineToggle.textContent = state.lineOpen
                ? (single ? 'Hide your product' : 'Hide your line')
                : (single ? 'See your product — ' + trioLabel() : 'See your line — ' + trioLabel());
        }

        function currentState() {
            var product = section.querySelector('input[name="lp-product"]:checked');
            var palette = section.querySelector('input[name="lp-style"]:checked');
            var mode = section.querySelector('input[name="lp-logo-mode"]:checked');
            var next = {
                brand: (brandInput.value || '').trim(),
                category: state.category,
                product: product ? product.value : 'cleanser',
                palette: palette ? palette.value : 'cream-gold',
                logo: state.logo,
                lineOpen: state.lineOpen
            };
            if (next.logo) {
                next.logo = Object.assign({}, next.logo);
                if (logoSize) next.logo.size = parseInt(logoSize.value, 10) || 100;
                next.logo.mode = mode ? mode.value : 'logo-name';
            }
            return next;
        }

        function render() {
            state = currentState();
            previewEl.innerHTML = buildSvg(state.brand, state.product, state.palette, state.logo);
            syncChips();
            syncLineToggle();
            var lineNote = section.querySelector('.lp-line-note');
            if (lineNote) lineNote.hidden = !(state.lineOpen && state.category === 'tanning');
            var summary = section.querySelector('.lp-summary-text');
            if (summary) {
                var prod = PRODUCTS[state.product] || PRODUCTS.cleanser;
                var pal = PALETTES[state.palette] || PALETTES['cream-gold'];
                var cat = (CATEGORIES[prod.cat] || CATEGORIES.facial).label;
                summary.textContent = cat + ' — ' + prod.bottle + ' · ' + pal.label + ((state.logo && state.logo.dataUrl) ? ' · Logo added (file stays on your device)' : '');
            }
            if (state.lineOpen) renderLineRow();
            if (cta) {
                if (form) {
                    cta.setAttribute('href', '#sample-request');
                } else {
                    var q = new URLSearchParams();
                    if (state.brand) q.set('brand', state.brand);
                    q.set('product', state.product);
                    q.set('style', state.palette);
                    if (state.logo) {
                        /* The file itself cannot travel in a URL — it never
                           leaves the browser — but the mode and size do, so
                           the sample request still describes the logo. */
                        q.set('logo', '1');
                        if (state.logo.mode) q.set('logomode', state.logo.mode);
                        if (state.logo.size && state.logo.size !== 100) q.set('logosize', String(state.logo.size));
                    }
                    var base = cta.getAttribute('data-lp-base') || '/wholesale/';
                    cta.setAttribute('href', base + '?' + q.toString());
                }
            }
        }

        function renderLineRow() {
            if (!lineRow) return;
            var trio = LINE_TRIO[state.category] || LINE_TRIO.facial;
            var svgs = buildLineSvgs(state);
            lineRow.innerHTML = svgs.map(function (s, i) {
                var prod = PRODUCTS[trio[i]] || PRODUCTS.cleanser;
                return '<div class="lp-line-item">' + s + '<p class="lp-line-caption">' + esc(prod.bottle) + '</p></div>';
            }).join('');
        }

        function previewLine() {
            return formatPreviewLine(state);
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

        /* Logo drag: pointerdown on the logo image, then move it in
           viewBox coordinates. Pointer events cover mouse + touch. */
        var drag = null;
        function svgPoint(e) {
            var svg = previewEl.querySelector('svg');
            if (!svg) return null;
            var r = svg.getBoundingClientRect();
            if (!r.width || !r.height) return null;
            return {
                x: (e.clientX - r.left) * 200 / r.width,
                y: (e.clientY - r.top) * 300 / r.height
            };
        }
        previewEl.addEventListener('pointerdown', function (e) {
            if (!state.logo) return;
            if (!e.target || !e.target.classList || !e.target.classList.contains('lp-logo-img')) return;
            var pt = svgPoint(e);
            if (!pt) return;
            /* Anchor the drag on the logo's current rendered centre, so a
               mode switch (which moves the default centre) never jumps it. */
            var prod0 = PRODUCTS[state.product] || PRODUCTS.cleanser;
            var cur0 = logoRect(state, prod0, 'drag');
            var anchorX = cur0 ? cur0.cx : 100, anchorY = cur0 ? cur0.cy : 100;
            drag = { dx: pt.x - anchorX, dy: pt.y - anchorY };
            try { previewEl.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
            e.preventDefault();
        });
        previewEl.addEventListener('pointermove', function (e) {
            if (!drag || !state.logo) return;
            var pt = svgPoint(e);
            if (!pt) return;
            var prod = PRODUCTS[state.product] || PRODUCTS.cleanser;
            var box = prod.box;
            var cx = pt.x - drag.dx, cy = pt.y - drag.dy;
            if (prod.topView) {
                cx = Math.max(66, Math.min(134, cx));
                cy = Math.max(138, Math.min(206, cy));
            } else if (state.logo.mode === 'logo-only') {
                cx = Math.max(box[0] + 8, Math.min(box[0] + box[2] - 8, cx));
                cy = Math.max(box[1] + 8, Math.min(box[1] + box[3] - 8, cy));
                /* Keep the logo off the product-name line at the foot of
                   the label (same productY the label draws at). */
                var r0 = logoRect(state, prod, 'drag');
                if (r0) {
                    var badgeCy0 = box[1] + 6 + box[4];
                    var bs0 = box[5];
                    var nm0 = (state.brand || '').trim() || 'Your Spa';
                    if (nm0.length > 14) bs0 *= 0.85;
                    if (nm0.length > 20) bs0 *= 0.82;
                    var productY0 = badgeCy0 + box[4] + bs0 + 2 + 6 + box[6] + 4;
                    cy = Math.min(cy, productY0 - 6 - r0.h / 2);
                    cy = Math.max(cy, box[1] + 8 + r0.h / 2);
                }
            } else {
                /* Badge mode: the logo is clipped to the badge circle, so
                   drags stay near the badge centre — a nudge, not a move. */
                var badgeCy = box[1] + 6 + box[4];
                cx = Math.max(100 - box[4] / 2, Math.min(100 + box[4] / 2, cx));
                cy = Math.max(badgeCy - box[4] / 2, Math.min(badgeCy + box[4] / 2, cy));
            }
            /* Store per mode (plus the legacy single pair), so each mode
               keeps its own dragged spot across switches. */
            if (state.logo.mode === 'logo-only') { state.logo.cxOnly = Math.round(cx); state.logo.cyOnly = Math.round(cy); }
            else { state.logo.cxName = Math.round(cx); state.logo.cyName = Math.round(cy); }
            state.logo.cx = Math.round(cx);
            state.logo.cy = Math.round(cy);
            state = currentState();
            previewEl.innerHTML = buildSvg(state.brand, state.product, state.palette, state.logo);
            if (state.lineOpen) renderLineRow();
        });
        function endDrag() { drag = null; }
        previewEl.addEventListener('pointerup', endDrag);
        previewEl.addEventListener('pointercancel', endDrag);

        brandInput.addEventListener('input', function () { markStarted(); render(); });
        section.querySelectorAll('input[name="lp-category"]').forEach(function (input) {
            input.addEventListener('change', function () {
                markStarted();
                state.category = input.value;
                var pick = lastProductByCat[state.category] || CATEGORIES[state.category].products[0];
                var prInput = section.querySelector('input[name="lp-product"][value="' + pick + '"]');
                if (prInput) prInput.checked = true;
                render();
            });
        });
        section.querySelectorAll('input[name="lp-product"], input[name="lp-style"]').forEach(function (input) {
            input.addEventListener('change', function () {
                markStarted();
                if (input.name === 'lp-product') lastProductByCat[state.category] = input.value;
                render();
            });
        });

        if (logoInput) {
            logoInput.addEventListener('change', function () {
                markStarted();
                var file = logoInput.files && logoInput.files[0];
                if (!file) return;
                if (file.size > MAX_LOGO_BYTES) {
                    setStatus('That file is over 2 MB — please use a smaller logo (PNG, JPG or SVG).');
                    logoInput.value = '';
                    return;
                }
                if (!LOGO_TYPES[file.type]) {
                    setStatus('Please choose a PNG, JPG or SVG file for your logo.');
                    logoInput.value = '';
                    return;
                }
                setStatus('Reading your logo…');
                var reader = new FileReader();
                reader.onload = function () {
                    normalizeLogo(reader.result, file.type, function (logo, err) {
                        if (err) { setStatus(err); logoInput.value = ''; return; }
                        state.logo = { dataUrl: logo.dataUrl, aspect: logo.aspect, size: 100, mode: 'logo-name', cx: null, cy: null };
                        if (logoControls) logoControls.hidden = false;
                        if (logoSize) logoSize.value = '100';
                        var modeInput = section.querySelector('input[name="lp-logo-mode"][value="logo-name"]');
                        if (modeInput) modeInput.checked = true;
                        setStatus('Logo added — drag it on the bottle to move it, or use the size slider below.');
                        firePreviewEvent('preview_logo_uploaded');
                        render();
                    });
                };
                reader.onerror = function () {
                    setStatus('That file could not be read — please try again.');
                    logoInput.value = '';
                };
                reader.readAsDataURL(file);
            });
        }
        if (logoSize) {
            logoSize.addEventListener('input', function () { markStarted(); render(); });
        }
        section.querySelectorAll('input[name="lp-logo-mode"]').forEach(function (input) {
            input.addEventListener('change', function () { markStarted(); render(); });
        });
        if (logoRemove) {
            logoRemove.addEventListener('click', function () {
                state.logo = null;
                if (logoControls) logoControls.hidden = true;
                if (logoInput) logoInput.value = '';
                setStatus('Logo removed. PNG, JPG or SVG, up to 2 MB — your logo never leaves this browser.');
                render();
            });
        }

        if (lineToggle && lineRow) {
            lineToggle.addEventListener('click', function () {
                markStarted();
                state.lineOpen = !state.lineOpen;
                lineRow.hidden = !state.lineOpen;
                syncLineToggle();
                if (state.lineOpen) renderLineRow();
                var lineNote = section.querySelector('.lp-line-note');
                if (lineNote) lineNote.hidden = !(state.lineOpen && state.category === 'tanning');
            });
        }

        if (downloadBtn) {
            downloadBtn.addEventListener('click', function () {
                markStarted();
                state = currentState();
                firePreviewEvent('preview_downloaded');
                var svgText = buildSvg(state.brand, state.product, state.palette, state.logo)
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
                    /* The bottle (and its label) come from the SVG. The
                       logo is drawn separately, from its own load: a nested
                       <image> inside an SVG used as an image does not
                       reliably reach the canvas, so the download used to
                       ship with no logo at all. */
                    function finish() {
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
                    }
                    if (!state.logo || !state.logo.dataUrl) { finish(); return; }
                    var logoImg = new Image();
                    logoImg.onload = function () {
                        var prod = PRODUCTS[state.product] || PRODUCTS.cleanser;
                        var r = logoRect(state, prod, 'download');
                        if (r) {
                            /* ViewBox units to canvas pixels: the SVG is
                               200x300 drawn at 600x900, under a 1.24x scale
                               about (100, 159). */
                            var toX = function (x) { return (100 + 1.24 * (x - 100)) * 3; };
                            var toY = function (y) { return (159 + 1.24 * (y - 159)) * 3; };
                            var box = prod.box;
                            ctx.save();
                            if (state.logo.mode !== 'logo-only') {
                                /* Badge mode clips to the badge circle:
                                   (100, badgeCy) r=badgeR, or (100, 152)
                                   for the top-view jar. */
                                var badgeCy = prod.topView ? 152 : box[1] + 6 + box[4];
                                var c = toX(100), cy2 = toY(badgeCy);
                                ctx.beginPath();
                                ctx.arc(c, cy2, box[4] * 1.24 * 3, 0, Math.PI * 2);
                                ctx.clip();
                            }
                            ctx.drawImage(logoImg, toX(r.x), toY(r.y), r.w * 1.24 * 3, r.h * 1.24 * 3);
                            ctx.restore();
                        }
                        finish();
                    };
                    logoImg.onerror = finish;
                    logoImg.src = state.logo.dataUrl;
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
           /label-preview/ page). Params win; nothing is stored anywhere.
           A logo cannot travel in a URL — the file never leaves the
           browser — but ?logo=1 records that one was uploaded, so the
           sample-request line still says so. */
        var q = params();
        if (q) {
            var b = q.get('brand');
            var pr = q.get('product');
            var st = q.get('style');
            var lg = q.get('logo');
            if (b) brandInput.value = b.slice(0, 40);
            if (pr) {
                if (LEGACY_PRODUCT_MAP[pr]) pr = LEGACY_PRODUCT_MAP[pr];
                if (PRODUCTS[pr]) {
                    var prod = PRODUCTS[pr];
                    state.category = prod.cat;
                    lastProductByCat[prod.cat] = pr;
                    var catInput = section.querySelector('input[name="lp-category"][value="' + prod.cat + '"]');
                    if (catInput) catInput.checked = true;
                    var prInput = section.querySelector('input[name="lp-product"][value="' + pr + '"]');
                    if (prInput) prInput.checked = true;
                }
            }
            if (st && PALETTES[st]) {
                var stInput = section.querySelector('input[name="lp-style"][value="' + st + '"]');
                if (stInput) stInput.checked = true;
            }
            render();
            if (lg === '1') {
                /* Logo flag only — no file, no image: it marks the
                   prefill line. The mockup itself shows the badge. The mode
                   and size travel in the URL too, so the line describes the
                   logo; the size slider and mode radio are set to match so
                   the prefill reads them back. */
                var lm = q.get('logomode'), ls = parseInt(q.get('logosize') || '', 10);
                var flagMode = (lm === 'logo-only') ? 'logo-only' : 'logo-name';
                var flagSize = (ls > 0 && ls <= 160) ? ls : 100;
                state.logo = { dataUrl: null, aspect: 1, size: flagSize, mode: flagMode, cx: null, cy: null, flagOnly: true };
                if (logoSize) logoSize.value = String(flagSize);
                var flagModeInput = section.querySelector('input[name="lp-logo-mode"][value="' + flagMode + '"]');
                if (flagModeInput) flagModeInput.checked = true;
                /* No file in this section: hide the size/mode controls and
                   say so plainly, so "No file chosen" is not confusing. */
                if (logoControls) logoControls.hidden = true;
                setStatus('Logo uploaded on the preview page — you\u2019ll share the file with Robert later.');
                render();
            }
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
        module.exports = {
            buildSvg: buildSvg, buildLineSvgs: buildLineSvgs, logoRect: logoRect,
            formatPreviewLine: formatPreviewLine,
            PRODUCTS: PRODUCTS, PALETTES: PALETTES, CATEGORIES: CATEGORIES,
            LINE_TRIO: LINE_TRIO, LEGACY_PRODUCT_MAP: LEGACY_PRODUCT_MAP
        };
    }
})();
