importScripts("clientes.js", "common.js");

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
// Pestañas que abre la propia extensión o que ya tienen dueño (para no confundirlas con las que abre el portal).
const propias = new Set();

// Candado para que los pasos que pueden abrir pestañas se hagan de uno en uno: así cada pestaña nueva
// se asigna sin duda a la referencia que la abrió, aunque las referencias se procesen en paralelo.
let cola = Promise.resolve();
function conCandado(fn) {
  const resultado = cola.then(fn, fn);
  cola = resultado.catch(() => {});
  return resultado;
}
// Pasos que pueden abrir la ficha o el cliente en una pestaña nueva.
const ACCIONES_QUE_ABREN_PESTANAS = ["abrirResultado", "panelCliente"];

chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
  if (msg && msg.tipo === "abrir") {
    abrirTodas(msg.items, msg.sinCliente || [], msg.urlInicio).catch((e) => console.error(e));
    responder({ ok: true });
  }
});

async function abrirTodas(items, sinCliente, urlInicio) {
  const config = await cargarConfig();
  if (urlInicio && config.modo === "formulario") config.urlBusqueda = urlInicio;
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
      .catch((e) => registro.push({ ref, cliente: cliente.nombre, ok: false, error: e.message, traza: e.traza }))
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
  const usaModo = pasosDe(config).some((p) => String(p.texto || "").includes("{modo}"));
  if (usaModo && !modo) {
    throw new Error(tipo ? `el tipo "${tipo}" no tiene modo configurado` : "no se reconoce el tipo de referencia");
  }
  const valores = { cliente: cliente.nombre, ref, modo, tipo };

  let inicio = config.urlBusqueda;
  if (config.modo === "enlace") {
    inicio = construirEnlace(cliente, config.pantallaEnlace);
    if (!inicio) throw new Error("el cliente no tiene enlace directo (añádelo en Configuración → Clientes)");
  }
  const tab = await conCandado(async () => {
    const t = await chrome.tabs.create({ url: inicio, active });
    propias.add(t.id);
    return t;
  });
  let tabId = tab.id;
  await esperarCarga(tabId, config.timeoutMs);

  // Si un paso abre una pestaña nueva (p. ej. el icono ↗ de entrar en el cliente),
  // se siguen los pasos en ella y se cierra la anterior.
  const nuevas = [];
  const alCrear = (t) => nuevas.push(t);
  chrome.tabs.onCreated.addListener(alCrear);
  try {
    tabId = await hacerPasos(config, cliente, valores, tabId, nuevas);
  } finally {
    chrome.tabs.onCreated.removeListener(alCrear);
    propias.delete(tabId);
  }
}

// Acciones que pueden recargar la página: si Chrome corta el paso por la navegación, se da por hecho.
const ACCIONES_QUE_NAVEGAN = ["clic", "enviar", "seleccionar", "panelCliente", "abrirResultado"];

