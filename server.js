require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise'); // Usamos promise para que sea más rápido y moderno
const path = require('path');
const bcrypt = require('bcryptjs'); // La nueva librería de seguridad

const app = express();

// Middleware: Le dice al servidor que entienda los datos que llegan de los formularios HTML
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. Configurar conexión a la Base de Datos (Pool es mejor para múltiples usuarios)
const dbConfig = {
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};
const pool = mysql.createPool(dbConfig);

// 2. LA MAGIA: Ruta API para registrar usuarios
app.post('/api/registro', async (req, res) => {
  try {
    // Añadimos tipo_doc y num_doc
    const { nombre, apellido, fecha_nacimiento, telefono, tipo_doc, num_doc, email, password } = req.body;

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const clave_hash = await bcrypt.hash(password, salt);

    // Actualizamos el INSERT para incluir los nuevos campos
    const query = `
      INSERT INTO usuarios (codigo, nombre, apellido, fecha_nacimiento, telefono, tipo_documento, numero_documento, email, clave_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await pool.execute(query, [codigo, nombre, apellido, fecha_nacimiento, telefono, tipo_doc, num_doc, email, clave_hash]);

    console.log(`✅ Nuevo usuario registrado: ${email}`);
    res.status(201).json({ exito: true, mensaje: 'Usuario registrado exitosamente' });

  } catch (error) {
    console.error('❌ Error en registro:', error);
    // Verificamos EXACTAMENTE qué se duplicó
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

// Ruta API para Iniciar Sesión (Login)
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Buscar si el correo existe en la base de datos
    const [rows] = await pool.execute('SELECT * FROM usuarios WHERE email = ?', [email]);
    
    if (rows.length === 0) {
      return res.status(401).json({ exito: false, mensaje: 'Correo o contraseña incorrectos.' });
    }

    const usuario = rows[0];

    // 2. Comparar la contraseña escrita con la encriptada en MySQL
    const passwordValida = await bcrypt.compare(password, usuario.clave_hash);
    
    if (!passwordValida) {
      return res.status(401).json({ exito: false, mensaje: 'Correo o contraseña incorrectos.' });
    }

    // 3. Si todo está bien, enviamos los datos básicos para el Dashboard
    console.log(`✅ Ingreso exitoso: ${usuario.email}`);
    res.json({
      exito: true,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol,
        saldo: usuario.saldo_disponible
      }
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno del servidor.' });
  }
});

// 3. Iniciar el servidor
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});