const state = {
  data: null,
  selectedPanelKey: null,
  selectedTypeKey: null,
  activeTab: "panel",
};

const DEFAULT_API_BASE = "https://grab-chemicals-metals-lung.trycloudflare.com";
const DEFAULT_API_KEY = "change-this-dashboard-key";
const API_BASE_STORAGE_KEY = "rafff-dashboard-api-base";
const API_KEY_STORAGE_KEY = "rafff-dashboard-api-key";
const DASHBOARD_PIN = "9384";
const THEME_OPTIONS = ["classic", "clean", "pro", "bold", "high_contrast", "ticket_king"];

const el = {
  lockscreen: document.getElementById("lockscreen"),
  pinDots: [...document.querySelectorAll("#pinDots .dot")],
  lockMessage: document.getElementById("lockMessage"),
  unlockButton: document.getElementById("unlockButton"),
  keypadButtons: [...document.querySelectorAll(".keypad .key")],
  connectionBadge: document.getElementById("connectionBadge"),
  refreshButton: document.getElementById("refreshButton"),
  panelList: document.getElementById("panelList"),
  ticketTypeList: document.getElementById("ticketTypeList"),
  panelCount: document.getElementById("panelCount"),
  ticketTypeCount: document.getElementById("ticketTypeCount"),
  tabButtons: [...document.querySelectorAll(".tab-btn")],
  tabPanes: {
    panel: document.getElementById("tab-panel"),
    options: document.getElementById("tab-options"),
    type: document.getElementById("tab-type"),
  },
  currentPanelText: document.getElementById("currentPanelText"),
  currentTypeText: document.getElementById("currentTypeText"),
  panelKey: document.getElementById("panelKey"),
  panelTitle: document.getElementById("panelTitle"),
  panelDescription: document.getElementById("panelDescription"),
  panelTheme: document.getElementById("panelTheme"),
  panelDisplayMode: document.getElementById("panelDisplayMode"),
  panelColor: document.getElementById("panelColor"),
  panelFooter: document.getElementById("panelFooter"),
  panelImage: document.getElementById("panelImage"),
  panelThumbnail: document.getElementById("panelThumbnail"),
  panelPlaceholder: document.getElementById("panelPlaceholder"),
  panelAccessibility: document.getElementById("panelAccessibility"),
  panelAccessibilitySummary: document.getElementById("panelAccessibilitySummary"),
  savePanelButton: document.getElementById("savePanelButton"),
  postChannelSelect: document.getElementById("postChannelSelect"),
  postPanelButton: document.getElementById("postPanelButton"),
  addButtonRow: document.getElementById("addButtonRow"),
  buttonEditorRows: document.getElementById("buttonEditorRows"),
  saveButtonsButton: document.getElementById("saveButtonsButton"),
  typeKey: document.getElementById("typeKey"),
  typeName: document.getElementById("typeName"),
  typeEmoji: document.getElementById("typeEmoji"),
  typeRole: document.getElementById("typeRole"),
  typeCategory: document.getElementById("typeCategory"),
  typeActive: document.getElementById("typeActive"),
  typeDescription: document.getElementById("typeDescription"),
  saveTypeButton: document.getElementById("saveTypeButton"),
  previewMount: document.getElementById("previewMount"),
  rowTemplate: document.getElementById("buttonRowTemplate"),
};

let enteredPin = "";
let unlocked = false;

for (const theme of THEME_OPTIONS) {
  const option = document.createElement("option");
  option.value = theme;
  option.textContent = theme;
  el.panelTheme.append(option);
}

function apiBase() {
  const saved = (localStorage.getItem(API_BASE_STORAGE_KEY) || "").trim();
  const origin = window.location.origin;

  if (!saved) return DEFAULT_API_BASE;

  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(saved);
  const isGithubPages = /github\.io$/i.test(window.location.hostname);
  const isHttps = /^https:\/\//i.test(saved);

  if (isGithubPages && (isLocal || !isHttps)) {
    localStorage.removeItem(API_BASE_STORAGE_KEY);
    return DEFAULT_API_BASE;
  }

  if (/^https?:\/\//i.test(saved)) {
    return saved;
  }

  if (/^https?:\/\//i.test(DEFAULT_API_BASE)) {
    return DEFAULT_API_BASE;
  }

  return `${origin}`;
}

function apiKey() {
  return localStorage.getItem(API_KEY_STORAGE_KEY) || DEFAULT_API_KEY;
}

function setStatus(online, text) {
  el.connectionBadge.textContent = text;
  el.connectionBadge.classList.remove("online", "offline");
  el.connectionBadge.classList.add(online ? "online" : "offline");
}

function updatePinDots() {
  el.pinDots.forEach((dot, index) => {
    dot.classList.toggle("filled", index < enteredPin.length);
  });
}

