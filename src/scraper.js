const axios = require('axios');
const cheerio = require('cheerio');

// Calcula la fecha del sorteo y construye la URL de TN
function construirURL() {
  const hoy = new Date();
  const diaSemana = hoy.getDay(); // 0 = Domingo, 3 = Miércoles
  
  let fechaSorteo = new Date(hoy);
  
  // Retroceder al último miércoles o domingo según el día actual
  if (diaSemana === 1) fechaSorteo.setDate(hoy.getDate() - 1); // Lunes → Domingo
  else if (diaSemana === 2) fechaSorteo.setDate(hoy.getDate() - 2); // Martes → Domingo
  else if (diaSemana === 4) fechaSorteo.setDate(hoy.getDate() - 1); // Jueves → Miércoles
  else if (diaSemana === 5) fechaSorteo.setDate(hoy.getDate() - 2); // Viernes → Miércoles
  else if (diaSemana === 6) fechaSorteo.setDate(hoy.getDate() - 3); // Sábado → Miércoles
  else if (diaSemana === 0 && hoy.getHours() < 21) fechaSorteo.setDate(hoy.getDate() - 4); // Domingo antes de las 21 → Miércoles
  else if (diaSemana === 3 && hoy.getHours() < 21) fechaSorteo.setDate(hoy.getDate() - 3); // Miércoles antes de las 21 → Domingo
  
  // La URL de TN usa el día siguiente al sorteo
  const fechaURL = new Date(fechaSorteo);
  fechaURL.setDate(fechaURL.getDate() + 1);
  
  const anio = fechaURL.getFullYear();
  const mes = String(fechaURL.getMonth() + 1).padStart(2, '0');
  const dia = String(fechaURL.getDate()).padStart(2, '0');
  
  const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  
  const diaSorteo = fechaSorteo.getDate();
  const mesSorteo = meses[fechaSorteo.getMonth()];
  const nombreDia = diasSemana[fechaSorteo.getDay()];
  
  return {
    url: `https://tn.com.ar/sociedad/${anio}/${mes}/${dia}/quini-6-los-resultados-de-este-${nombreDia}-${diaSorteo}-de-${mesSorteo}/`,
    fecha: fechaSorteo,
    numero: null
  };
}

async function obtenerResultadoSorteo() {
  const { url, fecha } = construirURL();
  
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
  
  // Extraer número de sorteo
  const matchSorteo = textoCompleto.match(/sorteo\s+N\.?º?\s*(\d+)/i);
  const numeroSorteo = matchSorteo ? matchSorteo[1] : 'Desconocido';
  
  // Extraer números por modalidad
  const extraerNumeros = (nombre) => {
    const regex = new RegExp(`${nombre}[\\s\\S]*?([\\d]{2}\\s*[-–—]\\s*[\\d]{2}\\s*[-–—]\\s*[\\d]{2}\\s*[-–—]\\s*[\\d]{2}\\s*[-–—]\\s*[\\d]{2}\\s*[-–—]\\s*[\\d]{2})`, 'i');
    const match = textoCompleto.match(regex);
    if (match && match[1]) {
      return match[1].replace(/[-–—\s]/g, ',').replace(/,+/g, ',').replace(/^,|,$/g, '');
    }
    return null;
  };
  
  const tradicional = extraerNumeros('Tradicional');
  const segunda = extraerNumeros('La Segunda');
  const revancha = extraerNumeros('Revancha');
  const siempreSale = extraerNumeros('Siempre Sale');
  
  if (!tradicional) {
    throw new Error('No se pudieron extraer los números. TN puede haber cambiado la estructura o el título del artículo.');
  }
  
  const fechaFormateada = `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}/${fecha.getFullYear()}`;
  
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
}

async function obtenerTodosLosSorteos() {
  const sorteo = await obtenerResultadoSorteo();
  return [sorteo];
}

module.exports = { obtenerTodosLosSorteos, obtenerResultadoSorteo };