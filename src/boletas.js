const express = require('express');
const pool = require('./db');
const { requireAuth } = require('./middleware');

const router = express.Router();
router.use(requireAuth); // todos los endpoints de este router requieren login

// GET /boletas — lista todas las boletas del usuario
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, numeros, tipo, TO_CHAR(fecha_desde, 'YYYY-MM-DD') AS fecha_desde,
              TO_CHAR(fecha_hasta, 'YYYY-MM-DD') AS fecha_hasta, activa, created_at
       FROM boletas
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json({ ok: true, boletas: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /boletas — crea una boleta nueva
router.post('/', async (req, res) => {
  try {
    const { numeros, tipo, fecha_desde, fecha_hasta } = req.body;

    if (!numeros || !tipo || !fecha_desde) {
      return res.status(400).json({ ok: false, error: 'Faltan numeros, tipo o fecha_desde' });
    }
    if (!['fija', 'del_dia'].includes(tipo)) {
      return res.status(400).json({ ok: false, error: 'tipo debe ser "fija" o "del_dia"' });
    }

    // Valida que sean 6 números entre 00 y 45
    const nums = numeros.split(',').map((n) => n.trim().padStart(2, '0'));
    if (nums.length !== 6) {
      return res.status(400).json({ ok: false, error: 'Deben ser exactamente 6 números' });
    }
    for (const n of nums) {
      const num = parseInt(n);
      if (isNaN(num) || num < 0 || num > 45) {
        return res.status(400).json({ ok: false, error: `Número inválido: ${n}` });
      }
    }
    const numerosNormalizados = nums.join(',');

    const result = await pool.query(
      `INSERT INTO boletas (user_id, numeros, tipo, fecha_desde, fecha_hasta)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, numeros, tipo,
                 TO_CHAR(fecha_desde, 'YYYY-MM-DD') AS fecha_desde,
                 TO_CHAR(fecha_hasta, 'YYYY-MM-DD') AS fecha_hasta,
                 activa`,
      [req.userId, numerosNormalizados, tipo, fecha_desde, fecha_hasta || null]
    );

    res.json({ ok: true, boleta: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /boletas/:id — edita una boleta
router.put('/:id', async (req, res) => {
  try {
    const { numeros, tipo, fecha_desde, fecha_hasta, activa } = req.body;

    const result = await pool.query(
      `UPDATE boletas
       SET numeros = COALESCE($1, numeros),
           tipo = COALESCE($2, tipo),
           fecha_desde = COALESCE($3, fecha_desde),
           fecha_hasta = $4,
           activa = COALESCE($5, activa)
       WHERE id = $6 AND user_id = $7
       RETURNING id, numeros, tipo,
                 TO_CHAR(fecha_desde, 'YYYY-MM-DD') AS fecha_desde,
                 TO_CHAR(fecha_hasta, 'YYYY-MM-DD') AS fecha_hasta,
                 activa`,
      [numeros, tipo, fecha_desde, fecha_hasta || null, activa, req.params.id, req.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Boleta no encontrada' });
    }

    res.json({ ok: true, boleta: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /boletas/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM boletas WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Boleta no encontrada' });
    }

    res.json({ ok: true, message: 'Boleta eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;