const axios = require('axios');
const cheerio = require('cheerio');

// Función para obtener la fecha del último sorteo (miércoles o domingo)
function obtenerFechaUltimoSorteo() {
  const hoy = new Date();
  const diaSemana = hoy.getDay(); // 0 = Domingo, 3 = Miércoles

  // Si hoy es lunes o martes, el último sorteo fue el domingo.
  // Si es jueves o viernes, fue el miércoles.
  // Si es miércoles o domingo, puede ser hoy o el anterior, dependiendo de la hora.
  
  let fechaSorteo = new Date(hoy);
  
  if (diaSemana === 1 || diaSemana === 2) { // Lunes o Martes
    // Retroceder al domingo
    fechaSorteo.setDate(hoy.getDate() - (diaSemana === 1 ? 1 : 2));
  } else if (diaSemana === 4 || diaSemana === 5) { // Jueves o Viernes
    // Retroceder al miércoles
    fechaSorteo.setDate(hoy.getDate() - (diaSemana === 4 ? 1 : 2));
  } else if (diaSemana === 6) { // Sábado
    // El último sorteo fue el miércoles
    fechaSorteo.setDate(hoy.getDate() - 3);
  } else if (diaSemana === 0) { // Domingo
    // El sorteo es hoy, pero a las 21:15. Si es antes, el último fue el miércoles.
    if (hoy.getHours() < 21) {
      fechaSorteo.setDate(hoy.getDate() - 4);
    }
  } else if (diaSemana === 3) { // Miércoles
    // El sorteo es hoy. Si es antes de las 21:15, el último fue el domingo.
    if (hoy.getHours() < 21) {
      fechaSorteo.setDate(hoy.getDate() - 3);
    }
  }
  
  return fechaSorteo;
}

// Formatea la fecha a YYYY/MM/DD
function formatearFechaParaURL(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}/${mes}/${dia}`;
}

async function obtenerResultadoSorteo() {
  try {
    // 1. Calcular la fecha del último sorteo
    const fechaSorteo = obtenerFechaUltimoSorteo();
    // La URL de TN usa la fecha del día siguiente al sorteo
    const fechaURL = new Date(fechaSorteo);
    fechaURL.setDate(fechaURL.getDate() + 1); 
    
    const fechaStr = formatearFechaParaURL(fechaURL);
    
    // 2. Construir la URL base (asumiendo que el slug es predecible, pero puede variar)
    // Esta es la parte más frágil. Necesitamos encontrar la URL exacta.
    // Para este ejemplo, usaremos una URL base y asumiremos un patrón.
    // En una implementación real, se debería scrapear la sección de TN para encontrar el enlace.
    // Por ahora, usaremos una URL de ejemplo del sorteo del 30/09 para probar la extracción.
    // La URL real sería algo como: https://tn.com.ar/sociedad/2026/10/01/quini-6-...
    
    // Para hacer esto robusto, necesitamos una página de índice.
    // Como no la tenemos, usaremos una URL de ejemplo para el sorteo del 30/09.
    // En producción, esto debería ser reemplazado por una búsqueda en el sitio de TN.
    const url = `https://tn.com.ar/sociedad/${fechaStr}/quini-6-los-resultados-de-este-miercoles-30-de-septiembre/`;
    
    console.log(`Buscando resultados en: ${url}`);

    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      }
    });

    const $ = cheerio.load(data);
    const textoCompleto = $('body').text();

    // 3. Extraer los números de cada modalidad usando regex
    const extraerNumeros = (nombreModalidad) => {
      // Busca la modalidad seguida de 6 números separados por guiones o espacios
      const regex = new RegExp(`${nombreModalidad}[\\s\\S]*?([\\d]{2}\\s*[-–—]\\s*[\\d]{2}\\s*[-–—]\\s*[\\d]{2}\\s*[-–—]\\s*[\\d]{2}\\s*[-–—]\\s*[\\d]{2}\\s*[-–—]\\s*[\\d]{2})`, 'i');
      const match = textoCompleto.match(regex);
      if (match && match[1]) {
        // Limpiar y normalizar los números a formato "XX,XX,XX,XX,XX,XX"
        return match[1].replace(/[-–—\s]/g, ',').replace(/,+/g, ',').replace(/^,|,$/g, '');
      }
      return null;
    };

    // Los títulos en TN son: "Tradicional", "La Segunda", "Revancha", "Siempre Sale"
    const tradicional = extraerNumeros('Tradicional');
    const segunda = extraerNumeros('La Segunda');
    const revancha = extraerNumeros('Revancha');
    const siempreSale = extraerNumeros('Siempre Sale');

    if (!tradicional) {
      throw new Error('No se pudieron extraer los números del sorteo. La estructura de la página puede haber cambiado o la URL es incorrecta.');
    }

    // 4. Extraer el número de sorteo y la fecha (opcional pero recomendado)
    // El número de sorteo suele estar en el texto como "sorteo N.º XXXX"
    const regexSorteo = /sorteo\s+N\.?º?\s*(\d+)/i;
    const matchSorteo = textoCompleto.match(regexSorteo);
    const numeroSorteo = matchSorteo ? matchSorteo[1] : 'Desconocido';

    // La fecha la podemos obtener del objeto Date que calculamos
    const fechaFormateada = `${String(fechaSorteo.getDate()).padStart(2, '0')}/${String(fechaSorteo.getMonth() + 1).padStart(2, '0')}/${fechaSorteo.getFullYear()}`;

    return {
      numero: numeroSorteo,
      fecha: fechaFormateada,
      resultados: [
        { tipo: 'tradicional', numeros: tradicional },
        { tipo: 'segunda', numeros: segunda },
        { tipo: 'revancha', numeros: revancha },
        { tipo: 'siempre_sale', numeros: siempreSale }
      ]
    };
  } catch (error) {
    console.error('Error en el scraper:', error.message);
    throw error;
  }
}

// Esta función es la que llama tu endpoint /sync
async function obtenerTodosLosSorteos() {
  // Devolvemos solo el último sorteo.
  // Si quisieras un historial, podrías hacer un bucle con fechas anteriores.
  const sorteo = await obtenerResultadoSorteo();
  return [sorteo];
}

module.exports = { obtenerTodosLosSorteos, obtenerResultadoSorteo };