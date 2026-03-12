// ============================================================
// TestKit — Background Service Worker
// ============================================================

const DB_REMOTE_CACHE_KEY   = "remoteTechDB";
const DB_REMOTE_UPDATED_KEY = "remoteTechDBUpdatedAt";
const DB_REMOTE_COUNT_KEY   = "remoteTechDBCount";
const DB_REFRESH_INTERVAL   = 24 * 60 * 60 * 1000; // 24 h

// ── Built-in test data ────────────────────────────────────────

const SQL_INJECTIONS = [
  "' OR '1'='1",
  "' OR '1'='1' --",
  "' OR '1'='1' /*",
  "' OR 1=1--",
  "' OR 1=1#",
  "admin'--",
  "admin' OR '1'='1",
  "' UNION SELECT NULL--",
  "' UNION SELECT NULL,NULL--",
  "' UNION SELECT NULL,NULL,NULL--",
  "1; DROP TABLE users--",
  "'; DROP TABLE users--",
  "' AND SLEEP(5)--",
  "1 WAITFOR DELAY '0:0:5'--",
  "' AND 1=1--",
  "1' ORDER BY 1--",
  "' AND EXTRACTVALUE(1,CONCAT(0x7e,version()))--",
];

const XSS_SCRIPTS = [
  "<script>alert(1)</script>",
  "<script>alert('XSS')</script>",
  "<img src=x onerror=alert(1)>",
  "<img src=x onerror=\"alert('XSS')\">",
  "<svg onload=alert(1)>",
  "<body onload=alert(1)>",
  "javascript:alert(1)",
  "<a href=\"javascript:alert(1)\">click</a>",
  "\"><script>alert(1)</script>",
  "'><script>alert(1)</script>",
  "<script>alert(document.cookie)</script>",
  "<iframe src=\"javascript:alert(1)\"></iframe>",
  "<details open ontoggle=alert(1)>",
  "<input autofocus onfocus=alert(1)>",
  "<div onmouseover=alert(1)>hover</div>",
  "{{7*7}}",
  "${7*7}",
  "<%= 7*7 %>",
];

// Format per country: [international (+code), national (trunk), local (bare)]
const PHONE_COUNTRIES = [
  { name: "🇷🇺 Россия (+7)",           id: "ru", nums: ["+71111111111",      "81111111111",     "1111111111"]    },
  { name: "🇺🇸 США (+1)",              id: "us", nums: ["+11111111111",      "11111111111",     "1111111111"]    },
  { name: "🇬🇧 Великобритания (+44)",  id: "gb", nums: ["+441111111111",     "01111111111",     "1111111111"]    },
  { name: "🇩🇪 Германия (+49)",        id: "de", nums: ["+491111111111",     "01111111111",     "1111111111"]    },
  { name: "🇫🇷 Франция (+33)",         id: "fr", nums: ["+33111111111",      "0111111111",      "111111111"]     },
  { name: "🇮🇹 Италия (+39)",          id: "it", nums: ["+391111111111",     "00391111111111",  "1111111111"]    },
  { name: "🇪🇸 Испания (+34)",         id: "es", nums: ["+34111111111",      "0034111111111",   "111111111"]     },
  { name: "🇨🇳 Китай (+86)",           id: "cn", nums: ["+8611111111111",    "011111111111",    "11111111111"]   },
  { name: "🇯🇵 Япония (+81)",          id: "jp", nums: ["+811111111111",     "01111111111",     "1111111111"]    },
  { name: "🇮🇳 Индия (+91)",           id: "in", nums: ["+911111111111",     "01111111111",     "1111111111"]    },
  { name: "🇧🇷 Бразилия (+55)",        id: "br", nums: ["+5511111111111",    "011111111111",    "11111111111"]   },
  { name: "🇦🇺 Австралия (+61)",       id: "au", nums: ["+61111111111",      "0111111111",      "111111111"]     },
  { name: "🇺🇦 Украина (+380)",        id: "ua", nums: ["+380111111111",     "0111111111",      "111111111"]     },
  { name: "🇰🇿 Казахстан (+7)",        id: "kz", nums: ["+71111111111",      "81111111111",     "1111111111"]    },
  { name: "🇧🇾 Беларусь (+375)",       id: "by", nums: ["+375111111111",     "0111111111",      "111111111"]     },
];

