import { brDateToIso, isValidIsoDate } from './dates.mjs';

export function validateLogin(credentials, { requireName = true } = {}) {
  const name = String(credentials.name ?? '').trim();
  const email = String(credentials.email ?? '').trim().toLowerCase();
  const password = String(credentials.password ?? '');

  if (requireName && name.length < 2) return { valid: false, error: 'Informe seu nome.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { valid: false, error: 'Informe um e-mail válido.' };
  if (password.length < 6) return { valid: false, error: 'A senha deve ter pelo menos 6 caracteres.' };

  // A senha só existe no objeto retornado durante este fluxo. As camadas de
  // persistência local e remota usam-na para autenticar e nunca a gravam.
  return { valid: true, value: { name, email, password } };
}

export function normalizeCurrency(input) {
  if (typeof input === 'number') return input;

  const value = String(input ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/R\$/gi, '')
    .replace(/\./g, '')
    .replace(',', '.');

  return Number(value);
}

export function isValidDate(value) {
  return isValidIsoDate(value);
}

function normalizeDateToIso(value) {
  return brDateToIso(value) ?? (isValidDate(value) ? value : null);
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value ?? '');
}

export function validateTransaction(transaction) {
  const description = String(transaction.description ?? '').trim();
  const category = String(transaction.category ?? '').trim();
  const amount = normalizeCurrency(transaction.amount);

  if (!['receita', 'despesa'].includes(transaction.type)) {
    return { valid: false, error: 'Selecione o tipo da transação.' };
  }

  if (!description) {
    return { valid: false, error: 'Informe uma descrição.' };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { valid: false, error: 'Informe um valor maior que zero.' };
  }

  if (!category) {
    return { valid: false, error: 'Informe uma categoria.' };
  }

  const dueDate = normalizeDateToIso(transaction.dueDate);
  if (!dueDate) {
    return { valid: false, error: 'Informe uma data válida no formato DD/MM/AAAA.' };
  }

  return {
    valid: true,
    value: {
      type: transaction.type,
      description,
      amount,
      category,
      dueDate,
    },
  };
}

export function validateReminder(reminder, now = new Date()) {
  const title = String(reminder.title ?? '').trim();
  const notes = String(reminder.notes ?? '').trim();
  const transactionId = reminder.transactionId ?? null;

  if (!title) {
    return { valid: false, error: 'Informe o título do lembrete.' };
  }

  const reminderDate = normalizeDateToIso(reminder.reminderDate);
  if (!reminderDate) {
    return { valid: false, error: 'Informe uma data válida no formato DD/MM/AAAA.' };
  }

  if (!isValidTime(reminder.reminderTime)) {
    return { valid: false, error: 'Informe um horário válido no formato HH:MM.' };
  }

  const reminderAt = new Date(`${reminderDate}T${reminder.reminderTime}:00`);
  if (reminderAt <= now) {
    return { valid: false, error: 'Escolha uma data e horário futuros.' };
  }

  return {
    valid: true,
    value: {
      title,
      notes,
      reminderDate,
      reminderTime: reminder.reminderTime,
      transactionId,
    },
  };
}
