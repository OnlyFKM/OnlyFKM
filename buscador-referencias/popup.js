const $ = (id) => document.getElementById(id);
let config;
let items = [];
// Página del portal donde empiezan los pasos y si hay permiso para usarla.
let portal = { url: "", permitido: false };

async function iniciar() {
  config = await cargarConfig();
  const { borrador = "" } = await chrome.storage.local.get("borrador");
  $("texto").value = borrador;
  await comprobarPortal();
  analizar();
  chrome.action.setBadgeText({ text: "" });

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

// Sin URL configurada se usa la pestaña actual: basta con abrir el popup estando dentro del portal.
async function comprobarPortal() {
  const div = $("portal");
  div.textContent = "";
  if (config.modo === "url") return;

  let url = config.urlBusqueda;
  if (config.modo === "enlace") {
    // Todos los enlaces directos van al mismo portal: basta con el primero.
    const conEnlace = config.clientes.find((c) => c.enlace);
    url = conEnlace ? conEnlace.enlace : "";
  } else if (!url) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    url = tab && /^https?:/.test(tab.url || "") ? tab.url : "";
  }
  const origen = url ? origenDe(url) : null;
  if (!origen) {
    portal = { url: "", permitido: false };
    div.innerHTML =
      config.modo === "enlace"
        ? '<span class="aviso">Ningún cliente tiene enlace directo. Revisa la Configuración.</span>'
        : '<span class="aviso">Abre el portal en esta pestaña y vuelve a pulsar el icono.</span>';
    return;
  }

  const permitido = await chrome.permissions.contains({ origins: [origen] });
  portal = { url, permitido };
  const host = new URL(url).host;
  const detalle = config.modo === "enlace" ? " (enlace directo de cada cliente)" : config.urlBusqueda ? "" : " (pestaña actual)";
  div.append(`Portal: ${host}${detalle}`);
  if (!permitido) {
    const boton = document.createElement("button");
    boton.textContent = "Permitir acceso";
    boton.title = "La extensión necesita permiso para hacer los pasos en este portal";
    // Si el navegador cierra el popup al mostrar el aviso, el permiso queda igualmente concedido.
    boton.addEventListener("click", async () => {
      if (await chrome.permissions.request({ origins: origenesPortal(url) })) {
        await comprobarPortal();
        pintarLista();
      }
    });
    div.append(boton);
    div.className = "aviso";
  } else {
    div.className = "suave";
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

    const tipo = document.createElement("small");
    if (item.cliente && pasosDe(config).some((p) => String(p.texto || "").includes("{modo}"))) {
      const t = tipoDeReferencia(item.ref, item.cliente, config);
      tipo.textContent = t.modo ? t.tipo : `${t.tipo || "?"} ✗`;
      tipo.title = t.modo || "Tipo de referencia sin modo configurado: fallará";
      tipo.className = t.modo ? "suave" : "aviso";
    }

    fila.append(ref, tipo, sel, quitar);
    lista.append(fila);
  }

  const sinCliente = items.filter((i) => !i.cliente).length;
  const validas = items.length - sinCliente;
  $("resumen").textContent = items.length
    ? `${items.length} referencia(s) detectada(s)` + (sinCliente ? ` · ${sinCliente} sin cliente` : "")
    : "";
  $("resumen").className = sinCliente ? "aviso" : "suave";
  $("abrir").disabled = validas === 0 || (config.modo !== "url" && !portal.permitido);
  $("abrir").textContent = validas ? `Abrir ${validas} pestaña(s)` : "Abrir pestañas";
}

async function abrir() {
  const validas = items.filter((i) => i.cliente);
  if (!validas.length) return;

  // Las referencias sin cliente no frenan al resto: se abren las demás y las que no tienen cliente
  // se quedan en el cuadro de texto (para la próxima vez que se abra el popup).
  const sinCliente = items.filter((i) => !i.cliente).map((i) => i.ref);
  await chrome.storage.local.set({ borrador: sinCliente.join("\n") });
  await chrome.runtime.sendMessage({ tipo: "abrir", items: validas, sinCliente, urlInicio: portal.url });
  window.close();
}

iniciar();
