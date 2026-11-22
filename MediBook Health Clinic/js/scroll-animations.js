// MediBook homepage scroll animations
document.addEventListener("DOMContentLoaded", () => {
    const heroSection = document.querySelector(".hero-scroll");
    const heroTitle = document.querySelector("#hero-title");

    // Fill the outlined hero headline according to scroll progress.
    if (heroSection && heroTitle) {
        let ticking = false;

        const updateHeroFill = () => {
            const scrollDistance =
                heroSection.offsetHeight - window.innerHeight;

            if (scrollDistance <= 0) {
                heroTitle.style.setProperty("--fill", "100%");
                ticking = false;
                return;
            }

            const sectionTop = heroSection.getBoundingClientRect().top;
            const progress = Math.max(
                0,
                Math.min(1, -sectionTop / scrollDistance)
            );

            heroTitle.style.setProperty(
                "--fill",
                `${progress * 100}%`
            );

            ticking = false;
        };

        const requestHeroUpdate = () => {
            if (!ticking) {
                window.requestAnimationFrame(updateHeroFill);
                ticking = true;
            }
        };

        window.addEventListener("scroll", requestHeroUpdate, {
            passive: true
        });
        window.addEventListener("resize", requestHeroUpdate);
        updateHeroFill();
    }

    // Reveal homepage text and cards when they enter the viewport.
    const revealElements = document.querySelectorAll(
        ".health-intro > *, " +
        ".clinic-stats .stats-grid > div, " +
        ".dentistry-section > *, " +
        ".hours-section > *, " +
        ".approach-section > *, " +
        ".approach-card, " +
        ".appointment-banner > *"
    );

    if ("IntersectionObserver" in window) {
        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.15,
            rootMargin: "0px 0px -35px 0px"
        });

        revealElements.forEach((element) => {
            element.classList.add("scroll-reveal", "reveal-ready");
            revealObserver.observe(element);
        });
    }

    // Count the clinic statistics up when the statistics bar enters view.
    const statsSection = document.querySelector(".clinic-stats");
    const statCounters = document.querySelectorAll(".stat-counter");

    const runCounter = (counter) => {
        const target = Number(counter.dataset.target);
        const suffix = counter.dataset.suffix || "";
        const decimals = Number(counter.dataset.decimals || 0);
        const duration = 1800;
        const startTime = performance.now();
        const formatter = new Intl.NumberFormat("en-US", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });

        const updateCounter = (currentTime) => {
            const progress = Math.min((currentTime - startTime) / duration, 1);
            // Ease-out makes the count start quickly and slow near the final value.
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const currentValue = target * easedProgress;

            counter.textContent = formatter.format(
                progress === 1 ? target : currentValue
            ) + suffix;

            if (progress < 1) {
                window.requestAnimationFrame(updateCounter);
            }
        };

        window.requestAnimationFrame(updateCounter);
    };

    if (statsSection && statCounters.length) {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
            !("IntersectionObserver" in window)) {
            statCounters.forEach((counter) => {
                const decimals = Number(counter.dataset.decimals || 0);
                const target = Number(counter.dataset.target);
                const suffix = counter.dataset.suffix || "";
                counter.textContent = new Intl.NumberFormat("en-US", {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals
                }).format(target) + suffix;
            });
        } else {
            const counterObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        statCounters.forEach(runCounter);
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.35 });

            counterObserver.observe(statsSection);
        }
    }

});