function resetPin(message = "Locked", isError = false) {
  enteredPin = "";
  updatePinDots();
  el.lockMessage.textContent = message;
  el.lockMessage.classList.toggle("error", isError);
}

function unlockDashboard() {
  unlocked = true;
  el.lockscreen.classList.add("hidden");
  connectAndLoad();
}

function attemptUnlock() {
  if (enteredPin === DASHBOARD_PIN) {
    el.lockMessage.classList.remove("error");
    el.lockMessage.textContent = "Unlocked";
    unlockDashboard();
    return;
  }
  resetPin("Wrong PIN. Try again.", true);
}

function connectionErrorText(base, message) {
  const lower = String(message || "").toLowerCase();
  if (lower.includes("failed to fetch")) {
    if (window.location.origin.includes("github.io") && /localhost|127\.0\.0\.1/.test(base)) {
      return "Cannot reach local API from GitHub Pages. Use a public HTTPS API URL.";
    }
    return "Dashboard API is unreachable right now. Check bot + tunnel are running.";
  }
  return String(message || "Connection failed");
}

async function callApi(path, options = {}) {
  const base = apiBase().replace(/\/$/, "");
  const key = apiKey().trim();
  if (!base || !key) throw new Error("Dashboard API base or key is missing.");

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${base}${path}`, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function connectAndLoad() {
  if (!unlocked) return;
  const base = apiBase();
  setStatus(false, "Connecting...");
  try {
    const data = await callApi("/api/bootstrap");
    state.data = data;
    state.selectedPanelKey = state.selectedPanelKey || data.panels[0]?.panel_key || null;
    state.selectedTypeKey = state.selectedTypeKey || data.ticket_types[0]?.key || null;
    setStatus(true, `Connected · ${data.guild.name}`);
    renderAll();
  } catch (error) {
    setStatus(false, connectionErrorText(base, error.message));
  }
}

function selectedPanel() {
  return state.data?.panels.find((panel) => panel.panel_key === state.selectedPanelKey) || null;
}

function selectedButtons() {
  const rows = state.data?.panel_buttons[state.selectedPanelKey] || [];
  return [...rows].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
}

function selectedType() {
  return state.data?.ticket_types.find((item) => item.key === state.selectedTypeKey) || null;
}

function switchTab(tab) {
  state.activeTab = tab;
  for (const btn of el.tabButtons) {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  }
  for (const [name, pane] of Object.entries(el.tabPanes)) {
    pane.classList.toggle("active", name === tab);
  }
}

function renderLists() {
  const panels = state.data?.panels || [];
  const types = state.data?.ticket_types || [];
  el.panelCount.textContent = String(panels.length);
  el.ticketTypeCount.textContent = String(types.length);

  el.panelList.innerHTML = "";
  for (const panel of panels) {
    const button = document.createElement("button");
    button.className = `list-item ${panel.panel_key === state.selectedPanelKey ? "active" : ""}`;
    button.textContent = `${panel.panel_key} · ${panel.title}`;
    button.onclick = () => {
      state.selectedPanelKey = panel.panel_key;
      renderPanelEditor();
      renderOptionRows();
      renderPreview();
      renderLists();
    };
    el.panelList.append(button);
  }

  el.ticketTypeList.innerHTML = "";
  for (const item of types) {
    const button = document.createElement("button");
    button.className = `list-item ${item.key === state.selectedTypeKey ? "active" : ""}`;
    button.textContent = `${item.name} (${item.key})`;
    button.onclick = () => {
      state.selectedTypeKey = item.key;
      switchTab("type");
      renderTypeEditor();
      renderLists();
    };
    el.ticketTypeList.append(button);
  }
}

function renderPanelEditor() {
  const panel = selectedPanel();
  if (!panel) return;

  el.currentPanelText.textContent = `${panel.panel_key} panel`;
  el.panelKey.value = panel.panel_key;
  el.panelTitle.value = panel.title || "";
  el.panelDescription.value = panel.description || "";
  el.panelTheme.value = panel.theme || "classic";
  el.panelDisplayMode.value = panel.display_mode || "buttons";
  el.panelColor.value = panel.color_hex || "#2b2d31";
  el.panelFooter.value = panel.footer_text || "";
  el.panelImage.value = panel.image_url || "";
  el.panelThumbnail.value = panel.thumbnail_url || "";
  el.panelPlaceholder.value = panel.dropdown_placeholder || "Choose a ticket type";
  el.panelAccessibility.checked = Boolean(panel.accessibility_mode);
  el.panelAccessibilitySummary.value = panel.accessibility_summary || "";

  const previousSelection = String(el.postChannelSelect.value || "");
  el.postChannelSelect.innerHTML = "";
  const channels = state.data.text_channels || [];
  for (const channel of channels) {
    const option = document.createElement("option");
    option.value = String(channel.id);
    option.textContent = `#${channel.name}`;
    el.postChannelSelect.append(option);
  }

  if (channels.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No text channels available";
    el.postChannelSelect.append(option);
    el.postChannelSelect.value = "";
    el.postPanelButton.disabled = true;
    return;
  }

  const previousStillExists = channels.some((channel) => String(channel.id) === previousSelection);
  el.postChannelSelect.value = previousStillExists
    ? previousSelection
    : String(channels[0].id);
  el.postPanelButton.disabled = false;
}

