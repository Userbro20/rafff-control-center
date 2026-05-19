const DEFAULT_API_BASE = "https://namely-essence-checking-punk.trycloudflare.com";
const DEFAULT_API_KEY = "change-this-dashboard-key";
const DEV_PIN = "8368";
const API_BASE_STORAGE_KEY = "rafff-dashboard-api-base";
const API_KEY_STORAGE_KEY = "rafff-dashboard-api-key";

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

function apiBase() {
  return (localStorage.getItem(API_BASE_STORAGE_KEY) || DEFAULT_API_BASE).replace(/\/$/, "");
}

function apiKey() {
  return localStorage.getItem(API_KEY_STORAGE_KEY) || DEFAULT_API_KEY;
}

function seedConnectionDefaults() {
  if (/github\.io$/i.test(window.location.hostname)) {
    localStorage.setItem(API_BASE_STORAGE_KEY, DEFAULT_API_BASE);
    localStorage.setItem(API_KEY_STORAGE_KEY, DEFAULT_API_KEY);
  }
}

function setStatus(online, text) {
  el.status.textContent = text;
  el.status.classList.remove("online", "offline");
  el.status.classList.add(online ? "online" : "offline");
}

function appendOutput(text) {
  el.terminalOutput.textContent += text;
  el.terminalOutput.scrollTop = el.terminalOutput.scrollHeight;
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
    setStatus(false, "Offline");
    appendOutput("\n[connection closed]\n");
  };

  ws.onerror = () => {
    setStatus(false, "Socket error");
    appendOutput("\n[socket error - check API base/tunnel and runner status]\n");
  };
}

async function checkHealth() {
  if (el.app.classList.contains("hidden")) return;
  try {
    const response = await fetch(`${apiBase()}/api/health`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey()}` },
    });
    if (!response.ok) throw new Error("down");
  } catch {
    setStatus(false, "Offline");
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      ws.close();
    }
    appendOutput("\n[runner offline]\n");
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
  if (enteredPin !== DEV_PIN) {
    resetPin("Wrong PIN", true);
    return;
  }

  try {
    await loginDev();
    el.lockscreen.classList.add("hidden");
    el.app.classList.remove("hidden");
    startHealthMonitor();
    connectWs();
  } catch (error) {
    resetPin(String(error.message || "Login failed"), true);
  }
}

function sendInput(text) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    setStatus(false, "Socket offline");
    return;
  }
  ws.send(JSON.stringify({ type: "input", data: text }));
}

function runCurrentCommand() {
  const command = el.terminalInput.value;
  if (!command.trim()) return;
  const normalized = normalizeCommand(command);
  appendOutput(`\n$ ${normalized}\n`);
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
  el.reconnectBtn.onclick = () => connectWs();
  el.terminalInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runCurrentCommand();
    }
  });
}

seedConnectionDefaults();
resetPin("Locked", false);
wirePinPad();
wireTerminal();
appendOutput("Dev console ready. Unlock to connect.\n");