const NAME_GROUPS = [
  {
    name: "Русские", id: "rus",
    names: [
      "Иван",
      "Иван Иванов",
      "г-н Иван",
      "Иван Иванов мл.",
      "Иван-Сергей Иванов",
      "Зина",
      "Зина Иванова",
      "г-жа Зина",
      "Зина Иванова ст.",
      "Зина-Инна Иванова",
    ],
  },
  {
    name: "Латинские", id: "lat",
    names: [
      "John",
      "John Doe",
      "Mr. John",
      "John Doe Jr.",
      "John-Jonathan Doe",
      "Jane",
      "Jane Doe",
      "Ms. Jane",
      "Jane Doe Sr.",
      "Jane-Marie Doe",
    ],
  },
  {
    name: "Китайские", id: "chn",
    names: [
      "王伟",
      "Wang Wei",
      "Wei Wang",
      "先生 王伟",
      "王芳",
      "Wang Fang",
      "Fang Wang",
      "女士 王芳",
    ],
  },
];

const EDGE_CASES = [
  {
    name: "Спецсимволы", id: "special",
    items: [
      { label: `"  двойная кавычка`,       value: `"` },
      { label: `'  одинарная кавычка`,     value: `'` },
      { label: `''  две одинарных`,        value: `''` },
      { label: `&  амперсанд`,             value: `&` },
      { label: `<>  угловые скобки`,       value: `<>` },
      { label: `\\  обратный слеш`,        value: `\\` },
      { label: `\\0  нулевой байт`,        value: `\u0000` },
      { label: `%00  URL-null`,            value: `%00` },
      { label: `\\r\\n  CRLF`,             value: "\r\n" },
      { label: `<!--comment-->`,           value: `<!--comment-->` },
      { label: `]]>  XML CDATA end`,       value: `]]>` },
    ]
  },
  {
    name: "Unicode", id: "unicode",
    items: [
      { label: `😀🔥💀  4-байт эмодзи`,    value: `😀🔥💀` },
      { label: `مرحبا  арабский (RTL)`,     value: `مرحبا` },
      { label: `שלום  иврит (RTL)`,         value: `שלום` },
      { label: `[ZWS]  нулевая ширина`,     value: `\u200B` },
      { label: `Ω≈ç√∫˜µ≤≥÷  спецсимволы`, value: `Ω≈ç√∫˜µ≤≥÷` },
      { label: `ñéüöä  акцентированные`,    value: `ñéüöä` },
      { label: `A × 300  длинная строка`,   value: "A".repeat(300) },
    ]
  },
  {
    name: "Числа", id: "numbers",
    items: [
      { label: `0`,                          value: `0` },
      { label: `-1`,                         value: `-1` },
      { label: `99999999999999`,             value: `99999999999999` },
      { label: `1.000.000  EU формат`,       value: `1.000.000` },
      { label: `1,000,000  US формат`,       value: `1,000,000` },
      { label: `1,5  EU десятичная`,         value: `1,5` },
      { label: `Infinity`,                   value: `Infinity` },
      { label: `NaN`,                        value: `NaN` },
      { label: `1e100`,                      value: `1e100` },
      { label: `-0`,                         value: `-0` },
    ]
  },
  {
    name: "Даты", id: "dates",
    items: [
      { label: `29.02.2023  не високосный`,    value: `29.02.2023` },
      { label: `31.11.2024  ноябрь — 30 дней`, value: `31.11.2024` },
      { label: `00/00/0000`,                   value: `00/00/0000` },
      { label: `2038-01-19  Unix overflow`,    value: `2038-01-19` },
      { label: `9999-12-31  макс. дата`,       value: `9999-12-31` },
      { label: `1970-01-01  Unix epoch`,       value: `1970-01-01` },
      { label: `2000-02-29  високосный`,       value: `2000-02-29` },
    ]
  },
  {
    name: "Пути и шаблоны", id: "paths",
    items: [
      { label: `../../etc/passwd`,             value: `../../etc/passwd` },
      { label: `..\\..\\windows\\system32`,   value: `..\\..\\windows\\system32` },
      { label: `{{7*7}}  Jinja / Twig`,        value: `{{7*7}}` },
      { label: `\${7*7}  JS / EL`,             value: `${7*7}` },
      { label: `<%= 7*7 %>  ERB / EJS`,        value: `<%= 7*7 %>` },
      { label: `#{7*7}  Ruby / Groovy`,        value: `#{7*7}` },
      { label: `*|7*7|*  Mailchimp`,           value: `*|7*7|*` },
    ]
  },
];

