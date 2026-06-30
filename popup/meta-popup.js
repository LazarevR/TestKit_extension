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
  { key: "other",      label: "Прочие теги",    color: "#64748b" },
  { key: "duplicates", label: "Дубликаты!",     color: "#f59e0b" },
];

// ── Init ─────────────────────────────────────────────────────
const NAV_PAGES = { tech: "tech-popup.html", headers: "headers-popup.html", meta: "meta-popup.html" };

function initNav() {
  document.querySelector(".nav-bar").addEventListener("click", e => {
    const btn = e.target.closest(".nav-btn[data-to]");
    if (!btn || btn.classList.contains("active")) return;
    window.location.href = NAV_PAGES[btn.dataset.to];
  });
}

async function init() {
  initNav();

  document.getElementById("content").addEventListener("click", e => {
    const h = e.target.closest(".section-header[data-key]");
    if (h) document.getElementById("sec-" + h.dataset.key)?.classList.toggle("collapsed");
  });

  try {
    let { metaScan } = await chrome.storage.session.get("metaScan");

    if (!metaScan) {
      const { currentTab } = await chrome.storage.session.get("currentTab");
      if (!currentTab?.tabId) { renderError("Данные не найдены. Откройте через контекстное меню."); return; }
      document.getElementById("content").innerHTML = `<div class="loading"><div class="spinner"></div><span>Читаем мета-теги…</span></div>`;
      let _scanListener = null;
      await new Promise((resolve, reject) => {
        let done = false;
        const finish = (fn, val) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          if (_scanListener) chrome.storage.onChanged.removeListener(_scanListener);
          fn(val);
        };
        const timer = setTimeout(() => finish(reject, new Error("Таймаут ответа (15с)")), 15000);
        _scanListener = (changes, area) => {
          if (area === "session" && changes.metaScan) finish(resolve, changes.metaScan.newValue);
        };
        chrome.storage.onChanged.addListener(_scanListener);
        chrome.runtime.sendMessage({ action: "triggerScan", type: "meta", tabId: currentTab.tabId }, r => {
          if (chrome.runtime.lastError) { finish(reject, new Error(chrome.runtime.lastError.message)); return; }
          if (r?.ok === false) finish(reject, new Error(r.error));
        });
      }).then(data => { metaScan = data; }).catch(err => { renderError("Не удалось собрать мета-теги: " + err.message); });
      if (!metaScan) return;
    }

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
         src="${esc(favIconUrl) || "https://www.google.com/s2/favicons?sz=32&domain=" + encodeURIComponent(domain)}" alt="">
    <div class="header-text">
      <div class="header-title" title="${esc(title)}">${esc(title || domain)}</div>
      <div class="header-url"   title="${esc(url)}">${esc(domain)}</div>
    </div>
    <span class="header-badge">${time}</span>`;
  document.getElementById("hfav")?.addEventListener("error", function () { this.style.display = "none"; });
}

// ── Body ─────────────────────────────────────────────────────
function renderBody({ pageTitle, tags, canonical }) {
  // Build normalized lookup: key → first value found; track duplicates
  const found = new Map();
  const droppedDupes = [];
  for (const tag of tags) {
    const key = (tag.property || tag.name || "").toLowerCase();
    if (tag.charset && !found.has("__charset__")) { found.set("__charset__", tag.charset); continue; }
    if (tag.httpEquiv) {
      const k = "http-equiv:" + tag.httpEquiv.toLowerCase();
      if (!found.has(k)) found.set(k, tag.content);
      else droppedDupes.push({ key: k, value: tag.content || "" });
      continue;
    }
    if (key) {
      if (!found.has(key)) found.set(key, tag.content || "");
      else droppedDupes.push({ key, value: tag.content || "" });
    }
  }
  if (canonical) found.set("__canonical__", canonical);

  // Group items
  const byGroup = { seo: [], og: [], twitter: [], technical: [], other: [], duplicates: [] };

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

  // Duplicates group (populated after dedup so inner dedup pass doesn't touch it)
  for (const d of droppedDupes) {
    byGroup.duplicates.push({ key: d.key, present: true, value: d.value, keptValue: found.get(d.key) ?? "", desc: "", expected: false, isDupe: true });
  }

  // Stats — required vs extra
  let reqPresent = 0, reqTotal = 0, extraCount = 0;
  for (const [k, items] of Object.entries(byGroup)) {
    if (k === "duplicates") continue;
    for (const item of items) {
      if (item.expected) {
        reqTotal++;
        if (item.present) reqPresent++;
      } else if (item.present) {
        extraCount++;
      }
    }
  }

  const hasDupes = droppedDupes.length > 0;
  let html = `
    <div class="stats${hasDupes ? " stats-3" : ""}">
      <div class="stat-card"><div class="stat-value">${reqPresent}/${reqTotal}</div><div class="stat-label">обязательных</div></div>
      <div class="stat-card"><div class="stat-value">${extraCount}</div><div class="stat-label">дополнительных</div></div>
      ${hasDupes ? `<div class="stat-card stat-warn"><div class="stat-value">${droppedDupes.length}</div><div class="stat-label">дублей</div></div>` : ""}
    </div>`;

  for (const grp of GROUPS) {
    const items = byGroup[grp.key];
    if (!items || items.length === 0) continue;
    const presentCnt = items.filter(i => i.present).length;
    const collapsed  = (grp.key === "other" || grp.key === "duplicates") ? " collapsed" : "";
    const countDisp  = grp.key === "duplicates" ? items.length : `${presentCnt}/${items.length}`;

    const rows = items.map(item => {
      if (item.isDupe) {
        const disp     = item.value.length > 140 ? item.value.slice(0, 137) + "…" : item.value;
        const keptDisp = item.keptValue.length > 80 ? item.keptValue.slice(0, 77) + "…" : item.keptValue;
        return `
          <div class="tag-row tag-dupe">
            <div class="tag-key">${esc(item.key)} <span class="dupe-badge">ДУБЛЬ</span></div>
            <div class="tag-val" title="${esc(item.value)}">${esc(disp) || '<span style="color:#334155">—</span>'}</div>
            <div class="tag-desc">Сохранён первый: ${esc(keptDisp) || "—"}</div>
          </div>`;
      }
      if (!item.present) return `
        <div class="tag-row tag-absent">
          <div class="tag-key">${esc(item.key)} <span class="absent-badge">ОТСУТСТВУЕТ</span></div>
          <div class="tag-val absent">—</div>
          ${item.desc ? `<div class="tag-desc">${esc(item.desc)}</div>` : ""}
        </div>`;

      const disp    = item.value.length > 140 ? item.value.slice(0, 137) + "…" : item.value;
      const reqMark = item.expected ? ` <span class="req-badge">ОБЯЗ</span>` : "";
      return `
        <div class="tag-row">
          <div class="tag-key" title="${esc(item.key)}">${esc(item.key)}${reqMark}</div>
          <div class="tag-val" title="${esc(item.value)}">${esc(disp) || '<span style="color:#334155">—</span>'}</div>
          ${item.desc ? `<div class="tag-desc">${esc(item.desc)}</div>` : ""}
        </div>`;
    }).join("");

    html += `
      <div class="section${collapsed}" id="sec-${grp.key}">
        <div class="section-header" data-key="${grp.key}">
          <span class="section-dot" style="background:${grp.color}"></span>
          <span class="section-name">${esc(grp.label)}</span>
          <span class="section-count">${countDisp}</span>
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
