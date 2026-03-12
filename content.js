// ============================================================
// TestKit — Content Script
// ============================================================

// Lorem ipsum source texts (truncated to requested length at runtime)
const LOREM = {
  en: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed perspiciatis unde omnis iste natus error sit voluptatem.",
  ru: "Далеко-далеко за словесными горами в стране гласных и согласных живут рыбные тексты. Вдали от всех живут они в буквенных домах на берегу Семантика, большого языкового океана. Маленький ручеёк Сбой журчит по всей местности по необходимым правилам. Однажды ночью алфавитное сообщество, разбавленное толикой переводчиков из Скриптории, решило уйти в безбрежные просторы синтаксиса. Это стандартный заполнитель текста для тестирования вёрстки и макетирования интерфейсов. Здесь живут буквы и знаки препинания."
};

// Track the last focused editable element —
// context menu clicks can shift focus away from the target field.
let lastFocused = null;

document.addEventListener("focus", (e) => {
  const el = e.target;
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) {
    lastFocused = el;
  }
}, true /* capture phase */);

// ── Message listener ────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "lorem") {
    const text = (LOREM[msg.lang] || LOREM.en).substring(0, msg.len ?? 50);
    insertText(text);
    sendResponse({ ok: true });
  }
  if (msg.action === "insert") {
    insertText(msg.text ?? "");
    sendResponse({ ok: true });
  }
  return false;
});

// ── Generic text insertion ───────────────────────────────────
function insertText(text) {
  const el = lastFocused || document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return;

  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
    const supportsSelection = el.tagName === "TEXTAREA" ||
      ["text", "search", "url", "tel", "password", ""].includes((el.type || "").toLowerCase());
    const start = supportsSelection ? (el.selectionStart ?? el.value.length) : el.value.length;
    const end   = supportsSelection ? (el.selectionEnd   ?? el.value.length) : el.value.length;
    el.value = el.value.slice(0, start) + text + el.value.slice(end);
    if (supportsSelection) el.selectionStart = el.selectionEnd = start + text.length;
    el.dispatchEvent(new InputEvent("input",  { bubbles: true, data: text }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (el.isContentEditable) {
    el.focus();
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}
