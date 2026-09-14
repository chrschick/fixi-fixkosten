// MariaDB-Anbindung (mysql2) + Schema-Anlage beim Start.
import mysql from 'mysql2/promise'
import type { Pool, PoolConnection } from 'mysql2/promise'
import { config } from './config.ts'

export type Db = Pool | PoolConnection

export const pool: Pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci',
  decimalNumbers: true,
  dateStrings: true,
  timezone: 'Z',
})

export async function withTransaction<T>(
  fn: (conn: PoolConnection) => Promise<T>,
): Promise<T> {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (e) {
    try {
      await conn.rollback()
    } catch {
      // ignore
    }
    throw e
  } finally {
    conn.release()
  }
}

const TABLE_OPTS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'

// Reihenfolge beachten (Fremdschlüssel). Alle Statements sind idempotent.
const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS \`users\` (
    \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    \`username\` VARCHAR(64) NOT NULL,
    \`password_hash\` VARCHAR(255) NOT NULL,
    \`role\` ENUM('user','superadmin') NOT NULL DEFAULT 'user',
    \`data_version\` INT UNSIGNED NOT NULL DEFAULT 0,
    \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`uq_users_username\` (\`username\`)
  ) ${TABLE_OPTS}`,

  `CREATE TABLE IF NOT EXISTS \`sessions\` (
    \`token\` CHAR(64) NOT NULL,
    \`user_id\` INT UNSIGNED NOT NULL,
    \`expires_at\` DATETIME NOT NULL,
    \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`token\`),
    KEY \`ix_sessions_user\` (\`user_id\`),
    KEY \`ix_sessions_expires\` (\`expires_at\`),
    CONSTRAINT \`fk_sessions_user\` FOREIGN KEY (\`user_id\`)
      REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
  ) ${TABLE_OPTS}`,

  `CREATE TABLE IF NOT EXISTS \`meta_categories\` (
    \`user_id\` INT UNSIGNED NOT NULL,
    \`id\` VARCHAR(64) NOT NULL,
    \`name\` VARCHAR(255) NOT NULL,
    \`icon\` VARCHAR(64) NOT NULL,
    \`color\` VARCHAR(32) NOT NULL,
    \`sort_order\` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (\`user_id\`, \`id\`),
    CONSTRAINT \`fk_meta_user\` FOREIGN KEY (\`user_id\`)
      REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
  ) ${TABLE_OPTS}`,

  `CREATE TABLE IF NOT EXISTS \`categories\` (
    \`user_id\` INT UNSIGNED NOT NULL,
    \`id\` VARCHAR(64) NOT NULL,
    \`name\` VARCHAR(255) NOT NULL,
    \`icon\` VARCHAR(64) NOT NULL,
    \`color\` VARCHAR(32) NOT NULL,
    \`sort_order\` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (\`user_id\`, \`id\`),
    CONSTRAINT \`fk_cat_user\` FOREIGN KEY (\`user_id\`)
      REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
  ) ${TABLE_OPTS}`,

  `CREATE TABLE IF NOT EXISTS \`items\` (
    \`user_id\` INT UNSIGNED NOT NULL,
    \`id\` VARCHAR(64) NOT NULL,
    \`name\` VARCHAR(255) NOT NULL,
    \`turnus\` ENUM('monthly','quarterly','half-yearly','yearly') NOT NULL DEFAULT 'monthly',
    \`day\` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    \`month\` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    \`amount\` DECIMAL(12,2) NOT NULL DEFAULT 0,
    \`info\` TEXT NOT NULL,
    \`meta_category_id\` VARCHAR(64) NOT NULL,
    \`category_id\` VARCHAR(64) NOT NULL,
    \`sort_order\` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (\`user_id\`, \`id\`),
    KEY \`ix_items_meta\` (\`user_id\`, \`meta_category_id\`),
    KEY \`ix_items_cat\` (\`user_id\`, \`category_id\`),
    CONSTRAINT \`fk_items_user\` FOREIGN KEY (\`user_id\`)
      REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
    CONSTRAINT \`fk_items_meta\` FOREIGN KEY (\`user_id\`, \`meta_category_id\`)
      REFERENCES \`meta_categories\` (\`user_id\`, \`id\`) ON DELETE CASCADE,
    CONSTRAINT \`fk_items_cat\` FOREIGN KEY (\`user_id\`, \`category_id\`)
      REFERENCES \`categories\` (\`user_id\`, \`id\`) ON DELETE CASCADE
  ) ${TABLE_OPTS}`,

  `CREATE TABLE IF NOT EXISTS \`incomes\` (
    \`user_id\` INT UNSIGNED NOT NULL,
    \`id\` VARCHAR(64) NOT NULL,
    \`name\` VARCHAR(255) NOT NULL,
    \`day\` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    \`amount\` DECIMAL(12,2) NOT NULL DEFAULT 0,
    \`info\` TEXT NOT NULL,
    \`sort_order\` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (\`user_id\`, \`id\`),
    CONSTRAINT \`fk_inc_user\` FOREIGN KEY (\`user_id\`)
      REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
  ) ${TABLE_OPTS}`,
]

export async function pingDb(): Promise<void> {
  await pool.query('SELECT 1')
}

function describeError(e: unknown): string {
  const err = e as { code?: string; message?: string }
  return err?.code || err?.message || String(e)
}

/**
 * Wartet, bis die Datenbank erreichbar ist. In Docker starten Container in
 * beliebiger Reihenfolge; ohne Warten würde Fixi sich sofort beenden.
 */
export async function waitForDb(attempts = 60, delayMs = 2000): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      await pingDb()
      if (i > 1) console.log('Datenbank erreichbar.')
      return
    } catch (e) {
      if (i >= attempts) throw e
      console.log(
        `warte auf Datenbank ${config.db.host}:${config.db.port}… (${i}/${attempts}: ${describeError(e)})`,
      )
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

export async function initSchema(): Promise<void> {
  for (const sql of SCHEMA) await pool.query(sql)
}
