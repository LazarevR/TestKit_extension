// ============================================================
// TestKit — Settings Page
// All DOM interaction uses event delegation (data-action attributes)
// to comply with the extension's Content Security Policy.
// ============================================================

let customMenus = [];

// ── Init ─────────────────────────────────────────────────────
async function init() {
  const { customMenus: stored = [] } = await chrome.storage.sync.get("customMenus");
  customMenus = stored;
  render();
  bindEvents();
  await initDbSection();
}

async function save() {
  await chrome.storage.sync.set({ customMenus });
}

// ── Render ────────────────────────────────────────────────────
function render(openGroupId = null) {
  const list = document.getElementById("groups-list");

  if (customMenus.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📂</div>
        <div>Нет пользовательских меню</div>
        <div style="font-size:12px;margin-top:4px;">Нажми «+ Добавить группу» чтобы начать</div>
      </div>`;
    return;
  }

  list.innerHTML = customMenus.map(g => renderGroup(g)).join("");

  if (openGroupId) {
    document.getElementById("gc-" + openGroupId)?.classList.add("open");
  }
}

function renderGroup(group) {
  const body = group.items.length === 0
    ? `<div class="empty-items">Нет пунктов — добавь первый ↓</div>`
    : group.items.map(entry =>
        Array.isArray(entry.items)
          ? renderSubgroup(group.id, entry)
          : renderItem(group.id, null, entry)
      ).join("");

  return `
    <div class="group-card" id="gc-${group.id}">
      <div class="group-head" data-action="toggle-group" data-group-id="${group.id}">
        <span class="group-arrow">▶</span>
        <span class="group-icon">📁</span>
        <span class="group-name-text" id="gname-${group.id}">${escHtml(group.name)}</span>
        <span class="group-count">${group.items.length}</span>
        <div class="group-actions">
          <button class="btn btn-ghost btn-sm"
                  data-action="rename-group"
                  data-group-id="${group.id}"
                  title="Переименовать">✏️</button>
          <button class="btn btn-danger btn-sm"
                  data-action="delete-group"
                  data-group-id="${group.id}"
                  title="Удалить группу">🗑</button>
        </div>
      </div>
      <div class="group-body">
        <div id="items-${group.id}">${body}</div>
        <div id="add-item-slot-${group.id}"></div>
        <div class="group-footer-actions">
          <button class="btn btn-ghost btn-sm"
                  data-action="show-add-item"
                  data-group-id="${group.id}">+ Добавить пункт</button>
          <button class="btn btn-ghost btn-sm"
                  data-action="show-add-subgroup"
                  data-group-id="${group.id}">+ Добавить подгруппу</button>
        </div>
      </div>
    </div>`;
}

function renderSubgroup(parentGroupId, subgroup) {
  const body = subgroup.items.length === 0
    ? `<div class="empty-items" style="padding:4px 0;font-size:12px;">Нет пунктов ↓</div>`
    : subgroup.items.map(item => renderItem(parentGroupId, subgroup.id, item)).join("");

  return `
    <div class="subgroup-card" id="sgc-${subgroup.id}">
      <div class="subgroup-head" data-action="toggle-subgroup" data-subgroup-id="${subgroup.id}">
        <span class="group-arrow" style="font-size:9px;">▶</span>
        <span class="group-icon" style="font-size:14px;">📂</span>
        <span class="subgroup-name-text">${escHtml(subgroup.name)}</span>
        <span class="group-count">${subgroup.items.length}</span>
        <div class="group-actions">
          <button class="btn btn-danger btn-sm"
                  data-action="delete-subgroup"
                  data-group-id="${parentGroupId}"
                  data-subgroup-id="${subgroup.id}"
                  title="Удалить подгруппу">🗑</button>
        </div>
      </div>
      <div class="subgroup-body">
        <div id="sub-items-${subgroup.id}">${body}</div>
        <div id="add-sub-item-slot-${subgroup.id}"></div>
        <div style="margin-top:8px;">
          <button class="btn btn-ghost btn-sm"
                  data-action="show-add-sub-item"
                  data-group-id="${parentGroupId}"
                  data-subgroup-id="${subgroup.id}">+ Добавить пункт</button>
        </div>
      </div>
    </div>`;
}

function renderItem(groupId, subgroupId, item) {
  const preview = item.content.length > 60
    ? escHtml(item.content.substring(0, 57)) + "…"
    : escHtml(item.content);
  const sg = subgroupId ? `data-subgroup-id="${subgroupId}"` : "";
  return `
    <div class="item-row" id="ir-${item.id}">
      <div class="item-info">
        <div class="item-content-preview">${preview}</div>
      </div>
      <div class="item-actions">
        <button class="btn btn-ghost btn-sm"
                data-action="edit-item"
                data-group-id="${groupId}" ${sg}
                data-item-id="${item.id}"
                title="Редактировать">✏️</button>
        <button class="btn btn-danger btn-sm"
                data-action="delete-item"
                data-group-id="${groupId}" ${sg}
                data-item-id="${item.id}"
                title="Удалить">🗑</button>
      </div>
    </div>`;
}

// ── Event binding ─────────────────────────────────────────────
function bindEvents() {
  document.getElementById("btn-add-group").addEventListener("click", showAddGroupForm);
  document.getElementById("btn-cancel-group").addEventListener("click", hideAddGroupForm);
  document.getElementById("btn-save-group").addEventListener("click", createGroup);
  document.getElementById("new-group-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter")  createGroup();
    if (e.key === "Escape") hideAddGroupForm();
  });

  document.getElementById("btn-export").addEventListener("click", exportSettings);
  document.getElementById("import-input").addEventListener("change", importSettings);

  document.getElementById("btn-db-save").addEventListener("click", saveDbUrl);
  document.getElementById("btn-db-refresh").addEventListener("click", refreshDb);

  document.getElementById("groups-list").addEventListener("click", onGroupsClick);
  document.getElementById("groups-list").addEventListener("keydown", onGroupsKeydown);
}

// ── Delegated click handler ───────────────────────────────────
function onGroupsClick(e) {
  const el = e.target.closest("[data-action]");
  if (!el) return;

  const { action, groupId, subgroupId, itemId } = el.dataset;

  if (action !== "toggle-group" && action !== "toggle-subgroup") e.stopPropagation();

  switch (action) {
    case "toggle-group":        toggleGroup(groupId);                       break;
    case "rename-group":        startRenameGroup(groupId);                  break;
    case "confirm-rename":      confirmRenameGroup(groupId);                break;
    case "cancel-rename":       render(groupId);                            break;
    case "delete-group":        deleteGroup(groupId);                       break;
    case "show-add-item":       showAddItemForm(groupId);                   break;
    case "cancel-add-item":     hideAddItemForm(groupId);                   break;
    case "save-new-item":       saveNewItem(groupId);                       break;
    case "show-add-subgroup":   showAddSubgroupForm(groupId);               break;
    case "cancel-add-subgroup": hideAddSubgroupForm(groupId);               break;
    case "save-new-subgroup":   saveNewSubgroup(groupId);                   break;
    case "toggle-subgroup":     toggleSubgroup(subgroupId);                 break;
    case "delete-subgroup":     deleteSubgroup(groupId, subgroupId);        break;
    case "show-add-sub-item":   showAddSubItemForm(groupId, subgroupId);    break;
    case "cancel-add-sub-item": hideAddSubItemForm(subgroupId);             break;
    case "save-new-sub-item":   saveNewSubItem(groupId, subgroupId);        break;
    case "edit-item":           startEditItem(groupId, subgroupId, itemId); break;
    case "save-edit-item":      saveEditItem(groupId, subgroupId, itemId);  break;
    case "cancel-edit-item":    render(groupId);                            break;
    case "delete-item":         deleteItem(groupId, subgroupId, itemId);    break;
  }
}

function onGroupsKeydown(e) {
  if (!e.target.matches("[data-role='rename-input']")) return;
  const groupId = e.target.dataset.groupId;
  if (e.key === "Enter")  confirmRenameGroup(groupId);
  if (e.key === "Escape") render(groupId);
}

// ── Group operations ──────────────────────────────────────────
function toggleGroup(groupId) {
  document.getElementById("gc-" + groupId)?.classList.toggle("open");
}

function showAddGroupForm() {
  document.getElementById("add-group-form").classList.remove("hidden");
  document.getElementById("new-group-name").focus();
}

function hideAddGroupForm() {
  document.getElementById("add-group-form").classList.add("hidden");
  document.getElementById("new-group-name").value = "";
}

function createGroup() {
  const name = document.getElementById("new-group-name").value.trim();
  if (!name) { showToast("Введи название группы"); return; }

  const newGroup = { id: uid(), name, items: [] };
  customMenus.push(newGroup);
  save().then(() => {
    hideAddGroupForm();
    render(newGroup.id);
    showToast("Группа создана");
  });
}

function startRenameGroup(groupId) {
  const group = customMenus.find(g => g.id === groupId);
  if (!group) return;

  const nameSpan = document.getElementById("gname-" + groupId);
  if (!nameSpan) return;

  nameSpan.innerHTML = `
    <input type="text"
           data-role="rename-input"
           data-group-id="${groupId}"
           value="${escHtml(group.name)}"
           maxlength="40"
           style="width:180px;font-size:13px;">
    <button class="btn btn-primary btn-sm"
            data-action="confirm-rename"
            data-group-id="${groupId}"
            style="margin-left:6px;">OK</button>
    <button class="btn btn-ghost btn-sm"
            data-action="cancel-rename"
            data-group-id="${groupId}"
            style="margin-left:4px;">✕</button>
  `;
  nameSpan.querySelector("input")?.focus();
}

function confirmRenameGroup(groupId) {
  const input = document.querySelector(`[data-role="rename-input"][data-group-id="${groupId}"]`);
  const newName = input?.value.trim();
  if (!newName) return;

  const group = customMenus.find(g => g.id === groupId);
  if (!group) return;
  group.name = newName;

  const wasOpen = document.getElementById("gc-" + groupId)?.classList.contains("open");
  save().then(() => render(wasOpen ? groupId : null));
}

function deleteGroup(groupId) {
  if (!confirm("Удалить группу и все её пункты?")) return;
  customMenus = customMenus.filter(g => g.id !== groupId);
  save().then(() => render());
}

// ── Subgroup operations ───────────────────────────────────────
function toggleSubgroup(subgroupId) {
  document.getElementById("sgc-" + subgroupId)?.classList.toggle("open");
}

function showAddSubgroupForm(groupId) {
  const slot = document.getElementById("add-item-slot-" + groupId);
  if (!slot) return;

  slot.innerHTML = `
    <div class="inline-form">
      <div class="form-label">Название подгруппы</div>
      <input type="text"
             id="new-subgroup-name-${groupId}"
             placeholder="Например: Адреса, Подписи…"
             maxlength="40">
      <div class="form-actions">
        <button class="btn btn-ghost btn-sm"
                data-action="cancel-add-subgroup"
                data-group-id="${groupId}">Отмена</button>
        <button class="btn btn-primary btn-sm"
                data-action="save-new-subgroup"
                data-group-id="${groupId}">Создать</button>
      </div>
    </div>`;

  document.getElementById("new-subgroup-name-" + groupId)?.focus();
}

function hideAddSubgroupForm(groupId) {
  const slot = document.getElementById("add-item-slot-" + groupId);
  if (slot) slot.innerHTML = "";
}

function saveNewSubgroup(groupId) {
  const name = document.getElementById("new-subgroup-name-" + groupId)?.value.trim();
  if (!name) { showToast("Введи название подгруппы"); return; }

  const group = customMenus.find(g => g.id === groupId);
  if (!group) return;

  group.items.push({ id: uid(), name, items: [] });
  save().then(() => {
    render(groupId);
    showToast("Подгруппа создана");
  });
}

function deleteSubgroup(groupId, subgroupId) {
  if (!confirm("Удалить подгруппу и все её пункты?")) return;
  const group = customMenus.find(g => g.id === groupId);
  if (!group) return;

  group.items = group.items.filter(i => i.id !== subgroupId);
  save().then(() => {
    render(groupId);
    showToast("Подгруппа удалена");
  });
}

// ── Item operations (direct in group) ────────────────────────
function showAddItemForm(groupId) {
  const slot = document.getElementById("add-item-slot-" + groupId);
  if (!slot) return;

  slot.innerHTML = `
    <div class="inline-form">
      <div class="form-label">Текст для вставки</div>
      <textarea id="new-item-content-${groupId}"
                placeholder="Текст, который вставится при нажатии…"
                rows="3"></textarea>
      <div class="form-actions">
        <button class="btn btn-ghost btn-sm"
                data-action="cancel-add-item"
                data-group-id="${groupId}">Отмена</button>
        <button class="btn btn-primary btn-sm"
                data-action="save-new-item"
                data-group-id="${groupId}">Добавить</button>
      </div>
    </div>`;

  document.getElementById("new-item-content-" + groupId)?.focus();
}

function hideAddItemForm(groupId) {
  const slot = document.getElementById("add-item-slot-" + groupId);
  if (slot) slot.innerHTML = "";
}

function saveNewItem(groupId) {
  const content = document.getElementById("new-item-content-" + groupId)?.value ?? "";
  if (!content.trim()) { showToast("Введи текст для вставки"); return; }

  const group = customMenus.find(g => g.id === groupId);
  if (!group) return;

  group.items.push({ id: uid(), content });
  save().then(() => {
    render(groupId);
    showToast("Пункт добавлен");
  });
}

// ── Item operations (inside subgroup) ────────────────────────
function showAddSubItemForm(groupId, subgroupId) {
  const slot = document.getElementById("add-sub-item-slot-" + subgroupId);
  if (!slot) return;

  slot.innerHTML = `
    <div class="inline-form">
      <div class="form-label">Текст для вставки</div>
      <textarea id="new-sub-item-content-${subgroupId}"
                placeholder="Текст, который вставится при нажатии…"
                rows="3"></textarea>
      <div class="form-actions">
        <button class="btn btn-ghost btn-sm"
                data-action="cancel-add-sub-item"
                data-group-id="${groupId}"
                data-subgroup-id="${subgroupId}">Отмена</button>
        <button class="btn btn-primary btn-sm"
                data-action="save-new-sub-item"
                data-group-id="${groupId}"
                data-subgroup-id="${subgroupId}">Добавить</button>
      </div>
    </div>`;

  document.getElementById("new-sub-item-content-" + subgroupId)?.focus();
}

function hideAddSubItemForm(subgroupId) {
  const slot = document.getElementById("add-sub-item-slot-" + subgroupId);
  if (slot) slot.innerHTML = "";
}

function saveNewSubItem(groupId, subgroupId) {
  const content = document.getElementById("new-sub-item-content-" + subgroupId)?.value ?? "";
  if (!content.trim()) { showToast("Введи текст для вставки"); return; }

  const group    = customMenus.find(g => g.id === groupId);
  const subgroup = group?.items.find(i => i.id === subgroupId && Array.isArray(i.items));
  if (!subgroup) return;

  subgroup.items.push({ id: uid(), content });
  save().then(() => {
    render(groupId);
    showToast("Пункт добавлен");
  });
}

// ── Edit / Delete items (work for both direct and sub-group items) ──
function startEditItem(groupId, subgroupId, itemId) {
  const group = customMenus.find(g => g.id === groupId);
  const item  = subgroupId
    ? group?.items.find(i => i.id === subgroupId && Array.isArray(i.items))?.items.find(i => i.id === itemId)
    : group?.items.find(i => i.id === itemId && !Array.isArray(i.items));
  if (!item) return;

  const row = document.getElementById("ir-" + itemId);
  if (!row) return;

  const sg   = subgroupId ? `data-subgroup-id="${subgroupId}"` : "";
  const form = document.createElement("div");
  form.className = "inline-form";
  form.id = "ef-" + itemId;
  form.innerHTML = `
    <div class="form-label">Текст для вставки</div>
    <textarea id="edit-content-${itemId}" rows="3">${escHtml(item.content)}</textarea>
    <div class="form-actions">
      <button class="btn btn-ghost btn-sm"
              data-action="cancel-edit-item"
              data-group-id="${groupId}"
              data-item-id="${itemId}">Отмена</button>
      <button class="btn btn-primary btn-sm"
              data-action="save-edit-item"
              data-group-id="${groupId}" ${sg}
              data-item-id="${itemId}">Сохранить</button>
    </div>`;

  row.replaceWith(form);
  document.getElementById("edit-content-" + itemId)?.focus();
}

function saveEditItem(groupId, subgroupId, itemId) {
  const content = document.getElementById("edit-content-" + itemId)?.value ?? "";
  if (!content.trim()) { showToast("Введи текст для вставки"); return; }

  const group = customMenus.find(g => g.id === groupId);
  const item  = subgroupId
    ? group?.items.find(i => i.id === subgroupId && Array.isArray(i.items))?.items.find(i => i.id === itemId)
    : group?.items.find(i => i.id === itemId && !Array.isArray(i.items));
  if (!item) return;

  item.content = content;
  save().then(() => {
    render(groupId);
    showToast("Сохранено");
  });
}

function deleteItem(groupId, subgroupId, itemId) {
  const group = customMenus.find(g => g.id === groupId);
  if (!group) return;

  if (subgroupId) {
    const sub = group.items.find(i => i.id === subgroupId && Array.isArray(i.items));
    if (sub) sub.items = sub.items.filter(i => i.id !== itemId);
  } else {
    group.items = group.items.filter(i => i.id !== itemId);
  }
  save().then(() => {
    render(groupId);
    showToast("Пункт удалён");
  });
}

// ── Technology DB ─────────────────────────────────────────────
async function initDbSection() {
  const { remoteDbUrl = "" } = await chrome.storage.sync.get("remoteDbUrl");
  const { remoteTechDBUpdatedAt, remoteTechDBCount } = await chrome.storage.local.get([
    "remoteTechDBUpdatedAt", "remoteTechDBCount"
  ]);
  document.getElementById("db-url-input").value = remoteDbUrl;
  renderDbStatus(remoteTechDBUpdatedAt, remoteTechDBCount);
}

function renderDbStatus(updatedAt, count) {
  const el = document.getElementById("db-status");
  if (!updatedAt) {
    el.innerHTML = "Удалённая база ещё не загружена.";
    return;
  }
  const date = new Date(updatedAt).toLocaleString("ru-RU");
  el.innerHTML = `<span class="ok">✓</span> Обновлено: ${date}` +
    (count ? ` · ${count} технологий` : "");
}

async function saveDbUrl() {
  const url = document.getElementById("db-url-input").value.trim();
  await chrome.storage.sync.set({ remoteDbUrl: url });
  showToast("URL сохранён");
}

async function refreshDb() {
  const btn = document.getElementById("btn-db-refresh");
  btn.disabled = true;
  btn.textContent = "Загрузка…";

  try {
    const response = await chrome.runtime.sendMessage({ action: "fetchTechDB" });
    if (response?.ok) {
      const { remoteTechDBUpdatedAt, remoteTechDBCount } = await chrome.storage.local.get([
        "remoteTechDBUpdatedAt", "remoteTechDBCount"
      ]);
      renderDbStatus(remoteTechDBUpdatedAt, remoteTechDBCount);
      showToast("База обновлена");
    } else {
      showToast("Ошибка: " + (response?.error || "неизвестная ошибка"));
    }
  } catch (err) {
    showToast("Ошибка: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Обновить сейчас";
  }
}

// ── Export ────────────────────────────────────────────────────
function exportSettings() {
  const blob = new Blob(
    [JSON.stringify({ version: 1, customMenus }, null, 2)],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement("a"), { href: url, download: "testkit-settings.json" });
  a.click();
  URL.revokeObjectURL(url);
  showToast("Файл скачан");
}

// ── Import ────────────────────────────────────────────────────
function importSettings(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = "";

  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);

      if (!Array.isArray(parsed.customMenus)) {
        showToast("Неверный формат файла"); return;
      }
      for (const g of parsed.customMenus) {
        if (typeof g.id !== "string" || typeof g.name !== "string" || !Array.isArray(g.items)) {
          showToast("Неверный формат файла"); return;
        }
        for (const entry of g.items) {
          if (typeof entry.id !== "string") { showToast("Неверный формат файла"); return; }
          if (Array.isArray(entry.items)) {
            if (typeof entry.name !== "string") { showToast("Неверный формат файла"); return; }
            for (const item of entry.items) {
              if (typeof item.id !== "string" || typeof item.content !== "string") {
                showToast("Неверный формат файла"); return;
              }
            }
          } else if (typeof entry.content !== "string") {
            showToast("Неверный формат файла"); return;
          }
        }
      }

      if (!confirm(`Импортировать ${parsed.customMenus.length} групп(ы)? Текущие настройки будут заменены.`)) return;

      customMenus = parsed.customMenus;
      await save();
      render();
      showToast(`Импортировано: ${customMenus.length} групп`);
    } catch {
      showToast("Ошибка чтения файла");
    }
  };
  reader.readAsText(file);
}

// ── Helpers ───────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
}

// ── Start ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", init);
