require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'public/uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, 'DOC-' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

const pool = mysql.createPool({ uri: process.env.DATABASE_URL, waitForConnections: true, connectionLimit: 10, queueLimit: 0 });

// --- 1. AUTENTICACIÓN ---
app.post('/api/registro', upload.single('documento_archivo'), async (req, res) => {
  try {
    const { nombre, apellido, fecha_nacimiento, telefono, tipo_doc, num_doc, email, password } = req.body;
    const documento_url = req.file ? `/uploads/${req.file.filename}` : null;
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const clave_hash = await bcrypt.hash(password, await bcrypt.genSalt(10));
    await pool.execute(
      `INSERT INTO usuarios (codigo, nombre, apellido, fecha_nacimiento, telefono, tipo_documento, numero_documento, documento_url, email, clave_hash, estado_kyc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE')`,
      [codigo, nombre, apellido, fecha_nacimiento, telefono, tipo_doc, num_doc, documento_url, email, clave_hash]
    );
    res.status(201).json({ exito: true, mensaje: 'Usuario registrado' });
  } catch (error) { res.status(500).json({ exito: false, mensaje: error.message }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.execute('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (rows.length === 0 || !(await bcrypt.compare(password, rows[0].clave_hash))) return res.status(401).json({ exito: false, mensaje: 'Datos incorrectos.' });
    const u = rows[0];
    res.json({ exito: true, usuario: { id: u.id, nombre: u.nombre, apellido: u.apellido, email: u.email, rol: u.rol, saldo: u.saldo_disponible, estado_kyc: u.estado_kyc } });
  } catch (error) { res.status(500).json({ exito: false }); }
});

// Ruta para refrescar datos del usuario (saldo, kyc, etc)
app.get('/api/usuario/:id', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id, nombre, apellido, email, rol, saldo_disponible as saldo, estado_kyc FROM usuarios WHERE id = ?', [req.params.id]);
        res.json({ exito: true, usuario: rows[0] });
    } catch (error) { res.status(500).json({ exito: false }); }
});

// --- 2. FINANZAS (CLIENTE Y ADMIN) ---
app.post('/api/cliente/deposito', async (req, res) => {
    try {
        const { usuario_id, monto, metodo, referencia } = req.body;
        await pool.query("INSERT INTO transacciones (usuario_id, tipo, metodo, monto_usd, referencia, estado) VALUES (?, 'DEPOSITO', ?, ?, ?, 'PENDIENTE')", [usuario_id, metodo, monto, referencia]);
        res.json({ exito: true, mensaje: 'Depósito reportado exitosamente.' });
    } catch (error) { res.status(500).json({ exito: false, mensaje: error.message }); }
});

app.get('/api/admin/finanzas/lista', async (req, res) => {
    try {
        const estado = req.query.estado || 'PENDIENTE';
        let query = `
            SELECT t.id, t.monto_usd, t.metodo, t.referencia, t.estado, DATE_FORMAT(t.fecha, '%d/%m/%Y %H:%i') as fecha_formato, u.nombre, u.apellido 
            FROM transacciones t JOIN usuarios u ON t.usuario_id = u.id `;
        
        if(estado !== 'TODOS') query += ` WHERE t.estado = '${estado}' `;
        query += ` ORDER BY t.fecha DESC LIMIT 50`;
        
        const [rows] = await pool.query(query);
        res.json({ exito: true, transacciones: rows });
    } catch (error) { res.status(500).json({ exito: false }); }
});

