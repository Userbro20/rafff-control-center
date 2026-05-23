let _offlineShown = false;
function showOfflineMessage() {
  setStatus(false, "Offline");
  if (!_offlineShown) {
    el.terminalOutput.textContent += "\n[runner offline]\nBackend is offline. Use Reconnect when it\'s back up.\n";
    _offlineShown = true;
  }
  setConsoleEnabled(false);
}
const DEFAULT_API_BASE = "https://particular-develops-sporting-sociology.trycloudflare.com";
const API_BASE_FALLBACKS = [
  "https://particular-develops-sporting-sociology.trycloudflare.com",
];
const DEFAULT_API_KEY = "change-this-dashboard-key";
const DEFAULT_RUN_COMMAND = ".venv/bin/python -m src.main";
const OUTPUT_STORAGE_KEY = "rafff-dev-console-output";
const OUTPUT_MAX_CHARS = 120000;
const HEALTH_FAILURE_THRESHOLD = 2;
let runtimeApiBase = DEFAULT_API_BASE;

const el = {
  lockscreen: document.getElementById("lockscreen"),
  app: document.getElementById("app"),
  pinDots: [...document.querySelectorAll("#pinRow .dot")],
  lockMessage: document.getElementById("lockMessage"),
  unlockBtn: document.getElementById("unlockBtn"),
  keypadButtons: [...document.querySelectorAll(".pad button")],
  status: document.getElementById("status"),
  reconnectBtn: document.getElementById("reconnectBtn"),
  terminalOutput: document.getElementById("terminalOutput"),
  terminalInput: document.getElementById("terminalInput"),
  sendBtn: document.getElementById("sendBtn"),
  ctrlCBtn: document.getElementById("ctrlCBtn"),
};

let enteredPin = "";
let ws = null;
let token = "";
let healthTimerId = null;
let healthFailureCount = 0;

function apiBase() {
  return runtimeApiBase.replace(/\/$/, "");
}

async function tryResolveApiBase() {
  const candidates = [runtimeApiBase, ...API_BASE_FALLBACKS].filter(Boolean);
  const uniqueCandidates = [...new Set(candidates.map((v) => String(v).trim()))];
  for (const candidate of uniqueCandidates) {
    if (!/^https?:\/\//i.test(candidate)) continue;
    const normalized = candidate.replace(/\/$/, "");
    try {
      const response = await fetch(`${normalized}/api/health`, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey()}` },
      });
      if (response.ok) {
        runtimeApiBase = normalized;
        return true;
      }
    } catch {
      // Try next candidate.
    }
  }
  return false;
}

async function refreshApiBase() {
  try {
    const response = await fetch("./api-base.json", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    const value = String(data.apiBase || "").trim();
    if (/^https?:\/\//i.test(value)) {
      runtimeApiBase = value;
    }
  } catch {
    // Keep default URL if config file is missing/unreachable.
  }
  await tryResolveApiBase();
}

function apiKey() {
  return DEFAULT_API_KEY;
}

function setStatus(online, text) {
  el.status.textContent = text;
  el.status.classList.remove("online", "offline");
  el.status.classList.add(online ? "online" : "offline");
}

function cleanTerminalOutput(text) {
  let out = String(text || "");

  // Normalize CRLF and strip standalone carriage returns used for cursor control.
  out = out.replace(/\r\n/g, "\n").replace(/\r(?!\n)/g, "");
  // Strip OSC (Operating System Command) sequences.
  out = out.replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "");
  // Strip CSI sequences like colors, cursor movements, and bracketed paste mode.
  out = out.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
  // Strip remaining short ESC sequences.
  out = out.replace(/\x1b[@-_]/g, "");

  // Apply backspaces from terminal echo (e.g., ".\b.").
  while (/\x08/.test(out)) {
    out = out.replace(/[^\n]\x08/g, "").replace(/\x08/g, "");
  }

  // Drop prompt repaint artifacts like "%           host %" that cause visual drifting.
  out = out.replace(/^%\s{10,}.*$/gm, "");
  // Normalize occasional doubled leading dot from PTY echo artifacts.
  out = out.replace(/^\.\.venv\/bin\//gm, ".venv/bin/");

  return out;
}

function saveOutputSnapshot() {
  const text = String(el.terminalOutput.textContent || "");
  const trimmed = text.length > OUTPUT_MAX_CHARS ? text.slice(-OUTPUT_MAX_CHARS) : text;
  localStorage.setItem(OUTPUT_STORAGE_KEY, trimmed);
}

function restoreOutputSnapshot() {
  const saved = localStorage.getItem(OUTPUT_STORAGE_KEY);
  if (!saved) return false;
  el.terminalOutput.textContent = saved;
  el.terminalOutput.scrollTop = el.terminalOutput.scrollHeight;
  return true;
}

function appendOutput(text) {
  el.terminalOutput.textContent += cleanTerminalOutput(text);
  if (el.terminalOutput.textContent.length > OUTPUT_MAX_CHARS) {
    el.terminalOutput.textContent = el.terminalOutput.textContent.slice(-OUTPUT_MAX_CHARS);
  }
  saveOutputSnapshot();
  el.terminalOutput.scrollTop = el.terminalOutput.scrollHeight;
}

function setConsoleEnabled(enabled) {
  el.terminalInput.disabled = !enabled;
  el.sendBtn.disabled = !enabled;
  el.ctrlCBtn.disabled = !enabled;
}

function normalizeCommand(command) {
  const trimmed = String(command || "").trim();
  if (!trimmed) return "";
  if (/^python(\s|$)/.test(trimmed)) {
    return trimmed.replace(/^python(\s|$)/, ".venv/bin/python$1");
  }
  if (/^python3(\s|$)/.test(trimmed)) {
    return trimmed.replace(/^python3(\s|$)/, ".venv/bin/python$1");
  }
  if (/^pip(\s|$)/.test(trimmed)) {
    return trimmed.replace(/^pip(\s|$)/, ".venv/bin/pip$1");
  }
  if (/^pip3(\s|$)/.test(trimmed)) {
    return trimmed.replace(/^pip3(\s|$)/, ".venv/bin/pip$1");
  }
  return trimmed;
}

function updatePinDots() {
  el.pinDots.forEach((dot, i) => dot.classList.toggle("filled", i < enteredPin.length));
}

function resetPin(message, isError = false) {
  enteredPin = "";
  updatePinDots();
  el.lockMessage.textContent = message;
  el.lockMessage.classList.toggle("error", isError);
}

async function loginDev() {
  await tryResolveApiBase();
  const base = apiBase();
  const response = await fetch(`${apiBase()}/api/dev/login`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pin: enteredPin }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Dev login failed for ${base}`);
  }
  const json = await response.json();
  token = String(json.token || "");
  if (!token) throw new Error("Missing dev session token");
}

function wsUrl() {
  const httpBase = apiBase();
  const url = new URL(httpBase);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/api/dev/ws";
  url.search = `token=${encodeURIComponent(token)}`;
  return url.toString();
}

function connectWs() {
  if (!token) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  ws = new WebSocket(wsUrl());
  setStatus(false, "Connecting");

  ws.onopen = () => {
    setStatus(true, "Online");
    setConsoleEnabled(true);
    healthFailureCount = 0;
    _offlineShown = false;
    appendOutput("\n[connected]\n");
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "output") {
        appendOutput(String(data.data || ""));
      }
    } catch {
      appendOutput(String(event.data || ""));
    }
  };

  ws.onclose = () => {
    showOfflineMessage();
    appendOutput("\n[connection closed]\n");
  };

  ws.onerror = () => {
    showOfflineMessage();
    // Suppress CORS/network error spam
  };
}

