# Buscador de referencias (Chrome y Edge)

Extensión de navegador para Chrome y Edge (Manifest V3, el mismo código vale para los dos).
Pegas una lista de referencias de **distintos clientes**, la extensión detecta a qué cliente pertenece cada una
y abre una pestaña del portal por referencia: entra directamente en el cliente con su enlace y lanza la búsqueda.

## Instalación

1. Descarga o clona esta carpeta (`buscador-referencias`).
2. Abre la página de extensiones:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
3. Activa el **Modo de desarrollador**.
4. Pulsa **Cargar descomprimida** y elige la carpeta `buscador-referencias`.
5. Fija el icono de la extensión en la barra para tenerlo a mano.

## Configuración (una sola vez)

Clic derecho en el icono → **Opciones** (o el enlace *Configuración* del popup).

Viene lista para usar: normalmente solo hay que pulsar **Guardar** la primera vez para dar permiso
de acceso al portal (`cybersecurity.telefonica.com`).

### 1. Cómo se busca en el portal

**Enlace directo de cada cliente** (el modo por defecto). Cada cliente tiene su enlace al portal
(`…/clients/1636/units/CAF`). La extensión lo abre con la pantalla del listado de amenazas
(`?URL=/threats/threats`, se cambia en Opciones) y hace cuatro pasos:

| # | Acción | Texto | Etiqueta | Qué hace |
|---|---|---|---|---|
| 1 | clic | `Filtros` | | Abre el panel de filtros |
| 2 | campo | `{ref}` | `Referencia` | Escribe la referencia en el campo *Referencia* (no en *Referencia externa* ni en otros) |
| 3 | clic | `Buscar` | | Pulsa el *Buscar* del panel de filtros (si hay varios, el que está junto al campo) |
| 4 | abrirResultado | `{ref}` | | Espera a los resultados y pulsa la celda de la columna *Referencia* que tiene **exactamente** esa referencia (`CAF-D-1731` no abre `CAF-D-17317`) para abrir la amenaza. Nunca pulsa otros enlaces de la fila, como el caso `CARR-D-213063-0001` de la columna *Casos*. Si con un clic no se abre, prueba con doble clic |

Si el panel de filtros ya estaba abierto y el paso 1 lo cierra, el paso 2 lo detecta y vuelve a pulsar *Filtros*.
Cada pestaña acaba en la ficha de su amenaza. Si el portal abre la ficha en una pestaña nueva, la extensión se queda
con esa y cierra la del listado. El clic del paso 4 se hace de una referencia en una para que cada ficha nueva
se asigne a la referencia correcta.
Como cada pestaña entra en su cliente por su enlace, las referencias se abren en paralelo y tarda unos segundos.

El portal muestra el listado de amenazas dentro de un **marco** (iframe) de la página: antes de cada paso la extensión
busca en todos los marcos dónde está lo que necesita (el botón *Filtros*, el campo *Referencia*, el resultado…) y hace
el paso ahí. Por eso al guardar pide permiso para `*.telefonica.com` además de `cybersecurity.telefonica.com`:
el marco podría servirse desde otro subdominio. Si un paso no encuentra nada, **Ver qué hizo** lista los marcos que ve.

**Antes de usarla, activa el modo Digital Risk Protection en el portal**: la extensión no lo cambia.

**Opción A: URL con plantilla.** Haz una búsqueda a mano y fíjate en la barra de direcciones.
Si el cliente y la referencia aparecen en la URL, por ejemplo
`https://portal.com/expedientes?cliente=1234&ref=ABC001`, usa el modo URL con la plantilla:

```
https://portal.com/expedientes?cliente={cliente}&ref={ref}
```

Es el modo más rápido y fiable.

**Opción B: seguir unos pasos en el portal** (para clientes sin enlace directo). Para cada referencia la extensión abre el portal
y repite lo que harías a mano. Pasos por defecto:

| # | Acción | Texto | Qué hace |
|---|---|---|---|
| 1 | panelCliente | `{cliente}` | Abre el panel de la barra superior y lo recorre en cascada: pulsa el OB (*Global*, se cambia en Opciones) → escribe el cliente en el buscador de **Clientes** y lo pulsa → pulsa la unidad que se llame como el cliente (o la primera) → si el panel sigue abierto, entra con el icono ↗ |
| 2 | clic | `{modo}` | Activa el modo según el tipo de referencia (`D` → *Digital Risk Protection*) |
| 3 | clic | `Amenazas` | Abre el apartado Amenazas |
| 4 | clic | `Listado de amenazas` | Entra en el listado |
| 5 | escribir | `{ref}` | Escribe la referencia en el cuadro de búsqueda |
| 6 | enviar | | Pulsa Intro (o el botón del selector, si lo pones) |

