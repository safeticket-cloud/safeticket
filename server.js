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

// Configuración para subir imágenes
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'public/uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, 'DOC-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

const dbConfig = { uri: process.env.DATABASE_URL, waitForConnections: true, connectionLimit: 10, queueLimit: 0 };
const pool = mysql.createPool(dbConfig);

// --- 1. REGISTRO Y LOGIN ---
app.post('/api/registro', upload.single('documento_archivo'), async (req, res) => {
  try {
    const { nombre, apellido, fecha_nacimiento, telefono, tipo_doc, num_doc, email, password } = req.body;
    const documento_url = req.file ? `/uploads/${req.file.filename}` : null;
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const clave_hash = await bcrypt.hash(password, salt);

    const query = `INSERT INTO usuarios (codigo, nombre, apellido, fecha_nacimiento, telefono, tipo_documento, numero_documento, documento_url, email, clave_hash, estado_kyc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE')`;
    await pool.execute(query, [codigo, nombre, apellido, fecha_nacimiento, telefono, tipo_doc, num_doc, documento_url, email, clave_hash]);
    res.status(201).json({ exito: true, mensaje: 'Usuario registrado' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ exito: false, mensaje: 'Datos duplicados (Correo o Documento ya existen).' });
    res.status(500).json({ exito: false, mensaje: 'Error del servidor.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.execute('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(401).json({ exito: false, mensaje: 'Datos incorrectos.' });
    
    const usuario = rows[0];
    const passwordValida = await bcrypt.compare(password, usuario.clave_hash);
    if (!passwordValida) return res.status(401).json({ exito: false, mensaje: 'Datos incorrectos.' });

    res.json({
      exito: true,
      usuario: { id: usuario.id, nombre: usuario.nombre, apellido: usuario.apellido, email: usuario.email, rol: usuario.rol, saldo: usuario.saldo_disponible, estado_kyc: usuario.estado_kyc }
    });
  } catch (error) { res.status(500).json({ exito: false, mensaje: 'Error del servidor.' }); }
});

// --- 2. RUTAS ADMIN: ESTADÍSTICAS Y KYC ---
app.get('/api/admin/stats', async (req, res) => {
  try {
    const [pendientes] = await pool.query("SELECT COUNT(*) as total FROM usuarios WHERE estado_kyc = 'PENDIENTE'");
    const [clientes] = await pool.query("SELECT COUNT(*) as total FROM usuarios WHERE rol = 'CLIENTE'");
    res.json({ exito: true, kyc_pendientes: pendientes[0].total, total_clientes: clientes[0].total });
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
    const { usuario_id, admin_id } = req.body;
    await pool.query("UPDATE usuarios SET estado_kyc = 'APROBADO', fecha_aprobacion = NOW(), aprobado_por = ? WHERE id = ?", [admin_id, usuario_id]);
    res.json({ exito: true, mensaje: 'Identidad validada exitosamente.' });
  } catch (error) { res.status(500).json({ exito: false }); }
});

// --- 3. RUTAS ADMIN: GESTIÓN DE CLIENTES Y STAFF ---
app.get('/api/admin/clientes', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, codigo, nombre, apellido, email, saldo_disponible, estado_kyc, DATE_FORMAT(creado_en, '%d/%m/%Y') as fecha FROM usuarios WHERE rol = 'CLIENTE' ORDER BY creado_en DESC");
    res.json({ exito: true, clientes: rows });
  } catch (error) { res.status(500).json({ exito: false }); }
});

app.post('/api/admin/crear-staff', async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;
    const salt = await bcrypt.genSalt(10);
    const clave_hash = await bcrypt.hash(password, salt);
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const doc_falso = 'STAFF-' + codigo; // Para saltar la validación única

    await pool.query(`INSERT INTO usuarios (codigo, nombre, apellido, fecha_nacimiento, email, clave_hash, rol, estado_kyc, tipo_documento, numero_documento) VALUES (?, ?, '', '1990-01-01', ?, ?, ?, 'APROBADO', 'CEDULA', ?)`, [codigo, nombre, email, clave_hash, rol, doc_falso]);
    res.json({ exito: true, mensaje: 'Usuario del equipo creado exitosamente.' });
  } catch (error) { res.status(500).json({ exito: false, mensaje: error.message }); }
});

// --- 4. RUTAS ADMIN: SORTEOS (Para los contadores) ---
app.get('/api/admin/sorteos', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT s.id, j.nombre as loteria, DATE_FORMAT(s.fecha_sorteo, '%Y-%m-%dT%H:%i') as fecha, s.premio_mayor FROM sorteos s JOIN tipos_juego j ON s.juego_id = j.id ORDER BY s.fecha_sorteo DESC");
    res.json({ exito: true, sorteos: rows });
  } catch (error) { res.status(500).json({ exito: false }); }
});

app.post('/api/admin/crear-sorteo', async (req, res) => {
  try {
    const { juego_id, fecha_sorteo, premio_mayor } = req.body;
    await pool.query("INSERT INTO sorteos (juego_id, fecha_sorteo, premio_mayor) VALUES (?, ?, ?)", [juego_id, fecha_sorteo, premio_mayor]);
    res.json({ exito: true, mensaje: 'Sorteo programado en el sistema.' });
  } catch (error) { res.status(500).json({ exito: false, mensaje: error.message }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));