// Lookup: menu item ID → text to insert (populated once at load)
const BUILTIN_MAP = new Map();
SQL_INJECTIONS.forEach((s, i) => BUILTIN_MAP.set(`dk-sql-${i}`, s));
XSS_SCRIPTS.forEach((s, i) => BUILTIN_MAP.set(`dk-xss-${i}`, s));
PHONE_COUNTRIES.forEach(c => c.nums.forEach((n, j) => BUILTIN_MAP.set(`dk-phone-${c.id}-${j}`, n)));
NAME_GROUPS.forEach(g => g.names.forEach((n, j) => BUILTIN_MAP.set(`dk-names-${g.id}-${j}`, n)));
EDGE_CASES.forEach(g => g.items.forEach((item, j) => BUILTIN_MAP.set(`dk-edge-${g.id}-${j}`, item.value)));

// ── Lifecycle ─────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  buildContextMenu();
  chrome.alarms.create("testkit-db-refresh", { periodInMinutes: 24 * 60 });
  fetchAndCacheRemoteTechDB();
});

chrome.runtime.onStartup.addListener(async () => {
  buildContextMenu();
  const { [DB_REMOTE_UPDATED_KEY]: updatedAt = 0 } = await chrome.storage.local.get(DB_REMOTE_UPDATED_KEY);
  if (Date.now() - updatedAt > DB_REFRESH_INTERVAL) fetchAndCacheRemoteTechDB();
});

// Rebuild menu when custom menus change in settings
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.customMenus) buildContextMenu();
});

// Daily alarm → refresh remote DB
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "testkit-db-refresh") fetchAndCacheRemoteTechDB();
});

// Toolbar icon → settings
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

// Update storage info when user switches tabs or tab finishes loading
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === "complete") updateStorageInfo(tab);
  } catch {}
});
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) updateStorageInfo(tab);
});

// Firefox: update storage info right when the menu opens
if (chrome.contextMenus.onShown) {
  chrome.contextMenus.onShown.addListener(async (_info, tab) => {
    await updateStorageInfo(tab);
    chrome.contextMenus.refresh();
  });
}

// Messages from settings page
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "fetchTechDB") {
    fetchAndCacheRemoteTechDB().then(ok => sendResponse({ ok }));
    return true; // keep channel open for async response
  }
});

