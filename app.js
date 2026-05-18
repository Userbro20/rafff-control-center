const state = {
  data: null,
  selectedPanelKey: null,
  selectedTypeKey: null,
};

const DEFAULT_API_BASE = "https://try-hockey-warming-meaning.trycloudflare.com";
const DEFAULT_API_KEY = "change-this-dashboard-key";

const themeOptions = ["classic", "clean", "pro", "bold", "high_contrast", "ticket_king"];

const elements = {
  apiBase: document.getElementById("apiBase"),
  apiKey: document.getElementById("apiKey"),
  connectButton: document.getElementById("connectButton"),
  refreshButton: document.getElementById("refreshButton"),
  connectionStatus: document.getElementById("connectionStatus"),
  panelList: document.getElementById("panelList"),
  ticketTypeList: document.getElementById("ticketTypeList"),
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
  currentPanelBadge: document.getElementById("currentPanelBadge"),
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
  currentTicketTypeBadge: document.getElementById("currentTicketTypeBadge"),
  saveTypeButton: document.getElementById("saveTypeButton"),
  previewMount: document.getElementById("previewMount"),
  settingKey: document.getElementById("settingKey"),
  settingValue: document.getElementById("settingValue"),
  saveSettingButton: document.getElementById("saveSettingButton"),
  settingsList: document.getElementById("settingsList"),
  buttonRowTemplate: document.getElementById("buttonRowTemplate"),
};

for (const theme of themeOptions) {
  const option = document.createElement("option");
  option.value = theme;
  option.textContent = theme;
  elements.panelTheme.append(option);
}

elements.apiBase.value = localStorage.getItem("rafff-dashboard-api-base") || DEFAULT_API_BASE;
elements.apiKey.value = localStorage.getItem("rafff-dashboard-api-key") || DEFAULT_API_KEY;

async function api(path, options = {}) {
  const base = elements.apiBase.value.replace(/\/$/, "");
  const apiKey = elements.apiKey.value.trim();
  if (!base || !apiKey) throw new Error("API base URL and API key are required.");
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${apiKey}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${base}${path}`, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function explainConnectionError(base, error) {
  const message = String(error?.message || "Connection failed");
  const isFetchFailure = message.toLowerCase().includes("failed to fetch");
  if (!isFetchFailure) return message;

  const origin = window.location.origin;
  const isLocalBase = /https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(base);
  const isHttpsPage = origin.startsWith("https://");

  if (isLocalBase && origin.includes("github.io")) {
    return "Failed to fetch: this site is on GitHub Pages, so 127.0.0.1 points to your own device, not your bot host. Use a public HTTPS API URL.";
  }
  if (isHttpsPage && base.startsWith("http://")) {
    return "Failed to fetch: your page is HTTPS but API base is HTTP. Use an HTTPS API URL.";
  }
  return "Failed to fetch: API URL is unreachable, blocked by CORS, or the bot API is not running.";
}

async function connect() {
  localStorage.setItem("rafff-dashboard-api-base", elements.apiBase.value.trim());
  localStorage.setItem("rafff-dashboard-api-key", elements.apiKey.value.trim());
  elements.connectionStatus.textContent = "Connecting...";
  const data = await api("/api/bootstrap");
  state.data = data;
  state.selectedPanelKey = data.panels[0]?.panel_key || null;
  state.selectedTypeKey = data.ticket_types[0]?.key || null;
  elements.connectionStatus.textContent = `Connected to ${data.guild.name}`;
  renderAll();
}

function renderAll() {
  renderLists();
  renderPanelEditor();
  renderTicketTypeEditor();
  renderSettings();
  renderPreview();
}

function renderLists() {
  elements.panelList.innerHTML = "";
  for (const panel of state.data.panels) {
    const item = document.createElement("button");
    item.className = `list-item ${panel.panel_key === state.selectedPanelKey ? "active" : ""}`;
    item.textContent = `${panel.panel_key} · ${panel.title}`;
    item.onclick = () => {
      state.selectedPanelKey = panel.panel_key;
      renderAll();
    };
    elements.panelList.append(item);
  }

  elements.ticketTypeList.innerHTML = "";
  for (const ticketType of state.data.ticket_types) {
    const item = document.createElement("button");
    item.className = `list-item ${ticketType.key === state.selectedTypeKey ? "active" : ""}`;
    item.textContent = `${ticketType.name} (${ticketType.key})`;
    item.onclick = () => {
      state.selectedTypeKey = ticketType.key;
      renderAll();
    };
    elements.ticketTypeList.append(item);
  }
}

function selectedPanel() {
  return state.data.panels.find(panel => panel.panel_key === state.selectedPanelKey) || null;
}

function selectedButtons() {
  return [...(state.data.panel_buttons[state.selectedPanelKey] || [])]
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
}

function selectedType() {
  return state.data.ticket_types.find(ticketType => ticketType.key === state.selectedTypeKey) || null;
}

function renderPanelEditor() {
  const panel = selectedPanel();
  if (!panel) return;
  elements.currentPanelBadge.textContent = panel.panel_key;
  elements.panelKey.value = panel.panel_key;
  elements.panelTitle.value = panel.title || "";
  elements.panelDescription.value = panel.description || "";
  elements.panelTheme.value = panel.theme || "classic";
  elements.panelDisplayMode.value = panel.display_mode || "buttons";
  elements.panelColor.value = panel.color_hex || "#2b2d31";
  elements.panelFooter.value = panel.footer_text || "";
  elements.panelImage.value = panel.image_url || "";
  elements.panelThumbnail.value = panel.thumbnail_url || "";
  elements.panelPlaceholder.value = panel.dropdown_placeholder || "Choose a ticket type";
  elements.panelAccessibility.checked = Boolean(panel.accessibility_mode);
  elements.panelAccessibilitySummary.value = panel.accessibility_summary || "";
  populateChannelSelect();
  renderButtonRows();
}

function renderButtonRows() {
  const buttons = selectedButtons();
  elements.buttonEditorRows.innerHTML = "";
  for (const button of buttons) {
    elements.buttonEditorRows.append(buildButtonRow(button));
  }
}

function buildButtonRow(button = {}) {
  const fragment = elements.buttonRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".button-row");
  for (const [field, value] of Object.entries(button)) {
    const input = row.querySelector(`[data-field="${field}"]`);
    if (input) input.value = value;
  }
  const typeSelect = row.querySelector('[data-field="ticket_type_key"]');
  for (const ticketType of state.data.ticket_types) {
    const option = document.createElement("option");
    option.value = ticketType.key;
    option.textContent = `${ticketType.name} (${ticketType.key})`;
    typeSelect.append(option);
  }
  typeSelect.value = button.ticket_type_key || state.data.ticket_types[0]?.key || "";
  row.querySelector('[data-action="remove"]').onclick = () => row.remove();
  return row;
}

function populateChannelSelect() {
  const currentValue = elements.postChannelSelect.value;
  elements.postChannelSelect.innerHTML = "";
  for (const channel of state.data.text_channels) {
    const option = document.createElement("option");
    option.value = channel.id;
    option.textContent = `#${channel.name}`;
    elements.postChannelSelect.append(option);
  }
  if (currentValue) elements.postChannelSelect.value = currentValue;
}

