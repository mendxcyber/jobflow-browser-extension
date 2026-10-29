const ext = typeof browser !== "undefined" ? browser : chrome;

const DEFAULTS = {
  panelUrl: "http://localhost:8090",
  autoApplyEnabled: false,
  autoSubmitEnabled: false,
  pollMinutes: 5,
};

const cleanPanelUrl = (value) => (value || DEFAULTS.panelUrl).trim().replace(/\/+$/, "");
let startingApplication = false;

async function settings() {
  return { ...DEFAULTS, ...(await ext.storage.sync.get(DEFAULTS)) };
}

async function api(path, options = {}) {
  const config = await settings();
  const response = await fetch(`${cleanPanelUrl(config.panelUrl)}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`Painel respondeu ${response.status}`);
  return response.json();
}

async function activeTasks() {
  return (await ext.storage.local.get({ activeTasks: {} })).activeTasks;
}

async function saveTasks(tasks) {
  await ext.storage.local.set({ activeTasks: tasks });
}

async function startNextApplication() {
  if (startingApplication) return;
  startingApplication = true;
  let claimedJob = null;
  try {
    const config = await settings();
    await api('/api/extension/heartbeat', {method:'POST',body:JSON.stringify({...config,version:'3.1.0'})});
    if (!config.autoApplyEnabled) return;
    const tasks = await activeTasks();
    const openTabIds = new Set((await ext.tabs.query({})).map((tab) => String(tab.id)));
    let removedStaleTask = false;
    for (const [tabId, job] of Object.entries(tasks)) {
      if (openTabIds.has(tabId)) continue;
      delete tasks[tabId];
      removedStaleTask = true;
      await report(job, "action_required", "A aba foi fechada sem confirmação; confira o envio antes de tentar novamente");
    }
    if (removedStaleTask) await saveTasks(tasks);
    if (Object.keys(tasks).length) return;
    const data = await api("/api/applications/next?client_version=3.1.0");
    if (!data.job) return;
    claimedJob = data.job;
    const tab = await ext.tabs.create({ url: data.job.url, active: false });
    tasks[String(tab.id)] = data.job;
    await saveTasks(tasks);
  } catch (error) {
    if (claimedJob) await report(claimedJob, "retry", "Não foi possível abrir a página da vaga; candidatura devolvida à fila");
    console.warn("Não foi possível iniciar a próxima candidatura:", error);
  } finally {
    startingApplication = false;
  }
}

async function report(job, state, message, currentUrl = "") {
  try {
    await api(`/api/applications/${job.id}/result`, {
      method: "POST",
      body: JSON.stringify({ state, message, current_url: currentUrl, attempt_token:job.attempt_token, evidence:job.evidence || '' }),
    });
  } catch (error) {
    console.warn("Não foi possível registrar o resultado:", error);
    throw error;
  }
}

ext.runtime.onInstalled.addListener(async (details) => {
  const current = await ext.storage.sync.get(DEFAULTS);
  await ext.storage.sync.set(current);
  const config = await settings();
  await ext.alarms.create("auto-apply", { periodInMinutes: Math.max(1, Number(config.pollMinutes) || 5) });
  if (details?.reason === "install") {
    try { await ext.runtime.openOptionsPage(); } catch (_) {}
  }
});

ext.runtime.onStartup.addListener(async () => {
  const config = await settings();
  await ext.alarms.create("auto-apply", { periodInMinutes: Math.max(1, Number(config.pollMinutes) || 5) });
  startNextApplication();
});

ext.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "auto-apply") startNextApplication();
});

ext.tabs.onCreated.addListener(async (tab) => {
  if (!tab.openerTabId) return;
  const tasks = await activeTasks();
  const parent = tasks[String(tab.openerTabId)];
  if (!parent) return;
  tasks[String(tab.id)] = parent;
  delete tasks[String(tab.openerTabId)];
  await saveTasks(tasks);
  try { await ext.tabs.remove(tab.openerTabId); } catch (_) {}
});

ext.tabs.onRemoved.addListener(async (tabId) => {
  const tasks = await activeTasks();
  const key = String(tabId);
  if (!tasks[key]) return;
  await report(tasks[key], 'action_required', 'A aba foi fechada sem confirmação; confira o envio antes de reenfileirar');
  delete tasks[key];
  await saveTasks(tasks);
  startNextApplication();
});

ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const tasks = await activeTasks();
    const tabId = sender.tab?.id;
    let job = tabId == null ? null : tasks[String(tabId)] || null;

    if (message.type === "getTask") {
      const config = await settings();
      sendResponse({ job, config });
      return;
    }

    if (message.type === 'beforeSubmit' && job) {
      if (job.submitted) { sendResponse({error:'Envio já iniciado; aguarde confirmação'}); return; }
      job.submitted=true;
      tasks[String(tabId)]=job;
      await saveTasks(tasks);
      await report(job,'processing','Envio iniciado; aguardando comprovante da página',sender.tab?.url||'');
      sendResponse({ok:true});
      return;
    }

    if (message.type === 'answerQuestions' && job) {
      const data=await api(`/api/applications/${job.id}/answers`,{method:'POST',body:JSON.stringify({attempt_token:job.attempt_token,questions:message.questions})});
      sendResponse(data);
      return;
    }

    if (message.type === "getPdf" && job) {
      const response = await fetch(job.pdf_url);
      if (!response.ok) throw new Error(`PDF respondeu ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      sendResponse({ base64: btoa(binary), filename: job.pdf_name || `CV_${job.id}.pdf` });
      return;
    }

    if (message.type === "result" && job) {
      job.evidence=message.evidence||'';
      await report(job, message.state, message.message || "", message.currentUrl || "");
      if (["sent", "action_required", "failed"].includes(message.state) && tabId != null) {
        delete tasks[String(tabId)];
        await saveTasks(tasks);
        if (message.state === "sent") {
          if (ext.notifications) {
            try { await ext.notifications.create({type:'basic',iconUrl:ext.runtime.getURL('icon.svg'),title:'Currículo enviado automaticamente',message:job.title}); } catch (_) {}
          }
          try { await ext.tabs.remove(tabId); } catch (_) {}
        }
        startNextApplication();
      }
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "settingsChanged") {
      const config = await settings();
      await ext.alarms.clear("auto-apply");
      await ext.alarms.create("auto-apply", { periodInMinutes: Math.max(1, Number(config.pollMinutes) || 5) });
      startNextApplication();
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false });
  })().catch((error) => sendResponse({ error: String(error.message || error) }));
  return true;
});

startNextApplication();
