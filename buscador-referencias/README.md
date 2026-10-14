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

**Opción B: rellenar el formulario.** Si la URL no cambia, la extensión abre la página de búsqueda,
elige el cliente en el desplegable, escribe la referencia y pulsa Buscar. Necesita:

| Campo | Cómo obtenerlo |
|---|---|
| URL de la página de búsqueda | La dirección donde está el desplegable |
| Selector del desplegable | Clic derecho sobre el desplegable → *Inspeccionar*. Si es `<select id="cliente">` → `#cliente`; si es `<select name="idCliente">` → `select[name="idCliente"]` |
| Selector de las opciones | Solo si el desplegable no es un `<select>` (por ejemplo, una lista que se despliega al pulsar). Ej.: `.dropdown-menu li` |
| Selector del cuadro de referencia | Igual, sobre el cuadro de texto. Ej.: `#referencia` |
| Selector del botón Buscar | Opcional. Si lo dejas vacío se envía el formulario / se pulsa Intro |

Si el portal recarga la página al cambiar de cliente, sube la *Espera tras elegir cliente*.
Al guardar, el navegador te pedirá permiso para acceder al dominio del portal: es necesario para rellenar el formulario.

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

Pulsa el icono, pega las referencias (una por línea o separadas por espacios o comas) y pulsa **Abrir N pestañas**:

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
