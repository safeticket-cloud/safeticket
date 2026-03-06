require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const app = express();

// 1. Conexión a la Base de Datos (Aiven)
const connection = mysql.createConnection(process.env.DATABASE_URL);

connection.connect((err) => {
  if (err) {
    console.error('Error conectando a la base de datos:', err.message);
  } else {
    console.log('✅ Base de datos Aiven conectada exitosamente.');
  }
});

// 2. Configurar Express para mostrar los archivos HTML de la carpeta "public"
app.use(express.static(path.join(__dirname, 'public')));

// 3. Iniciar el servidor
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});