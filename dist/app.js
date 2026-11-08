const flavorDetails = {
  pink: {
    tag: "THE BRIGHT ONE",
    name: "Pink\nGrapefruit",
    description: "Tart ruby grapefruit, followed by rose and a clean rosemary finish.",
    notes: ["citrus", "herbal", "crisp"],
    can: "PINK\nGRAPEFRUIT",
    stage: "flavor-stage--pink",
    canClass: "can-illustration--pink",
  },
  orange: {
    tag: "THE BOLD ONE",
    name: "Blood\nOrange",
    description: "Sweet blood orange meets bitter peel and a trace of cardamom.",
    notes: ["juicy", "bittersweet", "spiced"],
    can: "BLOOD\nORANGE",
    stage: "flavor-stage--orange",
    canClass: "can-illustration--orange",
  },
  blue: {
    tag: "THE SOFT ONE",
    name: "Yuzu\nBloom",
    description: "Sharp yuzu meets soft elderflower, with lemon balm at the end.",
    notes: ["floral", "bright", "easy"],
    can: "YUZU\nBLOOM",
    stage: "flavor-stage--blue",
    canClass: "can-illustration--blue",
  },
};

const recipes = {
  bright: {
    count: "01 / 03",
    title: "The Pink",
    flourish: "Outlook",
    description: "Grapefruit, lime, and a little fizz.",
    steps: ["Pink Grapefruit", "Lime, ½ oz", "Soda, to top"],
    instructions: ["Fill a glass with ice", "Add fresh lime", "Pour, stir once, garnish"],
    garnish: "orange",
    copy: "The Pink Outlook — pour Oddbird Pink Grapefruit over ice, add ½ oz fresh lime, top with soda, and garnish with an orange wheel.",
  },
  bitter: {
    count: "02 / 03",
    title: "The Good",
    flourish: "Detour",
    description: "Bitter orange with a rosemary high note.",
    steps: ["Blood Orange", "NA bitter aperitif, 1 oz", "Rosemary sprig"],
    instructions: ["Fill a glass with ice", "Add a little aperitif", "Pour, stir once, garnish"],
    garnish: "herb",
    copy: "The Good Detour — pour Oddbird Blood Orange over ice, add 1 oz non-alcoholic bitter aperitif, stir gently, and garnish with rosemary.",
  },
  soft: {
    count: "03 / 03",
    title: "The Soft",
    flourish: "Landing",
    description: "Floral yuzu with a splash of white grape.",
    steps: ["Yuzu Bloom", "White grape, 1 oz", "Mint leaves"],
    instructions: ["Fill a glass with ice", "Add white grape juice", "Pour, stir once, garnish"],
    garnish: "mint",
    copy: "The Soft Landing — pour Oddbird Yuzu Bloom over ice, add 1 oz white grape juice, stir gently, and finish with mint.",
  },
};

const flavorButtons = [...document.querySelectorAll(".flavor-tab")];
const productStage = document.querySelector(".product-stage");
const featureCan = document.querySelector("#feature-can");

