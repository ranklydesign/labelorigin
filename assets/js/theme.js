/**
 * LabelOrigin theme switcher.
 * Light is the default. The visitor's choice is remembered in localStorage.
 * Loaded synchronously in <head> so the saved theme is applied before first paint.
 */
(function () {
    var KEY = 'labelorigin_theme';
    var root = document.documentElement;

    function read() {
        try { return localStorage.getItem(KEY); } catch (e) { return null; }
    }
    function write(value) {
        try { localStorage.setItem(KEY, value); } catch (e) { /* storage unavailable */ }
    }
    function apply(theme) {
        root.setAttribute('data-theme', theme);
        var btn = document.getElementById('theme-toggle');
        if (btn) {
            btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
            btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
        }
    }

    apply(read() === 'dark' ? 'dark' : 'light');

    document.addEventListener('DOMContentLoaded', function () {
        var btn = document.createElement('button');
        btn.id = 'theme-toggle';
        btn.type = 'button';
        btn.className = 'theme-toggle';
        btn.innerHTML =
            '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>' +
            '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
        btn.addEventListener('click', function () {
            var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            apply(next);
            write(next);
        });
        document.body.appendChild(btn);
        apply(root.getAttribute('data-theme'));
    });
})();
