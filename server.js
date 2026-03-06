require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer'); // Nueva librería para archivos
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuración para guardar archivos subidos (Fotos de ID)
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

const dbConfig = {
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};
const pool = mysql.createPool(dbConfig);

// --- RUTA: REGISTRO CON ARCHIVO ---
// upload.single('documento_archivo') atrapa la imagen que envía el frontend
app.post('/api/registro', upload.single('documento_archivo'), async (req, res) => {
  try {
    const { nombre, apellido, fecha_nacimiento, telefono, tipo_doc, num_doc, email, password } = req.body;
    
    // Si se subió un archivo, guardamos su ruta, si no, null
    const documento_url = req.file ? `/uploads/${req.file.filename}` : null;

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const clave_hash = await bcrypt.hash(password, salt);

    const query = `
      INSERT INTO usuarios (codigo, nombre, apellido, fecha_nacimiento, telefono, tipo_documento, numero_documento, documento_url, email, clave_hash, estado_kyc)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE')
    `;
    
    await pool.execute(query, [codigo, nombre, apellido, fecha_nacimiento, telefono, tipo_doc, num_doc, documento_url, email, clave_hash]);

    console.log(`✅ Nuevo usuario registrado con documento: ${email}`);
    res.status(201).json({ exito: true, mensaje: 'Usuario registrado exitosamente' });

  } catch (error) {
    console.error('❌ Error en registro:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.message.includes('email')) return res.status(400).json({ exito: false, mensaje: 'El correo ya está registrado.' });
      if (error.message.includes('numero_documento')) return res.status(400).json({ exito: false, mensaje: 'Este documento ya está registrado.' });
    }
    res.status(500).json({ exito: false, mensaje: 'Error interno del servidor.' });
  }
});

// --- RUTA: LOGIN (Sirve para Clientes y Admins) ---
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.execute('SELECT * FROM usuarios WHERE email = ?', [email]);
    
    if (rows.length === 0) return res.status(401).json({ exito: false, mensaje: 'Correo o contraseña incorrectos.' });

    const usuario = rows[0];
    const passwordValida = await bcrypt.compare(password, usuario.clave_hash);
    
    if (!passwordValida) return res.status(401).json({ exito: false, mensaje: 'Correo o contraseña incorrectos.' });

    res.json({
      exito: true,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        rol: usuario.rol,
        saldo: usuario.saldo_disponible,
        estado_kyc: usuario.estado_kyc
      }
    });
  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({ exito: false, mensaje: 'Error del servidor.' });
  }
});

// --- RUTAS ADMINISTRATIVAS (Básicas para empezar) ---
app.get('/api/admin/stats', async (req, res) => {
  try {
    const [pendientes] = await pool.query("SELECT COUNT(*) as total FROM usuarios WHERE estado_kyc = 'PENDIENTE'");
    const [clientes] = await pool.query("SELECT COUNT(*) as total FROM usuarios WHERE rol = 'CLIENTE'");
    res.json({ exito: true, kyc_pendientes: pendientes[0].total, total_clientes: clientes[0].total });
  } catch (error) {
    res.status(500).json({ exito: false });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));