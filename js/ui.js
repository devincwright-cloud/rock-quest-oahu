import { RARITY_META, rarityStars } from "./data/catalog.js";

export function $(sel, root = document) {
  return root.querySelector(sel);
}

export function $$(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v === false || v == null) continue;
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function rarityBadge(rarity) {
  const meta = RARITY_META[rarity] || RARITY_META.common;
  return `<span class="rarity-badge rarity-${rarity}" style="--r:${meta.color}">
    <span class="stars">${rarityStars(rarity)}</span> ${meta.label}
  </span>`;
}

export function toast(message, type = "info") {
  let host = $("#toast-host");
  if (!host) {
    host = el("div", { id: "toast-host", class: "toast-host" });
    document.body.append(host);
  }
  const t = el("div", { class: `toast toast-${type}`, role: "status" }, [message]);
  host.append(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 300);
  }, 2800);
}

export function sparkleBurst(target) {
  const rect = target.getBoundingClientRect();
  const layer = el("div", { class: "sparkle-layer", "aria-hidden": "true" });
  document.body.append(layer);
  for (let i = 0; i < 18; i++) {
    const s = el("span", { class: "sparkle" });
    const x = rect.left + rect.width / 2 + (Math.random() - 0.5) * rect.width;
    const y = rect.top + rect.height / 2 + (Math.random() - 0.5) * rect.height * 0.4;
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    s.style.setProperty("--dx", `${(Math.random() - 0.5) * 120}px`);
    s.style.setProperty("--dy", `${-40 - Math.random() * 80}px`);
    s.style.animationDelay = `${Math.random() * 0.15}s`;
    layer.append(s);
  }
  setTimeout(() => layer.remove(), 900);
}

export function showModal(html, { onClose } = {}) {
  const backdrop = el("div", { class: "modal-backdrop", role: "dialog", "aria-modal": "true" });
  const card = el("div", { class: "modal-card", html });
  backdrop.append(card);
  const close = () => {
    backdrop.classList.remove("open");
    setTimeout(() => backdrop.remove(), 200);
    onClose?.();
  };
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  card.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
  document.body.append(backdrop);
  requestAnimationFrame(() => backdrop.classList.add("open"));
  return { close, el: backdrop };
}

export function celebrateBadge(badge) {
  showModal(`
    <div class="badge-unlock">
      <div class="badge-unlock-emoji">${badge.emoji}</div>
      <p class="eyebrow">Badge unlocked!</p>
      <h2>${badge.name}</h2>
      <p>${badge.description}</p>
      <button class="btn btn-primary btn-lg" data-close type="button">Awesome!</button>
    </div>
  `);
  sparkleBurst(document.body);
}

export function setActiveNav(route) {
  $$(".nav-item").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === route);
  });
}

export function conf(percent) {
  const p = Math.round((percent || 0) * 100);
  return `${p}%`;
}
