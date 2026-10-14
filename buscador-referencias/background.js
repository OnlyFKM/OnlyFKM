importScripts("clientes.js", "common.js");

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
  if (msg && msg.tipo === "abrir") {
    abrirTodas(msg.items, msg.sinCliente || [], msg.urlInicio).catch((e) => console.error(e));
    responder({ ok: true });
  }
});

async function abrirTodas(items, sinCliente, urlInicio) {
  const config = await cargarConfig();
  if (urlInicio) config.urlBusqueda = urlInicio;
  const registro = [];
  const guardarRegistro = (enCurso = true) =>
    chrome.storage.local.set({ registro: { fecha: Date.now(), enCurso, entradas: registro } });
  await guardarRegistro();

  chrome.action.setBadgeBackgroundColor({ color: "#1a73e8" });
  const pendientes = [];

  for (let i = 0; i < items.length; i++) {
    const { ref, cliente } = items[i];
    chrome.action.setBadgeText({ text: String(items.length - i) });

    const tarea = abrirUna(config, cliente, ref)
      .then(() => registro.push({ ref, cliente: cliente.nombre, ok: true }))
      .catch((e) => registro.push({ ref, cliente: cliente.nombre, ok: false, error: e.message }))
      .then(() => guardarRegistro());

    // En modo formulario y en secuencia, se espera a que termine cada búsqueda antes de la siguiente
    // (algunos portales guardan el cliente seleccionado en la sesión).
    if (config.modo === "formulario" && config.enSecuencia) await tarea;
    else pendientes.push(tarea);

    if (i < items.length - 1) await esperar(config.retardoEntrePestanasMs);
  }

  await Promise.all(pendientes);

  // Al terminar se añaden las referencias a las que no se pudo asignar cliente.
  for (const ref of sinCliente) {
    registro.push({ ref, cliente: "", ok: false, error: "no se ha encontrado su cliente" });
  }
  await guardarRegistro(false);

  const errores = registro.filter((r) => !r.ok).length;
  chrome.action.setBadgeBackgroundColor({ color: errores ? "#d93025" : "#188038" });
  chrome.action.setBadgeText({ text: errores ? "!" : "" });
}

async function abrirUna(config, cliente, ref) {
  const active = !!config.activarPestanas;

  if (config.modo === "url") {
    await chrome.tabs.create({ url: construirUrl(config.urlPlantilla, cliente, ref), active });
    return;
  }

  const { tipo, modo } = tipoDeReferencia(ref, cliente, config);
  const usaModo = config.pasos.some((p) => String(p.texto || "").includes("{modo}"));
  if (usaModo && !modo) {
    throw new Error(tipo ? `el tipo "${tipo}" no tiene modo configurado` : "no se reconoce el tipo de referencia");
  }
  const valores = { cliente: cliente.nombre, ref, modo, tipo };

  const tab = await chrome.tabs.create({ url: config.urlBusqueda, active });
  await esperarCarga(tab.id, config.timeoutMs);

  for (const [n, paso] of config.pasos.entries()) {
    if (paso.accion === "esperar") {
      await esperar(Number(paso.texto) || 1000);
      continue;
    }
    const plantilla = String(paso.texto || "").trim();
    // Para el cliente se prueba con el nombre y con el valor del desplegable.
    const textos =
      plantilla === "{cliente}"
        ? [cliente.nombre, cliente.valor].filter(Boolean)
        : [plantilla.replace(/\{(cliente|ref|modo|tipo)\}/g, (_, k) => valores[k] || "")];

    const args = [paso.accion, paso.selector || "", textos, config.timeoutMs];
    let r = await ejecutar(tab.id, pasoEnPagina, args);
    if (!r.ok && r.navegando) {
      // La página se estaba recargando: se espera a que termine y se repite el paso.
      await esperarCarga(tab.id, config.timeoutMs);
      r = await ejecutar(tab.id, pasoEnPagina, args);
    }
    if (!r.ok && !(r.navegando && ["clic", "enviar", "seleccionar"].includes(paso.accion))) {
      throw new Error(`paso ${n + 1} (${paso.accion} ${textos[0] || paso.selector}): ${r.error}`);
    }

    // El paso puede recargar la página o cargar contenido: se espera antes del siguiente.
    await esperar(config.esperaEntrePasosMs);
    await esperarCarga(tab.id, config.timeoutMs);
  }
}

async function ejecutar(tabId, func, args) {
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
    return res && res.result ? res.result : { ok: false, navegando: true, error: "la página cambió durante el paso" };
  } catch (e) {
    // Si la página navega mientras se ejecuta el paso, Chrome corta la ejecución.
    const navegando = /removed|navigat|unload|showing error page|No frame/i.test(e.message);
    return { ok: false, navegando, error: e.message };
  }
}

function esperarCarga(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    let terminado = false;
    const fin = (err) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(t);
      chrome.tabs.onUpdated.removeListener(oyente);
      err ? reject(err) : resolve();
    };
    const oyente = (id, cambio) => {
      if (id === tabId && cambio.status === "complete") fin();
    };
    const t = setTimeout(() => fin(new Error("La página tardó demasiado en cargar")), timeoutMs);
    chrome.tabs.onUpdated.addListener(oyente);
    chrome.tabs.get(tabId).then(
      (tab) => tab.status === "complete" && fin(),
      () => fin(new Error("La pestaña se cerró"))
    );
  });
}

// ---- Función que se inyecta en la página del portal (debe ser autocontenida) ----

