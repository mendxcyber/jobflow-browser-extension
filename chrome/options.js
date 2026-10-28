const ext = typeof browser !== "undefined" ? browser : chrome;

const DEFAULTS = {
  panelUrl: "http://localhost:8090",
  autoApplyEnabled: false,
  autoSubmitEnabled: false,
  pollMinutes: 5,
};

async function load() {
  const config = await ext.storage.sync.get(DEFAULTS);
  document.querySelector("#panelUrl").value = config.panelUrl;
  document.querySelector("#pollMinutes").value = config.pollMinutes;
  document.querySelector("#autoApplyEnabled").checked = config.autoApplyEnabled;
  document.querySelector("#autoSubmitEnabled").checked = config.autoSubmitEnabled;
}

document.querySelector("#save").addEventListener("click", async () => {
  const panelUrl = document.querySelector("#panelUrl").value.trim().replace(/\/+$/, "");
  const pollMinutes = Math.max(1, Math.min(60, Number(document.querySelector("#pollMinutes").value) || 5));
  const autoApplyEnabled = document.querySelector("#autoApplyEnabled").checked;
  const autoSubmitEnabled = document.querySelector("#autoSubmitEnabled").checked;
  await ext.storage.sync.set({ panelUrl, pollMinutes, autoApplyEnabled, autoSubmitEnabled });
  await ext.runtime.sendMessage({ type: "settingsChanged" });
  const status = document.querySelector("#status");
  status.textContent = "Configurações salvas.";
  setTimeout(() => { status.textContent = ""; }, 2500);
});

load();
