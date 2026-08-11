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
