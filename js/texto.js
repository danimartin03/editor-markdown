// Funciones que trabajan solo con texto: contar y calcular qué hay que cambiar
// cuando se pulsa un botón de la barra. No tocan la página.
//
// Las funciones de la barra reciben el texto entero y dónde empieza y acaba la
// selección, y devuelven un "cambio" con esta forma:
//   { desde, hasta, nuevo, seleccion: [inicio, fin] }
// que significa: sustituye lo que hay entre "desde" y "hasta" por "nuevo"
// y después deja seleccionado lo que hay entre "inicio" y "fin".

const PALABRAS_POR_MINUTO = 200;

// ---------- Contar ----------

// Cuento como palabra cada trozo separado por espacios que tenga alguna letra o número.
// Así los símbolos sueltos de Markdown ("#", "-", ">", "```") no cuentan.
function contarPalabras(texto) {
  const trozos = texto.split(/\s+/);
  let palabras = 0;
  for (const trozo of trozos) {
    // \p{L} es "cualquier letra" (con tildes, ñ...) y \p{N} "cualquier número"
    if (/[\p{L}\p{N}]/u.test(trozo)) palabras++;
  }
  return palabras;
}

// OJO: no uso texto.length porque un emoji cuenta como 2. Al pasarlo a lista cuenta como 1.
function contarCaracteres(texto) {
  return Array.from(texto).length;
}

// Minutos de lectura, redondeando hacia arriba (1 palabra ya es "1 min")
function minutosDeLectura(palabras) {
  return Math.ceil(palabras / PALABRAS_POR_MINUTO);
}

// ---------- Cambios de la barra de herramientas ----------

// Envuelvo la selección con una marca delante y detrás: **negrita**, _cursiva_, `código`.
// Si ya estaba envuelta, quito las marcas (así el botón funciona como un interruptor).
// Si no hay nada seleccionado, pongo un texto de ejemplo y lo dejo seleccionado
// para que se pueda escribir encima.
function envolver(texto, inicio, fin, marca, ejemplo) {
  const largo = marca.length;
  const seleccionado = texto.slice(inicio, fin);

  // OJO: compruebo que hay sitio delante (inicio >= largo). Si no, slice recibiría un
  // número negativo, que para él significa "contar desde el final", y miraría donde no es.
  const yaEnvuelto = inicio >= largo &&
    texto.slice(inicio - largo, inicio) === marca &&
    texto.slice(fin, fin + largo) === marca;
  if (yaEnvuelto) {
    return {
      desde: inicio - largo,
      hasta: fin + largo,
      nuevo: seleccionado,
      seleccion: [inicio - largo, fin - largo]
    };
  }

  const contenido = seleccionado || ejemplo;
  return {
    desde: inicio,
    hasta: fin,
    nuevo: marca + contenido + marca,
    seleccion: [inicio + largo, inicio + largo + contenido.length]
  };
}

// Pongo un prefijo al principio de cada línea tocada por la selección:
// "## " para título, "- " para lista, "> " para cita.
// Si todas las líneas ya lo tenían, lo quito.
function prefijarLineas(texto, inicio, fin, prefijo) {
  // Si la selección acaba justo después de un salto de línea, no cuento la línea siguiente
  let final = fin;
  if (final > inicio && texto[final - 1] === '\n') final--;

  // Amplío hasta el principio de la primera línea y el final de la última
  // OJO: con el cursor en la posición 0 no busco hacia atrás, porque lastIndexOf con -1
  // lo trata como 0 y, si el texto empieza por un salto de línea, se pasaría de largo.
  const desde = inicio === 0 ? 0 : texto.lastIndexOf('\n', inicio - 1) + 1;
  let hasta = texto.indexOf('\n', final);
  if (hasta === -1) hasta = texto.length;

  const lineas = texto.slice(desde, hasta).split('\n');
  const todasLoTienen = lineas.every(function (linea) { return linea.startsWith(prefijo); });
  const nuevas = lineas.map(function (linea) {
    return todasLoTienen ? linea.slice(prefijo.length) : prefijo + linea;
  });
  const nuevo = nuevas.join('\n');

  // Sin selección dejo el cursor al final de la línea para seguir escribiendo.
  // Con selección dejo seleccionadas las líneas cambiadas.
  const finalNuevo = desde + nuevo.length;
  const seleccion = inicio === fin ? [finalNuevo, finalNuevo] : [desde, finalNuevo];
  return { desde: desde, hasta: hasta, nuevo: nuevo, seleccion: seleccion };
}

// [texto](https://) — dejo seleccionado lo que falta por rellenar
function insertarEnlace(texto, inicio, fin) {
  const seleccionado = texto.slice(inicio, fin);
  const direccion = 'https://';

  if (seleccionado) {
    // Ya hay texto: selecciono la dirección para pegar el enlace encima
    const nuevo = '[' + seleccionado + '](' + direccion + ')';
    const dondeDireccion = inicio + seleccionado.length + 3;
    return { desde: inicio, hasta: fin, nuevo: nuevo, seleccion: [dondeDireccion, dondeDireccion + direccion.length] };
  }

  const ejemplo = 'texto del enlace';
  const nuevo = '[' + ejemplo + '](' + direccion + ')';
  return { desde: inicio, hasta: fin, nuevo: nuevo, seleccion: [inicio + 1, inicio + 1 + ejemplo.length] };
}

// Código: si la selección ocupa una sola línea, va entre comillas invertidas (`así`).
// Si ocupa varias, hago un bloque con tres comillas invertidas arriba y abajo.
function insertarCodigo(texto, inicio, fin) {
  const seleccionado = texto.slice(inicio, fin);
  if (!seleccionado.includes('\n')) {
    return envolver(texto, inicio, fin, '`', 'código');
  }

  // El bloque tiene que empezar y acabar en línea propia, así que añado
  // un salto antes o después solo si hace falta
  const saltoAntes = inicio > 0 && texto[inicio - 1] !== '\n' ? '\n' : '';
  const saltoDespues = fin < texto.length && texto[fin] !== '\n' ? '\n' : '';
  const apertura = saltoAntes + '```\n';
  const nuevo = apertura + seleccionado + '\n```' + saltoDespues;
  const dondeEmpieza = inicio + apertura.length;
  return { desde: inicio, hasta: fin, nuevo: nuevo, seleccion: [dondeEmpieza, dondeEmpieza + seleccionado.length] };
}

// Aplico un cambio a un texto y devuelvo el texto resultante.
// En la página no lo uso (ahí escribo en el <textarea>), pero me sirve para probar.
function aplicarCambio(texto, cambio) {
  return texto.slice(0, cambio.desde) + cambio.nuevo + texto.slice(cambio.hasta);
}

// ---------- Nombres de archivo ----------

// El texto del primer título del documento ("# Mi receta" -> "Mi receta"), o '' si no hay ninguno
function tituloDelDocumento(texto) {
  const titulo = texto.match(/^#{1,6}\s+(.+)$/m);
  return titulo ? titulo[1].trim() : '';
}

// Saco un nombre de archivo del título:
// "Mi receta de paella" -> "mi-receta-de-paella". Si no hay título, "documento".
function nombreDeArchivo(texto) {
  const limpio = tituloDelDocumento(texto)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quito las tildes
    .replace(/[^a-z0-9]+/g, '-')                      // todo lo raro pasa a guion
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return limpio || 'documento';
}
