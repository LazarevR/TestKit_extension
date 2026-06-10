// ============================================================
// TestKit — Meta Tags (SEO) Popup
// ============================================================

// Known tags: key (name or property) → { group, desc, expected }
// expected = true means we warn if absent
const META_INFO = {
  // ── Basic SEO ──────────────────────────────────────────────
  "description":      { group: "seo",      expected: true,  desc: "Описание страницы для поисковиков. Отображается в сниппете выдачи. Рекомендуемая длина: 120–160 символов." },
  "keywords":         { group: "seo",      expected: false, desc: "Ключевые слова. Google игнорирует, Яндекс учитывает частично." },
  "robots":           { group: "seo",      expected: false, desc: "Инструкции для роботов: index/noindex, follow/nofollow, max-snippet и т.д." },
  "author":           { group: "seo",      expected: false, desc: "Автор страницы." },
  "googlebot":        { group: "seo",      expected: false, desc: "Инструкции специально для робота Google." },
  "yandex":           { group: "seo",      expected: false, desc: "Инструкции для робота Яндекса." },
  // ── Open Graph ─────────────────────────────────────────────
  "og:title":         { group: "og",       expected: true,  desc: "Заголовок превью при шеринге в соцсетях." },
  "og:description":   { group: "og",       expected: true,  desc: "Описание превью. Рекомендуемая длина: 150–300 символов." },
  "og:image":         { group: "og",       expected: true,  desc: "Изображение превью. Рекомендуемый размер: 1200×630 px." },
  "og:url":           { group: "og",       expected: false, desc: "Канонический URL страницы для шеринга." },
  "og:type":          { group: "og",       expected: false, desc: "Тип контента: website, article, product, book и т.д." },
  "og:site_name":     { group: "og",       expected: false, desc: "Название сайта, отображаемое рядом с превью." },
  "og:locale":        { group: "og",       expected: false, desc: "Язык и регион контента (например, ru_RU)." },
  "og:image:width":   { group: "og",       expected: false, desc: "Ширина OG-изображения в пикселях." },
  "og:image:height":  { group: "og",       expected: false, desc: "Высота OG-изображения в пикселях." },
  "og:image:alt":     { group: "og",       expected: false, desc: "Alt-текст для OG-изображения (доступность)." },
  // ── Twitter ────────────────────────────────────────────────
  "twitter:card":        { group: "twitter", expected: true,  desc: "Тип карточки: summary, summary_large_image, app, player." },
  "twitter:title":       { group: "twitter", expected: false, desc: "Заголовок карточки. Если не указан — берётся og:title." },
  "twitter:description": { group: "twitter", expected: false, desc: "Описание карточки. Если не указано — берётся og:description." },
  "twitter:image":       { group: "twitter", expected: false, desc: "Изображение карточки. Если не указано — берётся og:image." },
  "twitter:site":        { group: "twitter", expected: false, desc: "@username сайта в Twitter/X." },
  "twitter:creator":     { group: "twitter", expected: false, desc: "@username автора контента." },
  // ── Technical ──────────────────────────────────────────────
  "viewport":         { group: "technical", expected: true,  desc: "Управляет масштабированием на мобильных устройствах. Обязателен для адаптивного дизайна." },
  "theme-color":      { group: "technical", expected: false, desc: "Цвет адресной строки / UI браузера на мобильных." },
  "color-scheme":     { group: "technical", expected: false, desc: "Поддерживаемые цветовые схемы: light, dark, light dark." },
  "application-name": { group: "technical", expected: false, desc: "Название веб-приложения (используется, если нет manifest.json)." },
  "generator":        { group: "technical", expected: false, desc: "CMS или инструмент, которым создана страница." },
  "format-detection": { group: "technical", expected: false, desc: "Управляет автодетектом телефонов/дат браузером Safari." },
};

const GROUPS = [
  { key: "seo",       label: "Основные SEO",  color: "#22c55e" },
  { key: "og",        label: "Open Graph",     color: "#6366f1" },
  { key: "twitter",   label: "Twitter / X",    color: "#06b6d4" },
  { key: "technical", label: "Техническое",    color: "#a855f7" },
  { key: "other",     label: "Прочие теги",    color: "#64748b" },
];

// ── Init ─────────────────────────────────────────────────────
async function init() {
  document.getElementById("content").addEventListener("click", e => {
    const h = e.target.closest(".section-header[data-key]");
    if (h) document.getElementById("sec-" + h.dataset.key)?.classList.toggle("collapsed");
  });

  try {
    const { metaScan } = await chrome.storage.session.get("metaScan");
    if (!metaScan) { renderError("Данные не найдены. Попробуйте снова."); return; }
    renderHeader(metaScan);
    renderBody(metaScan);
  } catch (err) {
    renderError("Ошибка: " + err.message);
  }
}

