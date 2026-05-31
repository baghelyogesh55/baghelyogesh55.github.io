// ===== THREE.JS SCENES (module) =====
// Modern Three.js loaded via import-map in index.html — no build step required.
import * as THREE from 'three';

const ACCENT = 0x0ea5e9;
const ACCENT_2 = 0x8b5cf6;
const ACCENT_3 = 0x06b6d4;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Tracks the running render loops so we can pause/resume cheaply.
const scenes = [];

/**
 * Registers a scene's per-frame update and starts a shared-friendly RAF loop
 * that automatically pauses when the canvas is off-screen or the tab is hidden.
 */
function register(canvas, renderFn) {
    const entry = { canvas, renderFn, visible: true, running: false, raf: 0 };
    scenes.push(entry);

    const loop = () => {
        if (!entry.running) return;
        renderFn();
        entry.raf = requestAnimationFrame(loop);
    };
    entry.start = () => {
        if (entry.running || reducedMotion) return;
        entry.running = true;
        entry.raf = requestAnimationFrame(loop);
    };
    entry.stop = () => {
        entry.running = false;
        cancelAnimationFrame(entry.raf);
    };

    // Only animate while the canvas is in (or near) the viewport.
    const io = new IntersectionObserver((entries) => {
        entry.visible = entries[0].isIntersecting;
        if (entry.visible && !document.hidden) entry.start();
        else entry.stop();
    }, { rootMargin: '120px' });
    io.observe(canvas);

    // Always paint at least one frame (covers reduced-motion + initial state).
    renderFn();
    return entry;
}

document.addEventListener('visibilitychange', () => {
    scenes.forEach((s) => {
        if (document.hidden) s.stop();
        else if (s.visible) s.start();
    });
});

// Shared, throttled pointer position (-0.5 .. 0.5).
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener('pointermove', (e) => {
    pointer.tx = e.clientX / window.innerWidth - 0.5;
    pointer.ty = e.clientY / window.innerHeight - 0.5;
}, { passive: true });

function makeRenderer(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    return renderer;
}