// ── Context menu ──────────────────────────────────────────────
async function buildContextMenu() {
  const { customMenus = [] } = await chrome.storage.sync.get("customMenus");

  chrome.contextMenus.removeAll(() => {
    const cx = ["all"];
    const mk = (props) => chrome.contextMenus.create(props);

    mk({ id: "dk",       title: "TestKit", contexts: cx });
    mk({ id: "dk-tech",  parentId: "dk", title: "🔍 Технологии сайта",      contexts: cx });
    mk({ id: "dk-sep1",  parentId: "dk", type: "separator",                  contexts: cx });
    mk({ id: "dk-cache", parentId: "dk", title: "🔄 Очистка кэша и рефреш", contexts: cx });
    mk({ id: "dk-data",  parentId: "dk", title: "🗑️ Очистка данных сайта",  contexts: cx });
    mk({ id: "dk-sep2",  parentId: "dk", type: "separator",                  contexts: cx });
    mk({ id: "dk-lorem",    parentId: "dk",       title: "📝 Lorem Ipsum",   contexts: cx });
    mk({ id: "dk-lorem-en", parentId: "dk-lorem", title: "EN — English",     contexts: cx });
    mk({ id: "dk-lorem-ru", parentId: "dk-lorem", title: "RU — Русский",     contexts: cx });
    for (const len of [10, 50, 100, 300, 500]) {
      mk({ id: `dk-lorem-en-${len}`, parentId: "dk-lorem-en", title: `${len} символов`, contexts: cx });
      mk({ id: `dk-lorem-ru-${len}`, parentId: "dk-lorem-ru", title: `${len} символов`, contexts: cx });
    }

    // ── Testing tools ──────────────────────────────────────────
    mk({ id: "dk-sep-test", parentId: "dk", type: "separator", contexts: cx });

    mk({ id: "dk-sql", parentId: "dk", title: "💉 SQL Инъекции", contexts: cx });
    SQL_INJECTIONS.forEach((s, i) => {
      const lbl = s.length > 50 ? s.substring(0, 47) + "…" : s;
      mk({ id: `dk-sql-${i}`, parentId: "dk-sql", title: lbl, contexts: cx });
    });

    mk({ id: "dk-xss", parentId: "dk", title: "📜 Скрипты (XSS)", contexts: cx });
    XSS_SCRIPTS.forEach((s, i) => {
      const lbl = s.length > 50 ? s.substring(0, 47) + "…" : s;
      mk({ id: `dk-xss-${i}`, parentId: "dk-xss", title: lbl, contexts: cx });
    });

    mk({ id: "dk-phone", parentId: "dk", title: "📞 Номера телефонов", contexts: cx });
    PHONE_COUNTRIES.forEach(c => {
      mk({ id: `dk-phone-${c.id}`, parentId: "dk-phone", title: c.name, contexts: cx });
      c.nums.forEach((n, j) =>
        mk({ id: `dk-phone-${c.id}-${j}`, parentId: `dk-phone-${c.id}`, title: n, contexts: cx })
      );
    });

    mk({ id: "dk-names", parentId: "dk", title: "👤 Имена", contexts: cx });
    NAME_GROUPS.forEach(g => {
      mk({ id: `dk-names-${g.id}`, parentId: "dk-names", title: g.name, contexts: cx });
      g.names.forEach((n, j) =>
        mk({ id: `dk-names-${g.id}-${j}`, parentId: `dk-names-${g.id}`, title: n, contexts: cx })
      );
    });

    mk({ id: "dk-edge", parentId: "dk", title: "🧪 Edge Cases", contexts: cx });
    EDGE_CASES.forEach(g => {
      mk({ id: `dk-edge-${g.id}`, parentId: "dk-edge", title: g.name, contexts: cx });
      g.items.forEach((item, j) => {
        const lbl = item.label.length > 50 ? item.label.substring(0, 47) + "…" : item.label;
        mk({ id: `dk-edge-${g.id}-${j}`, parentId: `dk-edge-${g.id}`, title: lbl, contexts: cx });
      });
    });

    const activeGroups = customMenus.filter(g => g.items?.length > 0);
    if (activeGroups.length > 0) {
      mk({ id: "dk-sep3", parentId: "dk", type: "separator", contexts: cx });
      for (const group of activeGroups) {
        mk({ id: `dk-cg-${group.id}`, parentId: "dk", title: group.name, contexts: cx });
        for (const entry of group.items) {
          if (Array.isArray(entry.items)) {
            // Sub-group — only add if it has items
            if (entry.items.length > 0) {
              mk({ id: `dk-sg-${entry.id}`, parentId: `dk-cg-${group.id}`, title: entry.name, contexts: cx });
              for (const item of entry.items) {
                const lbl = item.content?.length > 40 ? item.content.substring(0, 37) + "…" : (item.content || "");
                mk({ id: `dk-ci-${item.id}`, parentId: `dk-sg-${entry.id}`, title: lbl, contexts: cx });
              }
            }
          } else {
            // Direct text item (supports both new {content} and old {name, content} format)
            const lbl = entry.content?.length > 40 ? entry.content.substring(0, 37) + "…"
              : (entry.content || entry.name || "");
            mk({ id: `dk-ci-${entry.id}`, parentId: `dk-cg-${group.id}`, title: lbl, contexts: cx });
          }
        }
      }
    }

    mk({ id: "dk-sep4",         parentId: "dk", type: "separator",                 contexts: cx });
    mk({ id: "dk-settings",     parentId: "dk", title: "⚙️ Настройки TestKit",     contexts: cx });
    mk({ id: "dk-sep5",         parentId: "dk", type: "separator",                 contexts: cx });
    mk({ id: "dk-storage-info", parentId: "dk", title: "💾 Хранилище: —",
         enabled: false,                                                             contexts: cx });
  });
}

// ── Click handler ─────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  const id = info.menuItemId;

  if (id === "dk-tech")     return handleTechnology(tab);
  if (id === "dk-cache")    return handleClearCache(tab);
  if (id === "dk-data")     return handleClearData(tab);
  if (id === "dk-settings") return chrome.runtime.openOptionsPage();

  const loremMatch = id.match(/^dk-lorem-(en|ru)-(\d+)$/);
  if (loremMatch) return handleLorem(tab, loremMatch[1], parseInt(loremMatch[2], 10));

  if (id.startsWith("dk-ci-")) return handleCustomItem(tab, id.slice(6));
  if (BUILTIN_MAP.has(id))    return handleBuiltinInsert(tab, BUILTIN_MAP.get(id));
});

// ── Technology scan ───────────────────────────────────────────
async function handleTechnology(tab) {
  try {
    const mergedDB = await getMergedTechDB();

    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world:  "MAIN",
      func:   scanTechnologies,
      args:   [mergedDB]
    });

    if (!injection?.result) return;

    await chrome.storage.session.set({
      techScan: {
        data:       injection.result,
        url:        tab.url,
        title:      tab.title,
        favIconUrl: tab.favIconUrl || "",
        timestamp:  Date.now()
      }
    });

    chrome.windows.create({
      url:    chrome.runtime.getURL("popup/tech-popup.html"),
      type:   "popup",
      width:  600,
      height: 680
    });
  } catch (err) {
    console.error("[TestKit] Technology scan failed:", err);
  }
}

