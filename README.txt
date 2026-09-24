ELECTRICISTA APP — README
==========================

Aplicación 100% local (sin backend). Todos los datos (trabajos, materiales
y fotos) se guardan en el navegador usando IndexedDB.

CÓMO EJECUTARLA
----------------
Al ser una app 100% de archivos estáticos, alcanza con abrirla con un
servidor local simple (recomendado, para evitar restricciones de
navegadores con file://) o directamente abriendo los .html.

Opción recomendada (con Python instalado):
  cd ElectricistaApp
  python3 -m http.server 8000
  Abrir http://localhost:8000/index.html

También podés usar cualquier otra extensión tipo "Live Server".

ESTRUCTURA
----------
index.html        Inicio (accesos rápidos + contadores)
galeria.html       Trabajos (fotos, anotaciones, editor)
materiales.html    Materiales (inventario, lista agrupada)
calculadora.html   Calculadora eléctrica de referencia
css/               Estilos por sección
js/app.js          Núcleo: acceso a IndexedDB, utilidades, menú, contadores
js/galeria.js      Lógica de Trabajos + editor de fotos/anotaciones
js/materiales.js   Lógica de Materiales
js/calculadora.js  Lógica de la calculadora
img/               Recursos gráficos (símbolos e íconos opcionales)

CAMBIOS EN ESTA REVISIÓN
-------------------------
Se revisó todo el proyecto probando los flujos reales en navegador
(Chromium, escritorio y viewport móvil) con IndexedDB real, no solo
verificación de sintaxis. Se corrigieron los siguientes problemas:

1. Variable global implícita "currentSymbol" en el editor de fotos
   (galeria.js). No estaba declarada; si en algún momento se agregaba
   "use strict" al archivo, el editor rompía al usar la herramienta de
   símbolos. Ahora está correctamente declarada dentro del módulo.

2. El botón "Deshacer" del editor de fotos no funcionaba en la
   práctica: solo revertía un "Limpiar", pero no removía símbolos,
   flechas, cajas, círculos, textos ni trazos de cable dibujados. Se
   reescribió con una pila de historial genérica: cada acción de dibujo
   guarda el estado anterior, y "Deshacer" ahora sí revierte la última
   acción (probado con Playwright: el canvas cambia realmente al
   deshacer).

3. Fuga de estado entre fotos: al editar una foto, anotar algo y cerrar
   sin guardar, y luego abrir el editor en OTRA foto, las anotaciones de
   la primera aparecían también en la segunda (el estado del editor era
   una variable global compartida por toda la página). Ahora cada
   apertura del editor usa su propio estado aislado.

4. galeria.js y calculadora.js no usaban "use strict" ni encapsulaban
   sus variables (quedaban en el ámbito global de la página). Se
   envolvieron en funciones autoejecutables ("use strict") y se
   reemplazaron asignaciones de eventos como
   `document.getElementById(id).onclick = ...` por
   `document.getElementById(id)?.addEventListener(...)`, evitando que
   la app entera se rompa si algún elemento no existiera.

5. css/galeria.css terminaba con un carácter suelto (una regla CSS
   incompleta al final del archivo, señal de una escritura cortada).
   Se limpió; no afectaba visualmente pero se corrigió por prolijidad.

PRUEBAS REALIZADAS (navegador real, no solo `node --check`)
-------------------------------------------------------------
- Carga de index.html, galeria.html, materiales.html y calculadora.html
  sin errores de consola (el único mensaje que aparece es el 404
  estándar de favicon.ico que pide el navegador automáticamente, no es
  parte de la app).
- Trabajos: crear, aparece en la lista, persiste tras recargar, abrir,
  editar, eliminar (y confirma que desaparece).
- Materiales: crear con foto, aparece, persiste tras recargar, +/-
  cantidad, editar, "Ver lista" (agrupada por categoría), eliminar.
- Editor de fotos: agregar foto, abrir editor, usar herramienta de
  símbolos, Deshacer (verificado que el canvas cambia realmente),
  guardar anotación.
- Menú hamburguesa en viewport móvil (375px): aparece y se abre/cierra
  correctamente.
- Contadores de Inicio: reflejan la cantidad real de trabajos y
  materiales guardados en IndexedDB.
- Calculadora: cálculo de corriente, térmica y sección con distintos
  valores, sin errores.

Los datos quedan guardados en el navegador (IndexedDB) y son
independientes por dispositivo/navegador: no se sincronizan entre
distintos equipos.