function renderTicketTypeEditor() {
  const ticketType = selectedType();
  if (!ticketType) return;
  elements.currentTicketTypeBadge.textContent = ticketType.key;
  elements.typeKey.value = ticketType.key;
  elements.typeName.value = ticketType.name;
  elements.typeEmoji.value = ticketType.emoji || "";
  fillSelect(elements.typeRole, state.data.roles, ticketType.support_role_id);
  fillSelect(elements.typeCategory, state.data.categories, ticketType.category_id);
  elements.typeActive.checked = Boolean(ticketType.is_active);
  elements.typeDescription.value = ticketType.description || "";
}

function fillSelect(select, items, selectedId) {
  select.innerHTML = "";
  for (const item of items) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    select.append(option);
  }
  select.value = String(selectedId || "");
}

function renderSettings() {
  elements.settingsList.innerHTML = "";
  const settings = state.data.guild_settings || {};
  for (const key of Object.keys(settings).sort()) {
    const line = document.createElement("div");
    line.className = "list-item";
    line.textContent = `${key}: ${settings[key]}`;
    line.onclick = () => {
      elements.settingKey.value = key;
      elements.settingValue.value = settings[key];
    };
    elements.settingsList.append(line);
  }
}

function gatherPanelPayload() {
  return {
    title: elements.panelTitle.value,
    description: elements.panelDescription.value,
    theme: elements.panelTheme.value,
    display_mode: elements.panelDisplayMode.value,
    color_hex: elements.panelColor.value,
    footer_text: elements.panelFooter.value,
    image_url: elements.panelImage.value,
    thumbnail_url: elements.panelThumbnail.value,
    dropdown_placeholder: elements.panelPlaceholder.value,
    accessibility_mode: elements.panelAccessibility.checked,
    accessibility_summary: elements.panelAccessibilitySummary.value,
  };
}

function gatherButtonPayload() {
  return [...elements.buttonEditorRows.querySelectorAll(".button-row")].map(row => ({
    ticket_type_key: row.querySelector('[data-field="ticket_type_key"]').value,
    button_label: row.querySelector('[data-field="button_label"]').value,
    button_style: row.querySelector('[data-field="button_style"]').value,
    sort_order: Number(row.querySelector('[data-field="sort_order"]').value || 0),
  }));
}