// ============================================================
// HERO — interactive particle network + drifting starfield + faint wireframe core
// ============================================================
function initHeroScene() {
    const canvas = document.getElementById('heroCanvas');
    if (!canvas) return;

    const renderer = makeRenderer(canvas);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 14;

    const size = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight, false);
    };
    size();
    window.addEventListener('resize', size);

    const group = new THREE.Group();
    scene.add(group);

    // --- Deep starfield (depth, parallax) ---
    const starCount = 900;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        starPos[i * 3]     = (Math.random() - 0.5) * 60;
        starPos[i * 3 + 1] = (Math.random() - 0.5) * 40;
        starPos[i * 3 + 2] = (Math.random() - 0.5) * 30 - 10;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
        color: ACCENT_3, size: 0.07, transparent: true, opacity: 0.5, sizeAttenuation: true,
    }));
    group.add(stars);

    // --- Network nodes (foreground) + dynamic connecting lines ---
    const NODES = 70;
    const BOX = 16;
    const LINK_DIST = 4.2;
    const nodePos = new Float32Array(NODES * 3);
    const vel = [];
    for (let i = 0; i < NODES; i++) {
        nodePos[i * 3]     = (Math.random() - 0.5) * BOX;
        nodePos[i * 3 + 1] = (Math.random() - 0.5) * BOX * 0.7;
        nodePos[i * 3 + 2] = (Math.random() - 0.5) * 6;
        vel.push({
            x: (Math.random() - 0.5) * 0.02,
            y: (Math.random() - 0.5) * 0.02,
            z: (Math.random() - 0.5) * 0.01,
        });
    }
    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
    const nodes = new THREE.Points(nodeGeo, new THREE.PointsMaterial({
        color: ACCENT, size: 0.16, transparent: true, opacity: 0.9, sizeAttenuation: true,
    }));
    group.add(nodes);

    // Pre-allocate a line buffer big enough for all possible links.
    const maxSegments = (NODES * NODES) / 2;
    const linePositions = new Float32Array(maxSegments * 6);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
        color: ACCENT, transparent: true, opacity: 0.18,
    }));
    group.add(lines);

    // --- Faint rotating wireframe core behind the headline ---
    const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(5.5, 1),
        new THREE.MeshBasicMaterial({ color: ACCENT_2, wireframe: true, transparent: true, opacity: 0.08 }),
    );
    group.add(core);

    const render = () => {
        pointer.x += (pointer.tx - pointer.x) * 0.05;
        pointer.y += (pointer.ty - pointer.y) * 0.05;

        const p = nodeGeo.attributes.position.array;
        for (let i = 0; i < NODES; i++) {
            p[i * 3]     += vel[i].x;
            p[i * 3 + 1] += vel[i].y;
            p[i * 3 + 2] += vel[i].z;
            if (Math.abs(p[i * 3])     > BOX / 2)        vel[i].x *= -1;
            if (Math.abs(p[i * 3 + 1]) > BOX * 0.35)     vel[i].y *= -1;
            if (Math.abs(p[i * 3 + 2]) > 3)              vel[i].z *= -1;
        }
        nodeGeo.attributes.position.needsUpdate = true;

        // Rebuild nearby links.
        let n = 0;
        for (let i = 0; i < NODES; i++) {
            for (let j = i + 1; j < NODES; j++) {
                const dx = p[i * 3] - p[j * 3];
                const dy = p[i * 3 + 1] - p[j * 3 + 1];
                const dz = p[i * 3 + 2] - p[j * 3 + 2];
                if (dx * dx + dy * dy + dz * dz < LINK_DIST * LINK_DIST) {
                    linePositions[n++] = p[i * 3];
                    linePositions[n++] = p[i * 3 + 1];
                    linePositions[n++] = p[i * 3 + 2];
                    linePositions[n++] = p[j * 3];
                    linePositions[n++] = p[j * 3 + 1];
                    linePositions[n++] = p[j * 3 + 2];
                }
            }
        }
        lineGeo.setDrawRange(0, n / 3);
        lineGeo.attributes.position.needsUpdate = true;

        core.rotation.x += 0.0014;
        core.rotation.y += 0.0019;
        stars.rotation.y += 0.0003;

        // Mouse parallax.
        group.rotation.y += (pointer.x * 0.5 - group.rotation.y) * 0.05;
        group.rotation.x += (pointer.y * 0.3 - group.rotation.x) * 0.05;

        renderer.render(scene, camera);
    };

    register(canvas, render);
}

// ============================================================
// SKILLS — slow-drifting wireframe polyhedra (subtle backdrop)
// ============================================================
function initSkillsScene() {
    const canvas = document.getElementById('skillsCanvas');
    if (!canvas) return;
    const wrap = canvas.parentElement;

    const renderer = makeRenderer(canvas);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.z = 18;

    const size = () => {
        const w = wrap.clientWidth || window.innerWidth;
        const h = wrap.clientHeight || 600;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
    };
    size();
    window.addEventListener('resize', size);

    const geoms = [
        new THREE.IcosahedronGeometry(2.2, 0),
        new THREE.OctahedronGeometry(2.4, 0),
        new THREE.TorusGeometry(1.8, 0.5, 8, 20),
        new THREE.DodecahedronGeometry(2.1, 0),
    ];
    const colors = [ACCENT, ACCENT_2, ACCENT_3, ACCENT];
    const shapes = [];
    for (let i = 0; i < 9; i++) {
        const mesh = new THREE.Mesh(
            geoms[i % geoms.length],
            new THREE.MeshBasicMaterial({ color: colors[i % colors.length], wireframe: true, transparent: true, opacity: 0.6 }),
        );
        mesh.position.set((Math.random() - 0.5) * 28, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 8);
        const s = 0.5 + Math.random() * 0.8;
        mesh.scale.setScalar(s);
        mesh.userData.spin = { x: (Math.random() - 0.5) * 0.01, y: (Math.random() - 0.5) * 0.01 };
        mesh.userData.drift = (Math.random() - 0.5) * 0.01;
        scene.add(mesh);
        shapes.push(mesh);
    }

    const render = () => {
        shapes.forEach((m) => {
            m.rotation.x += m.userData.spin.x;
            m.rotation.y += m.userData.spin.y;
            m.position.y += m.userData.drift;
            if (m.position.y > 9) m.position.y = -9;
            if (m.position.y < -9) m.position.y = 9;
        });
        renderer.render(scene, camera);
    };
    register(canvas, render);
}

