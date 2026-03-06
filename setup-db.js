require('dotenv').config();
const mysql = require('mysql2/promise');

async function crearTablas() {
  console.log("⏳ Conectando a Aiven MySQL...");
  
  try {
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    console.log("✅ Conexión exitosa. Creando estructura de SafeTicket...");

    // 1. Tabla de Usuarios (Combina Login y Clientes)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        codigo VARCHAR(6) UNIQUE NOT NULL, 
        nombre VARCHAR(40) NOT NULL,
        apellido VARCHAR(40) NOT NULL,
        email VARCHAR(80) UNIQUE NOT NULL,
        clave_hash VARCHAR(255) NOT NULL,
        rol ENUM('ADMIN', 'USUARIO', 'CLIENTE') DEFAULT 'CLIENTE',
        fecha_nacimiento DATE NOT NULL,
        telefono VARCHAR(20),
        tipo_documento ENUM('CEDULA', 'PASAPORTE'),
        documento_url VARCHAR(255), 
        estado_kyc ENUM('PENDIENTE', 'APROBADO', 'SUSPENDIDO') DEFAULT 'PENDIENTE',
        fecha_aprobacion DATETIME,
        aprobado_por INT,
        nivel_retiro ENUM('ESSENTIAL', 'ADVANCED', 'PRO') DEFAULT 'ESSENTIAL',
        saldo_disponible DECIMAL(10,2) DEFAULT 0.00,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("📦 Tabla 'usuarios' creada.");

    // 2. Tabla de Tipos de Juego
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tipos_juego (
        id INT PRIMARY KEY,
        nombre VARCHAR(50) NOT NULL
      )
    `);
    // Insertamos los juegos básicos de tu documento
    await connection.query(`INSERT IGNORE INTO tipos_juego (id, nombre) VALUES (1, 'Loto'), (2, 'Power Ball')`);
    console.log("📦 Tabla 'tipos_juego' creada.");

    // 3. Tabla de Sorteos
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sorteos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        juego_id INT,
        fecha_sorteo DATETIME NOT NULL,
        premio_mayor DECIMAL(15,2),
        FOREIGN KEY (juego_id) REFERENCES tipos_juego(id)
      )
    `);
    console.log("📦 Tabla 'sorteos' creada.");

    // 4. Tabla de Transacciones y Wallet (Unificada para Bs y USD)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS transacciones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        tipo ENUM('DEPOSITO', 'RETIRO', 'COMPRA_TICKET', 'PREMIO') NOT NULL,
        metodo ENUM('PAGO_MOVIL', 'TRANSFERENCIA', 'ZELLE', 'CRYPTO', 'SALDO_INTERNO') NOT NULL,
        monto_usd DECIMAL(10,2) NOT NULL,
        monto_local DECIMAL(10,2),
        tasa_cambio DECIMAL(10,2),
        referencia VARCHAR(100),
        banco_origen VARCHAR(50),
        cuenta_destino VARCHAR(50),
        estado ENUM('PENDIENTE', 'APROBADO', 'RECHAZADO') DEFAULT 'PENDIENTE',
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_aprobacion DATETIME,
        aprobado_por INT,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )
    `);
    console.log("📦 Tabla 'transacciones' creada.");

    // 5. Tabla de Boletos
    await connection.query(`
      CREATE TABLE IF NOT EXISTS boletos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        sorteo_id INT NOT NULL,
        fecha_compra DATETIME DEFAULT CURRENT_TIMESTAMP,
        numeros_jugados VARCHAR(50) NOT NULL,
        powerball VARCHAR(5),
        seleccion_rapida BOOLEAN DEFAULT FALSE,
        en_custodia BOOLEAN DEFAULT FALSE,
        scaneado BOOLEAN DEFAULT FALSE,
        imagen_url VARCHAR(255),
        es_ganador BOOLEAN DEFAULT FALSE,
        monto_ganado DECIMAL(15,2) DEFAULT 0.00,
        premio_pagado BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY (sorteo_id) REFERENCES sorteos(id)
      )
    `);
    console.log("📦 Tabla 'boletos' creada.");

    console.log("🎉 ¡Estructura de Base de Datos completada con éxito!");
    process.exit(0);

  } catch (error) {
    console.error("❌ Error creando las tablas:", error);
    process.exit(1);
  }
}

crearTablas();