function renderOptionRows() {
  const rows = selectedButtons();
  el.buttonEditorRows.innerHTML = "";
  for (const row of rows) {
    el.buttonEditorRows.append(buildOptionRow(row));
  }
}

function buildOptionRow(data = {}) {
  const node = el.rowTemplate.content.cloneNode(true);
  const row = node.querySelector(".option-row");
  const typeSelect = row.querySelector('[data-field="ticket_type_key"]');

  for (const type of state.data.ticket_types || []) {
    const option = document.createElement("option");
    option.value = type.key;
    option.textContent = `${type.name} (${type.key})`;
    typeSelect.append(option);
  }

  const set = (field, value) => {
    const input = row.querySelector(`[data-field="${field}"]`);
    if (input) input.value = value ?? "";
  };

  set("ticket_type_key", data.ticket_type_key || state.data.ticket_types[0]?.key || "");
  set("button_label", data.button_label || "");
  set("button_style", data.button_style || "primary");
  set("sort_order", data.sort_order ?? 0);

  row.querySelector('[data-action="remove"]').onclick = () => {
    row.remove();
    renderPreview();
  };

  return row;
}

function renderTypeEditor() {
  const type = selectedType();
  if (!type) return;

  el.currentTypeText.textContent = `${type.name} (${type.key})`;
  el.typeKey.value = type.key;
  el.typeName.value = type.name || "";
  el.typeEmoji.value = type.emoji || "";
  el.typeDescription.value = type.description || "";
  el.typeActive.checked = Boolean(type.is_active);

  fillSelect(el.typeRole, state.data.roles || [], type.support_role_id);
  fillSelect(el.typeCategory, state.data.categories || [], type.category_id);
}

function fillSelect(select, rows, selectedId) {
  select.innerHTML = "";
  for (const row of rows) {
    const option = document.createElement("option");
    option.value = row.id;
    option.textContent = row.name;
    select.append(option);
  }
  select.value = String(selectedId || "");
}

function panelPayload() {
  return {
    title: el.panelTitle.value,
    description: el.panelDescription.value,
    theme: el.panelTheme.value,
    display_mode: el.panelDisplayMode.value,
    color_hex: el.panelColor.value,
    footer_text: el.panelFooter.value,
    image_url: el.panelImage.value,
    thumbnail_url: el.panelThumbnail.value,
    dropdown_placeholder: el.panelPlaceholder.value,
    accessibility_mode: el.panelAccessibility.checked,
    accessibility_summary: el.panelAccessibilitySummary.value,
  };
}

function optionPayload() {
  return [...el.buttonEditorRows.querySelectorAll(".option-row")].map((row) => ({
    ticket_type_key: row.querySelector('[data-field="ticket_type_key"]').value,
    button_label: row.querySelector('[data-field="button_label"]').value,
    button_style: row.querySelector('[data-field="button_style"]').value,
    sort_order: Number(row.querySelector('[data-field="sort_order"]').value || 0),
  }));
}

function renderPreview() {
  const panel = selectedPanel();
  if (!panel) return;

  const p = { ...panel, ...panelPayload() };
  const rows = optionPayload();

  const shell = document.createElement("div");
  shell.className = "discord-shell";

  const embed = document.createElement("div");
  embed.className = "discord-embed";
  embed.style.borderLeftColor = p.color_hex || "#1fb27a";

  if (p.theme === "ticket_king") {
    const lines = (p.description || "").split("\n").map((line) => line.trim()).filter(Boolean);
    const author = document.createElement("div");
    author.className = "embed-author";
    author.textContent = p.title || "Service Panel";
    const title = document.createElement("div");
    title.className = "embed-title";
    title.textContent = lines[0] || "Support & Inquiries";
    const body = document.createElement("div");
    body.className = "embed-description";
    body.textContent = lines.slice(1).join("\n") || "Need help? Open a ticket below.";
    embed.append(author, title, body);
  } else {
    const title = document.createElement("div");
    title.className = "embed-title";
    title.textContent = p.title || "Support Panel";
    const body = document.createElement("div");
    body.className = "embed-description";
    body.textContent = p.description || "Panel description";
    embed.append(title, body);
  }

  if (p.image_url) {
    const image = document.createElement("img");
    image.className = "embed-image";
    image.src = p.image_url;
    embed.append(image);
  }

  if (p.footer_text) {
    const footer = document.createElement("div");
    footer.className = "embed-footer";
    footer.textContent = p.footer_text;
    embed.append(footer);
  }

  const actions = document.createElement("div");
  actions.className = "preview-actions";
  if (p.display_mode === "dropdown") {
    const select = document.createElement("div");
    select.className = "preview-select";
    select.textContent = p.dropdown_placeholder || "Choose a ticket type";
    actions.append(select);
  } else {
    for (const row of rows) {
      const btn = document.createElement("div");
      btn.className = `preview-button ${row.button_style || "primary"}`;
      btn.textContent = row.button_label || row.ticket_type_key || "Ticket";
      actions.append(btn);
    }
  }

  shell.append(embed, actions);
  el.previewMount.replaceChildren(shell);
}