async function hacerPasos(config, cliente, valores, tabId, nuevas) {
  const traza = []; // lo que se ha hecho, para mostrarlo en el popup si algo falla
  const marcos = { ultimo: null }; // marco (iframe) donde se hizo el último paso
  for (const [n, paso] of pasosDe(config).entries()) {
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

    const args = [paso.accion, paso.selector || "", textos, config.timeoutMs, { ob: config.obPanel }];
    const navega = ACCIONES_QUE_NAVEGAN.includes(paso.accion);
    const abrePestanas = ACCIONES_QUE_ABREN_PESTANAS.includes(paso.accion);

    const hacerPaso = async () => {
      if (abrePestanas) nuevas.length = 0; // solo cuentan las pestañas creadas durante este paso
      let r = await ejecutarEnSuMarco(tabId, args, marcos);
      if (!r.ok && r.navegando && !navega) {
        // La página se estaba recargando: se espera a que termine y se repite el paso.
        await esperarCarga(tabId, config.timeoutMs);
        r = await ejecutarEnSuMarco(tabId, args, marcos);
      }
      if (!r.ok && !(r.navegando && navega)) {
        const error = new Error(`paso ${n + 1} (${paso.accion} ${textos[0] || paso.selector}): ${r.error}`);
        error.traza = [...traza, ...(r.traza || [])];
        throw error;
      }
      traza.push(`paso ${n + 1} ${paso.accion} ✓`);
      for (const t of r.traza || []) traza.push(`   · ${t}`);

      // El paso puede recargar la página o cargar contenido: se espera antes del siguiente.
      await esperar(config.esperaEntrePasosMs);
      const abierta = await pestanaAbiertaPorElPaso(nuevas.splice(0), tabId, abrePestanas);
      if (abierta) {
        const anterior = tabId;
        tabId = abierta.id;
        propias.add(tabId);
        propias.delete(anterior);
        chrome.tabs.remove(anterior).catch(() => {});
        traza.push(`   · sigo en la pestaña nueva que ha abierto el portal`);
      }
    };

    if (paso.accion === "abrirResultado") {
      // Se espera a que salgan los resultados fuera del candado; dentro solo se pulsa.
      const espera = await ejecutarEnSuMarco(tabId, [paso.accion, "", textos, config.timeoutMs, { soloEsperar: true }], marcos);
      if (!espera.ok && !espera.navegando) {
        const error = new Error(`paso ${n + 1} (${paso.accion} ${textos[0]}): ${espera.error}`);
        error.traza = [...traza, ...(espera.traza || [])];
        throw error;
      }
    }
    if (abrePestanas) await conCandado(hacerPaso);
    else await hacerPaso();
    await esperarCarga(tabId, config.timeoutMs);
  }
  return tabId;
}

// Pestaña abierta por la página durante un paso: la que indique esta pestaña como origen o, si "conCandado"
// (nadie más puede estar abriendo pestañas), cualquier pestaña web nueva: la ficha puede abrirse desde un marco
// de otro dominio y el navegador no siempre indica bien quién la abrió.
async function pestanaAbiertaPorElPaso(creadas, tabId, conCandado) {
  for (const t of creadas.reverse()) {
    if (propias.has(t.id)) continue;
    const info = await chrome.tabs.get(t.id).catch(() => null);
    if (!info) continue;
    if (info.openerTabId === tabId || (conCandado && /^https?:/.test(info.pendingUrl || info.url || ""))) return info;
  }
  return null;
}

// El portal puede mostrar cada sección dentro de un marco (iframe): antes de cada paso se sondean todos los marcos
// hasta encontrar en cuál está lo que busca el paso (botón, campo, resultado...) y el paso se hace solo en ese.
async function ejecutarEnSuMarco(tabId, args, marcos) {
  const [accion, selector, textos, timeoutMs, extra = {}] = args;
  const limite = Date.now() + timeoutMs;
  let candidatos = [];
  for (;;) {
    const res = await chrome.scripting
      .executeScript({
        target: { tabId, allFrames: true },
        func: pasoEnPagina,
        args: [accion, selector, textos, 0, { ...extra, sondear: true }]
      })
      .catch(() => []);
    candidatos = res.filter((r) => r.result && r.result.ok).map((r) => r.frameId);
    if (candidatos.length || Date.now() >= limite) break;
    await esperar(400);
  }

  if (!candidatos.length) {
    // No está en ningún marco: se ejecuta en la página principal (sin volver a esperar) para obtener el motivo.
    const r = await ejecutar(tabId, pasoEnPagina, [accion, selector, textos, 500, extra], 0);
    if (!r.ok) r.traza = [...(r.traza || []), `marcos que veo en la pestaña: ${await describirMarcos(tabId)}`];
    return r;
  }

  // Si está en varios marcos: el del campo rellenado, el del paso anterior o la página principal.
  let frameId = candidatos[0];
  if (candidatos.length > 1) {
    const conCampo = (
      await chrome.scripting
        .executeScript({ target: { tabId, allFrames: true }, func: () => !!document.querySelector("[data-buscador-referencias]") })
        .catch(() => [])
    )
      .filter((r) => r.result)
      .map((r) => r.frameId);
    frameId =
      candidatos.find((f) => conCampo.includes(f)) ??
      (candidatos.includes(marcos.ultimo) ? marcos.ultimo : candidatos.includes(0) ? 0 : candidatos[0]);
  }
  marcos.ultimo = frameId;
  const r = await ejecutar(tabId, pasoEnPagina, args, frameId);
  if (frameId !== 0 && r.traza) r.traza = r.traza.map((t) => `${t} [en un marco de la página]`);
  else if (frameId !== 0) r.traza = ["(dentro de un marco de la página)"];
  return r;
}

