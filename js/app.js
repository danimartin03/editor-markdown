// Aquí va todo lo que toca la página: paneles, barra de herramientas, atajos y archivos.

const CLAVE_TEMA = 'editor-markdown:tema';
const CLAVE_DOCUMENTO = 'editor-markdown:documento';
const TAMANO_MAXIMO_ARCHIVO = 1024 * 1024; // 1 MB

// ---------- Ayudas pequeñas ----------

// Atajo para no escribir document.getElementById cien veces
function porId(id) {
  return document.getElementById(id);
}

// Guardo cosas en localStorage. Va en try/catch porque en modo privado
// o con el almacenamiento lleno puede fallar, y no quiero que rompa la página.
// Devuelvo true o false para poder avisar si no se ha guardado.
function guardarDato(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch (error) {
    console.warn('No he podido guardar en localStorage:', error);
    return false;
  }
}

// Leo lo guardado. Si no hay nada o está roto, devuelvo null y ya está.
function leerDato(clave) {
  try {
    return JSON.parse(localStorage.getItem(clave));
  } catch (error) {
    return null;
  }
}

// ---------- Tema claro / oscuro ----------

// El tema ya lo ha puesto el script del <head> (para que no parpadee).
// Aquí solo dejo el botón con el texto que toca.
function pintarBotonTema() {
  const esOscuro = document.documentElement.dataset.tema === 'oscuro';
  porId('botonTema').textContent = esOscuro ? 'Tema claro' : 'Tema oscuro';
  porId('botonTema').setAttribute('aria-pressed', esOscuro);
}

function cambiarTema() {
  const esOscuro = document.documentElement.dataset.tema === 'oscuro';
  const temaNuevo = esOscuro ? 'claro' : 'oscuro';
  document.documentElement.dataset.tema = temaNuevo;
  guardarDato(CLAVE_TEMA, temaNuevo);
  pintarBotonTema();
}

// ---------- Pestañas (móvil) ----------

// En el móvil solo se ve un panel. Cuál se ve lo decide el atributo data-pestana
// de los paneles; el CSS hace el resto. En pantallas grandes se ven siempre los dos.
function cambiarPestana(pestana) {
  porId('paneles').dataset.pestana = pestana;
  porId('pestanaEditor').setAttribute('aria-pressed', pestana === 'editor');
  porId('pestanaVista').setAttribute('aria-pressed', pestana === 'vista');
}

// ---------- Vista previa ----------

// Pongo un mensaje en la vista previa en vez del documento
function pintarMensajeEnVista(clase, mensaje) {
  const parrafo = document.createElement('p');
  parrafo.className = clase;
  parrafo.textContent = mensaje;
  porId('vista').replaceChildren(parrafo);
}

function pintarVista() {
  const texto = porId('editor').value;

  // Sin las librerías prefiero no enseñar nada antes que enseñar HTML sin limpiar
  if (!hayLibrerias()) {
    pintarMensajeEnVista('vista-aviso', 'No se ha podido cargar la vista previa (¿estás sin conexión?). Puedes seguir escribiendo: el texto se guarda igual.');
    return;
  }
  if (texto.trim() === '') {
    pintarMensajeEnVista('vista-vacia', 'Aquí verás el documento con formato según escribas.');
    return;
  }

  // OJO: este es el ÚNICO sitio donde meto HTML en la página con innerHTML,
  // y lo que meto sale siempre de convertirMarkdown(), que lo sanea.
  porId('vista').innerHTML = convertirMarkdown(texto);
}

let esperaVista = null;

// Se llama con cada tecla. Espero un pelín antes de convertir para que,
// si se escribe rápido en un documento largo, no se convierta a cada letra.
function alEscribir() {
  clearTimeout(esperaVista);
  esperaVista = setTimeout(function () {
    pintarVista();
    pintarContadores();
  }, 120);
  programarGuardado();
}

// ---------- Barra de herramientas y atajos ----------

// Según el botón, pido a texto.js el cambio que hay que hacer.
// Allí están las cuentas; aquí solo elijo cuál toca.
function calcularCambio(accion, texto, inicio, fin) {
  if (accion === 'negrita') return envolver(texto, inicio, fin, '**', 'negrita');
  if (accion === 'cursiva') return envolver(texto, inicio, fin, '_', 'cursiva');
  if (accion === 'titulo') return prefijarLineas(texto, inicio, fin, '## ');
  if (accion === 'lista') return prefijarLineas(texto, inicio, fin, '- ');
  if (accion === 'cita') return prefijarLineas(texto, inicio, fin, '> ');
  if (accion === 'enlace') return insertarEnlace(texto, inicio, fin);
  if (accion === 'codigo') return insertarCodigo(texto, inicio, fin);
  return null;
}

