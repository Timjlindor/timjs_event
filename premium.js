(function () {
    var nav = document.querySelector(".site-nav");
    if (nav) {
        var onScroll = function () {
            nav.classList.toggle("is-scrolled", window.scrollY > 12);
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
    }

    var revealTargets = document.querySelectorAll(
        ".section, .cta, .card, .decor-card, .fun-card, .payment-card, .auth-card, .wardrobe-card, .stat, .hero-banner, .game-wrap"
    );

    if (!("IntersectionObserver" in window) || revealTargets.length === 0) {
        return;
    }

    var observer = new IntersectionObserver(
        function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    revealTargets.forEach(function (el, i) {
        el.setAttribute("data-reveal", "");
        el.style.transitionDelay = (i % 6) * 0.06 + "s";
        observer.observe(el);
    });
})();

/* ===== Agrandissement au clic (lightbox) =====
   Couvre les galeries des pages photo et les images du fil d'actualité.
   La délégation d'événement est nécessaire car les publications du fil
   sont ajoutées au DOM après le chargement de la page. */
(function () {
    var SELECTOR = ".gallery-grid img, .gallery img, .post-thumbnail";
    var lightbox = null;
    var big = null;

    function close() {
        if (!lightbox) return;
        lightbox.classList.remove("open");
        big.src = "";
    }

    function open(src) {
        if (!lightbox) {
            lightbox = document.createElement("div");
            lightbox.className = "lightbox";
            lightbox.setAttribute("role", "dialog");
            lightbox.setAttribute("aria-modal", "true");
            lightbox.setAttribute("aria-label", "Aperçu photo");
            big = document.createElement("img");
            big.alt = "Photo en grand format";
            lightbox.appendChild(big);
            lightbox.addEventListener("click", close);
            document.body.appendChild(lightbox);
        }
        big.src = src;
        lightbox.classList.add("open");
    }

    document.addEventListener("click", function (e) {
        if (!(e.target instanceof Element)) return;
        var img = e.target.closest(SELECTOR);
        if (img) {
            open(img.currentSrc || img.src);
        }
    });

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
            close();
        }
    });
})();

/* ===== Compteur de visiteurs (léger, respectueux de la vie privée) =====
   Enregistre UNE visite par session de navigateur dans Supabase (table
   page_views). Aucune donnée personnelle : seulement la page et la date.
   La table + les droits sont à créer une fois (voir COMPTEUR-VISITEURS.md). */
(function () {
    if (location.protocol !== "http:" && location.protocol !== "https:") return;
    try {
        if (sessionStorage.getItem("visitCounted") === "1") return;
        sessionStorage.setItem("visitCounted", "1");
    } catch (e) { /* sessionStorage indisponible : on compte quand même */ }

    var URL = "https://zcgwkvuyxosxfyxwmfim.supabase.co";
    var ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjZ3drdnV5eG9zeGZ5eHdtZmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NzAyMTksImV4cCI6MjA4NjM0NjIxOX0.x1VNiNBu1N8dshlgwTBBW2_GhUtovSnjQs_mYZuLUgw";

    fetch(URL + "/rest/v1/page_views", {
        method: "POST",
        headers: {
            "apikey": ANON,
            "Authorization": "Bearer " + ANON,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        },
        body: JSON.stringify({ path: location.pathname })
    }).catch(function () { /* silencieux : ne jamais gêner la visite */ });
})();
