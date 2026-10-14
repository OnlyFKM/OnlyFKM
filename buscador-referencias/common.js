// Código compartido entre el popup, la página de opciones y el service worker.

const CONFIG_POR_DEFECTO = {
  // "url": cada búsqueda es una URL directa construida con una plantilla.
  // "formulario": se abre la página de búsqueda y se rellena el desplegable y el cuadro de búsqueda.
  modo: "formulario",

  // Modo "url". Marcadores disponibles: {cliente} (valor del cliente), {nombre} y {ref}.
  urlPlantilla: "https://portal.ejemplo.com/buscar?cliente={cliente}&ref={ref}",

  // Modo "formulario".
  urlBusqueda: "https://portal.ejemplo.com/busqueda",
  selectorCliente: "select#cliente",
  selectorOpcionCliente: "", // solo si el desplegable no es un <select> nativo
  selectorReferencia: "input#referencia",
  selectorBoton: "", // vacío = enviar el formulario / pulsar Intro
  esperaTrasClienteMs: 1500,
  timeoutMs: 20000,
  enSecuencia: true,

  retardoEntrePestanasMs: 400,
  activarPestanas: false,
  clientePorDefecto: "",

  // Cada cliente: nombre visible, valor en el desplegable (vacío = el nombre), alias (separados por comas),
  // código que aparece dentro de sus referencias y un patrón (expresión regular) opcional.
  clientes: typeof CLIENTES_INICIALES !== "undefined" ? CLIENTES_INICIALES : require("./clientes.js").CLIENTES_INICIALES
};

async function cargarConfig() {
  // Se usa storage.local: storage.sync limita cada elemento a 8 KB y la lista de clientes no cabe.
  const { config } = await chrome.storage.local.get("config");
  return { ...CONFIG_POR_DEFECTO, ...(config || {}) };
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
// El código no puede ir pegado a otras letras (así "TE-123" no se confunde con "TEFCORP-123");
// si varios encajan gana el más largo. Si ninguno, se prueba con el código al principio de la referencia.
function buscarClientePorCodigo(ref, clientes) {
  const r = String(ref).toUpperCase();
  let mejor = null;
  let mejorAlInicio = null;
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
    if (r.startsWith(codigo) && (!mejorAlInicio || codigo.length > mejorAlInicio.codigo.length)) mejorAlInicio = c;
  }
  return mejor || mejorAlInicio;
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
  module.exports = { CONFIG_POR_DEFECTO, analizarTexto, buscarClientePorCodigo, construirUrl, origenDe, normalizar };
}
