// Aquí va todo lo que toca la página: paneles, barra de herramientas, atajos y archivos.

const CLAVE_TEMA = 'editor-markdown:tema';

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
  esperaVista = setTimeout(pintarVista, 120);
}

// ---------- Arranque ----------

// Espero a DOMContentLoaded para que ya estén cargados todos los archivos JS
document.addEventListener('DOMContentLoaded', arrancar);

function arrancar() {
  pintarBotonTema();
  porId('editor').value = DOCUMENTO_DE_EJEMPLO;
  pintarVista();

  porId('editor').addEventListener('input', alEscribir);

  porId('botonTema').addEventListener('click', cambiarTema);
  porId('pestanaEditor').addEventListener('click', function () { cambiarPestana('editor'); });
  porId('pestanaVista').addEventListener('click', function () { cambiarPestana('vista'); });
}
