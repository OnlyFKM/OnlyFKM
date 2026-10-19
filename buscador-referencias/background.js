importScripts("clientes.js", "common.js");

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
// Pestañas que abre la propia extensión (para no confundirlas con las que abre el portal).
const propias = new Set();

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
  // Para reconocer las pestañas que abra el portal durante los pasos.
  config.origenPortal = origenDe(inicio);

  const tab = await chrome.tabs.create({ url: inicio, active });
  propias.add(tab.id);
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
const ACCIONES_QUE_NAVEGAN = ["clic", "enviar", "seleccionar", "panelCliente"];

async function hacerPasos(config, cliente, valores, tabId, nuevas) {
  const traza = []; // lo que se ha hecho, para mostrarlo en el popup si algo falla
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
    let r = await ejecutar(tabId, pasoEnPagina, args);
    if (!r.ok && r.navegando && !navega) {
      // La página se estaba recargando: se espera a que termine y se repite el paso.
      await esperarCarga(tabId, config.timeoutMs);
      r = await ejecutar(tabId, pasoEnPagina, args);
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
    // Pestaña abierta por la página durante el paso: la que indique esta pestaña como origen
    // o, si el navegador no lo indica bien, cualquier pestaña nueva del mismo portal.
    const abierta = await pestanaAbiertaPorElPaso(nuevas.splice(0), tabId, config.origenPortal);
    if (abierta) {
      const anterior = tabId;
      tabId = abierta.id;
      propias.add(tabId);
      propias.delete(anterior);
      chrome.tabs.remove(anterior).catch(() => {});
    }
    await esperarCarga(tabId, config.timeoutMs);
  }
  return tabId;
}

async function pestanaAbiertaPorElPaso(creadas, tabId, origen) {
  for (const t of creadas.reverse()) {
    if (propias.has(t.id)) continue;
    const info = await chrome.tabs.get(t.id).catch(() => null);
    if (!info) continue;
    if (info.openerTabId === tabId || origenDe(info.pendingUrl || info.url || "") === origen) return info;
  }
  return null;
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

async function pasoEnPagina(accion, selector, textos, timeoutMs, extra = {}) {
  const norm = (s) =>
    String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const buscados = textos.map(norm).filter(Boolean);
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const textoDe = (el) => norm(el.tagName === "INPUT" ? el.value : el.innerText || el.textContent);
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
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
      if (!boton) return fallo("no se encontró el botón que abre el panel de clientes (pon su selector en el paso)");
      traza.push(`abro el panel con "${corto(boton)}"`);
      pulsar(boton);
    }
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
    if (!el && buscados.length) el = porTexto(selector, { ocultos: true });
    if (!el) return { ok: false, error: `no se encontró "${textos[0] || selector}" en la página` };
    pulsar(el);
    return { ok: true, traza: [`pulso "${(el.innerText || el.value || el.textContent || "").trim().slice(0, 40)}" (${el.tagName.toLowerCase()})`] };
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

    let campo = await esperarA(buscarCampo, Math.min(timeoutMs, 6000));
    if (!campo) {
      // Si el panel de filtros se había quedado abierto, el clic anterior lo ha cerrado: se vuelve a abrir.
      // El botón puede llevar un icono delante ("⚙ Filtros"): se compara solo el texto.
      const botones = [...document.querySelectorAll(CLICABLES)].filter(
        (e) => visible(e) && esBoton(e) && textoDe(e).replace(/[^a-z0-9 ]/g, "").trim() === "filtros"
      );
      const filtros = botones.find((e) => !botones.some((o) => o !== e && e.contains(o)));
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
