// ============================================================
// TestKit — Technology Popup
// ============================================================

const CATEGORIES = [
  { key: "frameworks", label: "Frameworks",      color: "#6366f1" },
  { key: "libraries",  label: "Libraries",       color: "#a855f7" },
  { key: "cms",        label: "CMS / Platform",  color: "#f97316" },
  { key: "analytics",  label: "Analytics",       color: "#22c55e" },
  { key: "ui",         label: "UI / CSS",        color: "#06b6d4" },
  { key: "build",      label: "Build Tools",     color: "#eab308" },
  { key: "monitoring", label: "Monitoring",      color: "#ef4444" },
  { key: "other",      label: "Other",           color: "#94a3b8" }
];

async function init() {
  // Event delegation for section collapse/expand
  document.getElementById("content").addEventListener("click", (e) => {
    const header = e.target.closest(".section-header[data-key]");
    if (header) toggleSection(header.dataset.key);
  });

  try {
    const { techScan } = await chrome.storage.session.get("techScan");

    if (!techScan) {
      renderError("Данные не найдены. Попробуйте снова.");
      return;
    }

    const { data, url, title, favIconUrl, timestamp } = techScan;
    renderHeader({ url, title, favIconUrl, timestamp });
    renderBody(data);
  } catch (err) {
    renderError("Ошибка загрузки данных: " + err.message);
  }
}

// ── Header ──────────────────────────────────────────────────
function renderHeader({ url, title, favIconUrl, timestamp }) {
  const header = document.getElementById("header");
  const domain = (() => { try { return new URL(url).hostname; } catch { return url; } })();
  const time   = new Date(timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  header.innerHTML = `
    <img class="header-favicon" id="header-favicon"
         src="${favIconUrl || `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(domain)}`}"
         alt="">
    <div class="header-text">
      <div class="header-title" title="${escHtml(title)}">${escHtml(title || domain)}</div>
      <div class="header-url"   title="${escHtml(url)}">${escHtml(domain)}</div>
    </div>
    <span class="header-badge">${time}</span>
  `;
  document.getElementById("header-favicon").addEventListener("error", function () {
    this.style.display = "none";
  });
}

// ── Body ─────────────────────────────────────────────────────
function renderBody({ techs, stats, meta }) {
  const content = document.getElementById("content");
  const totalFound = Object.values(techs).reduce((s, arr) => s + arr.length, 0);

  let html = "";

  // Stats row
  html += `
    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${totalFound}</div>
        <div class="stat-label">технологий</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.scripts}</div>
        <div class="stat-label">скриптов</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.domNodes}</div>
        <div class="stat-label">DOM-узлов</div>
      </div>
    </div>
  `;

  // Technology categories
  if (totalFound === 0) {
    html += `<div class="none-detected">Технологии не обнаружены.<br>Возможно, страница использует серверный рендеринг или минимум JS.</div>`;
  } else {
    for (const cat of CATEGORIES) {
      const items = techs[cat.key];
      if (!items?.length) continue;

      const tags = items.map(t => `
        <span class="tag" style="
          color: ${cat.color};
          background: ${cat.color}18;
          border-color: ${cat.color}40;
        ">
          ${escHtml(t.name)}
          ${t.version ? `<span class="tag-version">v${escHtml(t.version)}</span>` : ""}
        </span>
      `).join("");

      html += `
        <div class="section" id="sec-${cat.key}">
          <div class="section-header" data-key="${cat.key}">
            <span class="section-dot" style="background:${cat.color}"></span>
            <span class="section-name">${escHtml(cat.label)}</span>
            <span class="section-count">${items.length}</span>
            <span class="section-arrow">▼</span>
          </div>
          <div class="section-body">${tags}</div>
        </div>
      `;
    }
  }

  // Meta info
  const metaRows = [
    { key: "Язык",        val: meta.lang        },
    { key: "Кодировка",   val: meta.charset      },
    { key: "Viewport",    val: meta.viewport     },
    { key: "Description", val: meta.description  },
    { key: "Keywords",    val: meta.keywords     },
    { key: "Robots",      val: meta.robots       },
    { key: "Canonical",   val: meta.canonical    },
    { key: "OG Title",    val: meta.ogTitle      },
    { key: "Generator",   val: meta.generator    }
  ].filter(r => r.val);

  if (metaRows.length) {
    const rows = metaRows.map(r => `
      <div class="meta-row">
        <span class="meta-key">${escHtml(r.key)}</span>
        <span class="meta-val" title="${escHtml(r.val)}">${escHtml(r.val)}</span>
      </div>
    `).join("");

    html += `
      <div class="meta-wrap">
        <div class="section-title">Meta / SEO</div>
        <div class="meta-grid">${rows}</div>
      </div>
    `;
  }

  // Extra stats
  html += `
    <div class="meta-wrap">
      <div class="section-title">Ресурсы страницы</div>
      <div class="meta-grid">
        ${statRow("Скрипты",      stats.scripts)}
        ${statRow("Стили",        stats.stylesheets)}
        ${statRow("Изображения",  stats.images)}
        ${statRow("Ссылки",       stats.links)}
        ${statRow("Iframe",       stats.iframes)}
        ${statRow("DOM-узлов",    stats.domNodes)}
      </div>
    </div>
  `;

  html += `<div class="footer">TestKit · ${new Date().toLocaleDateString("ru-RU")}</div>`;

  content.innerHTML = html;
}

function statRow(label, value) {
  return `
    <div class="meta-row">
      <span class="meta-key">${escHtml(label)}</span>
      <span class="meta-val">${value}</span>
    </div>
  `;
}

// ── Helpers ──────────────────────────────────────────────────
function toggleSection(key) {
  document.getElementById("sec-" + key)?.classList.toggle("collapsed");
}

function renderError(msg) {
  document.getElementById("header").innerHTML = `
    <div class="header-text"><div class="header-title">TestKit</div></div>
  `;
  document.getElementById("content").innerHTML = `
    <div class="empty">
      <div class="empty-icon">⚠️</div>
      <div>${escHtml(msg)}</div>
    </div>
  `;
}

function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Run ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", init);
