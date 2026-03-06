require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function resetAdmin() {
  try {
    const pool = mysql.createPool(process.env.DATABASE_URL);
    
    const emailMaster = 'master@safeticket.com';
    const passwordMaster = 'Admin2026*';
    
    // Encriptamos la clave nuevamente
    const salt = await bcrypt.genSalt(10);
    const clave_hash = await bcrypt.hash(passwordMaster, salt);

    // Verificamos si el correo ya existe
    const [rows] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [emailMaster]);
    
    if (rows.length > 0) {
        // Si ya existía, lo forzamos a ser ADMIN y le actualizamos la clave
        await pool.query(
          "UPDATE usuarios SET clave_hash = ?, rol = 'ADMIN', estado_kyc = 'APROBADO' WHERE email = ?", 
          [clave_hash, emailMaster]
        );
        console.log("✅ Cuenta Master actualizada. La clave se ha reseteado correctamente.");
    } else {
        // Si no existía, lo creamos con un documento ficticio para que MySQL no se queje
        const codigo = '000001';
        await pool.query(`
          INSERT INTO usuarios (codigo, nombre, apellido, fecha_nacimiento, email, clave_hash, rol, estado_kyc, tipo_documento, numero_documento)
          VALUES (?, 'Víctor', 'Master', '1990-01-01', ?, ?, 'ADMIN', 'APROBADO', 'CEDULA', 'V-MASTER')
        `, [codigo, emailMaster, clave_hash]);
        console.log("✅ Cuenta Master creada desde cero.");
    }
    
    console.log(`📧 Correo: ${emailMaster}`);
    console.log(`🔑 Clave: ${passwordMaster}`);
    process.exit(0);

  } catch (error) {
    console.error("❌ Error en la base de datos:", error.message);
    process.exit(1);
  }
}

resetAdmin();