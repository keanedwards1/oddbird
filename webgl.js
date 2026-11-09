/* Oddbird — WebGL layer
   The hero is a looping video (assets/hero-cans.*), not WebGL.
   Cans: one fixed, transparent three.js canvas renders a physically lit 3D
      can into the rect of every [data-can3d] element (scissor viewports), so
      the DOM keeps owning layout and GSAP keeps owning choreography.
   If anything here fails, the static <img> and SVG cans remain. */

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ticker = (fn) => (window.gsap ? window.gsap.ticker.add(fn) : (function loop() { fn(); requestAnimationFrame(loop); })());
const root = document.documentElement;

/* Shared pointer + scroll velocity ------------------------------------- */
const pointer = { x: innerWidth / 2, y: innerHeight / 2, active: false };
addEventListener("pointermove", (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; }, { passive: true });
let lastScrollY = scrollY;
let scrollVel = 0;
function sampleScrollVelocity() {
  const lenis = window.__oddbird && window.__oddbird.lenis;
  const v = lenis ? lenis.velocity : scrollY - lastScrollY;
  lastScrollY = scrollY;
  const clamped = Math.max(-35, Math.min(35, v || 0));
  scrollVel += (clamped - scrollVel) * 0.25;
}

/* ======================================================================
   2. 3D CANS
   ====================================================================== */
const FLAVORS = {
  pink: { color: "#f7a497", no: "N° 01", lines: ["Pink", "Grapefruit"], notes: "Ruby grapefruit · rose · rosemary" },
  orange: { color: "#f27a1f", no: "N° 02", lines: ["Blood", "Orange"], notes: "Blood orange · bitter peel · cardamom" },
  yuzu: { color: "#efd36a", no: "N° 03", lines: ["Yuzu", "Bloom"], notes: "Yuzu · elderflower · lemon balm" },
};
const INK = "#340c14";

// Label artwork is laid out in the same units as the SVG can (body = 184 wide,
// 456 tall), then wrapped 360° — front panel centred at u = .5.
const R_SVG = 92;
const CIRC_SVG = 2 * Math.PI * R_SVG;     // ≈ 578
const TEX_W = 2048;
const K = TEX_W / CIRC_SVG;               // px per svg unit
const TEX_H = Math.round(456 * K);

function spaced(ctx, text, x, y, spacing) {
  const widths = [...text].map((c) => ctx.measureText(c).width);
  let cx = x - (widths.reduce((a, b) => a + b, 0) + spacing * (widths.length - 1)) / 2;
  ctx.textAlign = "left";
  [...text].forEach((c, i) => { ctx.fillText(c, cx, y); cx += widths[i] + spacing; });
}

function drawLabel(key) {
  const f = FLAVORS[key];
  const c = document.createElement("canvas");
  c.width = TEX_W; c.height = TEX_H;
  const ctx = c.getContext("2d");
  const Y = (svgY) => (svgY - 58) * K;
  const serif = (s, it = false) => `${it ? "italic " : ""}400 ${s * K}px "Instrument Serif", serif`;
  const sans = (s, w = 600) => `${w} ${s * K}px "Inter Tight", sans-serif`;

  ctx.fillStyle = f.color;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.textBaseline = "alphabetic";

  // --- front (x = 1024) — mirrors the SVG label exactly
  const fx = TEX_W / 2;
  ctx.font = sans(8.6);
  spaced(ctx, "SPARKLING", fx, Y(92), 1.7 * K);
  spaced(ctx, "BOTANICAL", fx, Y(104), 1.7 * K);
  ctx.fillRect(fx - 24 * K, Y(113), 48 * K, 1 * K);
  ctx.textAlign = "center";
  ctx.font = serif(15, true);
  ctx.fillText(f.no, fx, Y(133));
  ctx.save();
  ctx.translate(fx + 34 * K, Y(296));
  ctx.rotate(-Math.PI / 2);
  ctx.font = serif(93);
  ctx.textAlign = "center";
  ctx.fillText("Oddbird", 0, 0);
  ctx.restore();
  ctx.font = serif(20, true);
  ctx.textAlign = "center";
  ctx.fillText(f.lines[0], fx, Y(463));
  ctx.fillText(f.lines[1], fx, Y(484));
  ctx.font = sans(6.6);
  spaced(ctx, "0.0% ALC · 355 ML", fx, Y(509), 1.1 * K);

  // --- right side (x = 1536): seal with circular type
  const sx = TEX_W * 0.75, sy = Y(200);
  const rad = 38 * K;
  ctx.lineWidth = 1 * K;
  ctx.beginPath(); ctx.arc(sx, sy, rad + 9 * K, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(sx, sy, rad - 11 * K, 0, Math.PI * 2); ctx.stroke();
  ctx.font = sans(7.2);
  const ring = "ZERO PROOF · ALL RITUAL · ZERO PROOF · ALL RITUAL · ";
  const step = (Math.PI * 2) / ring.length;
  [...ring].forEach((ch, i) => {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(i * step);
    ctx.textAlign = "center";
    ctx.fillText(ch, 0, -rad + 1.5 * K);
    ctx.restore();
  });
  ctx.font = serif(30, true);
  ctx.textAlign = "center";
  ctx.fillText("ob", sx, sy + 8 * K);
  ctx.font = serif(17, true);
  ["Pour cold.", "Over ice.", "Pass it", "around."].forEach((l, i) => ctx.fillText(l, sx, Y(300) + i * 19 * K));

  // --- left side (x = 512): story + ingredients
  const lx = TEX_W * 0.25;
  ctx.font = sans(6.6);
  spaced(ctx, "TASTING NOTES", lx, Y(150), 1.2 * K);
  ctx.font = serif(13, true);
  ctx.textAlign = "center";
  f.notes.split(" · ").forEach((n, i) => ctx.fillText(n, lx, Y(172) + i * 16 * K));
  ctx.fillRect(lx - 18 * K, Y(228), 36 * K, 1 * K);
  ctx.font = sans(6.6);
  spaced(ctx, "INGREDIENTS", lx, Y(254), 1.2 * K);
  ctx.font = sans(7.4, 450);
  ["Sparkling water, pressed", "citrus juice, cane sugar,", "botanical extracts (gentian,", "rosemary), citric acid,", "natural flavors."]
    .forEach((l, i) => { ctx.textAlign = "center"; ctx.fillText(l, lx, Y(274) + i * 11 * K); });
  ctx.font = sans(6.6);
  spaced(ctx, "ODDBIRD BEVERAGE CO.", lx, Y(360), 1.2 * K);
  // barcode-ish detail
  let bx = lx - 26 * K;
  for (let i = 0; i < 30; i++) {
    const w = ((i * 7) % 3 + 1) * 0.6 * K;
    ctx.fillRect(bx, Y(380), w, 26 * K);
    bx += w + (((i * 5) % 2) + 1) * 0.8 * K;
  }
  return c;
}

function droplets(w, h, kind) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = kind === "bump" ? "#000" : "rgb(150,150,150)";
  ctx.fillRect(0, 0, w, h);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * w, y = rnd() * h;
    const r = 0.8 + Math.pow(rnd(), 3) * 5.5;
    const sy = 1 + rnd() * 0.5;
    const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, 0, x, y, r);
    if (kind === "bump") { g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)"); }
    else { g.addColorStop(0, "rgba(20,20,20,1)"); g.addColorStop(0.85, "rgba(30,30,30,.9)"); g.addColorStop(1, "rgba(30,30,30,0)"); }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * sy, 0, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

