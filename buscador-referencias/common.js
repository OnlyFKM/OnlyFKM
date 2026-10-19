// Código compartido entre el popup, la página de opciones y el service worker.

const CONFIG_POR_DEFECTO = {
  // Cambia cuando la configuración guardada de versiones anteriores ya no sirve (ver cargarConfig).
  version: 3,

  // "enlace": se abre el enlace directo del cliente (columna "enlace") y se hacen los pasos de pasosEnlace.
  // "url": cada búsqueda es una URL directa construida con una plantilla.
  // "formulario": se abre el portal y se ejecuta la secuencia de pasos (elegir cliente, menús, buscar...).
  modo: "enlace",

  // Modo "enlace": pantalla del cliente que se abre (parámetro ?URL= del enlace) y pasos que se hacen en ella.
  // El modo Digital Risk Protection se activa a mano en el portal antes de usar la extensión.
  pantallaEnlace: "/threats/threats",
  pasosEnlace: [
    { accion: "escribir", selector: "", texto: "{ref}" },
    { accion: "enviar", selector: "", texto: "" }
  ],

  // Modo "url". Marcadores disponibles: {cliente} (valor del cliente), {nombre} y {ref}.
  urlPlantilla: "https://portal.ejemplo.com/buscar?cliente={cliente}&ref={ref}",

  // Modo "formulario": página en la que empieza la secuencia de pasos.
  // Vacío = la pestaña en la que tengas abierto el portal al pulsar el icono.
  urlBusqueda: "",

  // Pasos que se hacen en el portal para cada referencia, en orden. Acciones:
  //   panelCliente: abre el panel de la barra superior y recorre sus columnas en cascada:
  //                 OB (obPanel) -> cliente (escrito en el buscador de "Clientes") -> unidad -> entrar
  //                 (selector opcional = el botón que abre el panel).
  //   seleccionar: elige una opción en un desplegable (selector vacío = el <select> que tenga esa opción).
  //   clic:        pulsa el elemento con ese texto visible (y/o que encaje con el selector).
  //   escribir:    escribe el texto en un cuadro (selector vacío = el primer cuadro de búsqueda visible).
  //   enviar:      pulsa el botón del selector o, si está vacío, envía el formulario / pulsa Intro.
  //   esperar:     espera los milisegundos indicados en "texto".
  // Marcadores en "texto": {cliente}, {ref}, {modo} (según el tipo de referencia) y {tipo}.
  pasos: [
    { accion: "panelCliente", selector: "", texto: "{cliente}" },
    { accion: "clic", selector: "", texto: "{modo}" },
    { accion: "clic", selector: "", texto: "Amenazas" },
    { accion: "clic", selector: "", texto: "Listado de amenazas" },
    { accion: "escribir", selector: "", texto: "{ref}" },
    { accion: "enviar", selector: "", texto: "" }
  ],
  // OB que se pulsa en el panel antes de buscar el cliente (desbloquea la columna Clientes).
  obPanel: "Global",
  esperaEntrePasosMs: 1500,
  timeoutMs: 20000,
  enSecuencia: true,

  // Tipo de referencia: las letras que siguen al código del cliente (CAF-D-17317 -> "D")
  // indican en qué modo del portal hay que buscarla.
  tipos: [{ letra: "D", modo: "Digital Risk Protection" }],
  tipoPorDefecto: "D", // para referencias que no llevan tipo (p. ej. "BANK; 12345")

  retardoEntrePestanasMs: 400,
  activarPestanas: false,
  clientePorDefecto: "",

  // Cada cliente: nombre visible, valor en el desplegable (vacío = el nombre), alias (separados por comas),
  // código que aparece dentro de sus referencias y un patrón (expresión regular) opcional.
  clientes: typeof CLIENTES_INICIALES !== "undefined" ? CLIENTES_INICIALES : require("./clientes.js").CLIENTES_INICIALES
};

async function cargarConfig() {
  // Se usa storage.local: storage.sync limita cada elemento a 8 KB y la lista de clientes no cabe.
  let { config } = await chrome.storage.local.get("config");
  if (config && (config.version || 0) < 3) {
    // Antes de la versión 3 no había enlaces directos: se descartan los clientes y el modo guardados
    // y se conservan los ajustes que siguen valiendo.
    const { modo, clientes, version, ...resto } = config;
    config = resto;
  }
  const resultado = { ...CONFIG_POR_DEFECTO, ...(config || {}) };
  // La URL de ejemplo de versiones anteriores equivale a no tener URL.
  if (/portal\.ejemplo\.com/.test(resultado.urlBusqueda)) resultado.urlBusqueda = "";
  // El primer paso por defecto de versiones anteriores (desplegable nativo) pasa a ser el panel de clientes.
  const p0 = resultado.pasos && resultado.pasos[0];
  if (p0 && p0.accion === "seleccionar" && !p0.selector && p0.texto === "{cliente}") {
    resultado.pasos = [{ ...p0, accion: "panelCliente" }, ...resultado.pasos.slice(1)];
  }
  return resultado;
}

async function guardarConfig(config) {
  await chrome.storage.local.set({ config });
}

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

// Busca un cliente por nombre, valor o alias.
function buscarClientePorTexto(texto, clientes) {
  const t = normalizar(texto);
  if (!t) return null;
  return (
    clientes.find((c) => {
      const nombres = [c.nombre, c.valor, c.codigo, ...String(c.alias || "").split(",")];
      return nombres.some((n) => normalizar(n) && normalizar(n) === t);
    }) || null
  );
}