function renderPreview() {
  const panel = { ...selectedPanel(), ...gatherPanelPayload() };
  const buttons = gatherButtonPayload();
  if (!panel) return;

  const frame = document.createElement("div");
  frame.className = "discord-frame";
  const embed = document.createElement("div");
  embed.className = `discord-embed ${panel.theme === "ticket_king" ? "ticket-king" : ""}`;
  embed.style.borderLeftColor = panel.color_hex || "#ff6b35";

  if (panel.theme === "ticket_king") {
    const lines = (panel.description || "").split("\n").map(line => line.trim()).filter(Boolean);
    const author = document.createElement("div");
    author.className = "embed-author";
    author.textContent = panel.title || "Service Panel";
    embed.append(author);

    const title = document.createElement("div");
    title.className = "embed-title";
    title.textContent = lines[0] || "Support & Inquiries";
    embed.append(title);

    const body = document.createElement("div");
    body.className = "embed-description";
    body.textContent = lines.slice(1).join("\n") || "Need help? Open a ticket below.";
    embed.append(body);
  } else {
    const title = document.createElement("div");
    title.className = "embed-title";
    title.textContent = panel.title || "Support Panel";
    const body = document.createElement("div");
    body.className = "embed-description";
    body.textContent = panel.description || "Panel description";
    embed.append(title, body);
  }

  if (panel.image_url) {
    const image = document.createElement("img");
    image.className = "embed-image";
    image.src = panel.image_url;
    embed.append(image);
  }

  if (panel.footer_text) {
    const footer = document.createElement("div");
    footer.className = "embed-footer";
    footer.textContent = panel.footer_text;
    embed.append(footer);
  }

  const actions = document.createElement("div");
  actions.className = "preview-actions";
  if (panel.display_mode === "dropdown") {
    const select = document.createElement("div");
    select.className = "preview-select";
    const firstLabel = buttons[0]?.button_label || "Choose a ticket type";
    select.textContent = `${panel.dropdown_placeholder || "Choose a ticket type"} · ${firstLabel}`;
    actions.append(select);
  } else {
    for (const button of buttons) {
      const item = document.createElement("div");
      item.className = `preview-button ${button.button_style || "primary"}`;
      item.textContent = button.button_label || button.ticket_type_key || "Ticket";
      actions.append(item);
    }
  }

  frame.append(embed, actions);
  elements.previewMount.replaceChildren(frame);
}

async function savePanel() {
  const panel = selectedPanel();
  await api(`/api/panels/${panel.panel_key}`, { method: "PUT", body: JSON.stringify(gatherPanelPayload()) });
  await connect();
}

async function saveButtons() {
  const panel = selectedPanel();
  await api(`/api/panels/${panel.panel_key}/buttons`, { method: "PUT", body: JSON.stringify({ buttons: gatherButtonPayload() }) });
  await connect();
}

async function saveType() {
  const ticketType = selectedType();
  await api(`/api/ticket-types/${ticketType.key}`, {
    method: "PUT",
    body: JSON.stringify({
      name: elements.typeName.value,
      emoji: elements.typeEmoji.value,
      support_role_id: Number(elements.typeRole.value),
      category_id: Number(elements.typeCategory.value),
      is_active: elements.typeActive.checked,
      description: elements.typeDescription.value,
    }),
  });
  await connect();
}

async function saveSetting() {
  await api(`/api/guild-settings/${encodeURIComponent(elements.settingKey.value.trim())}`, {
    method: "PUT",
    body: JSON.stringify({ value: elements.settingValue.value }),
  });
  await connect();
}

async function postPanel() {
  const panel = selectedPanel();
  await api(`/api/panels/${panel.panel_key}/post`, {
    method: "POST",
    body: JSON.stringify({ channel_id: Number(elements.postChannelSelect.value) }),
  });
  elements.connectionStatus.textContent = `Posted panel ${panel.panel_key}.`;
}

elements.connectButton.onclick = () =>
  connect().catch(error => {
    elements.connectionStatus.textContent = explainConnectionError(elements.apiBase.value.trim(), error);
  });
elements.refreshButton.onclick = () =>
  connect().catch(error => {
    elements.connectionStatus.textContent = explainConnectionError(elements.apiBase.value.trim(), error);
  });
elements.savePanelButton.onclick = () => savePanel().catch(error => alert(error.message));
elements.saveButtonsButton.onclick = () => saveButtons().catch(error => alert(error.message));
elements.saveTypeButton.onclick = () => saveType().catch(error => alert(error.message));
elements.saveSettingButton.onclick = () => saveSetting().catch(error => alert(error.message));
elements.postPanelButton.onclick = () => postPanel().catch(error => alert(error.message));
elements.addButtonRow.onclick = () => elements.buttonEditorRows.append(buildButtonRow());

[
  elements.panelTitle,
  elements.panelDescription,
  elements.panelTheme,
  elements.panelDisplayMode,
  elements.panelColor,
  elements.panelFooter,
  elements.panelImage,
  elements.panelThumbnail,
  elements.panelPlaceholder,
  elements.panelAccessibility,
  elements.panelAccessibilitySummary,
].forEach(element => element.addEventListener("input", renderPreview));

document.addEventListener("input", event => {
  if (event.target.closest(".button-row")) renderPreview();
});

if (elements.apiBase.value && elements.apiKey.value) {
  connect().catch(error => {
    elements.connectionStatus.textContent = explainConnectionError(elements.apiBase.value.trim(), error);
  });
}