// ── Clear cache + hard reload ─────────────────────────────────
async function handleClearCache(tab) {
  try {
    const { origin } = new URL(tab.url);
    await chrome.browsingData.removeCache({ origins: [origin] });
    await chrome.tabs.reload(tab.id, { bypassCache: true });
  } catch (err) {
    console.error("[TestKit] Clear cache failed:", err);
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => location.reload(true) });
    } catch {}
  }
}

// ── Clear all site data + hard reload ────────────────────────
// Note: browsingData.remove with `origins` filter only supports:
// cache, cookies, localStorage, serviceWorkers, cacheStorage.
// sessionStorage and indexedDB are NOT compatible with origin filtering.
async function handleClearData(tab) {
  try {
    const { origin } = new URL(tab.url);
    await chrome.browsingData.remove(
      { origins: [origin] },
      { cache: true, cookies: true, localStorage: true,
        serviceWorkers: true, cacheStorage: true }
    );
    await chrome.tabs.reload(tab.id, { bypassCache: true });
  } catch (err) {
    console.error("[TestKit] Clear data failed:", err);
  }
}

// ── Lorem ipsum ───────────────────────────────────────────────
async function handleLorem(tab, lang, len) {
  try {
    await chrome.tabs.sendMessage(tab.id, { action: "lorem", lang, len });
  } catch (err) {
    console.warn("[TestKit] Lorem ipsum: content script unreachable.", err.message);
  }
}

// ── Custom item ───────────────────────────────────────────────
async function handleCustomItem(tab, itemId) {
  try {
    const { customMenus = [] } = await chrome.storage.sync.get("customMenus");
    for (const group of customMenus) {
      for (const entry of group.items ?? []) {
        if (Array.isArray(entry.items)) {
          // Sub-group: search inside
          const item = entry.items.find(i => i.id === itemId);
          if (item) {
            await chrome.tabs.sendMessage(tab.id, { action: "insert", text: item.content });
            return;
          }
        } else if (entry.id === itemId) {
          await chrome.tabs.sendMessage(tab.id, { action: "insert", text: entry.content });
          return;
        }
      }
    }
  } catch (err) {
    console.warn("[TestKit] Custom item: failed.", err.message);
  }
}

// ── Built-in insert ───────────────────────────────────────────
async function handleBuiltinInsert(tab, text) {
  try {
    await chrome.tabs.sendMessage(tab.id, { action: "insert", text });
  } catch (err) {
    console.warn("[TestKit] Built-in insert failed:", err.message);
  }
}

// ── Storage info ──────────────────────────────────────────────
async function updateStorageInfo(tab) {
  try {
    if (!tab?.url || !/^https?:\/\//.test(tab.url)) {
      chrome.contextMenus.update("dk-storage-info", { title: "💾 Хранилище: —" });
      return;
    }
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func:   () => navigator.storage?.estimate()
    });
    const bytes = injection?.result?.usage ?? 0;
    const label = formatBytes(bytes);
    chrome.contextMenus.update("dk-storage-info", { title: `💾 Хранилище: ${label}` });
  } catch {
    chrome.contextMenus.update("dk-storage-info", { title: "💾 Хранилище: —" });
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes < 1) return "0 Б";
  if (bytes < 1_000)           return bytes + " Б";
  if (bytes < 1_000_000)       return (bytes / 1_000).toFixed(1) + " КБ";
  if (bytes < 1_000_000_000)   return (bytes / 1_000_000).toFixed(1) + " МБ";
  return (bytes / 1_000_000_000).toFixed(2) + " ГБ";
}

// ── Tech database: fetch & cache ─────────────────────────────
async function fetchAndCacheRemoteTechDB() {
  const { remoteDbUrl = "" } = await chrome.storage.sync.get("remoteDbUrl");
  const url = remoteDbUrl.trim();
  if (!url) return false;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const list = Array.isArray(json) ? json : (Array.isArray(json.technologies) ? json.technologies : null);
    if (!list) throw new Error("Invalid format: expected array");

    await chrome.storage.local.set({
      [DB_REMOTE_CACHE_KEY]:   list,
      [DB_REMOTE_UPDATED_KEY]: Date.now(),
      [DB_REMOTE_COUNT_KEY]:   list.length
    });
    console.log(`[TestKit] Remote tech DB updated: ${list.length} entries`);
    return true;
  } catch (err) {
    console.warn("[TestKit] Remote tech DB fetch failed:", err.message);
    return false;
  }
}