async function pasoEnPagina(accion, selector, textos, timeoutMs) {
  const norm = (s) =>
    String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const buscados = textos.map(norm).filter(Boolean);
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const textoDe = (el) => norm(el.tagName === "INPUT" ? el.value : el.innerText || el.textContent);
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const esperarA = async (fn) => {
    const limite = Date.now() + timeoutMs;
    while (Date.now() < limite) {
      const r = fn();
      if (r) return r;
      await dormir(250);
    }
    return fn();
  };
  const CLICABLES =
    "a,button,[role=button],[role=tab],[role=menuitem],[role=option],[role=link],[role=switch],li,label,span,div,td,p,h1,h2,h3,h4,h5,h6";

  // Elemento cuyo texto visible coincide: primero exacto, luego que lo contenga; siempre el más interno.
  const porTexto = (sel, { ocultos = false, excluir = null } = {}) => {
    const els = [...document.querySelectorAll(sel || CLICABLES)].filter(
      (e) => (ocultos || visible(e)) && !(excluir && (e === excluir || e.contains(excluir)))
    );
    const masInterno = (lista) => lista.find((e) => !lista.some((o) => o !== e && e.contains(o)));
    for (const t of buscados) {
      const exactos = els.filter((e) => textoDe(e) === t);
      if (exactos.length) return masInterno(exactos);
    }
    for (const t of buscados) {
      const parecidos = els.filter((e) => textoDe(e).includes(t)).sort((a, b) => textoDe(a).length - textoDe(b).length);
      if (parecidos.length) return parecidos[0];
    }
    return null;
  };

  const pulsar = (el) => {
    el.scrollIntoView({ block: "center" });
    for (const tipo of ["mouseover", "mouseenter", "pointerdown", "mousedown", "pointerup", "mouseup"]) {
      el.dispatchEvent(new MouseEvent(tipo, { bubbles: true, cancelable: true, view: window }));
    }
    el.click();
  };

  const escribirEn = (input, valor) => {
    input.focus();
    // Setter nativo para que frameworks como React/Angular detecten el cambio.
    const proto = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const opcionDe = (select) => {
    const opciones = [...select.options];
    for (const t of buscados) {
      const o = opciones.find((o) => norm(o.text) === t || norm(o.value) === t);
      if (o) return o;
    }
    for (const t of buscados) {
      const o = opciones.find((o) => norm(o.text).includes(t));
      if (o) return o;
    }
    return null;
  };

  if (accion === "seleccionar") {
    const el = await esperarA(() =>
      selector
        ? document.querySelector(selector)
        : [...document.querySelectorAll("select")].find((s) => opcionDe(s))
    );
    if (!el) {
      return { ok: false, error: selector ? `no se encontró el desplegable (${selector})` : `no hay ningún desplegable con "${textos[0]}"` };
    }
    if (el.tagName === "SELECT") {
      const opcion = opcionDe(el);
      if (!opcion) return { ok: false, error: `"${textos[0]}" no está en el desplegable` };
      el.value = opcion.value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return { ok: true };
    }
    // Desplegable personalizado: se abre, se escribe en su buscador si lo tiene y se pulsa la opción.
    pulsar(el);
    await dormir(300);
    const activo = document.activeElement;
    if (activo && activo !== el && /^(INPUT|TEXTAREA)$/.test(activo.tagName)) escribirEn(activo, textos[0]);
    const opcion = await esperarA(() => porTexto("[role=option],li,option,a,span,div", { excluir: el }));
    if (!opcion) return { ok: false, error: `"${textos[0]}" no aparece en el desplegable` };
    pulsar(opcion);
    return { ok: true };
  }

  if (accion === "clic") {
    let el = await esperarA(() =>
      buscados.length ? porTexto(selector) : [...document.querySelectorAll(selector)].find(visible)
    );
    // Último intento con elementos ocultos (p. ej. enlaces de un submenú cerrado).
    if (!el && buscados.length) el = porTexto(selector, { ocultos: true });
    if (!el) return { ok: false, error: `no se encontró "${textos[0] || selector}" en la página` };
    pulsar(el);
    return { ok: true };
  }

  if (accion === "escribir") {
    const candidatos = () =>
      [
        ...document.querySelectorAll(
          'input[type=search],input[type=text],input:not([type]),textarea'
        )
      ].filter((i) => visible(i) && !i.disabled && !i.readOnly);
    const input = await esperarA(() => {
      if (selector) {
        const el = document.querySelector(selector);
        return el && !el.disabled ? el : null;
      }
      const lista = candidatos();
      return lista.find((i) => /busc|search|filtr|refer|amenaza/i.test(i.placeholder + i.name + i.id)) || lista[0];
    });
    if (!input) return { ok: false, error: `no se encontró el cuadro de búsqueda${selector ? ` (${selector})` : ""}` };
    escribirEn(input, textos[0]);
    input.setAttribute("data-buscador-referencias", "1");
    return { ok: true };
  }

  if (accion === "enviar") {
    if (selector) {
      const boton = await esperarA(() => {
        const b = document.querySelector(selector);
        return b && !b.disabled ? b : null;
      });
      if (!boton) return { ok: false, error: `no se encontró el botón (${selector})` };
      pulsar(boton);
      return { ok: true };
    }
    const input = document.querySelector("[data-buscador-referencias]") || document.activeElement;
    if (!input) return { ok: false, error: "no hay ningún cuadro de búsqueda rellenado" };
    for (const tipo of ["keydown", "keypress", "keyup"]) {
      input.dispatchEvent(
        new KeyboardEvent(tipo, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true })
      );
    }
    if (input.form) input.form.requestSubmit ? input.form.requestSubmit() : input.form.submit();
    return { ok: true };
  }

  return { ok: false, error: `acción desconocida "${accion}"` };
}
