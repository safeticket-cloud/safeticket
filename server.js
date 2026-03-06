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
    const { nombre, apellido, fecha_nacimiento, telefono, email, password } = req.body;

    // Generar el código de cliente de 6 dígitos (Ej: 482910)
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();

    // Encriptar la contraseña
    const salt = await bcrypt.genSalt(10);
    const clave_hash = await bcrypt.hash(password, salt);

    // Insertar el nuevo cliente en la tabla 'usuarios'
    const query = `
      INSERT INTO usuarios (codigo, nombre, apellido, fecha_nacimiento, telefono, email, clave_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    await pool.execute(query, [codigo, nombre, apellido, fecha_nacimiento, telefono, email, clave_hash]);

    console.log(`✅ Nuevo usuario registrado exitosamente: ${email}`);
    // Le respondemos al HTML que todo salió bien
    res.status(201).json({ exito: true, mensaje: 'Usuario registrado exitosamente' });

  } catch (error) {
    console.error('❌ Error en registro:', error);
    // Si el error es porque el correo ya existe en la base de datos
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ exito: false, mensaje: 'El correo electrónico ya está registrado.' });
    }
    res.status(500).json({ exito: false, mensaje: 'Error interno del servidor.' });
  }
});

// 3. Iniciar el servidor
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});