async function getBundledTechDB() {
  try {
    const res  = await fetch(chrome.runtime.getURL("technologies.json"));
    const json = await res.json();
    return Array.isArray(json) ? json : (json.technologies ?? []);
  } catch {
    return [];
  }
}

async function getMergedTechDB() {
  const [bundled, { [DB_REMOTE_CACHE_KEY]: remote = [] }] = await Promise.all([
    getBundledTechDB(),
    chrome.storage.local.get(DB_REMOTE_CACHE_KEY)
  ]);
  const seen  = new Set(bundled.map(t => t.name));
  const extra = remote.filter(t => t?.name && !seen.has(t.name));
  return [...bundled, ...extra];
}

// ============================================================
// Technology scanner — injected into MAIN world.
// Must be fully self-contained; remoteDB is passed as argument.
// ============================================================
function scanTechnologies(remoteDB) {
  const w   = window;
  const doc = document;

  const techs = {
    frameworks: [], libraries: [], cms: [],
    analytics:  [], ui:        [], build: [],
    monitoring: [], other:     []
  };

  function add(cat, name, version) {
    if (!techs[cat]?.find(t => t.name === name))
      techs[cat].push({ name, version: version || null });
  }

  // ── Built-in checks (fast path for popular tech) ──────────

  // Frameworks
  if (w.React) add("frameworks", "React", w.React.version);
  else if (doc.querySelector("[data-reactroot],[data-reactid]")) add("frameworks", "React");
  if (w.Vue || w.__VUE__) add("frameworks", "Vue.js", w.Vue?.version || (w.__VUE__ ? "3.x" : null));
  if (w.angular || w.getAllAngularRootElements || w.ng?.probe) add("frameworks", "Angular");
  if (w.__NEXT_DATA__) add("frameworks", "Next.js");
  if (w.__nuxt__ || w.$nuxt) add("frameworks", "Nuxt.js");
  if (w.__GATSBY) add("frameworks", "Gatsby");
  if (w.__remixContext) add("frameworks", "Remix");
  if (doc.querySelector("astro-island,[data-astro-cid]")) add("frameworks", "Astro");
  if (w._$HY) add("frameworks", "SolidJS");
  if (doc.querySelector("[q\\:container]")) add("frameworks", "Qwik");
  if (w.Ember) add("frameworks", "Ember.js", w.Ember.VERSION);
  if (w.Svelte || doc.querySelector("[class*='svelte-']")) add("frameworks", "Svelte");
  if (w.Alpine) add("frameworks", "Alpine.js", w.Alpine.version);
  if (w.htmx) add("frameworks", "htmx", w.htmx.version);

  // Libraries
  if (w.jQuery) add("libraries", "jQuery", w.jQuery.fn?.jquery);
  else if (w.$?.fn?.jquery) add("libraries", "jQuery", w.$.fn.jquery);
  if (w._ && w._.VERSION) add("libraries", "Underscore.js", w._.VERSION);
  if (w.lodash) add("libraries", "Lodash", w.lodash.VERSION);
  if (w.axios) add("libraries", "Axios", w.axios.VERSION);
  if (w.moment) add("libraries", "Moment.js", w.moment.version);
  if (w.dayjs) add("libraries", "Day.js", w.dayjs.version);
  if (w.luxon) add("libraries", "Luxon");
  if (w.d3) add("libraries", "D3.js", w.d3.version);
  if (w.THREE) add("libraries", "Three.js", "r" + w.THREE.REVISION);
  if (w.PIXI) add("libraries", "PixiJS", w.PIXI.VERSION);
  if (w.gsap) add("libraries", "GSAP", w.gsap.version);
  if (w.Swiper) add("libraries", "Swiper", w.Swiper.version);
  if (w.io && w.io.version) add("libraries", "Socket.IO", w.io.version);
  if (w.Popper) add("libraries", "Popper.js");
  if (w.anime) add("libraries", "Anime.js");
  if (w.p5) add("libraries", "p5.js", w.p5?.prototype?.version);
  if (w.Howl) add("libraries", "Howler.js");
  if (w.Chart) add("libraries", "Chart.js", w.Chart.version);
  if (w.Highcharts) add("libraries", "Highcharts", w.Highcharts.version);
  if (w.echarts) add("libraries", "Apache ECharts", w.echarts.version);

  // CMS
  const generator = doc.querySelector('meta[name="generator"]')?.content || "";
  if (/wordpress/i.test(generator))   add("cms", "WordPress",   generator.match(/[\d.]+/)?.[0]);
  if (/drupal/i.test(generator))      add("cms", "Drupal",      generator.match(/[\d.]+/)?.[0]);
  if (/joomla/i.test(generator))      add("cms", "Joomla!",     generator.match(/[\d.]+/)?.[0]);
  if (/ghost/i.test(generator))       add("cms", "Ghost");
  if (/wix\.com/i.test(generator))    add("cms", "Wix");
  if (/squarespace/i.test(generator)) add("cms", "Squarespace");
  if (/webflow/i.test(generator))     add("cms", "Webflow");
  if (/weebly/i.test(generator))      add("cms", "Weebly");
  if (/shopify/i.test(generator))     add("cms", "Shopify");
  if (/bitrix/i.test(generator))      add("cms", "1C-Bitrix");
  if (w.Shopify) add("cms", "Shopify");
  if (w.Drupal)  add("cms", "Drupal");
  if (w.Mage || w.MAGE)    add("cms", "Magento");
  if (w.BX || w.BXMobileApp) add("cms", "1C-Bitrix");
  if (w.tilda || doc.querySelector('meta[name="tilda-page-id"]')) add("cms", "Tilda");
  if (w.MODX) add("cms", "MODX");
  if (w.umi)  add("cms", "UMI.CMS");
  if (doc.querySelector('#wpadminbar,link[href*="/wp-content/"],link[href*="/wp-includes/"]'))
    add("cms", "WordPress");

  // Analytics
  if (w.ga || w.gtag || w.dataLayer) add("analytics", "Google Analytics / GTM");
  if (w.ym || doc.querySelector('script[src*="mc.yandex.ru"]')) add("analytics", "Yandex.Metrica");
  if (w.fbq)     add("analytics", "Meta Pixel (Facebook)");
  if (w.hj || w.Hotjar)  add("analytics", "Hotjar");
  if (w.mixpanel)         add("analytics", "Mixpanel");
  if (w.amplitude)        add("analytics", "Amplitude");
  if (w.analytics && w.analytics.initialized) add("analytics", "Segment");
  if (w.plausible)        add("analytics", "Plausible");
  if (w._paq)             add("analytics", "Matomo");
  if (w.rdt)              add("analytics", "Reddit Pixel");
  if (w.ttq)              add("analytics", "TikTok Pixel");
  if (w.VK && w.VK.Pixel) add("analytics", "VK Pixel");
  if (w.mindboxV2 || w.mindbox) add("analytics", "Mindbox");

  // UI
  const allLinks   = [...doc.querySelectorAll('link[rel="stylesheet"]')].map(l => l.href).join(" ");
  const allScripts = [...doc.scripts].map(s => s.src).join(" ");
  const allSrc     = allLinks + " " + allScripts;
  if (/bootstrap/i.test(allSrc) || w.bootstrap) add("ui", "Bootstrap", w.bootstrap?.Tooltip?.VERSION);
  if (/tailwind/i.test(allSrc) || w.tailwind)   add("ui", "Tailwind CSS");
  if (/material-ui|@mui|material\.min/i.test(allSrc) || w.MaterialUI) add("ui", "Material UI (MUI)");
  if (/antd|ant-design/i.test(allSrc) || w.antd) add("ui", "Ant Design");
  if (/chakra/i.test(allSrc))   add("ui", "Chakra UI");
  if (/bulma/i.test(allSrc))    add("ui", "Bulma");
  if (/foundation/i.test(allSrc)) add("ui", "Foundation");
  if (/semantic-ui|semantic\.min/i.test(allSrc) || w.semantic) add("ui", "Semantic UI");
  if (/vuetify/i.test(allSrc) || w.Vuetify) add("ui", "Vuetify");
  if (/primevue|primereact|primefaces/i.test(allSrc)) add("ui", "PrimeUI");
  if (w.Quasar)  add("ui", "Quasar");
  if (/radix-ui/i.test(allSrc)) add("ui", "Radix UI");
  if (/shadcn/i.test(allSrc))   add("ui", "shadcn/ui");
  if (/uikit/i.test(allSrc) || w.UIkit) add("ui", "UIkit");

  // Build
  if (w.__webpack_require__ || w.webpackJsonp || w.__webpack_modules__) add("build", "Webpack");
  if (w.__vite__)     add("build", "Vite");
  if (w.parcelRequire) add("build", "Parcel");
  if (w.__turbopack__) add("build", "Turbopack");

  // Monitoring
  if (w.__SENTRY__) add("monitoring", "Sentry");
  if (w.Bugsnag)    add("monitoring", "Bugsnag");
  if (w.DD_LOGS || w.DD_RUM) add("monitoring", "Datadog");
  if (w.newrelic)   add("monitoring", "New Relic");
  if (w.LR)         add("monitoring", "LogRocket");

  // Other
  if (w.Intercom) add("other", "Intercom");
  if (w.zE || w.zEmbed) add("other", "Zendesk");
  if (w.$crisp)    add("other", "Crisp Chat");
  if (w.tidioChatApi) add("other", "Tidio Chat");
  if (w.LiveChatWidget) add("other", "LiveChat");
  if (w.jivo_api)  add("other", "JivoChat");
  if (w.carrotquest) add("other", "Carrot Quest");
  if (w.grecaptcha) add("other", "Google reCAPTCHA");
  if (w.Turnstile)  add("other", "Cloudflare Turnstile");
  if (w.Stripe)     add("other", "Stripe");
  if (w.PayPal)     add("other", "PayPal");
  if (w.YaPay)      add("other", "YandexPay");
  if (w.SBP)        add("other", "СБП");
  if (w.cookieconsent || w.CookieConsent) add("other", "Cookie Consent");

  // ── Dynamic checks from merged DB ────────────────────────
  if (Array.isArray(remoteDB)) {
    for (const tech of remoteDB) {
      if (!tech?.name || !tech?.category || !Array.isArray(tech.checks)) continue;
      if (!techs[tech.category]) continue;
      if (techs[tech.category].find(t => t.name === tech.name)) continue; // already found

      let found   = false;
      let version = null;

      for (const chk of tech.checks) {
        if (!chk?.type) continue;

        if (chk.type === "global") {
          // Support dotted paths: "React.version", "L.version", etc.
          const parts = String(chk.key || "").split(".");
          let val = w;
          for (const p of parts) { val = val?.[p]; }
          if (val !== undefined && val !== null && val !== false && val !== "") {
            found = true;
            if (chk.version) {
              const vparts = String(chk.version).split(".");
              let ver = w;
              for (const p of vparts) { ver = ver?.[p]; }
              if (ver != null && typeof ver !== "object") version = String(ver);
            }
          }
        } else if (chk.type === "selector") {
          try { if (chk.css && doc.querySelector(chk.css)) found = true; } catch {}
        } else if (chk.type === "script") {
          try {
            if (chk.pattern && new RegExp(chk.pattern, "i").test(allScripts)) found = true;
          } catch {}
        } else if (chk.type === "stylesheet") {
          try {
            if (chk.pattern && new RegExp(chk.pattern, "i").test(allLinks)) found = true;
          } catch {}
        } else if (chk.type === "meta") {
          try {
            const sel   = chk.property ? `meta[property="${chk.property}"]` : `meta[name="${chk.name}"]`;
            const mEl   = (chk.name || chk.property) ? doc.querySelector(sel) : null;
            if (mEl) {
              const content = mEl.getAttribute("content") || "";
              if (!chk.pattern || new RegExp(chk.pattern, "i").test(content)) {
                found = true;
                if (chk.version_pattern) {
                  const m = content.match(new RegExp(chk.version_pattern));
                  if (m) version = m[1] ?? m[0];
                }
              }
            }
          } catch {}
        }

        if (found) break;
      }

      if (found) add(tech.category, tech.name, version);
    }
  }

  // ── Stats & meta ──────────────────────────────────────────
  const stats = {
    scripts:     doc.scripts.length,
    stylesheets: doc.styleSheets.length,
    images:      doc.images.length,
    iframes:     doc.querySelectorAll("iframe").length,
    links:       doc.links.length,
    domNodes:    doc.querySelectorAll("*").length
  };

  const meta = {
    lang:        doc.documentElement.lang || "",
    charset:     doc.characterSet || "",
    viewport:    doc.querySelector('meta[name="viewport"]')?.content    || "",
    description: doc.querySelector('meta[name="description"]')?.content || "",
    keywords:    doc.querySelector('meta[name="keywords"]')?.content    || "",
    robots:      doc.querySelector('meta[name="robots"]')?.content      || "",
    ogTitle:     doc.querySelector('meta[property="og:title"]')?.content || "",
    ogImage:     doc.querySelector('meta[property="og:image"]')?.content || "",
    canonical:   doc.querySelector('link[rel="canonical"]')?.href        || "",
    generator
  };

  return { techs, stats, meta };
}
