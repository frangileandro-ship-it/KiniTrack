const axios = require('axios');
const cheerio = require('cheerio');

const URL_LISTA = 'https://www.quini-6-resultados.com.ar/quini6/sorteos-anteriores.aspx';

async function obtenerListaSorteos() {
  const response = await axios.get(URL_LISTA);
  const $ = cheerio.load(response.data);
  const sorteos = [];

  $('div.col-md-3 p a').each((i, el) => {
    const texto = $(el).text();
    const partes = texto.split('del ');
    sorteos.push({
      numero: partes[0].replace('Sorteo ', '').trim(),
      fecha: partes[1].replace(/-/g, '/').trim(),
      link: $(el).attr('href'),
    });
  });

  return sorteos;
}

async function obtenerResultadoSorteo(numeroSorteo) {
  const lista = await obtenerListaSorteos();
  const sorteo = lista.find((s) => s.numero === numeroSorteo.toString());
  if (!sorteo) throw new Error(`No se encontró el sorteo ${numeroSorteo}`);

  const response = await axios.get(sorteo.link);
  const $ = cheerio.load(response.data);

  const extraerNumeros = (selector) => {
    return $(selector)
      .next()
      .text()
      .trim()
      .replace(/-/g, ',')
      .replace(/\s/g, '');
  };

  return {
    numero: sorteo.numero,
    fecha: sorteo.fecha,
    resultados: [
      {
        tipo: 'tradicional',
        numeros: extraerNumeros('h3:contains("SORTEO TRADICIONAL")'),
      },
      {
        tipo: 'segunda',
        numeros: extraerNumeros('h3:contains("LA SEGUNDA DEL QUINI")'),
      },
      {
        tipo: 'revancha',
        numeros: extraerNumeros('h3:contains("SORTEO REVANCHA")'),
      },
      {
        tipo: 'siempre_sale',
        numeros: extraerNumeros('h3:contains("QUE SIEMPRE SALE")'),
      },
    ],
  };
}

async function obtenerTodosLosSorteos() {
  const lista = await obtenerListaSorteos();
  const resultados = [];

  for (const sorteo of lista) {
    try {
      const data = await obtenerResultadoSorteo(parseInt(sorteo.numero));
      resultados.push(data);
    } catch (err) {
      console.error(`Error con sorteo ${sorteo.numero}:`, err.message);
    }
  }

  return resultados;
}

module.exports = { obtenerListaSorteos, obtenerResultadoSorteo, obtenerTodosLosSorteos };