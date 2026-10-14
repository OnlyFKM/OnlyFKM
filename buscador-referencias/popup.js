const $ = (id) => document.getElementById(id);
let config;
let items = [];

async function iniciar() {
  config = await cargarConfig();
  const { borrador = "" } = await chrome.storage.local.get("borrador");
  $("texto").value = borrador;
  analizar();
  mostrarRegistro();

  $("texto").addEventListener("input", () => {
    chrome.storage.local.set({ borrador: $("texto").value });
    analizar();
  });
  $("abrir").addEventListener("click", abrir);
  $("opciones").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  if (!config.clientes.length) {
    $("resumen").innerHTML = '<span class="aviso">No hay clientes configurados. Ve a Configuración.</span>';
  }
}

function analizar() {
  items = analizarTexto($("texto").value, config);
  pintarLista();
}

function pintarLista() {
  const lista = $("lista");
  lista.textContent = "";
  for (const item of items) {
    const fila = document.createElement("div");
    fila.className = "item" + (item.cliente ? "" : " sin-cliente");

    const ref = document.createElement("code");
    ref.textContent = item.ref;
    ref.title = item.ref;

    const sel = document.createElement("select");
    sel.add(new Option("— elige cliente —", ""));
    config.clientes.forEach((c, i) => sel.add(new Option(c.nombre, String(i))));
    sel.value = item.cliente ? String(config.clientes.findIndex((c) => c.nombre === item.cliente.nombre)) : "";
    sel.addEventListener("change", () => {
      item.cliente = sel.value === "" ? null : config.clientes[Number(sel.value)];
      pintarLista();
    });

    const quitar = document.createElement("button");
    quitar.textContent = "✕";
    quitar.title = "Quitar";
    quitar.addEventListener("click", () => {
      items.splice(items.indexOf(item), 1);
      pintarLista();
    });

    fila.append(ref, sel, quitar);
    lista.append(fila);
  }

  const sinCliente = items.filter((i) => !i.cliente).length;
  const validas = items.length - sinCliente;
  $("resumen").textContent = items.length
    ? `${items.length} referencia(s) detectada(s)` + (sinCliente ? ` · ${sinCliente} sin cliente` : "")
    : "";
  $("resumen").className = sinCliente ? "aviso" : "suave";
  $("abrir").disabled = validas === 0;
  $("abrir").textContent = validas ? `Abrir ${validas} pestaña(s)` : "Abrir pestañas";
}

async function abrir() {
  const validas = items.filter((i) => i.cliente);
  if (!validas.length) return;

  // Permiso sobre el dominio del portal (se concede al guardar la configuración).
  const origen = origenDe(config.urlBusqueda);
  if (config.modo === "formulario" && !(origen && (await chrome.permissions.contains({ origins: [origen] })))) {
    $("resumen").textContent = "Falta el permiso sobre el portal: abre Configuración y pulsa Guardar.";
    $("resumen").className = "aviso";
    return;
  }

  // Las referencias sin cliente no frenan al resto: se abren las demás y las fallidas
  // quedan en el registro (con el aviso "!") y en el cuadro de texto para corregirlas.
  const sinCliente = items.filter((i) => !i.cliente).map((i) => i.ref);
  await chrome.runtime.sendMessage({ tipo: "abrir", items: validas, sinCliente });
  if (!sinCliente.length) return window.close();

  $("texto").value = sinCliente.join("\n");
  chrome.storage.local.set({ borrador: $("texto").value });
  analizar();
}

async function mostrarRegistro() {
  const { registro } = await chrome.storage.local.get("registro");
  if (!registro || !registro.entradas.length) return;
  if (registro.enCurso) {
    $("registro").innerHTML = '<span class="suave">Abriendo búsquedas…</span>';
    return;
  }
  const errores = registro.entradas.filter((e) => !e.ok);
  const div = $("registro");
  if (!errores.length) {
    div.innerHTML = `<span class="ok">Última ejecución: ${registro.entradas.length} búsqueda(s) correctas.</span>`;
    return;
  }
  div.innerHTML = `<div class="aviso">Última ejecución: ${errores.length} error(es):</div>`;
  for (const e of errores) {
    const linea = document.createElement("div");
    linea.className = "aviso";
    linea.textContent = e.cliente ? `• ${e.cliente} / ${e.ref}: ${e.error}` : `• ${e.ref}: ${e.error}`;
    div.append(linea);
  }
  chrome.action.setBadgeText({ text: "" });
}

// El registro se actualiza mientras se abren las pestañas: se repinta si el popup sigue abierto.
chrome.storage.onChanged.addListener((cambios, area) => {
  if (area === "local" && cambios.registro) mostrarRegistro();
});

iniciar();
