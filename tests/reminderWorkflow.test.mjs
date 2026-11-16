import test from 'node:test';
import assert from 'node:assert/strict';
import { persistAndScheduleReminder } from '../src/services/reminderWorkflow.mjs';

const reminder = { title: 'Pagar conta' };

test('não agenda quando a persistência inicial falha', async () => {
  let scheduled = false;
  await assert.rejects(persistAndScheduleReminder({
    reminder, save: async () => { throw new Error('falha no banco'); },
    schedule: async () => { scheduled = true; }, cancel: async () => {},
  }), /falha no banco/);
  assert.equal(scheduled, false);
});

test('salva antes de agendar e associa a notificação no registro', async () => {
  const calls = [];
  const output = await persistAndScheduleReminder({
    reminder,
    save: async (value, notificationId, id) => {
      calls.push(['save', notificationId, id]); return id ?? 'db1';
    },
    schedule: async () => { calls.push(['schedule']); return 'novo'; },
    cancel: async (id) => { calls.push(['cancel', id]); },
  });
  assert.equal(output.savedId, 'db1');
  assert.equal(output.warning, null);
  assert.deepEqual(calls, [['save', null, null], ['schedule'], ['save', 'novo', 'db1']]);
});

test('cancela notificação nova se falhar a associação ao banco', async () => {
  const calls = [];
  let count = 0;
  const output = await persistAndScheduleReminder({
    reminder, id: 'db1', previousNotificationId: 'antigo',
    save: async () => { count++; if (count === 2) throw new Error('falha'); return 'db1'; },
    schedule: async () => 'novo',
    cancel: async (id) => { calls.push(id); },
  });
  assert.deepEqual(calls, ['novo', 'antigo']);
  assert.equal(output.notificationId, null);
  assert.match(output.warning, /não foi possível vincular/);
});

test('remove notificação anterior quando permissão não concedida', async () => {
  const cancelled = [];
  const output = await persistAndScheduleReminder({
    reminder, id: 'db1', previousNotificationId: 'antigo',
    save: async () => 'db1', schedule: async () => null,
    cancel: async (id) => { cancelled.push(id); },
  });
  assert.deepEqual(cancelled, ['antigo']);
  assert.match(output.warning, /sem notificação/);
});