app.post('/api/admin/finanzas/procesar', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { transaccion_id, accion, admin_id } = req.body;
        await connection.beginTransaction();
        const [txs] = await connection.query("SELECT * FROM transacciones WHERE id = ?", [transaccion_id]);
        const tx = txs[0];
        if(tx.estado !== 'PENDIENTE') throw new Error("Ya procesada.");

        if (accion === 'APROBAR') {
            await connection.query("UPDATE transacciones SET estado = 'APROBADO', fecha_aprobacion = NOW(), aprobado_por = ? WHERE id = ?", [admin_id, transaccion_id]);
            await connection.query("UPDATE usuarios SET saldo_disponible = saldo_disponible + ? WHERE id = ?", [tx.monto_usd, tx.usuario_id]);
        } else {
            await connection.query("UPDATE transacciones SET estado = 'RECHAZADO', aprobado_por = ? WHERE id = ?", [admin_id, transaccion_id]);
        }
        await connection.commit();
        res.json({ exito: true, mensaje: 'Procesado correctamente.' });
    } catch (error) { await connection.rollback(); res.status(500).json({ exito: false, mensaje: error.message }); }
    finally { connection.release(); }
});

// --- 3. SORTEOS (REALES) ---
app.get('/api/public/sorteos-activos', async (req, res) => {
    try {
        // Obtenemos sorteos cuya fecha sea mayor a "ahora"
        const [rows] = await pool.query("SELECT s.id, j.nombre as loteria, s.fecha_sorteo, s.premio_mayor FROM sorteos s JOIN tipos_juego j ON s.juego_id = j.id WHERE s.fecha_sorteo > NOW() ORDER BY s.fecha_sorteo ASC");
        res.json({ exito: true, sorteos: rows });
    } catch (error) { res.status(500).json({ exito: false }); }
});

app.post('/api/admin/crear-sorteo', async (req, res) => {
    try {
        const { juego_id, fecha_sorteo, premio_mayor } = req.body;
        await pool.query("INSERT INTO sorteos (juego_id, fecha_sorteo, premio_mayor) VALUES (?, ?, ?)", [juego_id, fecha_sorteo, premio_mayor]);
        res.json({ exito: true, mensaje: 'Sorteo programado.' });
    } catch (error) { res.status(500).json({ exito: false }); }
});

// --- 4. ADMIN: ESTADÍSTICAS Y KYC ---
app.get('/api/admin/stats', async (req, res) => {
  try {
    const [kyc] = await pool.query("SELECT COUNT(*) as t FROM usuarios WHERE estado_kyc = 'PENDIENTE'");
    const [cli] = await pool.query("SELECT COUNT(*) as t FROM usuarios WHERE rol = 'CLIENTE'");
    const [dep] = await pool.query("SELECT COUNT(*) as t FROM transacciones WHERE estado = 'PENDIENTE' AND tipo = 'DEPOSITO'");
    res.json({ exito: true, kyc_pendientes: kyc[0].t, total_clientes: cli[0].t, dep_pendientes: dep[0].t });
  } catch (error) { res.status(500).json({ exito: false }); }
});

app.get('/api/admin/kyc-pendientes', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, nombre, apellido, email, telefono, tipo_documento, numero_documento, documento_url, DATE_FORMAT(creado_en, '%d/%m/%Y') as fecha FROM usuarios WHERE estado_kyc = 'PENDIENTE' AND rol = 'CLIENTE'");
    res.json({ exito: true, usuarios: rows });
  } catch (error) { res.status(500).json({ exito: false }); }
});

app.post('/api/admin/aprobar-kyc', async (req, res) => {
  try {
    await pool.query("UPDATE usuarios SET estado_kyc = 'APROBADO', fecha_aprobacion = NOW(), aprobado_por = ? WHERE id = ?", [req.body.admin_id, req.body.usuario_id]);
    res.json({ exito: true, mensaje: 'KYC Aprobado.' });
  } catch (error) { res.status(500).json({ exito: false }); }
});

app.get('/api/admin/clientes', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, nombre, apellido, email, numero_documento, saldo_disponible, estado_kyc FROM usuarios WHERE rol = 'CLIENTE' ORDER BY creado_en DESC");
    res.json({ exito: true, clientes: rows });
  } catch (error) { res.status(500).json({ exito: false }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 SafeTicket Server on ${PORT}`));