function selectFlavor(key, animate = true) {
  const flavor = flavorDetails[key];
  if (!flavor) return;

  flavorButtons.forEach((button) => {
    const isSelected = button.dataset.flavor === key;
    button.classList.toggle("is-active", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

  productStage.classList.remove(...Object.values(flavorDetails).map((item) => item.stage));
  productStage.classList.add(flavor.stage);
  featureCan.classList.remove(...Object.values(flavorDetails).map((item) => item.canClass));
  featureCan.classList.add(flavor.canClass);
  featureCan.setAttribute("aria-label", "Oddbird " + flavor.can.replace("\n", " ") + " can");
  document.querySelector(".flavor-detail__tag").textContent = flavor.tag;
  document.querySelector(".flavor-detail__name").innerText = flavor.name;
  document.querySelector(".flavor-detail__description").textContent = flavor.description;
  document.querySelector("#can-flavor").innerText = flavor.can;
  document.querySelector(".add-button").dataset.add = flavor.name.replace("\n", " ");
  document.querySelector(".flavor-detail__chips").innerHTML = flavor.notes
    .map((note) => "<span>" + note + "</span>")
    .join("");

  if (animate && window.gsap) {
    gsap.fromTo(featureCan,
      { y: 14, rotation: 0, scale: .94, autoAlpha: .55 },
      { y: 2, rotation: -7, scale: 1, autoAlpha: 1, duration: .55, ease: "back.out(1.8)", overwrite: true }
    );
    gsap.fromTo(".flavor-detail",
      { y: 8, autoAlpha: .5 },
      { y: 0, autoAlpha: 1, duration: .35, ease: "power2.out", overwrite: true }
    );
  }
}

flavorButtons.forEach((button, index) => {
  button.addEventListener("click", () => selectFlavor(button.dataset.flavor));
  button.addEventListener("keydown", (event) => {
    if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(event.key)) return;
    event.preventDefault();
    const direction = ["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1;
    const next = (index + direction + flavorButtons.length) % flavorButtons.length;
    flavorButtons[next].focus();
    selectFlavor(flavorButtons[next].dataset.flavor);
  });
});

const recipeButtons = [...document.querySelectorAll(".recipe-tab")];
let activeRecipe = "bright";

function selectRecipe(key) {
  const recipe = recipes[key];
  if (!recipe) return;
  activeRecipe = key;
  recipeButtons.forEach((button) => {
    const isSelected = button.dataset.recipe === key;
    button.classList.toggle("is-active", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

  document.querySelector(".mix-builder__count").textContent = recipe.count;
  document.querySelector(".recipe-title").innerHTML = recipe.title + "<br /><em>" + recipe.flourish + "</em>";
  document.querySelector(".recipe-description").textContent = recipe.description;
  recipe.steps.forEach((step, index) => {
    document.querySelector("#recipe-step-" + ["one", "two", "three"][index]).textContent = step;
    document.querySelectorAll(".recipe-steps small")[index].textContent = recipe.instructions[index];
  });
  document.querySelector(".garnish--orange").classList.toggle("is-hidden", recipe.garnish !== "orange");
  document.querySelector(".garnish--herb").classList.toggle("is-hidden", recipe.garnish === "orange");
  document.querySelector(".garnish--herb").style.background = recipe.garnish === "mint" ? "#758d57" : "#667b44";

  if (window.gsap) {
    gsap.fromTo(".recipe-glass", { rotation: -8, scale: .92 }, {
      rotation: 0, scale: 1, duration: .5, ease: "back.out(1.8)", overwrite: true,
    });
    gsap.fromTo(".recipe-info", { x: 12, autoAlpha: .6 }, {
      x: 0, autoAlpha: 1, duration: .35, ease: "power2.out", overwrite: true,
    });
  }
}

recipeButtons.forEach((button, index) => {
  button.addEventListener("click", () => selectRecipe(button.dataset.recipe));
  button.addEventListener("keydown", (event) => {
    if (!["ArrowRight", "ArrowLeft"].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = (index + direction + recipeButtons.length) % recipeButtons.length;
    recipeButtons[next].focus();
    selectRecipe(recipeButtons[next].dataset.recipe);
  });
});

const toast = document.querySelector("#toast");
let toastTimer;
function announce(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

let bagCount = 0;
document.querySelectorAll("[data-add]").forEach((button) => {
  button.addEventListener("click", () => {
    bagCount += 1;
    const count = document.querySelector(".bag-count");
    count.textContent = String(bagCount);
    count.setAttribute("aria-label", bagCount + (bagCount === 1 ? " item in bag" : " items in bag"));
    if (window.gsap) gsap.fromTo(count, { scale: 1.35 }, { scale: 1, duration: .45, ease: "back.out(2)" });
    announce(button.dataset.add + " added to your bag.");
  });
});

document.querySelector("#copy-recipe").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(recipes[activeRecipe].copy);
    announce("Recipe copied. Go make something good.");
  } catch {
    announce("Your recipe is ready to copy from the ingredients above.");
  }
});

document.querySelector("#newsletter-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const email = document.querySelector("#email");
  if (!email.reportValidity()) return;
  document.querySelector("#newsletter-message").textContent = "Thanks for trying the signup.";
  email.value = "";
});

const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.querySelector("#main-nav");
menuToggle.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  menuToggle.querySelector(".menu-toggle__label").textContent = isOpen ? "Menu" : "Close";
  mainNav.classList.toggle("is-open", !isOpen);
});
mainNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.querySelector(".menu-toggle__label").textContent = "Menu";
    mainNav.classList.remove("is-open");
  });
});

// GSAP is loaded from the CDN; ScrollTrigger registration and usage follow:
// https://gsap.com/docs/v3/Installation/ and https://gsap.com/docs/v3/Plugins/ScrollTrigger/
if (window.gsap && window.ScrollTrigger && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  gsap.registerPlugin(ScrollTrigger);
  const heroTimeline = gsap.timeline({ defaults: { ease: "power3.out" } });
  heroTimeline
    .from(".site-header .wordmark", { y: -15, autoAlpha: 0, duration: .5 })
    .from(".main-nav a, .bag-link", { y: -9, autoAlpha: 0, stagger: .08, duration: .35 }, "-=.2")
    .from(".hero .eyebrow", { y: 16, autoAlpha: 0, duration: .4 }, "-=.05")
    .from(".hero h1", { y: 35, autoAlpha: 0, duration: .7 }, "-=.18")
    .from(".hero__intro, .hero__actions, .hero__notes", { y: 17, autoAlpha: 0, stagger: .11, duration: .42 }, "-=.32")
    .from(".hero__art img", { clipPath: "inset(0 0 0 100%)", duration: 1.05, ease: "power2.inOut" }, "-=.75")
    .from(".hero-sticker", { scale: 0, rotation: -28, duration: .5, ease: "back.out(1.8)" }, "-=.35");

  gsap.to(".hero-sticker", { y: -7, rotation: 14, duration: 2.4, yoyo: true, repeat: -1, ease: "sine.inOut" });
  gsap.to(".hero__doodle--one", { rotation: 48, duration: 8, repeat: -1, ease: "none" });
  gsap.to(".hero__art img", {
    yPercent: 6,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: .5 },
  });
  gsap.to(".stage-sun", {
    y: -24,
    scale: 1.12,
    ease: "none",
    scrollTrigger: { trigger: ".product-stage", start: "top bottom", end: "bottom top", scrub: .7 },
  });

  gsap.utils.toArray(".intro-strip, .section-heading, .flavor-tabs, .product-stage, .mix-copy, .mix-builder, .manifesto__seal, .manifesto__lead, .manifesto__body, .newsletter > div, .newsletter-form").forEach((element) => {
    gsap.fromTo(element, { y: 30, autoAlpha: 0 }, {
      y: 0,
      autoAlpha: 1,
      duration: .72,
      ease: "power2.out",
      scrollTrigger: { trigger: element, start: "top 86%", once: true },
    });
  });
}
