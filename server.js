require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const app = express();

// Configuramos la conexión con la "llave" que guardaste en el .env
const connection = mysql.createConnection(process.env.DATABASE_URL);

app.get('/', (req, res) => {
  connection.query('SELECT "Conexión exitosa" AS mensaje', (err, results) => {
    if (err) {
      res.send("Error conectando a la base de datos: " + err.message);
    } else {
      res.send("¡Arquitectura funcionando! La base de datos dice: " + results[0].mensaje);
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});