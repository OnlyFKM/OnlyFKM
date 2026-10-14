const $ = (id) => document.getElementById(id);
const CAMPOS_TEXTO = ["urlPlantilla", "urlBusqueda", "tipoPorDefecto"];
const CAMPOS_NUMERO = ["esperaEntrePasosMs", "timeoutMs", "retardoEntrePestanasMs"];
const ACCIONES = ["seleccionar", "clic", "escribir", "enviar", "esperar"];
const CAMPOS_CHECK = ["enSecuencia", "activarPestanas"];
const COLUMNAS = ["nombre", "codigo", "valor", "alias", "patron"];

function pintar(config) {
  document.querySelectorAll('input[name="modo"]').forEach((r) => (r.checked = r.value === config.modo));
  CAMPOS_TEXTO.forEach((c) => ($(c).value = config[c] || ""));
  CAMPOS_NUMERO.forEach((c) => ($(c).value = config[c]));
  CAMPOS_CHECK.forEach((c) => ($(c).checked = !!config[c]));
  $("pasos").textContent = "";
  config.pasos.forEach(anadirPaso);
  $("tipos").textContent = "";
  config.tipos.forEach(anadirTipo);
  $("clientes").textContent = "";
  config.clientes.forEach(anadirFila);
  actualizarPorDefecto(config.clientePorDefecto);
  actualizarModo();
}

function anadirFila(cliente = {}) {
  const tr = document.createElement("tr");
  for (const col of COLUMNAS) {
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.dataset.col = col;
    input.value = cliente[col] || "";
    if (col === "nombre") input.addEventListener("input", () => actualizarPorDefecto());
    td.append(input);
    tr.append(td);
  }
  const td = document.createElement("td");
  const quitar = document.createElement("button");
  quitar.textContent = "✕";
  quitar.title = "Quitar cliente";
  quitar.addEventListener("click", () => {
    tr.remove();
    actualizarPorDefecto();
  });
  td.append(quitar);
  tr.append(td);
  $("clientes").append(tr);
}

function botonQuitar(tr, alQuitar) {
  const td = document.createElement("td");
  const quitar = document.createElement("button");
  quitar.textContent = "✕";
  quitar.title = "Quitar";
  quitar.addEventListener("click", () => {
    tr.remove();
    if (alQuitar) alQuitar();
  });
  td.append(quitar);
  return td;
}

function celdaInput(col, valor) {
  const td = document.createElement("td");
  const input = document.createElement("input");
  input.dataset.col = col;
  input.value = valor || "";
  td.append(input);
  return td;
}

function anadirPaso(paso = { accion: "clic", texto: "", selector: "" }) {
  const tr = document.createElement("tr");
  const num = document.createElement("td");
  num.className = "suave num";
  const tdAccion = document.createElement("td");
  const sel = document.createElement("select");
  sel.dataset.col = "accion";
  ACCIONES.forEach((a) => sel.add(new Option(a, a)));
  sel.value = paso.accion;
  tdAccion.append(sel);

  const mover = document.createElement("td");
  mover.style.whiteSpace = "nowrap";
  for (const [simbolo, dir] of [["↑", -1], ["↓", 1]]) {
    const b = document.createElement("button");
    b.textContent = simbolo;
    b.addEventListener("click", () => {
      const otro = dir < 0 ? tr.previousElementSibling : tr.nextElementSibling;
      if (otro) dir < 0 ? otro.before(tr) : otro.after(tr);
      numerarPasos();
    });
    mover.append(b);
  }
  mover.append(botonQuitar(tr, numerarPasos).firstChild);

  tr.append(num, tdAccion, celdaInput("texto", paso.texto), celdaInput("selector", paso.selector), mover);
  $("pasos").append(tr);
  numerarPasos();
}

function numerarPasos() {
  [...$("pasos").rows].forEach((tr, i) => (tr.querySelector(".num").textContent = i + 1));
}

function anadirTipo(tipo = {}) {
  const tr = document.createElement("tr");
  tr.append(celdaInput("letra", tipo.letra), celdaInput("modo", tipo.modo), botonQuitar(tr));
  $("tipos").append(tr);
}

function leerFilas(tbody) {
  return [...tbody.rows].map((tr) => {
    const o = {};
    tr.querySelectorAll("[data-col]").forEach((i) => (o[i.dataset.col] = i.value.trim()));
    return o;
  });
}

