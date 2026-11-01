/* Homepage two-door choice: remember the door and lightly personalize.
 * Buyers see the client funnels first; manufacturers keep the default order.
 * No-JS fallback = the default order. Nothing is hidden or removed. */
(function () {
    function applyDoor() {
        var choice = null;
        try { choice = window.localStorage.getItem('lo_door'); } catch (e) { choice = null; }
        if (choice !== 'buyer') return;
        var funnels = document.getElementById('door-funnels');
        var pitch = document.getElementById('door-pitch');
        if (!funnels || !pitch) return;
        if (funnels.parentNode !== pitch.parentNode) return;
        pitch.parentNode.insertBefore(funnels, pitch);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyDoor);
    else applyDoor();
})();
