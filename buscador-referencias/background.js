importScripts("clientes.js", "common.js");

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
  if (msg && msg.tipo === "abrir") {
    abrirTodas(msg.items).catch((e) => console.error(e));
    responder({ ok: true });
  }
});

async function abrirTodas(items) {
  const config = await cargarConfig();
  const registro = [];
  const guardarRegistro = () =>
    chrome.storage.local.set({ registro: { fecha: Date.now(), entradas: registro } });

  chrome.action.setBadgeBackgroundColor({ color: "#1a73e8" });
  const pendientes = [];

  for (let i = 0; i < items.length; i++) {
    const { ref, cliente } = items[i];
    chrome.action.setBadgeText({ text: String(items.length - i) });

    const tarea = abrirUna(config, cliente, ref)
      .then(() => registro.push({ ref, cliente: cliente.nombre, ok: true }))
      .catch((e) => registro.push({ ref, cliente: cliente.nombre, ok: false, error: e.message }))
      .then(guardarRegistro);

    // En modo formulario y en secuencia, se espera a que termine cada búsqueda antes de la siguiente
    // (algunos portales guardan el cliente seleccionado en la sesión).
    if (config.modo === "formulario" && config.enSecuencia) await tarea;
    else pendientes.push(tarea);

    if (i < items.length - 1) await esperar(config.retardoEntrePestanasMs);
  }

  await Promise.all(pendientes);
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

  const tab = await chrome.tabs.create({ url: config.urlBusqueda, active });
  await esperarCarga(tab.id, config.timeoutMs);

  const r1 = await ejecutar(tab.id, pasoSeleccionarCliente, [
    config.selectorCliente,
    config.selectorOpcionCliente,
    cliente.valor || "",
    cliente.nombre || "",
    config.timeoutMs
  ]);
  if (!r1.ok) throw new Error(r1.error);

  // Al cambiar de cliente el portal puede recargar la página: se espera y se vuelve a comprobar.
  await esperar(config.esperaTrasClienteMs);
  await esperarCarga(tab.id, config.timeoutMs);

  const r2 = await ejecutar(tab.id, pasoBuscarReferencia, [
    config.selectorReferencia,
    config.selectorBoton,
    ref,
    config.timeoutMs
  ]);
  if (!r2.ok) throw new Error(r2.error);

  await esperar(300);
  await esperarCarga(tab.id, config.timeoutMs);
}

async function ejecutar(tabId, func, args) {
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
    return res && res.result ? res.result : { ok: false, error: "Sin respuesta de la página" };
  } catch (e) {
    return { ok: false, error: e.message };
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

// ---- Funciones que se inyectan en la página del portal (deben ser autocontenidas) ----

async function pasoSeleccionarCliente(selector, selectorOpcion, valor, nombre, timeoutMs) {
  const norm = (s) =>
    String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const esperarElementos = async (sel) => {
    const limite = Date.now() + timeoutMs;
    while (Date.now() < limite) {
      const els = [...document.querySelectorAll(sel)];
      if (els.length) return els;
      await new Promise((r) => setTimeout(r, 200));
    }
    return [];
  };
  const elegir = (opciones, texto) =>
    opciones.find((o) => norm(texto(o)) === norm(nombre)) ||
    opciones.find((o) => norm(texto(o)) === norm(valor)) ||
    opciones.find((o) => norm(nombre) && norm(texto(o)).includes(norm(nombre)));

  const [el] = await esperarElementos(selector);
  if (!el) return { ok: false, error: `No se encontró el desplegable de cliente (${selector})` };

  if (el.tagName === "SELECT") {
    const opciones = [...el.options];
    const opcion = opciones.find((o) => valor && o.value === valor) || elegir(opciones, (o) => o.text);
    if (!opcion) return { ok: false, error: `El cliente "${nombre}" no está en el desplegable` };
    el.value = opcion.value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true };
  }

  // Desplegable personalizado: se abre con un clic y se pulsa la opción.
  el.click();
  const opciones = await esperarElementos(selectorOpcion || "[role=option]");
  const opcion = elegir(opciones, (o) => o.textContent);
  if (!opcion) return { ok: false, error: `El cliente "${nombre}" no aparece en el desplegable` };
  opcion.scrollIntoView({ block: "nearest" });
  opcion.click();
  return { ok: true };
}

async function pasoBuscarReferencia(selector, selectorBoton, ref, timeoutMs) {
  const esperarElemento = async (sel) => {
    const limite = Date.now() + timeoutMs;
    while (Date.now() < limite) {
      const el = document.querySelector(sel);
      if (el && !el.disabled) return el;
      await new Promise((r) => setTimeout(r, 200));
    }
    return null;
  };

  const input = await esperarElemento(selector);
  if (!input) return { ok: false, error: `No se encontró el cuadro de referencia (${selector})` };

  // Se usa el setter nativo para que frameworks como React/Angular detecten el cambio.
  input.focus();
  const proto = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(input, ref);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));

  if (selectorBoton) {
    const boton = await esperarElemento(selectorBoton);
    if (!boton) return { ok: false, error: `No se encontró el botón de búsqueda (${selectorBoton})` };
    boton.click();
  } else if (input.form) {
    input.form.requestSubmit ? input.form.requestSubmit() : input.form.submit();
  } else {
    for (const tipo of ["keydown", "keypress", "keyup"]) {
      input.dispatchEvent(
        new KeyboardEvent(tipo, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true })
      );
    }
  }
  return { ok: true };
}
