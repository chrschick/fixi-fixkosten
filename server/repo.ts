// Datenzugriff: Benutzer + Fixkostendaten (Meta-Kategorien, Kategorien, Items, Einnahmen).
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { emptyData, sanitize } from '../shared/sanitize.ts'
import type { AppData } from '../shared/types.ts'
import { destroyUserSessions, hashPassword, verifyPassword } from './auth.ts'
import type { Role } from './auth.ts'
import { config } from './config.ts'
import { pool, withTransaction } from './db.ts'

export interface UserRow {
  id: number
  username: string
  role: Role
  password_hash: string
  data_version: number
  created_at: string
}

export interface UserSummary {
  id: number
  username: string
  createdAt: string
  dataVersion: number
  itemCount: number
  incomeCount: number
}

export class NotFoundError extends Error {}

// ---------- Benutzer ----------

export async function findUserByUsername(
  username: string,
): Promise<UserRow | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT `id`, `username`, `role`, `password_hash`, `data_version`, `created_at` FROM `users` WHERE `username` = ?',
    [username],
  )
  return (rows[0] as UserRow | undefined) ?? null
}

export async function findUserById(id: number): Promise<UserRow | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT `id`, `username`, `role`, `password_hash`, `data_version`, `created_at` FROM `users` WHERE `id` = ?',
    [id],
  )
  return (rows[0] as UserRow | undefined) ?? null
}

export async function listUsers(): Promise<UserSummary[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT u.id, u.username, u.created_at, u.data_version,
            (SELECT COUNT(*) FROM \`items\` i WHERE i.user_id = u.id) AS item_count,
            (SELECT COUNT(*) FROM \`incomes\` n WHERE n.user_id = u.id) AS income_count
       FROM \`users\` u
      WHERE u.role = 'user'
      ORDER BY u.username`,
  )
  return rows.map((r) => ({
    id: Number(r.id),
    username: String(r.username),
    createdAt: String(r.created_at),
    dataVersion: Number(r.data_version),
    itemCount: Number(r.item_count),
    incomeCount: Number(r.income_count),
  }))
}

/** Legt einen Benutzer an; normale Benutzer bekommen die Standard-Kategorien. */
export async function createUser(
  username: string,
  password: string,
  role: Role = 'user',
): Promise<number> {
  const hash = await hashPassword(password)
  return withTransaction(async (conn) => {
    const [res] = await conn.query<ResultSetHeader>(
      'INSERT INTO `users` (`username`, `password_hash`, `role`) VALUES (?, ?, ?)',
      [username, hash, role],
    )
    const id = res.insertId
    if (role === 'user') await replaceUserDataTx(conn, id, emptyData())
    return id
  })
}

/** Löscht einen normalen Benutzer samt Daten und Sessions (Cascade). */
export async function deleteUser(id: number): Promise<boolean> {
  const [res] = await pool.query<ResultSetHeader>(
    "DELETE FROM `users` WHERE `id` = ? AND `role` = 'user'",
    [id],
  )
  return res.affectedRows > 0
}

export async function setUserPassword(
  id: number,
  password: string,
): Promise<boolean> {
  const hash = await hashPassword(password)
  const [res] = await pool.query<ResultSetHeader>(
    'UPDATE `users` SET `password_hash` = ? WHERE `id` = ?',
    [hash, id],
  )
  if (res.affectedRows === 0) return false
  await destroyUserSessions(id)
  return true
}

/**
 * Stellt sicher, dass der Superadmin aus der .env existiert und das dort
 * hinterlegte Passwort gilt (die .env ist die Quelle der Wahrheit).
 */
export async function ensureSuperadmin(): Promise<void> {
  const { username, password } = config.sa
  const existing = await findUserByUsername(username)
  if (!existing) {
    await createUser(username, password, 'superadmin')
    console.log(`Superadmin "${username}" angelegt.`)
    return
  }
  if (existing.role !== 'superadmin') {
    throw new Error(
      `SA_USERNAME "${username}" ist bereits als normaler Benutzer vergeben.`,
    )
  }
  if (!(await verifyPassword(password, existing.password_hash))) {
    await pool.query('UPDATE `users` SET `password_hash` = ? WHERE `id` = ?', [
      await hashPassword(password),
      existing.id,
    ])
    await destroyUserSessions(existing.id)
    console.log(`Superadmin-Passwort aus .env übernommen.`)
  }
}

// ---------- Fixkostendaten ----------

export async function getDataVersion(userId: number): Promise<number | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT `data_version` FROM `users` WHERE `id` = ?',
    [userId],
  )
  return rows[0] ? Number(rows[0].data_version) : null
}

