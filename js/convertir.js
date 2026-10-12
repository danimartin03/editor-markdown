// Convertir el Markdown en HTML que sea seguro meter en la página.
//
// Por qué hace falta sanear: Markdown deja escribir HTML dentro, y la librería
// que lo convierte (marked) lo deja pasar tal cual. Si metiera ese resultado en
// la página, un documento podría ejecutar código. Por ejemplo, esto:
//
//     <img src="x" onerror="alert('hola')">
//
// carga una imagen que no existe y, al fallar, ejecuta lo que hay en onerror.
// DOMPurify revisa el HTML y quita todo lo que puede ejecutar código, dejando
// solo el formato. La regla del proyecto: NADA llega a la página sin pasar
// por convertirMarkdown(), que es la única función que sanea.

// Las dos librerías vienen de un CDN. Si no han cargado (sin conexión,
// bloqueadas...) sus variables no existen, y no puedo convertir nada.
function hayLibrerias() {
  return typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined';
}

// Además de lo que DOMPurify quita por su cuenta, yo le prohíbo:
// - <style> y el atributo style: un documento podría cambiar el aspecto del editor
//   o tapar la página con un cartel falso.
// - Los elementos de formulario (menos las casillas de las listas de tareas, mira abajo).
// SANITIZE_NAMED_PROPS le pone un prefijo a los id del documento para que no
// choquen con los míos (si no, un id="editor" en el texto podría confundir a mi código).
const OPCIONES_DE_SANEADO = {
  FORBID_TAGS: ['style', 'form', 'button', 'textarea', 'select', 'option'],
  FORBID_ATTR: ['style'],
  SANITIZE_NAMED_PROPS: true
};

let saneadoPreparado = false;

// Le digo a DOMPurify que, después de limpiar cada elemento, me lo pase para darle un último repaso
function prepararSaneado() {
  if (saneadoPreparado) return;
  DOMPurify.addHook('afterSanitizeAttributes', repasarElemento);
  saneadoPreparado = true;
}

function repasarElemento(elemento) {
  // Los enlaces se abren en otra pestaña, para no perder lo que se está escribiendo.
  // rel="noopener" evita que la página que se abre pueda manejar esta.
  if (elemento.tagName === 'A') {
    elemento.setAttribute('target', '_blank');
    elemento.setAttribute('rel', 'noopener noreferrer');
  }

  // Solo dejo imágenes por https. Las demás se quedan con su texto alternativo.
  if (elemento.tagName === 'IMG') {
    const direccion = elemento.getAttribute('src') || '';
    if (!direccion.startsWith('https://')) elemento.removeAttribute('src');
    elemento.setAttribute('loading', 'lazy');
    elemento.setAttribute('referrerpolicy', 'no-referrer');
  }

  // De los campos de formulario solo me valen las casillas de las listas de tareas
  // ("- [x] hecho"), y siempre desactivadas
  if (elemento.tagName === 'INPUT') {
    if (elemento.getAttribute('type') === 'checkbox') {
      elemento.setAttribute('disabled', '');
    } else {
      elemento.remove();
    }
  }

  // Las clases las quito todas para que el documento no pueda usar mis estilos,
  // menos la que marca el lenguaje de un bloque de código (class="language-js")
  if (elemento.hasAttribute('class')) {
    const esLenguaje = elemento.tagName === 'CODE' && /^language-[\w-]+$/.test(elemento.getAttribute('class'));
    if (!esLenguaje) elemento.removeAttribute('class');
  }
}

// La única puerta de entrada: de Markdown a HTML ya saneado
function convertirMarkdown(texto) {
  prepararSaneado();
  const htmlSinSanear = marked.parse(texto);
  return DOMPurify.sanitize(htmlSinSanear, OPCIONES_DE_SANEADO);
}

// ---------- Página completa para descargar ----------

// Cambio los caracteres que en HTML significan algo, para poder poner un texto
// cualquiera dentro de una etiqueta sin que se interprete como código
function escaparHtml(texto) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ESTILOS_DE_LA_PAGINA = [
  'body { max-width: 42rem; margin: 2rem auto; padding: 0 1rem; font-family: Georgia, serif; font-size: 1.1rem; line-height: 1.7; color: #22252b; background: #fffdf8; }',
  'h1, h2, h3 { line-height: 1.25; }',
  'h1 { border-bottom: 2px solid #22252b; padding-bottom: 0.3em; }',
  'a { color: #1e4d8c; }',
  'img { max-width: 100%; height: auto; }',
  'blockquote { margin: 1em 0; padding: 0.2em 1em; border-left: 4px solid #1e4d8c; color: #575c66; font-style: italic; }',
  'code { padding: 0.1em 0.35em; border-radius: 4px; background: #ece5d3; font-family: Consolas, Menlo, monospace; font-size: 0.88em; }',
  'pre { padding: 0.9rem 1rem; border-radius: 8px; background: #ece5d3; overflow-x: auto; }',
  'pre code { padding: 0; background: none; }',
  'table { border-collapse: collapse; }',
  'th, td { padding: 0.4rem 0.75rem; border: 1px solid #d5ccb9; text-align: left; }'
].join('\n    ');

// Monto un documento HTML entero alrededor del contenido, para que se pueda abrir solo.
// El contenido ya viene saneado; el título lo escapo porque es texto escrito por el usuario.
function crearPaginaHtml(titulo, htmlSaneado) {
  return [
    '<!DOCTYPE html>',
    '<html lang="es">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <title>' + escaparHtml(titulo) + '</title>',
    '  <style>',
    '    ' + ESTILOS_DE_LA_PAGINA,
    '  </style>',
    '</head>',
    '<body>',
    htmlSaneado,
    '</body>',
    '</html>',
    ''
  ].join('\n');
}
