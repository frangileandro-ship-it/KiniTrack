const axios = require('axios');
const Optiic = require('optiic');

// Configuración desde variables de entorno
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const OPTIIC_API_KEY = process.env.OPTIIC_API_KEY;

const optiic = new Optiic({ apiKey: OPTIIC_API_KEY });

// URL de la página oficial de Lotería de Santa Fe
const URL_LOTERIA = 'https://www.loteriasantafe.gov.ar/quini-6-2/';

async function obtenerResultadoSorteo() {
  try {
    // 1. Pedir a Cloudflare que saque una foto de la página
    console.log('Solicitando screenshot a Cloudflare...');
    const screenshotResponse = await axios.post(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/browser-rendering/screenshot`,
      {
        url: URL_LOTERIA,
        gotoOptions: {
          waitUntil: 'networkidle0' // Espera a que cargue todo el JavaScript
        },
        viewport: {
          width: 1280,
          height: 900
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer' // La respuesta es una imagen binaria
      }
    );

    // 2. Convertir la imagen a base64 para Optiic
    const imageBase64 = Buffer.from(screenshotResponse.data, 'binary').toString('base64');
    const imageDataUrl = `data:image/png;base64,${imageBase64}`;
    console.log('Screenshot obtenido. Procesando con OCR...');

    // 3. Enviar la imagen a Optiic para extraer el texto
    const ocrResult = await optiic.process({
      url: imageDataUrl,
      mode: 'ocr',
      language: 'es' // Español
    });

    const textoCompleto = ocrResult.text;
    console.log('Texto extraído por OCR:', textoCompleto.substring(0, 200) + '...');

    // 4. Extraer los números de cada modalidad del texto
    const extraerNumeros = (nombre) => {
      // Busca el nombre de la modalidad seguido de 6 números de 2 dígitos
      const regex = new RegExp(
        `${nombre}[\\s\\S]*?([\\d]{2}[\\s,;.-]+[\\d]{2}[\\s,;.-]+[\\d]{2}[\\s,;.-]+[\\d]{2}[\\s,;.-]+[\\d]{2}[\\s,;.-]+[\\d]{2})`,
        'i'
      );
      const match = textoCompleto.match(regex);
      if (match && match[1]) {
        return match[1].replace(/[^\d]/g, ',').replace(/,+/g, ',').replace(/^,|,$/g, '');
      }
      return null;
    };

    const tradicional = extraerNumeros('Tradicional');
    const segunda = extraerNumeros('La Segunda');
    const revancha = extraerNumeros('Revancha');
    const siempreSale = extraerNumeros('Siempre Sale');

    if (!tradicional) {
      throw new Error('No se pudieron extraer los números. El OCR puede haber fallado o la página no cargó bien.');
    }

    // 5. Extraer número de sorteo (opcional)
    const matchSorteo = textoCompleto.match(/sorteo\s+N\.?º?\s*(\d+)/i);
    const numeroSorteo = matchSorteo ? matchSorteo[1] : 'Desconocido';

    // 6. Calcular fecha del último sorteo
    const hoy = new Date();
    const diaSemana = hoy.getDay();
    let fechaSorteo = new Date(hoy);
    if (diaSemana === 1) fechaSorteo.setDate(hoy.getDate() - 1);
    else if (diaSemana === 2) fechaSorteo.setDate(hoy.getDate() - 2);
    else if (diaSemana === 4) fechaSorteo.setDate(hoy.getDate() - 1);
    else if (diaSemana === 5) fechaSorteo.setDate(hoy.getDate() - 2);
    else if (diaSemana === 6) fechaSorteo.setDate(hoy.getDate() - 3);
    else if (diaSemana === 0 && hoy.getHours() < 21) fechaSorteo.setDate(hoy.getDate() - 4);
    else if (diaSemana === 3 && hoy.getHours() < 21) fechaSorteo.setDate(hoy.getDate() - 3);

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

async function obtenerTodosLosSorteos() {
  const sorteo = await obtenerResultadoSorteo();
  return [sorteo];
}

module.exports = { obtenerTodosLosSorteos, obtenerResultadoSorteo };