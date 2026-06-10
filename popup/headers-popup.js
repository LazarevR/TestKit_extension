// ============================================================
// TestKit — HTTP Headers Popup
// ============================================================

const SECURITY_HEADERS = [
  {
    key: "content-security-policy", label: "Content-Security-Policy", abbr: "CSP", severity: 4,
    desc: "Ограничивает источники загрузки ресурсов (скрипты, стили, изображения). Основная защита от XSS-атак.",
    tip: "Content-Security-Policy: default-src 'self'"
  },
  {
    key: "strict-transport-security", label: "Strict-Transport-Security", abbr: "HSTS", severity: 4, httpsOnly: true,
    desc: "Принуждает браузер использовать только HTTPS. Защита от SSL-stripping и протокольного downgrade.",
    tip: "Strict-Transport-Security: max-age=31536000; includeSubDomains"
  },
  {
    key: "x-frame-options", label: "X-Frame-Options", severity: 3,
    desc: "Запрещает встраивание страницы в iframe на сторонних сайтах. Защита от Clickjacking.",
    tip: "X-Frame-Options: DENY  (современная альтернатива: CSP frame-ancestors 'none')"
  },
  {
    key: "x-content-type-options", label: "X-Content-Type-Options", severity: 2,
    desc: "Запрещает браузеру угадывать MIME-тип контента. Предотвращает MIME-sniffing атаки.",
    tip: "X-Content-Type-Options: nosniff"
  },
  {
    key: "referrer-policy", label: "Referrer-Policy", severity: 2,
    desc: "Контролирует, какой URL передаётся в заголовке Referer при переходах. Защищает чувствительные URL от утечки.",
    tip: "Referrer-Policy: strict-origin-when-cross-origin"
  },
  {
    key: "permissions-policy", label: "Permissions-Policy", severity: 2,
    desc: "Управляет доступом к браузерным API: камера, геолокация, микрофон и др.",
    tip: "Permissions-Policy: geolocation=(), camera=(), microphone=()"
  },
  {
    key: "cross-origin-opener-policy", label: "Cross-Origin-Opener-Policy", abbr: "COOP", severity: 1,
    desc: "Изолирует контекст просмотра от сторонних документов. Блокирует XS-Leaks атаки.",
    tip: "Cross-Origin-Opener-Policy: same-origin"
  },
  {
    key: "cross-origin-embedder-policy", label: "Cross-Origin-Embedder-Policy", abbr: "COEP", severity: 1,
    desc: "Требует явного разрешения для загрузки сторонних ресурсов. Необходим для SharedArrayBuffer.",
    tip: "Cross-Origin-Embedder-Policy: require-corp"
  },
  {
    key: "cross-origin-resource-policy", label: "Cross-Origin-Resource-Policy", abbr: "CORP", severity: 1,
    desc: "Запрещает загрузку ресурсов с этого сервера сторонними сайтами.",
    tip: "Cross-Origin-Resource-Policy: same-origin"
  },
];

const DISCLOSURE_HEADERS = [
  {
    key: "server", label: "Server",
    desc: "Раскрывает имя и версию серверного ПО. Помогает атакующим найти подходящие эксплойты.",
    tip: "Скройте версию: возвращайте только \"nginx\" без номера, или удалите заголовок полностью."
  },
  {
    key: "x-powered-by", label: "X-Powered-By",
    desc: "Раскрывает используемый фреймворк или язык (PHP, Express и т.д.).",
    tip: "Express: app.disable('x-powered-by')  |  PHP: expose_php = Off"
  },
  {
    key: "x-aspnet-version", label: "X-AspNet-Version",
    desc: "Раскрывает версию ASP.NET.",
    tip: "web.config: <httpRuntime enableVersionHeader=\"false\" />"
  },
  {
    key: "x-aspnetmvc-version", label: "X-AspNetMvc-Version",
    desc: "Раскрывает версию ASP.NET MVC.",
    tip: "Global.asax: MvcHandler.DisableMvcResponseHeader = true;"
  },
];

const SEV = {
  4: { label: "КРИТИЧНО",      color: "#ef4444" },
  3: { label: "ВАЖНО",         color: "#f97316" },
  2: { label: "РЕКОМЕНДОВАНО", color: "#eab308" },
  1: { label: "ОПЦИОНАЛЬНО",   color: "#64748b" },
};

