require('dotenv').config();
const mysql = require('mysql2/promise');

async function actualizarBD() {
  try {
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    console.log("Conectado. Actualizando tabla...");
    
    // Añadimos la columna y la hacemos UNIQUE para que no existan 2 cédulas iguales
    await connection.query("ALTER TABLE usuarios ADD COLUMN numero_documento VARCHAR(50) UNIQUE AFTER tipo_documento;");
    
    console.log("✅ Columna 'numero_documento' añadida exitosamente con restricción única.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error (Si dice Duplicate column, ignóralo):", error.message);
    process.exit(1);
  }
}
actualizarBD();