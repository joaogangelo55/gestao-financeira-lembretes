import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeCurrency,
  validateLogin,
  validateReminder,
  validateTransaction,
} from '../src/utils/validation.mjs';

test('validateLogin exige nome, e-mail válido e senha mínima', () => {
  assert.equal(validateLogin({ name: '', email: 'invalido', password: '123' }).valid, false);
  assert.equal(validateLogin({ name: 'Ana', email: 'ana@exemplo.com', password: '123456' }).valid, true);
});

test('validateLogin permite entrar sem repetir o nome', () => {
  assert.deepEqual(
    validateLogin({ name: '', email: 'ana@exemplo.com', password: '123456' }, { requireName: false }),
    { valid: true, value: { name: '', email: 'ana@exemplo.com', password: '123456' } }
  );
});

test('validateLogin normaliza nome, e-mail e mantém senha apenas para autenticação', () => {
  assert.deepEqual(validateLogin({ name: '  Ana Silva ', email: ' ANA@EXEMPLO.COM ', password: '123456' }), {
    valid: true,
    value: { name: 'Ana Silva', email: 'ana@exemplo.com', password: '123456' },
  });
});

test('normalizeCurrency aceita vírgula decimal brasileira', () => {
  assert.equal(normalizeCurrency('1.234,56'), 1234.56);
});

test('validateTransaction rejeita data inexistente', () => {
  const result = validateTransaction({
    type: 'despesa',
    description: 'Internet',
    amount: '120,00',
    category: 'Moradia',
    dueDate: '2026-02-31',
  });

  assert.equal(result.valid, false);
  assert.match(result.error, /data/i);
});

test('validateTransaction normaliza uma transação válida', () => {
  const result = validateTransaction({
    type: 'receita',
    description: '  Bolsa  ',
    amount: '900,50',
    category: 'Estudos',
    dueDate: '2026-10-15',
  });

  assert.deepEqual(result, {
    valid: true,
    value: {
      type: 'receita',
      description: 'Bolsa',
      amount: 900.5,
      category: 'Estudos',
      dueDate: '2026-10-15',
    },
  });
});

test('validateTransaction aceita data brasileira e preserva ISO no domínio', () => {
  const result = validateTransaction({
    type: 'despesa',
    description: 'Aluguel',
    amount: '1.200,00',
    category: 'Moradia',
    dueDate: '15/10/2026',
  });

  assert.deepEqual(result, {
    valid: true,
    value: {
      type: 'despesa',
      description: 'Aluguel',
      amount: 1200,
      category: 'Moradia',
      dueDate: '2026-10-15',
    },
  });
});

test('validateReminder exige data e horário futuros', () => {
  const result = validateReminder({
    title: 'Pagar internet',
    reminderDate: '2020-01-01',
    reminderTime: '08:00',
  }, new Date('2026-10-10T12:00:00'));

  assert.equal(result.valid, false);
  assert.match(result.error, /futuro/i);
});

test('validateReminder preserva associação opcional com transação', () => {
  const result = validateReminder({
    title: 'Pagar internet',
    reminderDate: '2026-10-12',
    reminderTime: '08:00',
    transactionId: 4,
  }, new Date('2026-10-10T12:00:00'));

  assert.deepEqual(result, {
    valid: true,
    value: {
      title: 'Pagar internet',
      notes: '',
      reminderDate: '2026-10-12',
      reminderTime: '08:00',
      transactionId: 4,
    },
  });
});