// ── Header bar ───────────────────────────────────────────────
function renderHeader({ url, title, favIconUrl, timestamp }) {
  const domain = (() => { try { return new URL(url).hostname; } catch { return url; } })();
  const time   = new Date(timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const el     = document.getElementById("header");
  el.innerHTML = `
    <img class="header-favicon" id="hfav"
         src="${favIconUrl || "https://www.google.com/s2/favicons?sz=32&domain=" + encodeURIComponent(domain)}" alt="">
    <div class="header-text">
      <div class="header-title" title="${esc(title)}">${esc(title || domain)}</div>
      <div class="header-url"   title="${esc(url)}">${esc(domain)}</div>
    </div>
    <span class="header-badge">${time}</span>`;
  document.getElementById("hfav")?.addEventListener("error", function () { this.style.display = "none"; });
}

// ── Body ─────────────────────────────────────────────────────
function renderBody({ pageTitle, tags, canonical }) {
  // Build normalized lookup: key → first value found
  const found = new Map();
  for (const tag of tags) {
    const key = (tag.property || tag.name || "").toLowerCase();
    if (tag.charset && !found.has("__charset__")) { found.set("__charset__", tag.charset); continue; }
    if (tag.httpEquiv) {
      const k = "http-equiv:" + tag.httpEquiv.toLowerCase();
      if (!found.has(k)) found.set(k, tag.content);
      continue;
    }
    if (key && !found.has(key)) found.set(key, tag.content || "");
  }
  if (canonical) found.set("__canonical__", canonical);

  // Group items
  const byGroup = { seo: [], og: [], twitter: [], technical: [], other: [] };

  // Virtual: page title
  byGroup.seo.push({ key: "title", present: true, value: pageTitle, desc: "Заголовок страницы. Самый важный SEO-элемент. Рекомендуемая длина: 50–60 символов.", expected: true });
  // Virtual: canonical
  byGroup.seo.push({ key: "canonical", present: !!canonical, value: canonical || "", desc: "Канонический URL. Указывает поисковику предпочтительный вариант адреса страницы.", expected: false });

  // All found tags
  const usedKeys = new Set(["title", "canonical"]);
  for (const [rawKey, value] of found) {
    if (rawKey === "__canonical__" || rawKey === "__charset__") continue;
    const info = META_INFO[rawKey];
    const item = { key: rawKey, present: true, value, desc: info?.desc || "", expected: info?.expected || false };
    if (info) {
      byGroup[info.group]?.push(item);
    } else if (rawKey.startsWith("http-equiv:")) {
      byGroup.technical.push(item);
    } else {
      byGroup.other.push(item);
    }
    usedKeys.add(rawKey);
  }

  // Charset (special)
  if (found.has("__charset__")) {
    byGroup.technical.push({ key: "charset", present: true, value: found.get("__charset__"), desc: "Кодировка страницы. Рекомендуется UTF-8.", expected: true });
  } else {
    byGroup.technical.push({ key: "charset", present: false, value: "", desc: "Кодировка страницы. Рекомендуется <meta charset=\"UTF-8\">.", expected: true });
  }

  // Add missing expected tags that weren't found
  for (const [key, info] of Object.entries(META_INFO)) {
    if (info.expected && !usedKeys.has(key) && !found.has(key)) {
      byGroup[info.group]?.push({ key, present: false, value: "", desc: info.desc, expected: true });
    }
  }

  // De-duplicate each group
  for (const gKey of Object.keys(byGroup)) {
    const seen = new Set();
    byGroup[gKey] = byGroup[gKey].filter(it => { if (seen.has(it.key)) return false; seen.add(it.key); return true; });
  }

  // Stats
  const totalTags   = tags.length;
  const ogPresent   = ["og:title","og:description","og:image"].filter(k => found.has(k)).length;
  const twPresent   = found.has("twitter:card") ? 1 : 0;

  let html = `
    <div class="stats">
      <div class="stat-card"><div class="stat-value">${totalTags}</div><div class="stat-label">мета-тегов</div></div>
      <div class="stat-card"><div class="stat-value">${ogPresent}/3</div><div class="stat-label">Open Graph</div></div>
      <div class="stat-card"><div class="stat-value">${twPresent}/1</div><div class="stat-label">Twitter Card</div></div>
    </div>`;

  for (const grp of GROUPS) {
    const items = byGroup[grp.key];
    if (!items || items.length === 0) continue;
    const presentCnt = items.filter(i => i.present).length;
    const collapsed  = grp.key === "other" ? " collapsed" : "";

    const rows = items.map(item => {
      if (!item.present) return `
        <div class="tag-row tag-absent">
          <div class="tag-key">${esc(item.key)} <span class="absent-badge">ОТСУТСТВУЕТ</span></div>
          <div class="tag-val absent">—</div>
          ${item.desc ? `<div class="tag-desc">${esc(item.desc)}</div>` : ""}
        </div>`;

      const disp = item.value.length > 140 ? item.value.slice(0, 137) + "…" : item.value;
      return `
        <div class="tag-row">
          <div class="tag-key" title="${esc(item.key)}">${esc(item.key)}</div>
          <div class="tag-val" title="${esc(item.value)}">${esc(disp) || '<span style="color:#334155">—</span>'}</div>
          ${item.desc ? `<div class="tag-desc">${esc(item.desc)}</div>` : ""}
        </div>`;
    }).join("");

    html += `
      <div class="section${collapsed}" id="sec-${grp.key}">
        <div class="section-header" data-key="${grp.key}">
          <span class="section-dot" style="background:${grp.color}"></span>
          <span class="section-name">${esc(grp.label)}</span>
          <span class="section-count">${presentCnt}/${items.length}</span>
          <span class="section-arrow">▼</span>
        </div>
        <div class="section-body">${rows}</div>
      </div>`;
  }

  html += `<div class="footer">TestKit · ${new Date().toLocaleDateString("ru-RU")}</div>`;
  document.getElementById("content").innerHTML = html;
}

// ── Helpers ──────────────────────────────────────────────────
function renderError(msg) {
  document.getElementById("header").innerHTML = `<div class="header-text"><div class="header-title">TestKit — Meta Tags</div></div>`;
  document.getElementById("content").innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><div>${esc(msg)}</div></div>`;
}

function esc(s) {
  if (!s) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

document.addEventListener("DOMContentLoaded", init);
