const $ = (id) => document.getElementById(id);
const CAMPOS_TEXTO = ["urlPlantilla", "urlBusqueda", "selectorCliente", "selectorOpcionCliente", "selectorReferencia", "selectorBoton"];
const CAMPOS_NUMERO = ["esperaTrasClienteMs", "timeoutMs", "retardoEntrePestanasMs"];
const CAMPOS_CHECK = ["enSecuencia", "activarPestanas"];
const COLUMNAS = ["nombre", "valor", "alias", "patron"];

function pintar(config) {
  document.querySelectorAll('input[name="modo"]').forEach((r) => (r.checked = r.value === config.modo));
  CAMPOS_TEXTO.forEach((c) => ($(c).value = config[c] || ""));
  CAMPOS_NUMERO.forEach((c) => ($(c).value = config[c]));
  CAMPOS_CHECK.forEach((c) => ($(c).checked = !!config[c]));
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
  config.clientes = leerClientes();
  config.clientePorDefecto = $("clientePorDefecto").value;
  return config;
}

function validar(config) {
  const errores = [];
  const url = config.modo === "url" ? config.urlPlantilla : config.urlBusqueda;
  if (!origenDe(url)) errores.push("La URL del portal no es válida.");
  if (config.modo === "url" && !config.urlPlantilla.includes("{ref}")) errores.push("La plantilla debe incluir {ref}.");
  if (config.modo === "formulario" && (!config.selectorCliente || !config.selectorReferencia))
    errores.push("Faltan los selectores del desplegable o del cuadro de referencia.");
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
$("anadirCliente").addEventListener("click", () => anadirFila());
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
