/* Oddbird — interactions & motion
   GSAP 3.13 + ScrollTrigger, Lenis smooth scroll. Everything degrades
   gracefully: no GSAP / reduced motion = static, fully usable page. */

(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = Boolean(window.gsap && window.ScrollTrigger);

  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } },
  };
  const session = {
    get(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { sessionStorage.setItem(key, value); } catch { /* ignore */ } },
  };

  /* ------------------------------------------------------------------
     Text utilities
     ------------------------------------------------------------------ */
  // Split [data-split] headings into masked words, preserving <em>/<br>.
  function splitWords(el) {
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(document.createTextNode(" ")); return; }
            const w = document.createElement("span");
            w.className = "w";
            const i = document.createElement("span");
            i.className = "w__i";
            i.textContent = part;
            w.append(i);
            frag.append(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== "BR") {
          walk(child);
        }
      });
    };
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    walk(el);
    $$(".w", el).forEach((w) => w.setAttribute("aria-hidden", "true"));
    return $$(".w__i", el);
  }

  // Split a paragraph into plain word spans for opacity scrubbing.
  function splitPlain(el) {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute("aria-label", words.join(" "));
    el.innerHTML = words.map((w) => `<span class="word" aria-hidden="true">${w}</span>`).join(" ");
    return $$(".word", el);
  }

  // Rolling button labels
  $$(".btn__text[data-text]").forEach((el) => {
    const roll = document.createElement("span");
    roll.className = "btn__roll";
    roll.dataset.text = el.dataset.text;
    roll.textContent = el.textContent;
    el.textContent = "";
    el.append(roll);
  });

  /* ------------------------------------------------------------------
     Toast
     ------------------------------------------------------------------ */
  const toastEl = $("[data-toast]");
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 2800);
  }

  /* ------------------------------------------------------------------
     Smooth scroll (Lenis)
     ------------------------------------------------------------------ */
  let lenis = null;
  if (window.Lenis && hasGsap && !reduceMotion) {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  // Shared with webgl.js (scroll velocity)
  const shared = (window.__oddbird = { lenis });

  /* ------------------------------------------------------------------
     Hero cinemagraph: starts with the hero reveal, pauses off-screen.
     Skipped for reduced motion / data saver (the photo stays).
     ------------------------------------------------------------------ */
  const heroVideo = $("[data-hero-video]");
  const saveData = Boolean(navigator.connection && navigator.connection.saveData);
  let heroVideoOn = false;
  if (heroVideo) {
    if (reduceMotion || saveData) heroVideo.remove();
    else heroVideo.addEventListener("playing", () => heroVideo.classList.add("is-playing"), { once: true });
  }
  const playHeroVideo = () => {
    if (!heroVideo || !heroVideo.isConnected || reduceMotion || saveData) return;
    heroVideoOn = true;
    const p = heroVideo.play();
    if (p && p.catch) p.catch(() => { /* autoplay blocked: the still photo remains */ });
  };
  if (heroVideo && "IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => {
      if (!heroVideoOn || !heroVideo.isConnected) return;
      if (e.isIntersecting) heroVideo.play().catch(() => {});
      else heroVideo.pause();
    }).observe(heroVideo);
  }
  const signalReveal = playHeroVideo;
  const scrollLock = {
    on() { lenis ? lenis.stop() : (document.body.style.overflow = "hidden"); },
    off() { lenis ? lenis.start() : (document.body.style.overflow = ""); },
  };
  function scrollToTarget(target) {
    if (lenis) lenis.scrollTo(target, { duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else (typeof target === "number" ? window.scrollTo({ top: target }) : target.scrollIntoView());
  }
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      const target = id === "#top" ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      closeMenu(false);
      closeCart(false);
      scrollToTarget(target);
      if (target !== 0) history.replaceState(null, "", id);
    });
  });

  /* ------------------------------------------------------------------
     Header: solid after hero, hide on scroll down, show on scroll up
     ------------------------------------------------------------------ */
  const header = $("[data-header]");
  const hero = $(".hero");
  let lastY = window.scrollY;
  function onScroll() {
    const y = window.scrollY;
    const pastHero = y > hero.offsetHeight - header.offsetHeight;
    header.classList.toggle("is-solid", pastHero);
    const goingDown = y > lastY + 4;
    const goingUp = y < lastY - 4;
    if (goingDown && y > 240 && !menuOpen) header.classList.add("is-hidden");
    if (goingUp || y < 240) header.classList.remove("is-hidden");
    lastY = y;
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ------------------------------------------------------------------
     Mobile menu
     ------------------------------------------------------------------ */
  const menu = $("[data-menu]");
  const menuBtn = $("[data-menu-toggle]");
  let menuOpen = false;
  function openMenu() {
    menuOpen = true;
    menu.inert = false;
    menu.classList.add("is-open");
    menuBtn.setAttribute("aria-expanded", "true");
    $(".menu-trigger__label", menuBtn).textContent = "Close";
    header.classList.remove("is-hidden");
    scrollLock.on();
    if (hasGsap && !reduceMotion) {
      gsap.fromTo($$("nav a", menu), { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.9, stagger: 0.06, ease: "expo.out", delay: 0.2 });
    }
  }
  function closeMenu(restoreFocus = true) {
    if (!menuOpen) return;
    menuOpen = false;
    menu.classList.remove("is-open");
    menu.inert = true;
    menuBtn.setAttribute("aria-expanded", "false");
    $(".menu-trigger__label", menuBtn).textContent = "Menu";
    scrollLock.off();
    if (restoreFocus) menuBtn.focus();
  }
  menuBtn.addEventListener("click", () => (menuOpen ? closeMenu() : openMenu()));

  /* ------------------------------------------------------------------
     Cart
     ------------------------------------------------------------------ */
  const PRODUCTS = {
    pink: { name: "Pink Grapefruit", meta: "12 cans", price: 36, can: "can-pink", thumb: "#f9b4a8" },
    orange: { name: "Blood Orange", meta: "12 cans", price: 36, can: "can-orange", thumb: "#f58a3a" },
    yuzu: { name: "Yuzu Bloom", meta: "12 cans", price: 36, can: "can-yuzu", thumb: "#f1dc82" },
    mixed: { name: "The Mixed Case", meta: "4 of each · 12 cans", price: 36, can: null, thumb: "#fcc961" },
  };
  let cart = store.get("oddbird-cart", {});
  Object.keys(cart).forEach((k) => { if (!PRODUCTS[k] || !(cart[k] > 0)) delete cart[k]; });

  const cartEl = $("#cart");
  const scrim = $("[data-scrim]");
  const cartBtn = $("[data-cart-open]");
  const itemsEl = $("[data-cart-items]");
  let cartOpen = false;
  let lastFocus = null;

  const money = (n) => "$" + n.toFixed(0);
  const canSvg = (id) => `<svg viewBox="0 0 200 560" aria-hidden="true"><use href="#${id}"/></svg>`;

  function renderCart() {
    const entries = Object.entries(cart);
    const count = entries.reduce((s, [, q]) => s + q, 0);
    const total = entries.reduce((s, [k, q]) => s + PRODUCTS[k].price * q, 0);
    $("[data-cart-count]").textContent = count;
    cartBtn.setAttribute("aria-label", `Cart, ${count} ${count === 1 ? "item" : "items"}`);
    $("[data-cart-total]").textContent = money(total);
    $("[data-cart-empty]").hidden = count > 0;
    $(".cart__foot").hidden = count === 0;
    $("[data-cart-ship]").innerHTML = count >= 2
      ? "<b>Free shipping</b> is on us."
      : "Add one more case for <b>free shipping</b>.";
    itemsEl.innerHTML = entries.map(([k, q]) => {
      const p = PRODUCTS[k];
      const thumb = p.can ? canSvg(p.can) : canSvg("can-pink") + canSvg("can-yuzu") + canSvg("can-orange");
      return `<li class="cart-item">
        <div class="cart-item__thumb ${p.can ? "" : "cart-item__thumb--mixed"}" style="--thumb:${p.thumb}">${thumb}</div>
        <div>
          <p class="cart-item__name">${p.name}</p>
          <p class="cart-item__meta">${p.meta}</p>
          <div class="qty" role="group" aria-label="Quantity for ${p.name}">
            <button type="button" data-qty="-1" data-id="${k}" aria-label="Remove one ${p.name}">−</button>
            <output aria-live="polite">${q}</output>
            <button type="button" data-qty="1" data-id="${k}" aria-label="Add one ${p.name}">+</button>
          </div>
        </div>
        <p class="cart-item__price">${money(p.price * q)}</p>
      </li>`;
    }).join("");
    store.set("oddbird-cart", cart);
  }

  function trapFocus(e) {
    if (e.key !== "Tab") return;
    const f = $$("button:not([hidden]), a[href], input", cartEl).filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function openCart() {
    if (cartOpen) return;
    closeMenu(false);
    cartOpen = true;
    lastFocus = document.activeElement;
    cartEl.inert = false;
    cartEl.classList.add("is-open");
    scrim.classList.add("is-on");
    cartBtn.setAttribute("aria-expanded", "true");
    scrollLock.on();
    cartEl.addEventListener("keydown", trapFocus);
    setTimeout(() => $(".cart__close").focus({ preventScroll: true }), 50);
  }
  function closeCart(restoreFocus = true) {
    if (!cartOpen) return;
    cartOpen = false;
    cartEl.classList.remove("is-open");
    scrim.classList.remove("is-on");
    cartEl.inert = true;
    cartBtn.setAttribute("aria-expanded", "false");
    scrollLock.off();
    cartEl.removeEventListener("keydown", trapFocus);
    if (restoreFocus && lastFocus) lastFocus.focus({ preventScroll: true });
  }

  cartBtn.addEventListener("click", openCart);
  $$("[data-cart-close]").forEach((el) => el.addEventListener("click", () => closeCart()));
  itemsEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-qty]");
    if (!b) return;
    const id = b.dataset.id;
    cart[id] = (cart[id] || 0) + Number(b.dataset.qty);
    if (cart[id] <= 0) delete cart[id];
    renderCart();
    const again = $(`[data-id="${id}"][data-qty="${b.dataset.qty}"]`, itemsEl) || $(".cart__close");
    again.focus();
  });
  $$("[data-add]").forEach((b) => b.addEventListener("click", () => {
    const id = b.dataset.add;
    cart[id] = (cart[id] || 0) + 1;
    renderCart();
    if (hasGsap) gsap.fromTo("[data-cart-count]", { scale: 1.6 }, { scale: 1, duration: 0.6, ease: "elastic.out(1, .5)" });
    openCart();
  }));
  $("[data-checkout]").addEventListener("click", () => toast("Checkout opens at launch. This is a preview."));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (cartOpen) closeCart();
    else if (menuOpen) closeMenu();
  });
  renderCart();

  /* ------------------------------------------------------------------
     Rituals (recipe tabs)
     ------------------------------------------------------------------ */
  const RECIPES = {
    bright: {
      mood: "Bright · Pink Grapefruit",
      name: "The Pink <em>Outlook</em>",
      desc: "Grapefruit, lime and a little extra fizz. Make it in a tall glass with plenty of ice.",
      steps: [["Fill", "a tall glass with ice"], ["Pour", "one can of Pink Grapefruit and ½ oz fresh lime"], ["Top", "with soda and finish with an orange wheel"]],
      liquid: "#f26f5c", garnish: "citrus",
      copy: "The Pink Outlook: fill a tall glass with ice, pour one can of Oddbird Pink Grapefruit and ½ oz fresh lime, top with soda and garnish with an orange wheel.",
    },
    bitter: {
      mood: "Bittersweet · Blood Orange",
      name: "The Good <em>Detour</em>",
      desc: "Blood orange with a non-alcoholic bitter aperitif. Serve it short, over one big cube.",
      steps: [["Fill", "a rocks glass with one large cube"], ["Pour", "1 oz non-alcoholic bitter aperitif, then Blood Orange"], ["Stir", "once and garnish with a sprig of rosemary"]],
      liquid: "#d2421d", garnish: "sprig",
      copy: "The Good Detour: over one large cube, pour 1 oz non-alcoholic bitter aperitif and top with Oddbird Blood Orange. Stir once, garnish with rosemary.",
    },
    soft: {
      mood: "Soft · Yuzu Bloom",
      name: "The Soft <em>Landing</em>",
      desc: "Floral yuzu with a splash of white grape and a few fresh mint leaves. Good for a long afternoon.",
      steps: [["Fill", "a wine glass with ice"], ["Pour", "Yuzu Bloom with 1 oz white grape juice"], ["Clap", "a few mint leaves and drop them in"]],
      liquid: "#e9cd6c", garnish: "mint",
      copy: "The Soft Landing: fill a wine glass with ice, pour Oddbird Yuzu Bloom with 1 oz white grape juice, and finish with a few clapped mint leaves.",
    },
  };
  const tabs = $$(".recipe-tab");
  const panel = $("#recipe-panel");
  const liquid = $("[data-liquid]");
  let currentRecipe = "bright";
  let glassTl = null;
  if (hasGsap) gsap.set([liquid, ...$$("[data-garnish]")], { transformOrigin: "50% 100%" });

  function setGarnish(name) {
    $$("[data-garnish]").forEach((g) => g.classList.toggle("is-on", g.dataset.garnish === name));
  }
  function selectRecipe(key, focus = false) {
    const r = RECIPES[key];
    if (!r || key === currentRecipe) { if (focus) $(`[data-recipe="${key}"]`).focus(); return; }
    currentRecipe = key;
    tabs.forEach((t) => {
      const on = t.dataset.recipe === key;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    panel.setAttribute("aria-labelledby", "tab-" + key);

    const fill = () => {
      $('[data-r="mood"]').textContent = r.mood;
      $('[data-r="name"]').innerHTML = r.name;
      $('[data-r="desc"]').textContent = r.desc;
      $('[data-r="steps"]').innerHTML = r.steps.map(([a, b]) => `<li><span>${a}</span>${b}</li>`).join("");
    };

    if (hasGsap && !reduceMotion) {
      const body = $("[data-recipe-body]");
      const tl = gsap.timeline({ defaults: { overwrite: "auto" } });
      tl.to(body, { opacity: 0, y: 10, duration: 0.25, ease: "power2.in" })
        .add(fill)
        .to(body, { opacity: 1, y: 0, duration: 0.6, ease: "expo.out" });
      if (glassTl) glassTl.kill();
      glassTl = gsap.timeline()
        .to("[data-garnish]", { opacity: 0, y: -20, rotation: -12, duration: 0.3, ease: "power2.in" })
        .to(liquid, { scaleY: 0.08, duration: 0.35, ease: "power2.in" }, 0)
        .add(() => { setGarnish(r.garnish); gsap.set(`[data-garnish="${r.garnish}"]`, { opacity: 0, y: -40, rotation: 14 }); })
        .set(liquid, { attr: { fill: r.liquid } })
        .to(liquid, { scaleY: 1, duration: 1.1, ease: "expo.out" })
        .to(`[data-garnish="${r.garnish}"]`, { opacity: 1, y: 0, rotation: 0, duration: 0.9, ease: "back.out(1.8)" }, "-=.8");
    } else {
      fill();
      liquid.setAttribute("fill", r.liquid);
      setGarnish(r.garnish);
    }
  }
  setGarnish("citrus");
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => selectRecipe(t.dataset.recipe));
    t.addEventListener("keydown", (e) => {
      const map = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      let next = null;
      if (e.key in map) next = (i + map[e.key] + tabs.length) % tabs.length;
      if (e.key === "Home") next = 0;
      if (e.key === "End") next = tabs.length - 1;
      if (next === null) return;
      e.preventDefault();
      selectRecipe(tabs[next].dataset.recipe, true);
    });
  });
  $("[data-copy-recipe]").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(RECIPES[currentRecipe].copy);
      toast("Recipe copied. Go make something good.");
    } catch {
      toast("Couldn't reach the clipboard. The recipe is right there.");
    }
  });

  /* ------------------------------------------------------------------
     Newsletter (preview only — nothing is sent)
     ------------------------------------------------------------------ */
  const form = $("[data-newsletter]");
  const msg = $("[data-newsletter-msg]");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("input", form);
    if (!input.value || !input.checkValidity()) {
      msg.textContent = "That email doesn't look quite right.";
      input.focus();
      return;
    }
    msg.textContent = "Thanks. Sign-ups open at launch; nothing was sent in this preview.";
    input.value = "";
  });

  /* ------------------------------------------------------------------
     Motion
     ------------------------------------------------------------------ */
  const introSeen = session.get("oddbird-intro");
  if (!hasGsap || reduceMotion || introSeen) root.classList.add("intro-skip");
  if (!hasGsap) { playHeroVideo(); return; }

  gsap.registerPlugin(ScrollTrigger);
  const splitTargets = $$("[data-split]").map((el) => ({ el, words: splitWords(el) }));
  const mm = gsap.matchMedia();

  mm.add({
    motion: "(prefers-reduced-motion: no-preference)",
    wide: "(min-width: 901px)",
  }, (ctx) => {
    const { motion, wide } = ctx.conditions;
    if (!motion) return;

    /* --- Intro + hero entrance --- */
    const heroWords = splitTargets.find((s) => s.el.classList.contains("hero__title")).words;
    const heroImg = $("[data-hero-layer]");
    const fades = $$("[data-hero-fade]");
    gsap.set(heroWords, { yPercent: 140 });
    gsap.set(fades, { opacity: 0, y: 24 });
    gsap.set(header, { opacity: 0, y: -12 });

    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    if (!introSeen) {
      session.set("oddbird-intro", "1");
      const letters = $$(".intro__word span");
      tl.from(letters, { yPercent: 110, duration: 1, stagger: 0.045 })
        .from(".intro__meta", { opacity: 0, y: 10, duration: 0.8 }, "-=.6")
        .to(".intro__word", { yPercent: -30, opacity: 0, duration: 0.7, ease: "power3.in" }, "+=.25")
        .to(".intro__meta", { opacity: 0, duration: 0.4 }, "<")
        .to(".intro", { yPercent: -100, duration: 1.1, ease: "expo.inOut" }, "-=.25")
        .set(".intro", { display: "none" });
    }
    tl.add(signalReveal, introSeen ? 0 : "-=1.05")
      .fromTo(heroImg, { scale: 1.22 }, { scale: 1, duration: 2.2 }, "<")
      .to(heroWords, { yPercent: 0, duration: 1.3, stagger: 0.07 }, "<.15")
      .to(header, { opacity: 1, y: 0, duration: 1 }, "<.3")
      .to(fades, { opacity: 1, y: 0, duration: 1.1, stagger: 0.08 }, "<.15");

    /* --- Hero scroll-out --- */
    gsap.to(heroImg, {
      yPercent: wide ? 10 : 6, ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
    });
    gsap.to(".hero__content", {
      y: wide ? -90 : -30, opacity: wide ? 0.15 : 1, ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
    });

    /* --- Generic split heading reveals --- */
    splitTargets.filter((s) => !s.el.classList.contains("hero__title")).forEach(({ el, words }) => {
      gsap.fromTo(words, { yPercent: 140 }, {
        yPercent: 0, duration: 1.2, stagger: 0.06, ease: "expo.out",
        scrollTrigger: { trigger: el, start: "top 85%", once: true },
      });
    });

    /* --- Story: word-by-word ink --- */
    const statement = $("[data-words]");
    const words = splitPlain(statement);
    gsap.fromTo(words, { opacity: 0.14 }, {
      opacity: 1, ease: "none", stagger: 0.1,
      scrollTrigger: { trigger: statement, start: "top 78%", end: "bottom 42%", scrub: true },
    });
    gsap.from(".pillar", {
      y: 60, opacity: 0, duration: 1.2, stagger: 0.12, ease: "expo.out",
      scrollTrigger: { trigger: ".pillars", start: "top 82%", once: true },
    });

    /* --- Lineup: plain vertical scroll, gentle parallax per panel --- */
    $$(".panel--flavor").forEach((p) => {
      const st = { trigger: p, start: "top bottom", end: "bottom top", scrub: true };
      gsap.fromTo($(".can", p), { yPercent: 10, rotation: 5 }, { yPercent: -6, rotation: -3, ease: "none", scrollTrigger: st });
      gsap.fromTo($(".flavor__sun", p), { scale: 0.82 }, { scale: 1.05, ease: "none", scrollTrigger: { ...st } });
      gsap.from($$(".flavor__info > *", p), {
        y: 40, opacity: 0, duration: 1, stagger: 0.06, ease: "expo.out",
        scrollTrigger: { trigger: $(".flavor__info", p), start: "top 85%", once: true },
      });
    });
  });

  // Animations that are independent of breakpoint (still motion-gated)
  mm.add("(prefers-reduced-motion: no-preference)", () => {
    /* --- Mixed case: cans fan out --- */
    const fan = { l: { xPercent: -78, rotation: -10 }, r: { xPercent: 78, rotation: 10 }, c: { yPercent: -4, rotation: 0 } };
    $$("[data-fan]").forEach((el) => {
      const to = fan[el.dataset.fan];
      gsap.fromTo(el, { x: 0, y: 0, xPercent: 0, yPercent: 30, rotation: 0, opacity: el.dataset.fan === "c" ? 1 : 0 }, {
        x: 0, y: 0, xPercent: 0, ...to, yPercent: to.yPercent || 0, opacity: 1, ease: "none",
        scrollTrigger: { trigger: ".mixed__stage", start: "top 90%", end: "center 55%", scrub: 0.6 },
      });
    });
    gsap.from(".mixed__tag", {
      scale: 0, rotation: -90, duration: 1.2, ease: "back.out(1.6)",
      scrollTrigger: { trigger: ".mixed__stage", start: "center 70%", once: true },
    });
    gsap.from(".mixed__copy > :not(.mixed__title)", {
      y: 40, opacity: 0, duration: 1.1, stagger: 0.07, ease: "expo.out",
      scrollTrigger: { trigger: ".mixed__copy", start: "top 80%", once: true },
    });

    /* --- Rituals --- */
    gsap.from(".recipe-tab", {
      y: 40, opacity: 0, duration: 1.1, stagger: 0.08, ease: "expo.out", clearProps: "opacity",
      scrollTrigger: { trigger: ".recipes", start: "top 82%", once: true },
    });
    gsap.from(".recipe-card", {
      y: 80, opacity: 0, duration: 1.3, ease: "expo.out",
      scrollTrigger: { trigger: ".recipe-card", start: "top 88%", once: true },
    });
    gsap.from(liquid, {
      scaleY: 0, duration: 1.6, ease: "expo.out",
      scrollTrigger: { trigger: ".recipe-card", start: "top 70%", once: true },
    });
    gsap.to(".glass__bubbles circle", {
      y: -60, opacity: 0, duration: 2.4, ease: "none",
      stagger: { each: 0.4, repeat: -1 },
    });

    /* --- Newsletter + footer --- */
    gsap.from(".newsletter__side > *", {
      y: 30, opacity: 0, duration: 1, stagger: 0.08, ease: "expo.out",
      scrollTrigger: { trigger: ".newsletter__side", start: "top 85%", once: true },
    });
    gsap.from("[data-footer-word] span", {
      yPercent: 125, duration: 1.4, stagger: 0.05, ease: "expo.out",
      scrollTrigger: { trigger: "[data-footer-word]", start: "top 95%", once: true },
    });
  });

  // Fonts change metrics — refresh pin distances once they're in.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener("load", () => ScrollTrigger.refresh());
})();