async function initCans() {
  const els = [...document.querySelectorAll("[data-can3d]")];
  if (!els.length) return;
  await Promise.all([
    document.fonts.load('400 100px "Instrument Serif"'),
    document.fonts.load('italic 400 100px "Instrument Serif"'),
    document.fonts.load('600 40px "Inter Tight"'),
    document.fonts.load('450 40px "Inter Tight"'),
  ]).catch(() => {});

  const canvas = document.createElement("canvas");
  canvas.className = "cans-gl";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environmentIntensity = 0.9;

  const key = new THREE.DirectionalLight(0xfff1e0, 2.2);
  key.position.set(-4, 6, 6);
  const rim = new THREE.DirectionalLight(0xffd2b0, 2.6);
  rim.position.set(6, 2, -4);
  scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.25));

  // --- geometry
  const R = 0.82, BODY_H = 456 / CIRC_SVG * (2 * Math.PI * R); // keep label aspect true
  const half = BODY_H / 2;
  const rig = new THREE.Group();
  scene.add(rig);

  const aniso = renderer.capabilities.getMaxAnisotropy();
  const bump = new THREE.CanvasTexture(droplets(1024, Math.round(1024 * TEX_H / TEX_W), "bump"));
  const rough = new THREE.CanvasTexture(droplets(1024, Math.round(1024 * TEX_H / TEX_W), "rough"));
  const materials = {};
  for (const k of Object.keys(FLAVORS)) {
    const map = new THREE.CanvasTexture(drawLabel(k));
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = aniso;
    materials[k] = new THREE.MeshPhysicalMaterial({
      map, roughness: 1, roughnessMap: rough, bumpMap: bump, bumpScale: 2.2,
      metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.35,
    });
  }
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, BODY_H, 160, 1, true, Math.PI, Math.PI * 2), materials.pink);
  rig.add(body);

  const metal = new THREE.MeshStandardMaterial({ color: 0xdfe3e7, metalness: 1, roughness: 0.26 });
  const neck = [
    [R, half], [R - 0.004, half + 0.07], [R - 0.04, half + 0.19], [0.71, half + 0.31], [0.665, half + 0.38],
    [0.668, half + 0.41], [0.69, half + 0.435], [0.68, half + 0.47], [0.64, half + 0.465], [0.625, half + 0.4],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const base = [
    [0.0, -half - 0.18], [0.5, -half - 0.24], [0.62, -half - 0.27], [0.7, -half - 0.24], [0.77, -half - 0.17],
    [R - 0.004, -half - 0.07], [R, -half],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  rig.add(new THREE.Mesh(new THREE.LatheGeometry(neck, 128), metal));
  rig.add(new THREE.Mesh(new THREE.LatheGeometry(base, 128), metal));
  const lid = new THREE.Mesh(new THREE.CircleGeometry(0.626, 96), new THREE.MeshStandardMaterial({ color: 0xc9cdd2, metalness: 1, roughness: 0.34 }));
  lid.rotation.x = -Math.PI / 2;
  lid.position.y = half + 0.4;
  rig.add(lid);
  const tab = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.22, 4, 16), metal);
  tab.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  tab.scale.set(1, 1, 0.18);
  tab.position.set(0, half + 0.42, 0.12);
  rig.add(tab);

  // soft contact shadow
  const sc = document.createElement("canvas");
  sc.width = sc.height = 256;
  const sctx = sc.getContext("2d");
  const sg = sctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  sg.addColorStop(0, "rgba(40,8,8,.55)"); sg.addColorStop(0.45, "rgba(40,8,8,.22)"); sg.addColorStop(1, "rgba(40,8,8,0)");
  sctx.fillStyle = sg; sctx.fillRect(0, 0, 256, 256);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -half - 0.27;
  rig.add(shadow);

  // SVG can → 3D mapping: svg 560 units tall; body (456 units) == BODY_H
  const U3 = BODY_H / 456;
  const TOTAL_H = 560 * U3;
  const CENTER_Y = half + 58 * U3 - TOTAL_H / 2;
  const camera = new THREE.PerspectiveCamera(16, 1, 0.1, 100);
  const ELEV = THREE.MathUtils.degToRad(5);

  // per-element motion state
  const items = els.map((el, i) => ({
    el, key: el.dataset.can3d, baseYaw: parseFloat(el.dataset.yaw || "0"),
    yaw: 0, vel: 0, phase: i * 1.7, tiltX: 0,
  }));

  function resize() {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(innerWidth, innerHeight, false);
  }
  addEventListener("resize", resize);

  const parseRot = (el) => {
    const t = getComputedStyle(el).transform;
    if (!t || t === "none") return 0;
    const m = new DOMMatrixReadOnly(t);
    return Math.atan2(m.b, m.a);
  };

  const t0 = performance.now();
  let first = true;
  let lastT = performance.now();
  function frame() {
    sampleScrollVelocity();
    const now = performance.now();
    const dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    const t = (now - t0) / 1000;
    const W = innerWidth, H = innerHeight;

    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);
    let drew = false;

    for (const it of items) {
      const box = it.el.getBoundingClientRect();
      if (!box.width || box.bottom < -200 || box.top > H + 200 || box.right < -200 || box.left > W + 200) continue;

      // undo the 2D rotation to recover the true size of the element
      const a = parseRot(it.el);
      const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
      const det = c * c - s * s || 1;
      const w = (box.width * c - box.height * s) / det;
      const h = (box.height * c - box.width * s) / det;
      const cx = box.left + box.width / 2, cy = box.top + box.height / 2;

      // motion: idle sway + pointer look + scroll-velocity spin, spring-damped
      let target = it.baseYaw;
      if (!reduceMotion) {
        target += Math.sin(t * 0.6 + it.phase) * 0.16;
        if (pointer.active) target += THREE.MathUtils.clamp((pointer.x - cx) / W, -0.6, 0.6) * 0.6;
        it.vel += scrollVel * 0.0009;
      }
      const TAU = Math.PI * 2;
      const nearest = target + TAU * Math.round((it.yaw - target) / TAU);
      it.vel += (nearest - it.yaw) * 14 * dt;
      it.vel *= Math.pow(0.04, dt);
      it.yaw += it.vel * dt * 6;
      const tiltTarget = reduceMotion || !pointer.active ? 0 : THREE.MathUtils.clamp((pointer.y - cy) / H, -0.5, 0.5) * 0.18;
      it.tiltX += (tiltTarget - it.tiltX) * 0.06;

      body.material = materials[it.key] || materials.pink;
      rig.rotation.set(it.tiltX, it.yaw, 0);
      rig.position.set(0, 0, 0);
      // apply element's 2D rotation around view axis
      const outer = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -a);
      rig.quaternion.premultiply(outer);

      // render rect: element rect padded so rotation/tilt never clips
      const padX = w * 0.9, padY = h * 0.14;
      const rw = w + padX * 2, rh = h + padY * 2;
      const rx = cx - rw / 2, ry = cy - rh / 2;
      camera.aspect = rw / rh;
      camera.fov = 16;
      const visH = TOTAL_H * (rh / h);
      const dist = visH / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      camera.position.set(0, CENTER_Y + Math.sin(ELEV) * dist, Math.cos(ELEV) * dist);
      camera.lookAt(0, CENTER_Y, 0);
      camera.updateProjectionMatrix();

      const vy = H - (ry + rh);
      renderer.setViewport(rx, vy, rw, rh);
      renderer.setScissor(rx, vy, rw, rh);
      renderer.render(scene, camera);
      drew = true;
    }
    if (drew && first) {
      first = false;
      root.classList.add("gl-cans");
    }
  }
  ticker(frame);
}

/* ---------------------------------------------------------------------- */
initCans().catch((e) => console.warn("[oddbird] 3D cans disabled:", e));