async function savePanel() {
  const panel = selectedPanel();
  if (!panel) return;
  await callApi(`/api/panels/${panel.panel_key}`, {
    method: "PUT",
    body: JSON.stringify(panelPayload()),
  });
  await connectAndLoad();
}

async function saveOptions() {
  const panel = selectedPanel();
  if (!panel) return;
  await callApi(`/api/panels/${panel.panel_key}/buttons`, {
    method: "PUT",
    body: JSON.stringify({ buttons: optionPayload() }),
  });
  await connectAndLoad();
}

async function saveType() {
  const type = selectedType();
  if (!type) return;
  await callApi(`/api/ticket-types/${type.key}`, {
    method: "PUT",
    body: JSON.stringify({
      name: el.typeName.value,
      emoji: el.typeEmoji.value,
      support_role_id: Number(el.typeRole.value),
      category_id: Number(el.typeCategory.value),
      is_active: el.typeActive.checked,
      description: el.typeDescription.value,
    }),
  });
  await connectAndLoad();
}

async function postPanel() {
  const panel = selectedPanel();
  if (!panel) return;
  const channelId = Number(el.postChannelSelect.value);
  if (!Number.isFinite(channelId) || channelId <= 0) {
    setStatus(false, "Choose a valid text channel before posting.");
    return;
  }
  await callApi(`/api/panels/${panel.panel_key}/post`, {
    method: "POST",
    body: JSON.stringify({ channel_id: channelId }),
  });
  setStatus(true, `Posted ${panel.panel_key} panel`);
}

function wireEvents() {
  el.refreshButton.onclick = () => connectAndLoad();
  el.savePanelButton.onclick = () => savePanel().catch((err) => setStatus(false, err.message));
  el.saveButtonsButton.onclick = () => saveOptions().catch((err) => setStatus(false, err.message));
  el.saveTypeButton.onclick = () => saveType().catch((err) => setStatus(false, err.message));
  el.postPanelButton.onclick = () => postPanel().catch((err) => setStatus(false, err.message));
  el.addButtonRow.onclick = () => {
    el.buttonEditorRows.append(buildOptionRow());
    renderPreview();
  };

  el.tabButtons.forEach((button) => {
    button.onclick = () => switchTab(button.dataset.tab);
  });

  el.keypadButtons.forEach((button) => {
    button.onclick = () => {
      const key = button.dataset.key;
      const action = button.dataset.action;
      if (action === "clear") {
        resetPin("Locked", false);
        return;
      }
      if (action === "backspace") {
        enteredPin = enteredPin.slice(0, -1);
        updatePinDots();
        return;
      }
      if (!key || enteredPin.length >= 4) return;
      enteredPin += key;
      updatePinDots();
      if (enteredPin.length === 4) attemptUnlock();
    };
  });

  el.unlockButton.onclick = () => attemptUnlock();

  window.addEventListener("keydown", (event) => {
    if (unlocked) return;
    if (/^[0-9]$/.test(event.key) && enteredPin.length < 4) {
      enteredPin += event.key;
      updatePinDots();
      if (enteredPin.length === 4) attemptUnlock();
      return;
    }
    if (event.key === "Backspace") {
      enteredPin = enteredPin.slice(0, -1);
      updatePinDots();
      return;
    }
    if (event.key === "Enter") {
      attemptUnlock();
    }
  });

  [
    el.panelTitle,
    el.panelDescription,
    el.panelTheme,
    el.panelDisplayMode,
    el.panelColor,
    el.panelFooter,
    el.panelImage,
    el.panelThumbnail,
    el.panelPlaceholder,
    el.panelAccessibility,
    el.panelAccessibilitySummary,
  ].forEach((field) => {
    field.addEventListener("input", renderPreview);
  });

  document.addEventListener("input", (event) => {
    if (event.target.closest(".option-row")) renderPreview();
  });
}

function renderAll() {
  renderLists();
  renderPanelEditor();
  renderOptionRows();
  renderTypeEditor();
  renderPreview();
}

wireEvents();
switchTab("panel");
resetPin();