export async function loadUserData(
  userId: number,
): Promise<{ version: number; data: AppData }> {
  return withTransaction(async (conn) => {
    const [users] = await conn.query<RowDataPacket[]>(
      'SELECT `data_version` FROM `users` WHERE `id` = ?',
      [userId],
    )
    if (!users[0]) throw new NotFoundError('Benutzer nicht gefunden')
    const [metas] = await conn.query<RowDataPacket[]>(
      'SELECT `id`, `name`, `icon`, `color` FROM `meta_categories` WHERE `user_id` = ? ORDER BY `sort_order`, `id`',
      [userId],
    )
    const [cats] = await conn.query<RowDataPacket[]>(
      'SELECT `id`, `name`, `icon`, `color` FROM `categories` WHERE `user_id` = ? ORDER BY `sort_order`, `id`',
      [userId],
    )
    const [items] = await conn.query<RowDataPacket[]>(
      `SELECT \`id\`, \`name\`, \`turnus\`, \`day\`, \`month\`, \`amount\`, \`info\`,
              \`meta_category_id\` AS metaCategoryId, \`category_id\` AS categoryId
         FROM \`items\` WHERE \`user_id\` = ? ORDER BY \`sort_order\`, \`id\``,
      [userId],
    )
    const [incomes] = await conn.query<RowDataPacket[]>(
      'SELECT `id`, `name`, `day`, `amount`, `info` FROM `incomes` WHERE `user_id` = ? ORDER BY `sort_order`, `id`',
      [userId],
    )
    const data = sanitize({
      version: 3,
      metaCategories: metas as AppData['metaCategories'],
      categories: cats as AppData['categories'],
      items: items as AppData['items'],
      incomes: incomes as AppData['incomes'],
    })
    return { version: Number(users[0].data_version), data }
  })
}

/** Ersetzt die kompletten Daten eines Benutzers (eine Transaktion). Liefert die neue Version. */
export async function replaceUserData(
  userId: number,
  data: Partial<AppData>,
): Promise<number> {
  return withTransaction((conn) => replaceUserDataTx(conn, userId, data))
}

async function replaceUserDataTx(
  conn: PoolConnection,
  userId: number,
  input: Partial<AppData>,
): Promise<number> {
  const data = sanitize(input)

  const [users] = await conn.query<RowDataPacket[]>(
    'SELECT `id` FROM `users` WHERE `id` = ? FOR UPDATE',
    [userId],
  )
  if (!users[0]) throw new NotFoundError('Benutzer nicht gefunden')

  await conn.query('DELETE FROM `items` WHERE `user_id` = ?', [userId])
  await conn.query('DELETE FROM `incomes` WHERE `user_id` = ?', [userId])
  await conn.query('DELETE FROM `categories` WHERE `user_id` = ?', [userId])
  await conn.query('DELETE FROM `meta_categories` WHERE `user_id` = ?', [userId])

  if (data.metaCategories.length) {
    await conn.query(
      'INSERT INTO `meta_categories` (`user_id`, `id`, `name`, `icon`, `color`, `sort_order`) VALUES ?',
      [data.metaCategories.map((m, i) => [userId, m.id, m.name, m.icon, m.color, i])],
    )
  }
  if (data.categories.length) {
    await conn.query(
      'INSERT INTO `categories` (`user_id`, `id`, `name`, `icon`, `color`, `sort_order`) VALUES ?',
      [data.categories.map((c, i) => [userId, c.id, c.name, c.icon, c.color, i])],
    )
  }
  if (data.items.length) {
    await conn.query(
      `INSERT INTO \`items\`
         (\`user_id\`, \`id\`, \`name\`, \`turnus\`, \`day\`, \`month\`, \`amount\`, \`info\`,
          \`meta_category_id\`, \`category_id\`, \`sort_order\`)
       VALUES ?`,
      [
        data.items.map((it, i) => [
          userId,
          it.id,
          it.name,
          it.turnus,
          it.day,
          it.month,
          it.amount,
          it.info,
          it.metaCategoryId,
          it.categoryId,
          i,
        ]),
      ],
    )
  }
  if (data.incomes.length) {
    await conn.query(
      'INSERT INTO `incomes` (`user_id`, `id`, `name`, `day`, `amount`, `info`, `sort_order`) VALUES ?',
      [data.incomes.map((n, i) => [userId, n.id, n.name, n.day, n.amount, n.info, i])],
    )
  }

  await conn.query(
    'UPDATE `users` SET `data_version` = `data_version` + 1 WHERE `id` = ?',
    [userId],
  )
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT `data_version` FROM `users` WHERE `id` = ?',
    [userId],
  )
  return Number(rows[0].data_version)
}