Los clics se hacen **por el texto visible**, así que normalmente no hace falta ningún selector CSS. Solo hace falta uno si:

- no encuentra el botón de la barra superior que abre el panel de clientes (el que pone "Global"): pon su selector en el paso 1;
- hay varios elementos con el mismo texto y pulsa el que no es: pon un selector en ese paso;
- el cuadro de búsqueda no es el primero de la página: pon su selector en el paso 5.

Para sacar un selector: clic derecho sobre el elemento → *Inspeccionar*. Si tiene `id="cliente"` el selector es `#cliente`.

**Tipos de referencia:** la letra que va tras el código del cliente (`CAF-`**`D`**`-17317`) dice qué modo activar.
Viene configurado `D` → *Digital Risk Protection*; puedes añadir más letras en Opciones. Si una referencia lleva una letra sin modo,
no se abre y aparece en el error del popup. Las referencias sin letra (p. ej. `BANK; 12345`) usan el *tipo por defecto* (`D`).

Si el portal tarda en cargar entre pasos, sube la *Espera entre pasos*.

**URL del portal:** no hace falta ponerla. Si la dejas vacía, entra en el portal como siempre y pulsa el icono
de la extensión **desde la pestaña del portal**: los pasos empiezan en esa página. La primera vez el popup mostrará
*Permitir acceso*; púlsalo y acepta (la extensión necesita ese permiso para hacer los pasos en el portal). Si el navegador
cierra el popup al aceptar, vuelve a abrirlo: el permiso ya queda guardado.
Si prefieres que funcione desde cualquier pestaña, pon la URL en Opciones.

### 2. Clientes

La extensión trae **174 clientes** con su código y su enlace directo, en `clientes.js`:
los 135 de `referencias.xlsx` que tienen enlace en el buscador del equipo, más 39 que solo estaban en el buscador
(Inditex, Enagas, Telxius…). Los 33 del Excel sin enlace (Cabildos, Consells, MSF Belgium/France/Netherlands,
Telefonica Corporativo…) no están: sus referencias aparecen como *sin cliente*. Para añadir uno, en Opciones → Clientes
pon su nombre, código y enlace (`https://cybersecurity.telefonica.com/security-service/tenants/1/socs/…/clients/…/units/CÓDIGO`).

| Columna | Para qué sirve |
|---|---|
| Nombre | Como aparece en el desplegable del portal |
| Código en referencia | La parte de la referencia que indica el cliente (coincide con la unidad del enlace) |
| Enlace | Dirección del cliente en el portal, sin `?URL=…` |
| Valor en desplegable | Solo si la opción del desplegable no se llama igual que el nombre |
| Alias | Otras formas de escribir el cliente, separadas por comas |
| Patrón | Expresión regular opcional para casos especiales |

**Cómo se detecta el cliente:** se busca el código dentro de la referencia sin que vaya pegado a otras letras
(`TE-2024-1` → Telefonica España, `TEFCORP-2024-1` → Telefonica Corporativo, `INC-SERGAS-778` → SERGAS).
Si encajan varios códigos gana el más largo. Un código pegado a otras letras nunca se usa: `TEFCORP-D-9` no se asigna
a `TE` aunque TEFCORP no esté en la lista (sale *sin cliente*).

## Uso

Con el modo Digital Risk Protection activado en el portal, pulsa el icono, pega las referencias (una por línea o separadas por espacios o comas) y pulsa **Abrir N pestañas**:

```
ABAI-12345 TEFCORP-2024-002
INC-SERGAS-778
BANK; 12345          ← si la referencia no lleva el código, escribe CLIENTE; REFERENCIA (vale el nombre o el código)
Pérez Llorca: 777
```

Antes de abrir verás la lista de referencias detectadas. Puedes cambiar el cliente de cualquiera o quitarla.
Las que no tengan cliente salen en rojo. Al pulsar **Abrir** se abren todas las demás y, al terminar,
el popup muestra un error con las referencias a las que no se les encontró cliente. Además, esas referencias se quedan en el
cuadro de texto para que las corrijas (por ejemplo `CLIENTE; REFERENCIA`) y las vuelvas a lanzar.

Si alguna búsqueda falla en el portal, el icono muestra un `!` y el popup indica qué referencia falló y por qué.
Debajo de cada error, **Ver qué hizo** muestra paso a paso lo que llegó a hacer la extensión antes de fallar.

## Pasar la configuración de Chrome a Edge

En Opciones → *Importar / exportar*: pulsa **Exportar**, copia el JSON, pégalo en la otra extensión y pulsa **Importar** y luego **Guardar**.
