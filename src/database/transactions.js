import * as SQLite from 'expo-sqlite';

let databasePromise;

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('financeiro.db');
  }

  return databasePromise;
}

export async function initDatabase() {
  const db = await getDatabase();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendente',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function getTransactions(filter = 'todos') {
  const db = await getDatabase();

  if (filter === 'pendente') {
    return await db.getAllAsync(
      `
        SELECT *
        FROM transactions
        WHERE status = ?
        ORDER BY due_date ASC, id DESC
      `,
      ['pendente']
    );
  }

  if (filter === 'concluida') {
    return await db.getAllAsync(
      `
        SELECT *
        FROM transactions
        WHERE status = ?
        ORDER BY due_date ASC, id DESC
      `,
      ['concluida']
    );
  }

  if (filter === 'futuras') {
    const today = new Date().toISOString().slice(0, 10);

    return await db.getAllAsync(
      `
        SELECT *
        FROM transactions
        WHERE due_date > ?
          AND status = ?
        ORDER BY due_date ASC, id DESC
      `,
      [today, 'pendente']
    );
  }

  return await db.getAllAsync(`
    SELECT *
    FROM transactions
    ORDER BY due_date ASC, id DESC
  `);
}

export async function createTransaction(transaction) {
  const db = await getDatabase();

  return await db.runAsync(
    `
      INSERT INTO transactions
      (
        type,
        description,
        amount,
        category,
        due_date,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      transaction.type,
      transaction.description,
      transaction.amount,
      transaction.category,
      transaction.dueDate,
      transaction.status ?? 'pendente',
    ]
  );
}

export async function updateTransaction(id, transaction) {
  const db = await getDatabase();

  return await db.runAsync(
    `
      UPDATE transactions
      SET
        type = ?,
        description = ?,
        amount = ?,
        category = ?,
        due_date = ?
      WHERE id = ?
    `,
    [
      transaction.type,
      transaction.description,
      transaction.amount,
      transaction.category,
      transaction.dueDate,
      id,
    ]
  );
}

export async function deleteTransaction(id) {
  const db = await getDatabase();

  return await db.runAsync(
    `
      DELETE FROM transactions
      WHERE id = ?
    `,
    [id]
  );
}

export async function changeTransactionStatus(id, status) {
  const db = await getDatabase();

  return await db.runAsync(
    `
      UPDATE transactions
      SET status = ?
      WHERE id = ?
    `,
    [status, id]
  );
}

export async function getMonthlySummary() {
  const db = await getDatabase();

  const now = new Date();

  const month =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return await db.getFirstAsync(
    `
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN type = 'receita'
              THEN amount
              ELSE 0
            END
          ),
          0
        ) AS receitas,

        COALESCE(
          SUM(
            CASE
              WHEN type = 'despesa'
              THEN amount
              ELSE 0
            END
          ),
          0
        ) AS despesas,

        COALESCE(
          SUM(
            CASE
              WHEN type = 'despesa'
               AND status = 'pendente'
              THEN amount
              ELSE 0
            END
          ),
          0
        ) AS comprometido

      FROM transactions

      WHERE substr(due_date, 1, 7) = ?
    `,
    [month]
  );
}