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

| Columna | Para qué sirve |
|---|---|
| Nombre | Como lo escribirás al pegar las referencias |
| Valor en desplegable | El `value` de la opción del desplegable o su texto exacto (en modo URL, lo que va en `{cliente}`) |
| Alias | Otras formas de escribir el cliente, separadas por comas |
| Patrón | Expresión regular opcional para reconocer el cliente solo por la referencia. Ej.: `^A\d{6}$` = "A" + 6 cifras |

## Uso

Pulsa el icono, pega las referencias y pulsa **Abrir N pestañas**. Puedes mezclar formatos:

```
Cliente A; A123456          ← cliente y referencia en la misma línea (; : | = o tabulador)
CB: B-778, B-779            ← varias referencias del mismo cliente (usando un alias)
Cliente C                   ← línea con solo el cliente: las siguientes son de ese cliente
X-001
X-002
A654321                     ← suelta: se detecta el cliente por su patrón
```

Antes de abrir verás la lista de referencias detectadas. Puedes cambiar el cliente de cualquiera o quitarla.
Las que no tengan cliente salen en rojo y no se abren. También se pueden pegar dos columnas copiadas de Excel (cliente | referencia).

Si alguna búsqueda falla, el icono muestra un `!` y el popup indica qué referencia falló y por qué.

## Pasar la configuración de Chrome a Edge

En Opciones → *Importar / exportar*: pulsa **Exportar**, copia el JSON, pégalo en la otra extensión y pulsa **Importar** y luego **Guardar**.
