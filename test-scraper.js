const { obtenerResultadoSorteo } = require('./src/scraper');

obtenerResultadoSorteo(3411)
  .then((data) => {
    console.log(JSON.stringify(data, null, 2));
  })
  .catch((err) => {
    console.error('Error:', err.message);
  });