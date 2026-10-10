import * as SQLite from 'expo-sqlite';
import { getLocalTodayIso } from '../utils/dates.mjs';

let databasePromise;

async function getDatabase() {
  if (!databasePromise) databasePromise = SQLite.openDatabaseAsync('financeiro.db');
  return databasePromise;
}

export async function initDatabase() {
  const db = await getDatabase();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('receita', 'despesa')),
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente', 'concluida')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_session (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      avatar_uri TEXT
    );
    CREATE TABLE IF NOT EXISTS app_preferences (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      reminder_date TEXT NOT NULL,
      reminder_time TEXT NOT NULL,
      transaction_id INTEGER,
      notification_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
    );
  `);
  const userColumns = await db.getAllAsync('PRAGMA table_info(user_session)');
  if (!userColumns.some((column) => column.name === 'avatar_uri')) {
    await db.execAsync('ALTER TABLE user_session ADD COLUMN avatar_uri TEXT');
  }
}

export async function getUserSession() {
  const db = await getDatabase();
  return db.getFirstAsync('SELECT name, email, avatar_uri AS avatarUri FROM user_session WHERE id = 1');
}

export async function saveUserSession(user) {
  const db = await getDatabase();
  await db.runAsync('INSERT OR REPLACE INTO user_session (id, name, email, avatar_uri) VALUES (1, ?, ?, ?)', [user.name, user.email, user.avatarUri ?? null]);
}

export async function updateUserProfile(profile) {
  const db = await getDatabase();
  await db.runAsync('UPDATE user_session SET name = ?, email = ?, avatar_uri = ? WHERE id = 1', [profile.name, profile.email, profile.avatarUri ?? null]);
}

export async function getPreference(key) {
  const db = await getDatabase();
  const row = await db.getFirstAsync('SELECT value FROM app_preferences WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setPreference(key, value) {
  const db = await getDatabase();
  await db.runAsync('INSERT OR REPLACE INTO app_preferences (key, value) VALUES (?, ?)', [key, String(value)]);
}

export async function clearUserSession() {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM user_session WHERE id = 1');
}

export async function getTransactions(filter = 'todos') {
  const db = await getDatabase();
  const today = getLocalTodayIso();
  const filters = {
    pendente: ['WHERE status = ?', ['pendente']],
    concluida: ['WHERE status = ?', ['concluida']],
    futuras: ['WHERE due_date > ? AND status = ?', [today, 'pendente']],
  };
  const [where, params] = filters[filter] ?? ['', []];
  return db.getAllAsync(`SELECT * FROM transactions ${where} ORDER BY due_date ASC, id DESC`, params);
}

export async function saveTransaction(transaction, id = null) {
  const db = await getDatabase();
  const values = [transaction.type, transaction.description, transaction.amount, transaction.category, transaction.dueDate];
  if (id) {
    await db.runAsync('UPDATE transactions SET type=?, description=?, amount=?, category=?, due_date=? WHERE id=?', [...values, id]);
    return id;
  }
  const result = await db.runAsync('INSERT INTO transactions (type, description, amount, category, due_date) VALUES (?, ?, ?, ?, ?)', values);
  return result.lastInsertRowId;
}

export async function deleteTransaction(id) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
}

export async function changeTransactionStatus(id, status) {
  const db = await getDatabase();
  await db.runAsync('UPDATE transactions SET status = ? WHERE id = ?', [status, id]);
}

export async function getMonthlySummary() {
  const db = await getDatabase();
  const month = getLocalTodayIso().slice(0, 7);
  return db.getFirstAsync(`SELECT
    COALESCE(SUM(CASE WHEN type='receita' THEN amount ELSE 0 END), 0) AS receitas,
    COALESCE(SUM(CASE WHEN type='despesa' THEN amount ELSE 0 END), 0) AS despesas,
    COALESCE(SUM(CASE WHEN type='despesa' AND status='pendente' THEN amount ELSE 0 END), 0) AS comprometido
    FROM transactions WHERE substr(due_date, 1, 7) = ?`, [month]);
}

export async function getReminders() {
  const db = await getDatabase();
  return db.getAllAsync(`SELECT reminders.*, transactions.description AS transaction_description
    FROM reminders LEFT JOIN transactions ON transactions.id = reminders.transaction_id
    ORDER BY reminder_date ASC, reminder_time ASC`);
}

export async function saveReminder(reminder, notificationId, id = null) {
  const db = await getDatabase();
  const values = [reminder.title, reminder.notes, reminder.reminderDate, reminder.reminderTime, reminder.transactionId, notificationId];
  if (id) {
    await db.runAsync('UPDATE reminders SET title=?, notes=?, reminder_date=?, reminder_time=?, transaction_id=?, notification_id=? WHERE id=?', [...values, id]);
    return id;
  }
  const result = await db.runAsync('INSERT INTO reminders (title, notes, reminder_date, reminder_time, transaction_id, notification_id) VALUES (?, ?, ?, ?, ?, ?)', values);
  return result.lastInsertRowId;
}

export async function deleteReminder(id) {
  const db = await getDatabase();
  const reminder = await db.getFirstAsync('SELECT notification_id FROM reminders WHERE id = ?', [id]);
  await db.runAsync('DELETE FROM reminders WHERE id = ?', [id]);
  return reminder?.notification_id ?? null;
}