// ============================================================
// CERTIFICATIONS — glowing core with orbiting nodes (one per cert)
// ============================================================
function initCertScene() {
    const canvas = document.getElementById('certCanvas');
    if (!canvas) return;
    const wrap = canvas.parentElement;

    const renderer = makeRenderer(canvas);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.z = 16;

    const size = () => {
        const w = wrap.clientWidth || window.innerWidth;
        const h = wrap.clientHeight || 600;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
    };
    size();
    window.addEventListener('resize', size);

    const root = new THREE.Group();
    scene.add(root);

    // Central wireframe sphere.
    const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(2.4, 1),
        new THREE.MeshBasicMaterial({ color: ACCENT, wireframe: true, transparent: true, opacity: 0.5 }),
    );
    root.add(core);

    // 10 orbiting cert nodes on tilted rings.
    const orbiters = [];
    for (let i = 0; i < 10; i++) {
        const ring = new THREE.Group();
        ring.rotation.x = Math.random() * Math.PI;
        ring.rotation.y = Math.random() * Math.PI;
        const radius = 5 + (i % 3) * 1.8;
        const dot = new THREE.Mesh(
            new THREE.SphereGeometry(0.22, 12, 12),
            new THREE.MeshBasicMaterial({ color: i % 2 ? ACCENT_2 : ACCENT_3 }),
        );
        dot.userData = { radius, angle: Math.random() * Math.PI * 2, speed: 0.004 + Math.random() * 0.006 };
        ring.add(dot);
        root.add(ring);
        orbiters.push(dot);
    }

    const render = () => {
        core.rotation.y += 0.003;
        core.rotation.x += 0.0015;
        orbiters.forEach((d) => {
            d.userData.angle += d.userData.speed;
            d.position.set(Math.cos(d.userData.angle) * d.userData.radius, Math.sin(d.userData.angle) * d.userData.radius, 0);
        });
        root.rotation.y += 0.001;
        renderer.render(scene, camera);
    };
    register(canvas, render);
}

// ============================================================
// CONTACT — soft drifting particle field
// ============================================================
function initContactScene() {
    const canvas = document.getElementById('contactCanvas');
    if (!canvas) return;
    const section = document.getElementById('contact');

    const renderer = makeRenderer(canvas);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.z = 6;

    const size = () => {
        const w = section.offsetWidth;
        const h = section.offsetHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
    };
    size();
    window.addEventListener('resize', size);

    const count = 700;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        positions[i * 3]     = (Math.random() - 0.5) * 16;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
        color: ACCENT_2, size: 0.05, transparent: true, opacity: 0.8, sizeAttenuation: true,
    }));
    scene.add(pts);

    const render = () => {
        pts.rotation.y += 0.0012;
        pts.rotation.x += 0.0005;
        renderer.render(scene, camera);
    };
    register(canvas, render);
}

function boot() {
    if (!window.WebGLRenderingContext) return; // graceful no-op if WebGL unsupported
    [initHeroScene, initSkillsScene, initCertScene, initContactScene].forEach((fn) => {
        try { fn(); } catch (err) { console.warn('Scene init failed:', err); }
    });
}

if (document.readyState === 'complete' || document.readyState === 'interactive') boot();
else window.addEventListener('DOMContentLoaded', boot);
