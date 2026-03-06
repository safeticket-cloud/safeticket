require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const app = express();

// 1. Configuración de la conexión
// Usamos la URL de conexión que ya configuramos en las variables de entorno
const connection = mysql.createConnection(process.env.DATABASE_URL);

// 2. Ruta principal con la corrección de sintaxis SQL
app.get('/', (req, res) => {
  // IMPORTANTE: Usamos comillas simples '' para el texto dentro de la consulta
  const sqlQuery = "SELECT 'Conexión exitosa' AS mensaje";

  connection.query(sqlQuery, (err, results) => {
    if (err) {
      console.error('Error en la consulta:', err);
      res.status(500).send("Error conectando a la base de datos: " + err.message);
    } else {
      // Si todo sale bien, verás este mensaje en tu navegador
      res.send("¡Arquitectura funcionando! La base de datos dice: " + results[0].mensaje);
    }
  });
});

// 3. Configuración del puerto para Render (por defecto usa el 10000)
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});