const axios = require('axios');
const cheerio = require('cheerio');

// Fuente de datos: Nueva Rioja (o podés cambiar a El Periódico)
const URL_BUSQUEDA = 'https://www.nuevarioja.com.ar/sociedad/quini-6-resultados-los-numeros-ganadores-de-este-domingo-27-de-septiembre.htm';

// Si en el futuro querés buscar dinámicamente, habría que hacer un paso previo
// que encuentre la URL del último sorteo. Por ahora, usamos una URL fija de ejemplo.

async function obtenerResultadoSorteo() {
  try {
    const { data } = await axios.get(URL_BUSQUEDA, {
      headers: {
        // Es importante enviar un User-Agent de navegador real
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });

    const $ = cheerio.load(data);
    
    // Extraer los números de cada modalidad
    // La estructura de Nueva Rioja los pone en el texto del cuerpo
    const textoCompleto = $('body').text();
    
    // Buscar los patrones usando regex (más robusto ante pequeños cambios de HTML)
    const extraerNumeros = (nombreModalidad) => {
      // Expresión regular para encontrar la modalidad y los números que le siguen
      // Ejemplo: "Tradicional del Quini 6\n31 - 03 - 19 - 04 - 21 - 36"
      const regex = new RegExp(`${nombreModalidad}[\\s\\S]*?([\\d]{2}\\s*[-–—]\\s*[\\d]{2}\\s*[-–—]\\s*[\\d]{2}\\s*[-–—]\\s*[\\d]{2}\\s*[-–—]\\s*[\\d]{2}\\s*[-–—]\\s*[\\d]{2})`, 'i');
      const match = textoCompleto.match(regex);
      if (match && match[1]) {
        // Limpiar y normalizar los números
        return match[1].replace(/[-–—\s]/g, ',').replace(/,+/g, ',').replace(/^,|,$/g, '');
      }
      return null;
    };

    const tradicional = extraerNumeros('Tradicional');
    const segunda = extraerNumeros('La Segunda');
    const revancha = extraerNumeros('Revancha');
    const siempreSale = extraerNumeros('Siempre Sale');

    // Si no pudimos extraer nada, lanzamos un error para que el sync falle y se loguee
    if (!tradicional) {
      throw new Error('No se pudieron extraer los números del sorteo');
    }

    // Retornamos en el formato que espera tu backend (simulando el array de sorteos)
    return {
      numero: '3412', // Idealmente, esto se debería extraer de la página
      fecha: '27/09/2026', // Idealmente, extraer la fecha
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
  // Por ahora, devolvemos solo el último sorteo.
  // En una próxima mejora, se podría recorrer varias URLs para traer un historial.
  const sorteo = await obtenerResultadoSorteo();
  return [sorteo];
}

module.exports = { obtenerTodosLosSorteos, obtenerResultadoSorteo };