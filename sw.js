/* Service Worker — reçoit les notifications push et les affiche,
   même quand le site est fermé. */

self.addEventListener("push", function (event) {
    var data = {};
    try { data = event.data ? event.data.json() : {}; } catch (e) {}

    var title = data.title || "Timj Multi-Services";
    var options = {
        body: data.body || "🎬 Le reel du jour est en ligne !",
        icon: data.icon || "/Timjs.PNG",
        badge: "/Timjs.PNG",
        data: { url: data.url || "/" },
        vibrate: [100, 50, 100],
        tag: "reel-du-jour",
        renotify: true
    };
    if (data.image) options.image = data.image;

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
    event.notification.close();
    var url = (event.notification.data && event.notification.data.url) || "/";
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
            for (var i = 0; i < list.length; i++) {
                if (list[i].url.indexOf(url) !== -1 && "focus" in list[i]) return list[i].focus();
            }
            if (self.clients.openWindow) return self.clients.openWindow(url);
        })
    );
});
