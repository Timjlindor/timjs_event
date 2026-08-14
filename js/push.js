/* Abonnement aux notifications push (le reel du jour chaque matin).
   Utilise la clé VAPID publique + la clé anon Supabase (toutes deux publiques). */
(function () {
    var VAPID_PUBLIC = "BF7xXcwCajA-FZeKE1xQgxdaebyRmPcnkLOaYbT5PU4EOjmPuUpEPWU8VaYU6Lor12CGeKlWmKNj3O-szqjKy1Y";
    var SUPABASE_URL = "https://zcgwkvuyxosxfyxwmfim.supabase.co";
    var ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjZ3drdnV5eG9zeGZ5eHdtZmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NzAyMTksImV4cCI6MjA4NjM0NjIxOX0.x1VNiNBu1N8dshlgwTBBW2_GhUtovSnjQs_mYZuLUgw";

    var btn = document.getElementById("pushSubscribeBtn");
    var status = document.getElementById("pushStatus");
    if (!btn) return;

    function say(msg) { if (status) status.textContent = msg; }

    if (location.protocol !== "https:") {
        btn.style.display = "none"; return; // push nécessite https
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        btn.disabled = true; say("Ton navigateur ne gère pas les notifications."); return;
    }

    // Sur iPhone, les notifications web ne marchent qu'en app installée (écran d'accueil).
    var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var standalone = navigator.standalone === true ||
        (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
    if (isIOS && !standalone) {
        say("📱 Sur iPhone : appuie sur Partager ⬆️ → « Sur l'écran d'accueil », ouvre l'app, puis reviens ici pour activer.");
    }

    function urlB64ToUint8Array(base64String) {
        var padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
        var raw = atob(base64);
        var arr = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
        return arr;
    }

    btn.addEventListener("click", function () {
        btn.disabled = true;
        say("Activation…");
        navigator.serviceWorker.register("/sw.js")
            .then(function (reg) { return navigator.serviceWorker.ready.then(function () { return reg; }); })
            .then(function (reg) {
                return Notification.requestPermission().then(function (perm) {
                    if (perm !== "granted") throw new Error("permission refusée");
                    return reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC)
                    });
                });
            })
            .then(function (sub) {
                return fetch(SUPABASE_URL + "/rest/v1/push_subscriptions", {
                    method: "POST",
                    headers: {
                        apikey: ANON, Authorization: "Bearer " + ANON,
                        "Content-Type": "application/json", Prefer: "return=minimal"
                    },
                    body: JSON.stringify({ endpoint: sub.endpoint, subscription: sub.toJSON() })
                });
            })
            .then(function (res) {
                // 201 = créé, 409 = endpoint déjà présent (déjà abonné) → succès dans les deux cas
                if (res.ok || res.status === 409) {
                    say("✅ C'est fait ! Tu recevras le reel du jour chaque matin. 🎬");
                    btn.textContent = "🔔 Abonné(e)";
                } else {
                    say("Oups, réessaie plus tard.");
                    btn.disabled = false;
                }
            })
            .catch(function (e) {
                if (String(e.message).indexOf("permission") !== -1) say("Tu as refusé les notifications. Tu peux réactiver dans les réglages du navigateur.");
                else say("Impossible d'activer pour le moment. Réessaie.");
                btn.disabled = false;
            });
    });
})();