function aplicarFormato(accion) {
  const editor = porId('editor');
  const textoAntes = editor.value;
  const cambio = calcularCambio(accion, textoAntes, editor.selectionStart, editor.selectionEnd);
  if (!cambio) return;
  const textoEsperado = aplicarCambio(textoAntes, cambio);

  // Selecciono el trozo que hay que sustituir y "escribo" encima el texto nuevo.
  // execCommand está marcado como antiguo, pero es la única forma de que Ctrl+Z
  // pueda deshacer lo que hace el botón, igual que si lo hubiera tecleado yo.
  editor.focus();
  editor.setSelectionRange(cambio.desde, cambio.hasta);
  if (cambio.nuevo === '') {
    document.execCommand('delete');
  } else {
    document.execCommand('insertText', false, cambio.nuevo);
  }

  // Plan B: si el navegador no ha hecho caso a execCommand, pongo el texto directamente
  // (en ese caso Ctrl+Z no lo deshará, pero al menos el botón funciona)
  if (editor.value !== textoEsperado) editor.value = textoEsperado;

  editor.setSelectionRange(cambio.seleccion[0], cambio.seleccion[1]);
  alEscribir();
}

function alPulsarHerramienta(evento) {
  const boton = evento.target.closest('button');
  if (boton) aplicarFormato(boton.dataset.accion);
}

const ATAJOS = { b: 'negrita', i: 'cursiva', k: 'enlace', e: 'codigo' };

function alPulsarTeclaEnEditor(evento) {
  // metaKey es la tecla Cmd del Mac
  const conControl = (evento.ctrlKey || evento.metaKey) && !evento.altKey && !evento.shiftKey;
  if (!conControl) return;

  const accion = ATAJOS[evento.key.toLowerCase()];
  if (!accion) return;

  // OJO: sin esto el navegador haría lo suyo con el atajo (Ctrl+K y Ctrl+E van a su buscador)
  evento.preventDefault();
  aplicarFormato(accion);
}

// ---------- Contadores ----------

function pintarContadores() {
  const texto = porId('editor').value;
  const palabras = contarPalabras(texto);
  const caracteres = contarCaracteres(texto);

  porId('contadores').textContent =
    palabras + (palabras === 1 ? ' palabra' : ' palabras') + ' · ' +
    caracteres + (caracteres === 1 ? ' carácter' : ' caracteres') + ' · ' +
    minutosDeLectura(palabras) + ' min de lectura';
}

// ---------- Autoguardado ----------

let esperaGuardado = null;

// No guardo a cada tecla: espero a que se pare de escribir medio segundo
function programarGuardado() {
  porId('estadoGuardado').textContent = 'Guardando…';
  clearTimeout(esperaGuardado);
  esperaGuardado = setTimeout(guardarDocumento, 500);
}

function guardarDocumento() {
  clearTimeout(esperaGuardado);
  const guardado = guardarDato(CLAVE_DOCUMENTO, porId('editor').value);
  porId('estadoGuardado').textContent = guardado
    ? 'Guardado en este navegador'
    : 'No se ha podido guardar. Descarga el .md para no perderlo.';
}

// Lo que había guardado, o el documento de ejemplo si es la primera vez.
// OJO: un documento vacío ("") también es un documento guardado; por eso miro
// que sea un texto y no solo que "tenga algo".
function leerDocumento() {
  const guardado = leerDato(CLAVE_DOCUMENTO);
  return typeof guardado === 'string' ? guardado : DOCUMENTO_DE_EJEMPLO;
}

// Cambio el documento entero (al arrancar, al abrir un archivo o al empezar de cero)
function ponerDocumento(texto) {
  const editor = porId('editor');
  editor.value = texto;
  editor.setSelectionRange(0, 0);
  editor.scrollTop = 0;
  pintarVista();
  pintarContadores();
}

// ---------- Avisos y confirmaciones ----------

function avisar(mensaje) {
  porId('avisoGeneral').textContent = mensaje;
  porId('avisoGeneral').hidden = mensaje === '';
}

// Abro la ventana de confirmar y espero la respuesta. Devuelvo true si aceptan.
// Los botones están dentro de un <form method="dialog">, así que al pulsarlos
// el navegador cierra la ventana y me deja en returnValue el value del botón.
function confirmar(pregunta, textoBoton) {
  const dialogo = porId('dialogoConfirmar');
  porId('textoConfirmar').textContent = pregunta;
  porId('botonConfirmar').textContent = textoBoton;

  return new Promise(function (resolver) {
    // Lo vacío antes, porque si cierran con Escape se queda el valor de la vez anterior
    dialogo.returnValue = '';
    dialogo.showModal();
    dialogo.addEventListener('close', function () {
      resolver(dialogo.returnValue === 'aceptar');
    }, { once: true });
  });
}

