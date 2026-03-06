require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function fixAndResetAdmin() {
  try {
    const pool = mysql.createPool(process.env.DATABASE_URL);
    console.log("⏳ Conectando a la base de datos...");

    // 1. REPARACIÓN AUTOMÁTICA: Intentar agregar la columna si falta
    try {
        await pool.query("ALTER TABLE usuarios ADD COLUMN numero_documento VARCHAR(50) UNIQUE AFTER tipo_documento");
        console.log("🛠️ ¡Reparación exitosa! Columna 'numero_documento' agregada a la tabla.");
    } catch(e) {
        // Si el error es porque la columna ya existe, lo ignoramos y seguimos
        if(e.code === 'ER_DUP_FIELDNAME') {
            console.log("✔️ La estructura de la tabla está correcta.");
        } else {
            console.log("⚠️ Aviso menor en la estructura (ignorando).");
        }
    }

    // 2. CREACIÓN DEL ADMINISTRADOR
    const emailMaster = 'master@safeticket.com';
    const passwordMaster = 'Admin2026*';
    
    const salt = await bcrypt.genSalt(10);
    const clave_hash = await bcrypt.hash(passwordMaster, salt);

    const [rows] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [emailMaster]);
    
    if (rows.length > 0) {
        await pool.query(
          "UPDATE usuarios SET clave_hash = ?, rol = 'ADMIN', estado_kyc = 'APROBADO' WHERE email = ?", 
          [clave_hash, emailMaster]
        );
        console.log("✅ Cuenta Master actualizada exitosamente.");
    } else {
        const codigo = '000001';
        await pool.query(`
          INSERT INTO usuarios (codigo, nombre, apellido, fecha_nacimiento, email, clave_hash, rol, estado_kyc, tipo_documento, numero_documento)
          VALUES (?, 'Víctor', 'Master', '1990-01-01', ?, ?, 'ADMIN', 'APROBADO', 'CEDULA', 'V-MASTER')
        `, [codigo, emailMaster, clave_hash]);
        console.log("✅ Cuenta Master creada desde cero.");
    }
    
    console.log(`\n--- DATOS DE ACCESO ---`);
    console.log(`📧 Correo: ${emailMaster}`);
    console.log(`🔑 Clave:  ${passwordMaster}`);
    console.log(`-----------------------\n`);
    
    process.exit(0);

  } catch (error) {
    console.error("❌ Error crítico:", error.message);
    process.exit(1);
  }
}

fixAndResetAdmin();