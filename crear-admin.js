require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function crearAdminMaster() {
  try {
    const pool = mysql.createPool(process.env.DATABASE_URL);
    
    const emailMaster = 'master@safeticket.com';
    const passwordMaster = 'Admin2026*'; // ¡Esta será tu clave de acceso!
    
    // Encriptamos la clave
    const salt = await bcrypt.genSalt(10);
    const clave_hash = await bcrypt.hash(passwordMaster, salt);
    const codigo = '000001'; // Código especial para el Master

    const query = `
      INSERT INTO usuarios (codigo, nombre, apellido, fecha_nacimiento, email, clave_hash, rol, estado_kyc)
      VALUES (?, 'Víctor', 'Master', '1990-01-01', ?, ?, 'ADMIN', 'APROBADO')
    `;
    
    await pool.execute(query, [codigo, emailMaster, clave_hash]);
    console.log(`✅ Administrador Master creado con éxito.`);
    console.log(`📧 Correo: ${emailMaster}`);
    console.log(`🔑 Clave: ${passwordMaster}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error (Si dice Duplicate, es que ya está creado):', error.message);
    process.exit(1);
  }
}
crearAdminMaster();