// Busca el cliente cuyo código aparece dentro de la referencia.
// El código no puede ir pegado a otras letras (así "TE-123" no se confunde con "TEFCORP-123", ni
// "TEFCORP-123" se asigna a "TE" si TEFCORP no está en la lista); si varios encajan gana el más largo.
function buscarClientePorCodigo(ref, clientes) {
  const r = String(ref).toUpperCase();
  let mejor = null;
  for (const c of clientes) {
    const codigo = String(c.codigo || "").trim().toUpperCase();
    if (!codigo) continue;
    let i = r.indexOf(codigo);
    while (i !== -1) {
      const antes = r[i - 1] || "";
      const despues = r[i + codigo.length] || "";
      if (!/[A-Z]/.test(antes) && !/[A-Z]/.test(despues)) {
        if (!mejor || codigo.length > mejor.codigo.length) mejor = c;
        break;
      }
      i = r.indexOf(codigo, i + 1);
    }
  }
  return mejor;
}

// Busca el cliente cuyo patrón encaja con la referencia.
function buscarClientePorPatron(ref, clientes) {
  for (const c of clientes) {
    if (!c.patron) continue;
    try {
      if (new RegExp(c.patron, "i").test(ref)) return c;
    } catch (e) {
      // Patrón mal escrito: se ignora.
    }
  }
  return null;
}

function separarReferencias(texto) {
  return String(texto)
    .split(/[\s,;]+/)
    .map((r) => r.trim())
    .filter(Boolean);
}

// Convierte el texto pegado en una lista de { ref, cliente }.
// Formatos admitidos (se pueden mezclar):
//   CLIENTE;REF   CLIENTE:REF   CLIENTE|REF   CLIENTE<tab>REF   CLIENTE = REF1, REF2
//   Una línea con solo el nombre del cliente -> las referencias siguientes son de ese cliente.
//   REF suelta -> se detecta el cliente por el código que contiene, si no por patrón,
//                 si no por el último encabezado, si no el cliente por defecto.
function analizarTexto(texto, config) {
  const clientes = config.clientes || [];
  const porDefecto = buscarClientePorTexto(config.clientePorDefecto, clientes);
  const resultado = [];
  const vistos = new Set();
  let clienteActual = null;

  const anadir = (ref, cliente) => {
    const clave = `${cliente ? cliente.nombre : ""}\u0000${ref}`;
    if (vistos.has(clave)) return;
    vistos.add(clave);
    resultado.push({ ref, cliente });
  };

  for (const lineaOriginal of String(texto).split(/\r?\n/)) {
    const linea = lineaOriginal.trim();
    if (!linea || linea.startsWith("#")) continue;

    // Línea que es solo un nombre de cliente (encabezado).
    const encabezado = buscarClientePorTexto(linea.replace(/[:;=|]\s*$/, ""), clientes);
    if (encabezado) {
      clienteActual = encabezado;
      continue;
    }

    // Línea con separador explícito CLIENTE<sep>REFS.
    const m = linea.match(/^([^;|\t:=]+?)\s*[;|\t:=]\s*(.+)$/);
    const clienteExplicito = m ? buscarClientePorTexto(m[1], clientes) : null;
    if (clienteExplicito) {
      separarReferencias(m[2]).forEach((ref) => anadir(ref, clienteExplicito));
      continue;
    }

    for (const ref of separarReferencias(linea)) {
      anadir(
        ref,
        buscarClientePorCodigo(ref, clientes) || buscarClientePorPatron(ref, clientes) || clienteActual || porDefecto
      );
    }
  }
  return resultado;
}

// Devuelve el tipo de una referencia (las letras que siguen al código del cliente) y su modo en el portal.
function tipoDeReferencia(ref, cliente, config) {
  const r = String(ref).toUpperCase();
  const codigo = String((cliente && cliente.codigo) || "").toUpperCase();
  const i = codigo ? r.indexOf(codigo) : -1;
  const resto = i >= 0 ? r.slice(i + codigo.length) : r;
  const m = resto.match(/^[^A-Z0-9]*([A-Z]+)(?![A-Z])/);
  const tipo = (m && i >= 0 ? m[1] : "") || String(config.tipoPorDefecto || "").toUpperCase();
  const encontrado = (config.tipos || []).find((t) => String(t.letra).toUpperCase() === tipo);
  return { tipo, modo: encontrado ? encontrado.modo : "" };
}

// Enlace directo del cliente con la pantalla que se quiere abrir (?URL=/threats/threats).
function construirEnlace(cliente, pantalla) {
  if (!cliente.enlace) return "";
  const base = cliente.enlace.replace(/\?.*$/, "");
  return pantalla ? `${base}?URL=${encodeURIComponent(pantalla)}` : base;
}

// Pasos del modo elegido.
function pasosDe(config) {
  return (config.modo === "enlace" ? config.pasosEnlace : config.pasos) || [];
}

function construirUrl(plantilla, cliente, ref) {
  return plantilla
    .replace(/\{cliente\}/g, encodeURIComponent(cliente.valor || cliente.nombre))
    .replace(/\{nombre\}/g, encodeURIComponent(cliente.nombre))
    .replace(/\{ref\}/g, encodeURIComponent(ref));
}

// Patrón de origen para pedir permiso sobre el portal, p. ej. "https://portal.com/*".
function origenDe(url) {
  try {
    const u = new URL(url.replace(/\{[^}]*\}/g, "x"));
    return `${u.protocol}//${u.host}/*`;
  } catch (e) {
    return null;
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    CONFIG_POR_DEFECTO,
    analizarTexto,
    buscarClientePorCodigo,
    tipoDeReferencia,
    construirEnlace,
    construirUrl,
    origenDe,
    normalizar
  };
}
