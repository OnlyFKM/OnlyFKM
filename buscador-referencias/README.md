# Buscador de referencias (Chrome y Edge)

Extensión de navegador para Chrome y Edge (Manifest V3, el mismo código vale para los dos).
Pegas una lista de referencias de **distintos clientes**, la extensión detecta a qué cliente pertenece cada una
y abre una pestaña del portal por referencia, eligiendo el cliente en el desplegable y lanzando la búsqueda.

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

### 1. Cómo se busca en el portal

**Opción A: URL directa.** Haz una búsqueda a mano y fíjate en la barra de direcciones.
Si el cliente y la referencia aparecen en la URL, por ejemplo
`https://portal.com/expedientes?cliente=1234&ref=ABC001`, usa el modo URL con la plantilla:

```
https://portal.com/expedientes?cliente={cliente}&ref={ref}
```

Es el modo más rápido y fiable.

**Opción B: seguir unos pasos en el portal** (la que viene configurada). Para cada referencia la extensión abre el portal
y repite lo que harías a mano. Pasos por defecto:

| # | Acción | Texto | Qué hace |
|---|---|---|---|
| 1 | panelCliente | `{cliente}` | Abre el panel de la barra superior (OBs / Clientes / Unidades), escribe el cliente en el buscador de **Clientes**, lo pulsa y, si hace falta, entra con el icono ↗ |
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

La extensión ya trae cargados los **168 clientes** de `referencias.xlsx` con su código (`ABAI`, `SERGAS`, `TEFCORP`…),
que está en `clientes.js`. En Opciones puedes filtrarlos, editarlos o añadir más.

| Columna | Para qué sirve |
|---|---|
| Nombre | Como aparece en el desplegable del portal |
| Código en referencia | La parte de la referencia que indica el cliente |
| Valor en desplegable | Solo si la opción del desplegable no se llama igual que el nombre |
| Alias | Otras formas de escribir el cliente, separadas por comas |
| Patrón | Expresión regular opcional para casos especiales |

**Cómo se detecta el cliente:** se busca el código dentro de la referencia sin que vaya pegado a otras letras
(`TE-2024-1` → Telefonica España, `TEFCORP-2024-1` → Telefonica Corporativo, `INC-SERGAS-778` → SERGAS).
Si encajan varios códigos gana el más largo. Si no encaja ninguno así, se prueba con el código al principio de la referencia
(`sergas20240001` → SERGAS).

## Uso

Con el portal abierto en la pestaña actual, pulsa el icono, pega las referencias (una por línea o separadas por espacios o comas) y pulsa **Abrir N pestañas**:

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

## Pasar la configuración de Chrome a Edge

En Opciones → *Importar / exportar*: pulsa **Exportar**, copia el JSON, pégalo en la otra extensión y pulsa **Importar** y luego **Guardar**.