async function checkHealth() {
  if (el.app.classList.contains("hidden")) return;
  // If WebSocket is open and working, buttons are fine — don't interfere.
  if (ws && ws.readyState === WebSocket.OPEN) {
    healthFailureCount = 0;
    return;
  }
  try {
    const response = await fetch(`${apiBase()}/api/health`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey()}` },
    });
    if (!response.ok) throw new Error("down");
    healthFailureCount = 0;
    // Backend is healthy but WS is closed — auto-reconnect.
    if (!ws || ws.readyState === WebSocket.CLOSED) {
      connectWs();
    }
  } catch {
    await tryResolveApiBase();
    healthFailureCount += 1;
    if (healthFailureCount >= HEALTH_FAILURE_THRESHOLD) {
      showOfflineMessage();
      if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
      }
    }
  }
}

function startHealthMonitor() {
  if (healthTimerId !== null) {
    clearInterval(healthTimerId);
  }
  healthTimerId = window.setInterval(() => {
    checkHealth();
  }, 6000);
}

async function unlock() {
  try {
    await refreshApiBase();
    await loginDev();
    el.lockscreen.classList.add("hidden");
    el.app.classList.remove("hidden");
    setConsoleEnabled(false);
    startHealthMonitor();
    connectWs();
  } catch (error) {
    resetPin(String(error.message || "Login failed"), true);
  }
}

function sendInput(text) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    appendOutput("\n[not connected — press Reconnect]\n");
    return;
  }
  ws.send(JSON.stringify({ type: "input", data: text }));
}

function runCurrentCommand() {
  const command = String(el.terminalInput.value || "");
  const normalized = normalizeCommand(command) || DEFAULT_RUN_COMMAND;
  sendInput(`${normalized}\n`);
  el.terminalInput.value = "";
}

function wirePinPad() {
  el.keypadButtons.forEach((button) => {
    button.onclick = () => {
      const key = button.dataset.key;
      const action = button.dataset.action;
      if (action === "clear") {
        resetPin("Locked", false);
        return;
      }
      if (action === "back") {
        enteredPin = enteredPin.slice(0, -1);
        updatePinDots();
        return;
      }
      if (!key || enteredPin.length >= 4) return;
      enteredPin += key;
      updatePinDots();
      if (enteredPin.length === 4) unlock();
    };
  });

  el.unlockBtn.onclick = () => unlock();

  window.addEventListener("keydown", (event) => {
    if (!el.app.classList.contains("hidden")) return;
    if (/^[0-9]$/.test(event.key) && enteredPin.length < 4) {
      enteredPin += event.key;
      updatePinDots();
      if (enteredPin.length === 4) unlock();
      return;
    }
    if (event.key === "Backspace") {
      enteredPin = enteredPin.slice(0, -1);
      updatePinDots();
      return;
    }
    if (event.key === "Enter") {
      unlock();
    }
  });
}

function wireTerminal() {
  el.sendBtn.onclick = runCurrentCommand;
  el.ctrlCBtn.onclick = () => sendInput("\u0003");
  el.reconnectBtn.onclick = async () => {
    await refreshApiBase();
    connectWs();
  };
  el.terminalInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runCurrentCommand();
    }
  });
}

resetPin("Locked", false);
wirePinPad();
wireTerminal();
refreshApiBase();
if (!restoreOutputSnapshot()) {
  appendOutput("Dev console ready. Unlock to connect.\n");
}
