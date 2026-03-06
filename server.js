require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de la base de datos (Pool)
const dbConfig = {
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};
const pool = mysql.createPool(dbConfig);

// Ruta API: REGISTRO
app.post('/api/registro', async (req, res) => {
  try {
    const { nombre, apellido, fecha_nacimiento, telefono, tipo_doc, num_doc, email, password } = req.body;

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const clave_hash = await bcrypt.hash(password, salt);

    const query = `
      INSERT INTO usuarios (codigo, nombre, apellido, fecha_nacimiento, telefono, tipo_documento, numero_documento, email, clave_hash, estado_kyc)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE')
    `;
    
    await pool.execute(query, [codigo, nombre, apellido, fecha_nacimiento, telefono, tipo_doc, num_doc, email, clave_hash]);

    console.log(`✅ Nuevo usuario registrado: ${email}`);
    res.status(201).json({ exito: true, mensaje: 'Usuario registrado exitosamente' });

  } catch (error) {
    console.error('❌ Error en registro:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.message.includes('email')) {
        return res.status(400).json({ exito: false, mensaje: 'El correo electrónico ya está registrado.' });
      } else if (error.message.includes('numero_documento')) {
        return res.status(400).json({ exito: false, mensaje: 'Este documento de identidad ya está registrado.' });
      }
    }
    res.status(500).json({ exito: false, mensaje: 'Error interno del servidor.' });
  }
});

// Ruta API: LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.execute('SELECT * FROM usuarios WHERE email = ?', [email]);
    
    if (rows.length === 0) {
      return res.status(401).json({ exito: false, mensaje: 'Correo o contraseña incorrectos.' });
    }

    const usuario = rows[0];
    const passwordValida = await bcrypt.compare(password, usuario.clave_hash);
    
    if (!passwordValida) {
      return res.status(401).json({ exito: false, mensaje: 'Correo o contraseña incorrectos.' });
    }

    console.log(`✅ Ingreso exitoso: ${usuario.email}`);
    // Devolvemos todos los datos necesarios para el dashboard
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
    res.status(500).json({ exito: false, mensaje: 'Error interno del servidor.' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});