// ── Init ─────────────────────────────────────────────────────
async function init() {
  document.getElementById("content").addEventListener("click", e => {
    const h = e.target.closest(".section-header[data-key]");
    if (h) document.getElementById("sec-" + h.dataset.key)?.classList.toggle("collapsed");
  });

  try {
    const { headersScan } = await chrome.storage.session.get("headersScan");
    if (!headersScan) { renderError("Данные не найдены. Попробуйте снова."); return; }
    renderHeader(headersScan);
    if (headersScan.error) { renderError("Не удалось получить заголовки: " + headersScan.error); return; }
    renderBody(headersScan.headers, headersScan.isHttps);
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
function renderBody(headers, isHttps) {
  const present  = h => headers[h.key] !== undefined;
  const isNA     = h => h.httpsOnly && !isHttps;
  const secOK    = SECURITY_HEADERS.filter(h => isNA(h) || present(h)).length;
  const missing  = SECURITY_HEADERS.filter(h => !isNA(h) && !present(h));
  const disclose = DISCLOSURE_HEADERS.filter(h => present(h));
  const issues   = missing.length + disclose.length;
  const issClr   = issues === 0 ? "#22c55e" : issues <= 3 ? "#eab308" : "#ef4444";

  let html = `
    <div class="stats">
      <div class="stat-card"><div class="stat-value">${Object.keys(headers).length}</div><div class="stat-label">заголовков</div></div>
      <div class="stat-card"><div class="stat-value">${secOK}/${SECURITY_HEADERS.length}</div><div class="stat-label">защитных</div></div>
      <div class="stat-card"><div class="stat-value" style="color:${issClr}">${issues}</div><div class="stat-label">проблем</div></div>
    </div>`;

  // ── Security headers section ────────────────────────────
  const secRows = SECURITY_HEADERS.map(h => {
    if (isNA(h)) return `
      <div class="hdr-row">
        <span class="hdr-status hdr-na">N/A</span>
        <div class="hdr-main">
          <div class="hdr-name">${esc(h.label)}${h.abbr ? ` <span class="hdr-abbr">${h.abbr}</span>` : ""}</div>
          <div class="hdr-na-desc">Применимо только для HTTPS-сайтов</div>
        </div>
      </div>`;

    if (present(h)) {
      const val = headers[h.key];
      const disp = val.length > 90 ? val.slice(0, 87) + "…" : val;
      return `
        <div class="hdr-row">
          <span class="hdr-status hdr-ok">✓</span>
          <div class="hdr-main">
            <div class="hdr-name">${esc(h.label)}${h.abbr ? ` <span class="hdr-abbr">${h.abbr}</span>` : ""}</div>
            <div class="hdr-value" title="${esc(val)}">${esc(disp)}</div>
            <div class="hdr-desc">${esc(h.desc)}</div>
          </div>
        </div>`;
    }

    const sev = SEV[h.severity];
    return `
      <div class="hdr-row hdr-missing">
        <span class="hdr-status hdr-miss">✗</span>
        <div class="hdr-main">
          <div class="hdr-name">
            ${esc(h.label)}${h.abbr ? ` <span class="hdr-abbr">${h.abbr}</span>` : ""}
            <span class="sev-badge" style="background:${sev.color}20;color:${sev.color};border-color:${sev.color}40">${sev.label}</span>
          </div>
          <div class="hdr-desc">${esc(h.desc)}</div>
          <div class="hdr-tip">💡 ${esc(h.tip)}</div>
        </div>
      </div>`;
  }).join("");

  html += `
    <div class="section" id="sec-security">
      <div class="section-header" data-key="security">
        <span class="section-dot" style="background:#6366f1"></span>
        <span class="section-name">Защитные заголовки</span>
        <span class="section-count">${secOK}/${SECURITY_HEADERS.length}</span>
        <span class="section-arrow">▼</span>
      </div>
      <div class="section-body">${secRows}</div>
    </div>`;

  // ── Disclosure headers ──────────────────────────────────
  if (disclose.length > 0) {
    const discRows = disclose.map(h => `
      <div class="hdr-row hdr-warn-row">
        <span class="hdr-status hdr-warn">⚠</span>
        <div class="hdr-main">
          <div class="hdr-name">
            ${esc(h.label)}
            <span class="sev-badge" style="background:#f9731620;color:#f97316;border-color:#f9731640">РАСКРЫТИЕ</span>
          </div>
          <div class="hdr-value">${esc(headers[h.key])}</div>
          <div class="hdr-desc">${esc(h.desc)}</div>
          <div class="hdr-tip">💡 ${esc(h.tip)}</div>
        </div>
      </div>`).join("");

    html += `
      <div class="section" id="sec-disclosure">
        <div class="section-header" data-key="disclosure">
          <span class="section-dot" style="background:#f97316"></span>
          <span class="section-name">Раскрытие информации</span>
          <span class="section-count">${disclose.length}</span>
          <span class="section-arrow">▼</span>
        </div>
        <div class="section-body">${discRows}</div>
      </div>`;
  }

  // ── All other headers ───────────────────────────────────
  const knownKeys = new Set([...SECURITY_HEADERS, ...DISCLOSURE_HEADERS].map(h => h.key));
  const others = Object.entries(headers)
    .filter(([k]) => !knownKeys.has(k))
    .sort(([a], [b]) => a.localeCompare(b));

  if (others.length > 0) {
    const rows = others.map(([k, v]) => {
      const disp = v.length > 100 ? v.slice(0, 97) + "…" : v;
      return `<div class="meta-row"><span class="meta-key" title="${esc(k)}">${esc(k)}</span><span class="meta-val" title="${esc(v)}">${esc(disp)}</span></div>`;
    }).join("");

    html += `
      <div class="section collapsed" id="sec-all">
        <div class="section-header" data-key="all">
          <span class="section-dot" style="background:#64748b"></span>
          <span class="section-name">Остальные заголовки</span>
          <span class="section-count">${others.length}</span>
          <span class="section-arrow">▼</span>
        </div>
        <div class="section-body"><div class="meta-grid">${rows}</div></div>
      </div>`;
  }

  html += `<div class="footer">TestKit · ${new Date().toLocaleDateString("ru-RU")}</div>`;
  document.getElementById("content").innerHTML = html;
}

// ── Helpers ──────────────────────────────────────────────────
function renderError(msg) {
  document.getElementById("header").innerHTML = `<div class="header-text"><div class="header-title">TestKit — HTTP Headers</div></div>`;
  document.getElementById("content").innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><div>${esc(msg)}</div></div>`;
}

function esc(s) {
  if (!s) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

document.addEventListener("DOMContentLoaded", init);