function leerClientes() {
  return [...$("clientes").rows]
    .map((tr) => {
      const c = {};
      tr.querySelectorAll("input").forEach((i) => (c[i.dataset.col] = i.value.trim()));
      return c;
    })
    .filter((c) => c.nombre);
}

function actualizarPorDefecto(valor = $("clientePorDefecto").value) {
  const sel = $("clientePorDefecto");
  sel.textContent = "";
  sel.add(new Option("— ninguno —", ""));
  leerClientes().forEach((c) => sel.add(new Option(c.nombre, c.nombre)));
  sel.value = valor || "";
}

function actualizarModo() {
  const modo = document.querySelector('input[name="modo"]:checked')?.value || "formulario";
  $("caja-url").hidden = modo !== "url";
  $("caja-formulario").hidden = modo !== "formulario";
}

function leer() {
  const config = { modo: document.querySelector('input[name="modo"]:checked')?.value || "formulario" };
  CAMPOS_TEXTO.forEach((c) => (config[c] = $(c).value.trim()));
  CAMPOS_NUMERO.forEach((c) => (config[c] = Number($(c).value) || 0));
  CAMPOS_CHECK.forEach((c) => (config[c] = $(c).checked));
  config.pasos = leerFilas($("pasos")).filter((p) => p.texto || p.selector || p.accion === "enviar");
  config.tipos = leerFilas($("tipos"))
    .filter((t) => t.letra && t.modo)
    .map((t) => ({ letra: t.letra.toUpperCase(), modo: t.modo }));
  config.tipoPorDefecto = config.tipoPorDefecto.toUpperCase();
  config.clientes = leerClientes();
  config.clientePorDefecto = $("clientePorDefecto").value;
  return config;
}

function validar(config) {
  const errores = [];
  const url = config.modo === "url" ? config.urlPlantilla : config.urlBusqueda;
  if (!origenDe(url)) errores.push("La URL del portal no es válida.");
  if (config.modo === "url" && !config.urlPlantilla.includes("{ref}")) errores.push("La plantilla debe incluir {ref}.");
  if (config.modo === "formulario" && !config.pasos.length) errores.push("Añade al menos un paso.");
  for (const c of config.clientes) {
    if (!c.patron) continue;
    try {
      new RegExp(c.patron);
    } catch (e) {
      errores.push(`Patrón no válido en "${c.nombre}": ${e.message}`);
    }
  }
  return errores;
}

function estado(texto, clase) {
  $("estado").textContent = texto;
  $("estado").className = clase;
}

async function guardar() {
  const config = leer();
  const errores = validar(config);
  if (errores.length) return estado(errores.join(" "), "aviso");

  // En modo formulario hace falta permiso para rellenar las páginas del portal.
  if (config.modo === "formulario") {
    const concedido = await chrome.permissions.request({ origins: [origenDe(config.urlBusqueda)] });
    if (!concedido) return estado("Guardado cancelado: hay que permitir el acceso al portal.", "aviso");
  }

  await guardarConfig(config);
  estado("Guardado ✓", "ok");
}

document.querySelectorAll('input[name="modo"]').forEach((r) => r.addEventListener("change", actualizarModo));
$("anadirCliente").addEventListener("click", () => {
  $("filtro").value = "";
  filtrar();
  anadirFila();
});
$("filtro").addEventListener("input", filtrar);
$("anadirPaso").addEventListener("click", () => anadirPaso());
$("anadirTipo").addEventListener("click", () => anadirTipo());
function filtrar() {
  const t = normalizar($("filtro").value);
  for (const tr of $("clientes").rows) {
    tr.hidden = !!t && ![...tr.querySelectorAll("input")].some((i) => normalizar(i.value).includes(t));
  }
}
$("guardar").addEventListener("click", guardar);
$("exportar").addEventListener("click", () => {
  $("json").value = JSON.stringify(leer(), null, 2);
});
$("importar").addEventListener("click", () => {
  try {
    pintar({ ...CONFIG_POR_DEFECTO, ...JSON.parse($("json").value) });
    estado("Importado. Revisa y pulsa Guardar.", "suave");
  } catch (e) {
    estado("El JSON no es válido.", "aviso");
  }
});

cargarConfig().then(pintar);