// ---------- Archivos ----------

// Para descargar un texto que he creado en memoria, me invento un enlace y le hago clic
function descargarTexto(texto, nombreArchivo, tipo) {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  // Le doy un momento al navegador para que arranque la descarga antes de liberar la URL
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

function descargarMarkdown() {
  const texto = porId('editor').value;
  descargarTexto(texto, nombreDeArchivo(texto) + '.md', 'text/markdown');
  avisar('');
}

function descargarHtml() {
  const texto = porId('editor').value;
  if (!hayLibrerias()) {
    avisar('Para crear el HTML hacen falta las librerías, que no se han podido cargar. El .md sí se puede descargar.');
    return;
  }
  const pagina = crearPaginaHtml(tituloDelDocumento(texto) || 'Documento', convertirMarkdown(texto));
  descargarTexto(pagina, nombreDeArchivo(texto) + '.html', 'text/html');
  avisar('');
}

async function empezarDeCero() {
  if (porId('editor').value.trim() !== '') {
    const seguro = await confirmar('¿Empezar un documento nuevo? Se borrará el texto que hay ahora. Si lo quieres conservar, descárgalo antes.', 'Empezar de cero');
    if (!seguro) return;
  }
  ponerDocumento('');
  guardarDocumento();
  avisar('');
  porId('editor').focus();
}

async function alElegirArchivo() {
  const campo = porId('campoArchivo');
  const archivo = campo.files[0];
  // Vacío el campo para que se pueda volver a elegir el mismo archivo
  campo.value = '';
  if (!archivo) return;

  if (archivo.size > TAMANO_MAXIMO_ARCHIVO) {
    avisar('El archivo pesa más de 1 MB, que es demasiado para este editor.');
    return;
  }

  let texto = '';
  try {
    texto = await archivo.text();
  } catch (error) {
    avisar('No he podido leer el archivo.');
    return;
  }

  // OJO: si alguien elige una foto o un PDF, al leerlo como texto sale basura.
  // Los archivos que no son de texto casi siempre llevan el carácter "nulo" dentro.
  if (texto.includes('\u0000')) {
    avisar('Ese archivo no parece de texto. Elige un .md o un .txt.');
    return;
  }

  if (porId('editor').value.trim() !== '') {
    const seguro = await confirmar('¿Abrir «' + archivo.name + '»? Sustituirá el texto que hay ahora.', 'Abrir');
    if (!seguro) return;
  }

  // En Windows los saltos de línea son \r\n. Los dejo todos como \n para que las cuentas cuadren.
  ponerDocumento(texto.replace(/\r\n?/g, '\n'));
  guardarDocumento();
  avisar('');
  porId('editor').focus();
}

// Ctrl+S en cualquier parte de la página descarga el .md en vez de "guardar la página web"
function alPulsarTeclaEnPagina(evento) {
  const conControl = (evento.ctrlKey || evento.metaKey) && !evento.altKey && !evento.shiftKey;
  if (conControl && evento.key.toLowerCase() === 's') {
    evento.preventDefault();
    descargarMarkdown();
  }
}

// ---------- Arranque ----------

// Espero a DOMContentLoaded para que ya estén cargados todos los archivos JS
document.addEventListener('DOMContentLoaded', arrancar);

function arrancar() {
  pintarBotonTema();
  ponerDocumento(leerDocumento());

  porId('editor').addEventListener('input', alEscribir);
  porId('editor').addEventListener('keydown', alPulsarTeclaEnEditor);
  porId('herramientas').addEventListener('click', alPulsarHerramienta);

  porId('botonNuevo').addEventListener('click', empezarDeCero);
  porId('botonAbrir').addEventListener('click', function () { porId('campoArchivo').click(); });
  porId('campoArchivo').addEventListener('change', alElegirArchivo);
  porId('botonDescargarMd').addEventListener('click', descargarMarkdown);
  porId('botonDescargarHtml').addEventListener('click', descargarHtml);
  document.addEventListener('keydown', alPulsarTeclaEnPagina);
  // Si cierran la pestaña justo después de escribir, guardo antes de que se vaya
  window.addEventListener('pagehide', guardarDocumento);

  porId('botonTema').addEventListener('click', cambiarTema);
  porId('pestanaEditor').addEventListener('click', function () { cambiarPestana('editor'); });
  porId('pestanaVista').addEventListener('click', function () { cambiarPestana('vista'); });
}