// Direcciones de los marcos de la pestaña a los que la extensión tiene acceso (para el registro de errores).
async function describirMarcos(tabId) {
  const res = await chrome.scripting
    .executeScript({ target: { tabId, allFrames: true }, func: () => location.href })
    .catch(() => []);
  return res.map((r) => (r.frameId === 0 ? "principal " : "marco ") + String(r.result).slice(0, 90)).join(" | ") || "ninguno";
}

async function ejecutar(tabId, func, args, frameId) {
  try {
    const target = frameId == null ? { tabId } : { tabId, frameIds: [frameId] };
    const [res] = await chrome.scripting.executeScript({ target, func, args });
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

async function pasoEnPagina(accion, selector, textos, timeoutMs, extra = {}) {
  // Sondeo: solo se comprueba si lo que busca el paso está en este marco (sin esperar, pulsar ni escribir).
  // Lo usa el service worker para saber en qué marco (iframe) de la página hay que hacer el paso.
  const sondeo = !!extra.sondear;
  if (sondeo) timeoutMs = 0;
  const norm = (s) =>
    String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const buscados = textos.map(norm).filter(Boolean);
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const textoDe = (el) => norm(el.tagName === "INPUT" ? el.value : el.innerText || el.textContent);
  const dormir = (ms) => (sondeo ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));
  const esperarA = async (fn, ms = timeoutMs) => {
    const limite = Date.now() + ms;
    while (Date.now() < limite) {
      const r = fn();
      if (r) return r;
      await dormir(250);
    }
    return fn();
  };
  const CLICABLES =
    "a,button,input[type=submit],input[type=button],[role=button],[role=tab],[role=menuitem],[role=option],[role=link],[role=switch],li,label,span,div,td,p,h1,h2,h3,h4,h5,h6";

  // Campo rellenado en un paso anterior ("escribir" o "campo"): sirve para elegir, entre varios botones
  // con el mismo texto (p. ej. "Buscar"), el que está junto a él.
  const distanciaAlCampo = (el) => {
    const campo = document.querySelector("[data-buscador-referencias]");
    if (!campo) return 0;
    const a = el.getBoundingClientRect();
    const b = campo.getBoundingClientRect();
    return Math.hypot(a.left + a.width / 2 - (b.left + b.width / 2), a.top + a.height / 2 - (b.top + b.height / 2));
  };
  const marcarCampo = (el) => {
    document.querySelectorAll("[data-buscador-referencias]").forEach((e) => e.removeAttribute("data-buscador-referencias"));
    el.setAttribute("data-buscador-referencias", "1");
  };
  const esBoton = (el) => !!el.closest("button,a,[role=button],input[type=submit],input[type=button]");

  // Elemento cuyo texto visible coincide: primero exacto, luego que lo contenga; siempre el más interno.
  const porTexto = (sel, { ocultos = false, excluir = null } = {}) => {
    const els = [...document.querySelectorAll(sel || CLICABLES)].filter(
      (e) => (ocultos || visible(e)) && !(excluir && (e === excluir || e.contains(excluir)))
    );
    for (const t of buscados) {
      const exactos = els.filter((e) => textoDe(e) === t);
      // Los más internos; si hay varios, primero los botones y luego el más cercano al campo rellenado.
      const internos = exactos
        .filter((e) => !exactos.some((o) => o !== e && e.contains(o)))
        .sort((a, b) => esBoton(b) - esBoton(a) || distanciaAlCampo(a) - distanciaAlCampo(b));
      if (internos.length) return internos[0];
    }
    for (const t of buscados) {
      const parecidos = els.filter((e) => textoDe(e).includes(t)).sort((a, b) => textoDe(a).length - textoDe(b).length);
      if (parecidos.length) return parecidos[0];
    }
    return null;
  };

  const pulsar = (el) => {
    if (sondeo) return;
    el.scrollIntoView({ block: "center" });
    for (const tipo of ["mouseover", "mouseenter", "pointerdown", "mousedown", "pointerup", "mouseup"]) {
      el.dispatchEvent(new MouseEvent(tipo, { bubbles: true, cancelable: true, view: window }));
    }
    el.click();
  };

  const escribirEn = (input, valor) => {
    if (sondeo) return;
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
    if (sondeo) return { ok: true };
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

  if (accion === "panelCliente") {
    // Panel en cascada del portal: botón de la barra superior que abre las columnas
    // "OBs | Clientes | Unidades". Pulsar un OB desbloquea Clientes y pulsar un cliente desbloquea Unidades.
    const traza = [];
    const rect = (e) => e.getBoundingClientRect();
    const masInterno = (lista) => lista.find((e) => !lista.some((o) => o !== e && e.contains(o)));
    const corto = (e) => (e.innerText || e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);

    // Columna por su título ("OBs", "Clientes Global", "Unidades AENA"): título, buscador y elementos de la lista.
    const columna = (re) => {
      const h = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,div,span,p,strong,b,label,th")]
        .filter((e) => visible(e) && re.test(textoDe(e)) && textoDe(e).length < 80)
        .sort((a, b) => textoDe(a).length - textoDe(b).length)[0];
      if (!h) return null;
      const rh = rect(h);
      const input = [...document.querySelectorAll("input")]
        .filter((i) => visible(i) && rect(i).top >= rh.top - 5 && rect(i).top - rh.bottom < 120 && Math.abs(rect(i).left - rh.left) < 120)
        .sort((a, b) => Math.abs(rect(a).left - rh.left) - Math.abs(rect(b).left - rh.left))[0];
      const ref = input ? rect(input) : rh;
      const izq = Math.min(ref.left, rh.left);
      const items = () =>
        [...document.querySelectorAll("li,a,div,span,p,td,button,[role=option],[role=treeitem]")].filter((e) => {
          if (!visible(e) || e === input || e.contains(h) || e.contains(input)) return false;
          const r = rect(e);
          const txt = textoDe(e);
          // Misma columna: empieza cerca del borde izquierdo de su buscador (puede ser más ancho que él).
          const enColumna = r.left >= izq - 30 && r.left <= izq + Math.max(60, ref.width * 0.6);
          return r.top >= ref.bottom - 2 && enColumna && txt && txt.length < 150;
        });
      return { h, input, items };
    };
    const colClientes = () => columna(/^clientes\b/);

    // Elemento de una lista cuyo nombre coincide (exacto, recortado con "..." o que lo contenga).
    const buscarEn = (lista, nombres) => {
      for (const t of nombres.map(norm).filter(Boolean)) {
        const exactos = lista.filter((e) => textoDe(e) === t || norm(e.getAttribute("title")) === t);
        if (exactos.length) return masInterno(exactos);
      }
      for (const t of nombres.map(norm).filter(Boolean)) {
        const recortados = lista.filter((e) => {
          const m = textoDe(e).match(/^(.*?)\s*(\.\.\.|…)$/);
          return m && m[1].length >= 4 && t.startsWith(m[1]);
        });
        if (recortados.length) return masInterno(recortados);
        const parecidos = lista.filter((e) => textoDe(e).includes(t)).sort((a, b) => textoDe(a).length - textoDe(b).length);
        if (parecidos.length) return parecidos[0];
      }
      return null;
    };
    const esperarHasta = async (fn, ms) => {
      const limite = Date.now() + ms;
      let r = fn();
      while (!r && Date.now() < limite) {
        await dormir(250);
        r = fn();
      }
      return r;
    };
    // Icono ↗ de la fila (puede estar oculto hasta pasar el ratón).
    const pulsarIcono = (item) => {
      let fila = item;
      for (let i = 0; i < 3 && fila.parentElement && rect(fila.parentElement).height < 60; i++) fila = fila.parentElement;
      const iconos = [
        ...[...fila.querySelectorAll("a[href],button,svg,i,img,[class*=icon],[class*=Icon],[class*=external]")].filter(
          (e) => e !== item && !e.contains(item) && !item.contains(e)
        ),
        ...item.querySelectorAll("a[href],svg,i,[class*=icon],[class*=external]")
      ];
      const icono = iconos.find(visible) || iconos[0];
      if (!icono) return false;
      pulsar(icono.closest("a,button") || icono);
      return true;
    };
    const fallo = (error) => ({ ok: false, error, traza });

    // 1. Abrir el panel.
    if (!colClientes()) {
      let boton = selector ? document.querySelector(selector) : null;
      if (!boton) {
        const arriba = [...document.querySelectorAll("button,a,[role=button],[aria-expanded],[aria-haspopup],li,div,span")].filter(
          (e) => visible(e) && rect(e).top < 90 && rect(e).bottom < 130 && textoDe(e) && textoDe(e).length < 60 && !/plataforma/.test(textoDe(e))
        );
        // Lo que está justo a la derecha del título "Plataforma Ciberseguridad".
        const marca = masInterno(
          [...document.querySelectorAll("a,span,div,h1,p")].filter((e) => visible(e) && rect(e).top < 90 && /^plataforma/.test(textoDe(e)))
        );
        const aLaDerecha = marca
          ? masInterno(arriba.filter((e) => rect(e).left >= rect(marca).right - 2).sort((a, b) => rect(a).left - rect(b).left).slice(0, 3))
          : null;
        boton =
          masInterno(arriba.filter((e) => textoDe(e) === "global")) ||
          aLaDerecha ||
          arriba.find((e) => e.hasAttribute("aria-expanded") || e.hasAttribute("aria-haspopup")) ||
          arriba.find((e) => e.tagName === "BUTTON");
        if (boton) boton = boton.closest("button,a,[role=button]") || boton;
      }
      if (sondeo) return { ok: !!boton };
      if (!boton) return fallo("no se encontró el botón que abre el panel de clientes (pon su selector en el paso)");
      traza.push(`abro el panel con "${corto(boton)}"`);
      pulsar(boton);
    }
    if (sondeo) return { ok: true };
    const panel = await esperarHasta(colClientes, timeoutMs);
    if (!panel) return fallo('no se abrió el panel con la columna "Clientes"');
    traza.push("panel abierto");

    // 2. OB (desbloquea la columna Clientes).
    const obs = columna(/^obs?\b/);
    if (obs) {
      const ob = buscarEn(obs.items(), [extra.ob || "Global"]);
      if (ob) {
        traza.push(`pulso el OB "${corto(ob)}"`);
        pulsar(ob);
      } else traza.push(`no veo el OB "${extra.ob || "Global"}"`);
    } else traza.push("no veo la columna OBs");

    // 3. Cliente: escribir en su buscador (cuando se desbloquee) y pulsarlo.
    const inputCliente = await esperarHasta(() => {
      const c = colClientes();
      return c && c.input && !c.input.disabled && !c.input.readOnly ? c.input : null;
    }, timeoutMs);
    if (!inputCliente) {
      const c = colClientes();
      return fallo(c && c.input ? "el buscador de Clientes sigue bloqueado" : "no veo el buscador de la columna Clientes");
    }
    let cliente = null;
    for (const original of textos.filter((x) => norm(x))) {
      escribirEn(inputCliente, original);
      inputCliente.dispatchEvent(new KeyboardEvent("keyup", { key: original.slice(-1), bubbles: true }));
      traza.push(`escribo "${original}" en Clientes`);
      cliente = await esperarHasta(() => buscarEn(colClientes().items(), [original]), Math.min(timeoutMs, 6000));
      if (cliente) break;
    }
    if (!cliente) {
      const vistos = colClientes().items().slice(0, 5).map(corto).join(" | ");
      return fallo(`el cliente "${textos[0]}" no aparece en el panel (se ve: ${vistos || "nada"}). Revisa su "Valor en desplegable"`);
    }
    traza.push(`pulso el cliente "${corto(cliente)}"`);
    pulsar(cliente);
    await dormir(800);
    if (!cliente.isConnected) return { ok: true, traza };

    // 4. Unidad (se desbloquea al pulsar el cliente): la que se llame como el cliente o, si no, la primera.
    const nombreCliente = norm(cliente.innerText || cliente.textContent).replace(/\s*(\.\.\.|…)$/, "");
    const colUnidades = () => columna(/^unidades\b/);
    const unidades = await esperarHasta(() => {
      const u = colUnidades();
      if (!u) return null;
      const lista = u.items();
      // Se espera a que la columna muestre las unidades de este cliente.
      return lista.length && textoDe(u.h).includes(nombreCliente.slice(0, 12)) ? lista : null;
    }, 5000) || (colUnidades() ? colUnidades().items() : []);
    let ultimo = cliente;
    if (unidades.length) {
      const unidad = buscarEn(unidades, textos) || unidades[0];
      traza.push(`pulso la unidad "${corto(unidad)}" (${unidades.length} disponible/s)`);
      pulsar(unidad);
      ultimo = unidad;
      await dormir(1200);
    } else traza.push("no veo unidades");

    // 5. Si el panel sigue abierto, se entra con el icono ↗ de la unidad o del cliente.
    if (ultimo.isConnected && visible(ultimo) && colClientes()) {
      const entro = pulsarIcono(ultimo) || (cliente.isConnected && pulsarIcono(cliente));
      traza.push(entro ? "pulso el icono ↗ para entrar" : "el panel sigue abierto y no veo icono ↗");
    }
    return { ok: true, traza };
  }

  if (accion === "clic") {
    let el = await esperarA(() =>
      buscados.length ? porTexto(selector) : [...document.querySelectorAll(selector)].find(visible)
    );
    // Último intento con elementos ocultos (p. ej. enlaces de un submenú cerrado).
    if (!el && buscados.length && !sondeo) el = porTexto(selector, { ocultos: true });
    if (!el) return { ok: false, error: `no se encontró "${textos[0] || selector}" en la página` };
    pulsar(el);
    return { ok: true, traza: [`pulso "${(el.innerText || el.value || el.textContent || "").trim().slice(0, 40)}" (${el.tagName.toLowerCase()})`] };
  }

  if (accion === "abrirResultado") {
    // Pulsa, en la lista de resultados, el elemento que contiene exactamente la referencia
    // (sin confundir "CAF-D-1731" con "CAF-D-17317") para abrir su ficha.
    const ref = norm(textos[0]);
    if (!ref) return { ok: false, error: "falta el texto a buscar en los resultados" };
    const esc = ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const exacta = new RegExp(`(^|[^a-z0-9_-])${esc}($|[^a-z0-9_-])`);
    const candidatos = () => {
      const els = [...document.querySelectorAll("a,td,th,span,div,p,li,button,[role=cell],[role=gridcell],[role=row]")].filter(
        (e) => visible(e) && !e.closest("input,textarea,select,label") && exacta.test(textoDe(e))
      );
      // Los más internos que contienen la referencia (la celda o el enlace, no la tabla entera).
      return els.filter((e) => !els.some((o) => o !== e && e.contains(o)));
    };
    const encontrados = await esperarA(() => {
      const c = candidatos();
      return c.length ? c : null;
    });
    if (!encontrados) return { ok: false, error: `la búsqueda no muestra ningún resultado con "${textos[0]}"` };
    if (extra.soloEsperar || sondeo) return { ok: true };
    const traza = [];
    if (encontrados.length > 1) traza.push(`${encontrados.length} elementos con la referencia: uso el primero`);
    const el = encontrados[0];
    const fila = el.closest("tr,[role=row]") || el.parentElement;
    // Si la propia referencia es un enlace, se usa. Si no, se pulsa la celda de la referencia (el clic llega a la fila).
    // Nunca otro enlace de la fila: p. ej. en la columna "Casos" hay enlaces como "CARR-D-213063-0001" que no son la amenaza.
    const enlace = el.closest("a[href]") || el.querySelector("a[href]");
    const destino = enlace || el;
    const describir = (e) => `"${(e.innerText || e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40)}" (${e.tagName.toLowerCase()})`;

    // Para saber si el clic ha hecho algo: cambio de dirección, la fila ya no está o se ha abierto una ventana encima.
    const ventanas = () =>
      [...document.querySelectorAll("[role=dialog],.modal,.cdk-overlay-pane,[class*=drawer],[class*=sidenav],[class*=detail]")].filter(visible).length;
    const antes = { url: location.href, ventanas: ventanas() };
    const haCambiado = () => location.href !== antes.url || !fila.isConnected || !visible(fila) || ventanas() > antes.ventanas;
    const esperarCambio = async (ms) => {
      const limite = Date.now() + ms;
      while (Date.now() < limite) {
        if (haCambiado()) return true;
        await dormir(250);
      }
      return haCambiado();
    };

    traza.push(`pulso ${describir(destino)}`);
    pulsar(destino);
    if (enlace || (await esperarCambio(2500))) return { ok: true, traza };

    // La fila no se abre con un clic: se prueba con doble clic.
    traza.push("no ha cambiado nada: pruebo con doble clic en la fila");
    for (const objetivo of [el, fila]) {
      objetivo.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, view: window, detail: 2 }));
      if (await esperarCambio(2500)) return { ok: true, traza };
    }
    traza.push("la fila tampoco se abre con doble clic");
    return { ok: false, error: `se encuentra "${textos[0]}" en los resultados, pero al pulsarlo no se abre la amenaza`, traza };
  }

  if (accion === "campo") {
    // Escribe en el campo cuya etiqueta es "selector" (p. ej. "Referencia" en el panel de Filtros).
    const etiqueta = norm(selector);
    if (!etiqueta) return { ok: false, error: "falta la etiqueta del campo (columna Selector/etiqueta)" };
    const traza = [];
    const editable = (i) => i && visible(i) && !i.disabled && !i.readOnly && /^(INPUT|TEXTAREA)$/.test(i.tagName) &&
      !/^(checkbox|radio|submit|button|hidden)$/i.test(i.type);
    const coincide = (t) => {
      const n = norm(t).replace(/[:*]+$/, "").trim();
      return n === etiqueta || n.startsWith(etiqueta + " ");
    };
    const buscarCampo = () => {
      // 1. <label> con ese texto.
      for (const l of document.querySelectorAll("label")) {
        if (!visible(l) || !coincide(l.innerText || l.textContent)) continue;
        const c = l.control || l.querySelector("input,textarea") || (l.htmlFor && document.getElementById(l.htmlFor));
        if (editable(c)) return c;
      }
      // 2. Campo con ese placeholder, aria-label, name, id o formcontrolname.
      const directo = [...document.querySelectorAll("input,textarea")].find(
        (i) => editable(i) && ["placeholder", "aria-label", "name", "id", "formcontrolname"].some((a) => coincide(i.getAttribute(a)))
      );
      if (directo) return directo;
      // 3. Texto suelto con esa etiqueta (span, div, mat-label...): el primer campo que lo sigue en su bloque.
      const textos = [...document.querySelectorAll("span,div,p,th,td,dt,mat-label,legend,strong,b,h4,h5,h6")].filter(
        (e) => visible(e) && coincide(e.innerText || e.textContent)
      );
      const masInternos = textos.filter((e) => !textos.some((o) => o !== e && e.contains(o)));
      for (const t of masInternos) {
        let bloque = t.parentElement;
        for (let nivel = 0; bloque && nivel < 4; nivel++, bloque = bloque.parentElement) {
          const siguiente = [...bloque.querySelectorAll("input,textarea")].find(
            (i) => editable(i) && (t.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_FOLLOWING)
          );
          if (siguiente) return siguiente;
        }
      }
      return null;
    };

    // El botón puede llevar un icono delante ("⚙ Filtros"): se compara solo el texto.
    const botonFiltros = () => {
      const botones = [...document.querySelectorAll(CLICABLES)].filter(
        (e) => visible(e) && esBoton(e) && textoDe(e).replace(/[^a-z0-9 ]/g, "").trim() === "filtros"
      );
      return botones.find((e) => !botones.some((o) => o !== e && e.contains(o)));
    };
    let campo = await esperarA(buscarCampo, Math.min(timeoutMs, 6000));
    if (sondeo) return { ok: !!(campo || botonFiltros()) };
    if (!campo) {
      // Si el panel de filtros se había quedado abierto, el clic anterior lo ha cerrado: se vuelve a abrir.
      const filtros = botonFiltros();
      if (filtros) {
        traza.push('no veo el campo: vuelvo a pulsar "Filtros"');
        pulsar(filtros);
        campo = await esperarA(buscarCampo);
      }
    }
    if (!campo) return { ok: false, error: `no se encontró el campo "${selector}"`, traza };
    escribirEn(campo, textos[0]);
    marcarCampo(campo);
    traza.push(`escribo "${textos[0]}" en el campo "${selector}"`);
    return { ok: true, traza };
  }

  if (accion === "escribir") {
    const candidatos = () =>
      [
        ...document.querySelectorAll(
          'input[type=search],input[type=text],input:not([type]),textarea'
        )
      ].filter((i) => visible(i) && !i.disabled && !i.readOnly);
    const elegir = (lista) => lista.find((i) => /busc|search|filtr|refer|amenaza/i.test(i.placeholder + i.name + i.id)) || lista[0];
    const fueraDeLaBarra = () => candidatos().filter((i) => i.getBoundingClientRect().top >= 90);
    let input;
    if (selector) {
      input = await esperarA(() => {
        const el = document.querySelector(selector);
        return el && !el.disabled ? el : null;
      });
    } else {
      // El buscador del listado puede tardar en cargar: se espera a que aparezca uno fuera de la barra
      // superior antes de recurrir a los de la barra (p. ej. el buscador general de la plataforma).
      const limite = Date.now() + Math.min(timeoutMs, 15000);
      while (!input && Date.now() < limite) {
        input = elegir(fueraDeLaBarra());
        if (!input) await dormir(250);
      }
      input = input || elegir(candidatos());
    }
    if (!input) return { ok: false, error: `no se encontró el cuadro de búsqueda${selector ? ` (${selector})` : ""}` };
    escribirEn(input, textos[0]);
    marcarCampo(input);
    const nombre = input.placeholder || input.name || input.id || input.tagName.toLowerCase();
    return { ok: true, traza: [`escribo "${textos[0]}" en el cuadro "${nombre}"`] };
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
