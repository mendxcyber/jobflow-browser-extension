(() => {
  if (window.top !== window) return;
  const ext = typeof browser !== "undefined" ? browser : chrome;

  const normalize = (value) => (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const visible = (element) => {
    if (!element || element.disabled) return false;
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
  };

  const descriptor = (input) => {
    const label = input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null;
    const group = input.closest("fieldset, [role='group'], .form-group, .field, .question");
    return normalize([
      input.name, input.id, input.placeholder, input.getAttribute("aria-label"),
      label?.textContent, input.closest("label")?.textContent,
      group?.querySelector("legend")?.textContent, group?.querySelector("label")?.textContent,
    ].filter(Boolean).join(" "));
  };

  const setValue = (input, value) => {
    const prototype = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(input, value); else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.style.outline = "2px solid #2563eb";
  };

  const answerFor = (input, answers) => {
    const text = descriptor(input);
    return answers.find((answer) => {
      try { return new RegExp(answer.padrao, "i").test(text); } catch (_) { return false; }
    });
  };

  const chooseOption = (input, answer) => {
    const desired = normalize(answer.opcao || answer.valor);
    if (input instanceof HTMLSelectElement) {
      const option = [...input.options].find((item) => {
        const current = normalize(`${item.value} ${item.textContent}`);
        return current === desired || current.includes(desired);
      });
      if (!option) return false;
      input.value = option.value;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    if (["radio", "checkbox"].includes(input.type)) {
      if (input.type === "checkbox" && answer.tipo === "sim") {
        if (!input.checked) input.click();
        return true;
      }
      const current = normalize(`${input.value} ${descriptor(input)}`);
      if (!current.includes(desired)) return false;
      input.click();
      return true;
    }
    return false;
  };

  const fillFields = (job) => {
    const candidate = job.candidate || {};
    let count = 0;
    document.querySelectorAll("input:not([type='hidden']):not([type='file']):not([type='password']):not([type='submit']):not([type='button']), textarea, select").forEach((input) => {
      if (!visible(input) || input.readOnly) return;
      const text = descriptor(input);
      let value = null;
      if (input.type === "email" || /(^| )(e-?mail|email)( |$)/.test(text)) value = candidate.email;
      else if (input.type === "tel" || /(telefone|celular|whatsapp|fone)/.test(text)) value = candidate.telefone;
      else if (/(nome completo|nome do candidato|seu nome|^nome$)/.test(text)) value = candidate.nome_completo;
      else {
        const answer = answerFor(input, job.answers || []);
        if (answer && chooseOption(input, answer)) { count += 1; return; }
        if (answer && !["radio", "checkbox"].includes(input.type) && !(input instanceof HTMLSelectElement)) value = answer.valor;
      }
      if (value && !String(input.value || "").trim()) {
        setValue(input, value);
        count += 1;
      }
    });
    return count;
  };

  const attachPdf = async (job) => {
    const inputs = [...document.querySelectorAll("input[type='file']")].filter((input) => !input.disabled);
    if (!inputs.length) return 0;
    const response = await ext.runtime.sendMessage({ type: "getPdf" });
    if (!response?.base64) return 0;
    const binary = atob(response.base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const file = new File([bytes], response.filename || "curriculo.pdf", { type: "application/pdf" });
    let count = 0;
    for (const input of inputs) {
      if (input.files?.length) continue;
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.style.outline = "2px solid #16a34a";
      count += 1;
    }
    return count;
  };

  const pageText = () => normalize(document.body?.innerText || "");

  const blocker = () => {
    const text = pageText();
    if (document.querySelector("iframe[src*='captcha'], .g-recaptcha, [data-sitekey]") || /captcha|nao sou um robo|não sou um robô/.test(text)) {
      return "CAPTCHA encontrado";
    }
    if ([...document.querySelectorAll("input[type='password']")].some(visible) && /entrar|login|senha|acessar conta/.test(text)) {
      return "Login necessário ou sessão expirada";
    }
    if (/teste comportamental|teste de perfil|video entrevista|vídeo entrevista|assessment/.test(text)) {
      return "Teste ou entrevista adicional necessária";
    }
    return "";
  };

  const unansweredRequired = () => {
    const missing = [];
    document.querySelectorAll("input[required], textarea[required], select[required], [aria-required='true']").forEach((input) => {
      if (!visible(input) || input.type === "hidden" || input.type === "submit" || input.type === "button") return;
      if (input.type === "file") {
        if (!input.files?.length) missing.push(descriptor(input) || "currículo");
      } else if (input.type === "checkbox") {
        if (!input.checked) missing.push(descriptor(input) || "confirmação");
      } else if (input.type === "radio") {
        const name = CSS.escape(input.name || input.id || "__radio__");
        if (!document.querySelector(`input[type='radio'][name='${name}']:checked`)) missing.push(descriptor(input) || "opção");
      } else if (!String(input.value || "").trim()) {
        missing.push(descriptor(input) || "campo obrigatório");
      }
    });
    return [...new Set(missing)].slice(0, 5);
  };

  const actionButtons = () => [...document.querySelectorAll("button, input[type='submit'], a[role='button'], a.button")]
    .filter(visible)
    .map((element) => ({ element, text: normalize(element.innerText || element.value || element.getAttribute("aria-label")) }));

  const successDetected = () => /candidatura (enviada|realizada|concluida|recebida)|inscricao (enviada|realizada|concluida)|curriculo enviado com sucesso|application submitted|obrigado por se candidatar|sucesso.*candidatura/.test(pageText());

  const report = (state, message) => ext.runtime.sendMessage({
    type: "result", state, message, currentUrl: location.href,
  });

  const addStatus = () => {
    const box = document.createElement("div");
    box.id = "jobflow-apply-status";
    Object.assign(box.style, {
      position: "fixed", right: "18px", bottom: "18px", zIndex: "2147483647",
      maxWidth: "330px", borderRadius: "10px", padding: "11px 14px",
      background: "#0f172a", color: "#e2e8f0", font: "600 13px Segoe UI, Arial, sans-serif",
      boxShadow: "0 8px 24px rgba(0,0,0,.35)",
    });
    box.textContent = "Preparando candidatura automática…";
    document.documentElement.appendChild(box);
    return box;
  };

  let activeJob = null;
  const main = async () => {
    const task = await ext.runtime.sendMessage({ type: "getTask" });
    if (!task?.job || !task.config?.autoApplyEnabled) return;
    const job = task.job;
    activeJob = job;
    const status = addStatus();
    let rounds = 0;
    let attached = false;
    const run = async () => {
      rounds += 1;
      if (successDetected()) {
        status.textContent = "Candidatura enviada.";
        await report("sent", "Candidatura confirmada pela página");
        return;
      }
      const blocked = blocker();
      if (blocked) {
        status.textContent = `${blocked}. Ação necessária.`;
        await report("action_required", blocked);
        return;
      }
      fillFields(job);
      if (!attached) {
        try { attached = (await attachPdf(job)) > 0; } catch (_) {}
      }
      const missing = unansweredRequired();
      const buttons = actionButtons();
      const final = buttons.find(({ text }) => /^(enviar candidatura|enviar inscricao|finalizar candidatura|submit application|aplicar agora)$/.test(text));
      const next = buttons.find(({ text }) => /^(continuar|proximo|avancar|seguinte|candidate-se no site da empresa|candidatar-se|candidatar|me candidatar|candidatura rapida|entre para candidatar-se|candidatar-se agora|candidatar-se para a vaga|candidatar-se a esta vaga|quero me candidatar|inscrever-se|realizar candidatura)$/.test(text));

      if (missing.length && rounds >= 5) {
        const detail = `Campos obrigatórios sem resposta segura: ${missing.join(", ")}`;
        status.textContent = detail;
        await report("action_required", detail);
        return;
      }
      if (!missing.length && final) {
        if (!task.config.autoSubmitEnabled) {
          status.textContent = "Formulário pronto. Ative o envio automático nas opções da extensão.";
          await report("action_required", "Formulário preenchido e pronto para o envio final");
          return;
        }
        status.textContent = "Enviando candidatura…";
        final.element.click();
        window.setTimeout(run, 3500);
        return;
      }
      if (!missing.length && next) {
        status.textContent = "Avançando para a próxima etapa…";
        next.element.click();
        window.setTimeout(run, 3000);
        return;
      }
      if (rounds >= 10) {
        status.textContent = "Fluxo não reconhecido. Ação necessária.";
        await report("action_required", "A página não apresentou uma etapa de candidatura reconhecida");
        return;
      }
      status.textContent = "Preenchendo dados e aguardando o formulário…";
      window.setTimeout(run, 1800);
    };
    run();
  };

  main().catch(async (error) => {
    console.warn("Automação de candidatura:", error);
    if (activeJob) await report("action_required", `Falha ao automatizar o formulário: ${String(error.message || error).slice(0, 180)}`);
  });
})();
