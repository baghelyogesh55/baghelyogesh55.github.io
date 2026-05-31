// ===== MAIN UI ENGINE =====
// Vanilla JS — drives every interactive element on the page.
(function () {
    'use strict';

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

    // ---------- Spaceship cursor (pointer devices only) ----------
    function initCursor() {
        const ship = $('#cursorShip');
        if (!ship) return;

        // Touch / coarse pointers: no flying ship, restore the native cursor.
        if (isTouch) {
            ship.style.display = 'none';
            document.body.style.cursor = 'auto';
            return;
        }

        const interactive = 'a, button, .btn, .project-card, .skill-card, .cert-card, .social-link, .theme-toggle, input, textarea, .hamburger';

        // Smoothed ship position + heading.
        let tx = window.innerWidth / 2, ty = window.innerHeight / 2; // target (pointer)
        let x = tx, y = ty;          // current ship position (lerped)
        let angle = 0;               // current heading (rad), nose points up by default
        let trailGap = 0;
        let started = false;

        document.addEventListener('pointermove', (e) => {
            tx = e.clientX; ty = e.clientY;
            if (!started) { started = true; ship.classList.add('ready'); }
        }, { passive: true });

        // Boost on click.
        document.addEventListener('pointerdown', () => ship.classList.add('boost'));
        document.addEventListener('pointerup', () => ship.classList.remove('boost'));

        // Engage glow over interactive targets.
        document.addEventListener('pointerover', (e) => {
            if (e.target.closest(interactive)) ship.classList.add('engage');
        });
        document.addEventListener('pointerout', (e) => {
            if (e.target.closest(interactive)) ship.classList.remove('engage');
        });

        const spawnTrail = (px, py) => {
            const p = document.createElement('div');
            p.className = 'thruster';
            p.style.left = px + 'px';
            p.style.top = py + 'px';
            document.body.appendChild(p);
            p.addEventListener('animationend', () => p.remove());
        };

        const fly = () => {
            const dx = tx - x;
            const dy = ty - y;
            const dist = Math.hypot(dx, dy);

            // Ease toward the pointer.
            x += dx * 0.22;
            y += dy * 0.22;

            // Rotate to face the direction of travel (nose-up art → +90°).
            if (dist > 1.2) {
                const target = Math.atan2(dy, dx) + Math.PI / 2;
                // Shortest-path angular interpolation.
                let diff = target - angle;
                diff = Math.atan2(Math.sin(diff), Math.cos(diff));
                angle += diff * 0.2;
            }

            const scale = ship.classList.contains('boost') ? 1.25 : 1;
            ship.style.transform =
                `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${angle}rad) scale(${scale})`;

            // Emit a thruster particle behind the ship while it moves.
            trailGap += dist;
            if (dist > 2 && trailGap > 9) {
                trailGap = 0;
                const back = angle - Math.PI / 2; // tail direction
                spawnTrail(x - Math.cos(back) * 16, y - Math.sin(back) * 16);
            }

            requestAnimationFrame(fly);
        };
        fly();
    }

    // ---------- Scroll progress bar + navbar state ----------
    function initScrollUI() {
        const bar = $('#progressBar');
        const nav = $('#navbar');
        let ticking = false;

        const update = () => {
            const scrollTop = window.scrollY;
            const height = document.documentElement.scrollHeight - window.innerHeight;
            if (bar) bar.style.width = (height > 0 ? (scrollTop / height) * 100 : 0) + '%';
            if (nav) nav.classList.toggle('scrolled', scrollTop > 40);
            ticking = false;
        };
        window.addEventListener('scroll', () => {
            if (!ticking) { requestAnimationFrame(update); ticking = true; }
        }, { passive: true });
        update();
    }

    // ---------- Typed hero name + rotating roles ----------
    function typeText(el, text, speed, done) {
        let i = 0;
        el.textContent = '';
        const tick = () => {
            if (i <= text.length) {
                el.textContent = text.slice(0, i);
                i++;
                setTimeout(tick, speed);
            } else if (done) {
                done();
            }
        };
        tick();
    }

    function initTyping() {
        const nameEl = $('#heroName');
        const roleEl = $('#roleText');
        const NAME = 'Yogesh Baghel';
        const ROLES = [
            'Salesforce Developer',
            'LWC & Apex Specialist',
            'Sales & Service Cloud Expert',
            'Salesforce Administrator',
            '10x Certified Trailblazer',
        ];

        if (reducedMotion) {
            if (nameEl) nameEl.textContent = NAME;
            if (roleEl) roleEl.textContent = ROLES[0];
            const c = $('.role-cursor');
            if (c) c.style.display = 'none';
            return;
        }

        if (nameEl) typeText(nameEl, NAME, 70, startRoles);
        else startRoles();

        function startRoles() {
            if (!roleEl) return;
            let r = 0;
            const loop = () => {
                const word = ROLES[r % ROLES.length];
                let i = 0;
                const typing = () => {
                    roleEl.textContent = word.slice(0, i);
                    if (i++ <= word.length) { setTimeout(typing, 55); }
                    else { setTimeout(erasing, 1600); }
                };
                const erasing = () => {
                    roleEl.textContent = word.slice(0, i);
                    if (i-- >= 0) { setTimeout(erasing, 28); }
                    else { r++; setTimeout(loop, 250); }
                };
                typing();
            };
            loop();
        }
    }

    // ---------- Scroll-reveal (float-up / float-left / float-right) ----------
    function initReveal() {
        const items = $$('.float-up, .float-left, .float-right');
        if (reducedMotion || !('IntersectionObserver' in window)) {
            items.forEach((el) => el.classList.add('visible'));
            return;
        }
        const io = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const el = entry.target;
                const delay = parseInt(el.dataset.delay || '0', 10);
                setTimeout(() => el.classList.add('visible'), delay);
                obs.unobserve(el);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
        items.forEach((el) => io.observe(el));
    }

    // ---------- Animated stat counters ----------
    function initCounters() {
        const stats = $$('.stat-number');
        if (!stats.length) return;
        if (reducedMotion) {
            stats.forEach((el) => { el.textContent = el.dataset.target || el.textContent; });
            return;
        }
        const io = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const el = entry.target;
                const target = parseInt(el.dataset.target || '0', 10);
                const duration = 1600;
                const start = performance.now();
                const step = (now) => {
                    const t = Math.min((now - start) / duration, 1);
                    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
                    el.textContent = Math.round(eased * target).toLocaleString();
                    if (t < 1) requestAnimationFrame(step);
                };
                requestAnimationFrame(step);
                obs.unobserve(el);
            });
        }, { threshold: 0.5 });
        stats.forEach((el) => io.observe(el));
    }

    // ---------- Skill bars fill on reveal ----------
    function initSkillBars() {
        const fills = $$('.skill-fill');
        if (!fills.length) return;
        const apply = (el) => { el.style.width = (el.dataset.width || '0') + '%'; };
        if (reducedMotion || !('IntersectionObserver' in window)) {
            fills.forEach(apply);
            return;
        }
        const io = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                apply(entry.target);
                obs.unobserve(entry.target);
            });
        }, { threshold: 0.4 });
        fills.forEach((el) => io.observe(el));
    }

    // ---------- Theme toggle (persisted) ----------
    function initTheme() {
        const toggle = $('#themeToggle');
        const icon = toggle ? toggle.querySelector('i') : null;
        const saved = localStorage.getItem('theme');
        const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        const initial = saved || (prefersLight ? 'light' : 'dark');

        const apply = (theme) => {
            if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
            else document.documentElement.removeAttribute('data-theme');
            if (icon) icon.className = theme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
        };
        apply(initial);

        if (toggle) {
            toggle.addEventListener('click', () => {
                const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
                apply(next);
                localStorage.setItem('theme', next);
            });
        }
    }

    // ---------- Mobile navigation ----------
    function initMobileNav() {
        const burger = $('#hamburger');
        const links = $('.nav-links');
        if (!burger || !links) return;

        const close = () => { burger.classList.remove('active'); links.classList.remove('open'); document.body.classList.remove('nav-open'); };
        burger.addEventListener('click', () => {
            const open = burger.classList.toggle('active');
            links.classList.toggle('open', open);
            document.body.classList.toggle('nav-open', open);
        });
        links.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
        window.addEventListener('resize', () => { if (window.innerWidth > 768) close(); });
    }

    // ---------- Active nav link on scroll ----------
    function initActiveNav() {
        const sections = $$('section[id]');
        const links = $$('.nav-links a');
        if (!sections.length || !links.length) return;
        const map = new Map(links.map((a) => [a.getAttribute('href'), a]));

        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const link = map.get('#' + entry.target.id);
                if (!link) return;
                links.forEach((a) => a.classList.remove('active'));
                link.classList.add('active');
            });
        }, { threshold: 0.5 });
        sections.forEach((s) => io.observe(s));
    }

    // ---------- Toast helper ----------
    function toast(message, type = 'success') {
        let el = $('.toast');
        if (!el) {
            el = document.createElement('div');
            el.className = 'toast';
            document.body.appendChild(el);
        }
        el.textContent = message;
        el.dataset.type = type;
        el.classList.add('show');
        clearTimeout(el._timer);
        el._timer = setTimeout(() => el.classList.remove('show'), 3800);
    }

    // ---------- Contact form (mailto bridge, no backend) ----------
    function initContactForm() {
        const form = $('#contactForm');
        if (!form) return;
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = $('#name').value.trim();
            const email = $('#email').value.trim();
            const subject = $('#subject').value.trim();
            const message = $('#message').value.trim();
            if (!name || !email || !subject || !message) {
                toast('Please fill in all fields.', 'error');
                return;
            }
            const body = `Hi Yogesh,%0D%0A%0D%0A${encodeURIComponent(message)}%0D%0A%0D%0A— ${encodeURIComponent(name)} (${encodeURIComponent(email)})`;
            const mailto = `mailto:baghelyogesh55@gmail.com?subject=${encodeURIComponent(subject)}&body=${body}`;
            window.location.href = mailto;
            toast('Opening your email client…');
            form.reset();
        });
    }

    // ---------- 3D tilt + glare on cards ----------
    function initTilt() {
        if (reducedMotion || isTouch) return;
        const cards = $$('.skill-card, .cert-card, .timeline-card');
        const MAX = 9; // max tilt in degrees
        cards.forEach((card) => {
            card.classList.add('tilt-card');
            const glare = document.createElement('span');
            glare.className = 'card-glare';
            card.appendChild(glare);

            card.addEventListener('pointermove', (e) => {
                const r = card.getBoundingClientRect();
                const px = (e.clientX - r.left) / r.width;
                const py = (e.clientY - r.top) / r.height;
                const rx = (0.5 - py) * MAX * 2;
                const ry = (px - 0.5) * MAX * 2;
                card.style.transform =
                    `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px) scale(1.02)`;
                glare.style.setProperty('--gx', (px * 100) + '%');
                glare.style.setProperty('--gy', (py * 100) + '%');
                card.classList.add('tilting');
            });
            card.addEventListener('pointerleave', () => {
                card.style.transform = '';
                card.classList.remove('tilting');
            });
        });
    }

    // ---------- Command palette (⌘K) ----------
    function initCommandPalette() {
        const modal = $('#cmdk');
        const input = $('#cmdkInput');
        const list = $('#cmdkList');
        const trigger = $('#cmdkTrigger');
        if (!modal || !input || !list) return;

        const go = (id) => () => {
            const t = document.querySelector(id);
            if (t) t.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
        };
        const open = (url) => () => window.open(url, '_blank', 'noopener');

        const items = [
            { icon: 'fa-house',          label: 'Home',           sub: 'Section', run: go('#hero') },
            { icon: 'fa-user',           label: 'About',          sub: 'Section', run: go('#about') },
            { icon: 'fa-layer-group',    label: 'Skills',         sub: 'Section', run: go('#skills') },
            { icon: 'fa-briefcase',      label: 'Experience',     sub: 'Section', run: go('#experience') },
            { icon: 'fa-award',          label: 'Certifications', sub: 'Section', run: go('#certifications') },
            { icon: 'fa-rocket',         label: 'Projects',       sub: 'Section', run: go('#projects') },
            { icon: 'fa-envelope',       label: 'Contact',        sub: 'Section', run: go('#contact') },
            { icon: 'fa-circle-half-stroke', label: 'Toggle theme', sub: 'Action', run: () => { const t = $('#themeToggle'); if (t) t.click(); } },
            { icon: 'fa-linkedin',       label: 'LinkedIn',       sub: 'Link', brand: true, run: open('https://linkedin.com/in/yogesh-kumar-baghel') },
            { icon: 'fa-github',         label: 'GitHub',         sub: 'Link', brand: true, run: open('https://github.com/baghelyogesh55') },
            { icon: 'fa-envelope',       label: 'Email me',       sub: 'Link', run: open('mailto:baghelyogesh55@gmail.com') },
        ];

        let filtered = items.slice();
        let selected = 0;

        const renderList = () => {
            if (!filtered.length) {
                list.innerHTML = '<li class="cmdk-empty">No results</li>';
                return;
            }
            list.innerHTML = filtered.map((it, i) => `
                <li class="cmdk-item ${i === selected ? 'selected' : ''}" data-index="${i}">
                    <span class="ci-icon"><i class="fa${it.brand ? 'b' : 's'} ${it.icon}"></i></span>
                    <span>${it.label}</span>
                    <span class="ci-sub">${it.sub}</span>
                </li>`).join('');
        };

        const filter = () => {
            const q = input.value.trim().toLowerCase();
            filtered = q ? items.filter((it) => it.label.toLowerCase().includes(q) || it.sub.toLowerCase().includes(q)) : items.slice();
            selected = 0;
            renderList();
        };

        const openModal = () => {
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
            input.value = '';
            filter();
            setTimeout(() => input.focus(), 30);
        };
        const closeModal = () => {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
        };
        const runSelected = () => {
            const it = filtered[selected];
            if (it) { closeModal(); it.run(); }
        };

        // Global shortcuts.
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                modal.classList.contains('open') ? closeModal() : openModal();
            } else if (e.key === 'Escape' && modal.classList.contains('open')) {
                closeModal();
            }
        });
        if (trigger) trigger.addEventListener('click', openModal);
        modal.querySelector('[data-cmdk-close]').addEventListener('click', closeModal);

        input.addEventListener('input', filter);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); selected = Math.min(selected + 1, filtered.length - 1); renderList(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); selected = Math.max(selected - 1, 0); renderList(); }
            else if (e.key === 'Enter') { e.preventDefault(); runSelected(); }
        });
        list.addEventListener('click', (e) => {
            const li = e.target.closest('.cmdk-item');
            if (!li) return;
            selected = parseInt(li.dataset.index, 10);
            runSelected();
        });
    }

    // ---------- Preloader ----------
    function initPreloader() {
        const pre = $('#preloader');
        if (!pre) return;
        const hide = () => {
            pre.classList.add('done');
            setTimeout(() => { pre.style.display = 'none'; }, 700);
        };
        if (document.readyState === 'complete') setTimeout(hide, 500);
        else window.addEventListener('load', () => setTimeout(hide, 500));
        // Safety net so the page is never stuck behind the loader.
        setTimeout(hide, 4000);
    }

    // ---------- Back-to-top ----------
    function initBackToTop() {
        const btn = $('#backToTop');
        if (!btn) return;
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                btn.classList.toggle('show', window.scrollY > 600);
                ticking = false;
            });
        }, { passive: true });
        btn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
        });
    }

    // ---------- Smooth-scroll for in-page anchors ----------
    function initSmoothAnchors() {
        $$('a[href^="#"]').forEach((a) => {
            a.addEventListener('click', (e) => {
                const id = a.getAttribute('href');
                if (id === '#' || id.length < 2) return;
                const target = document.querySelector(id);
                if (!target) return;
                e.preventDefault();
                target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
            });
        });
    }

    // ---------- Boot ----------
    function boot() {
        initPreloader();
        initCursor();
        initBackToTop();
        initScrollUI();
        initTyping();
        initReveal();
        initCounters();
        initSkillBars();
        initTheme();
        initMobileNav();
        initActiveNav();
        initContactForm();
        initSmoothAnchors();
        initTilt();
        initCommandPalette();
        document.body.classList.add('loaded');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
