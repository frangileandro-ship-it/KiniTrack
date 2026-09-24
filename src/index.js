const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { obtenerTodosLosSorteos } = require('./scraper');
const authRouter = require('./auth');
const boletasRouter = require('./boletas');
const { requireAuth } = require('./middleware');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/auth', authRouter);
app.use('/boletas', boletasRouter);

// Endpoint de prueba: verifica que la conexión a Neon funcione
app.get('/ping', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ ok: true, hora: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Convierte DD/MM/YYYY a YYYY-MM-DD
function formatearFecha(fecha) {
  const [dia, mes, anio] = fecha.split('/');
  return `${anio}-${mes}-${dia}`;
}

// Endpoint: scrapea y guarda todos los sorteos en Neon
app.post('/sync', async (req, res) => {
  try {
    const sorteos = await obtenerTodosLosSorteos();
    let insertados = 0;
    let duplicados = 0;

    for (const sorteo of sorteos) {
      for (const resultado of sorteo.resultados) {
        if (!resultado.numeros) continue;

        const result = await pool.query(
          `INSERT INTO sorteos (numero_sorteo, fecha, tipo_sorteo, numeros)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (numero_sorteo, tipo_sorteo) DO NOTHING
           RETURNING id`,
          [
            parseInt(sorteo.numero),
            formatearFecha(sorteo.fecha),
            resultado.tipo,
            resultado.numeros,
          ]
        );

        if (result.rowCount > 0) insertados++;
        else duplicados++;
      }
    }

    res.json({
      ok: true,
      message: `Sync completo: ${insertados} insertados, ${duplicados} duplicados`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Consulta las boletas del usuario contra los sorteos en un rango de fechas
app.post('/consultar', requireAuth, async (req, res) => {
  try {
    const { fecha_desde, fecha_hasta } = req.body;

    if (!fecha_desde || !fecha_hasta) {
      return res.status(400).json({
        ok: false,
        error: 'Faltan parámetros: fecha_desde, fecha_hasta',
      });
    }

    // 1. Buscar sorteos en el rango
    const sorteosResult = await pool.query(
      `SELECT TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha, tipo_sorteo, numeros, numero_sorteo
       FROM sorteos
       WHERE fecha BETWEEN $1 AND $2
       ORDER BY fecha DESC, tipo_sorteo`,
      [fecha_desde, fecha_hasta]
    );

    if (sorteosResult.rowCount === 0) {
      return res.json({
        ok: true,
        total: 0,
        resultados: [],
        message: 'No se encontraron sorteos en ese rango de fechas',
      });
    }

    // 2. Buscar boletas vigentes del usuario en el rango
    const boletasResult = await pool.query(
      `SELECT id, numeros, tipo,
              TO_CHAR(fecha_desde, 'YYYY-MM-DD') AS fecha_desde,
              TO_CHAR(fecha_hasta, 'YYYY-MM-DD') AS fecha_hasta
       FROM boletas
       WHERE user_id = $1
         AND activa = TRUE
         AND fecha_desde <= $3
         AND (fecha_hasta IS NULL OR fecha_hasta >= $2)`,
      [req.userId, fecha_desde, fecha_hasta]
    );

    if (boletasResult.rowCount === 0) {
      return res.json({
        ok: true,
        total: 0,
        resultados: [],
        message: 'No tenés boletas vigentes en ese rango de fechas',
      });
    }

    // 3. Agrupar sorteos por fecha para calcular el Premio Extra
    const sorteosPorFecha = {};
    sorteosResult.rows.forEach((s) => {
      if (!sorteosPorFecha[s.fecha]) sorteosPorFecha[s.fecha] = [];
      sorteosPorFecha[s.fecha].push(s);
    });

    // Números únicos del Extra por fecha (Tradicional + Segunda + Revancha)
    const numerosExtraPorFecha = {};
    Object.keys(sorteosPorFecha).forEach((fecha) => {
      const set = new Set();
      sorteosPorFecha[fecha]
        .filter((s) => ['tradicional', 'segunda', 'revancha'].includes(s.tipo_sorteo))
        .forEach((s) => {
          s.numeros.split(',').forEach((n) => set.add(n.trim()));
        });
      numerosExtraPorFecha[fecha] = Array.from(set);
    });

    // 4. Cruzar: por cada boleta × cada sorteo
    const resultados = [];
    for (const boleta of boletasResult.rows) {
      const numerosBoleta = boleta.numeros.split(',').map((n) => n.trim());

      for (const sorteo of sorteosResult.rows) {
        const sorteados = sorteo.numeros.split(',').map((n) => n.trim());
        const acertados = numerosBoleta.filter((n) => sorteados.includes(n));

        const numsExtra = numerosExtraPorFecha[sorteo.fecha] || [];
        const aciertosExtra = numerosBoleta.filter((n) => numsExtra.includes(n)).length;

        resultados.push({
          boleta_id: boleta.id,
          boleta_tipo: boleta.tipo,
          fecha: sorteo.fecha,
          numero_sorteo: sorteo.numero_sorteo,
          tipo_sorteo: sorteo.tipo_sorteo,
          numeros_sorteados: sorteo.numeros,
          aciertos: acertados.length,
          numeros_acertados: acertados,
          aciertos_extra: aciertosExtra,
        });
      }
    }

    res.json({
      ok: true,
      total: resultados.length,
      message: `Se encontraron ${sorteosResult.rowCount} sorteos y ${boletasResult.rowCount} boletas vigentes`,
      resultados,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});