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
