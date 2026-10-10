import test from 'node:test';
import assert from 'node:assert/strict';

import {
  brDateToIso,
  formatDateInput,
  getLocalTodayIso,
  isValidBrDate,
  isoToBrDate,
} from '../src/utils/dates.mjs';

test('formatDateInput aplica máscara a números e texto colado', () => {
  assert.equal(formatDateInput('1'), '1');
  assert.equal(formatDateInput('15'), '15/');
  assert.equal(formatDateInput('1510'), '15/10/');
  assert.equal(formatDateInput('15102026'), '15/10/2026');
  assert.equal(formatDateInput('15/10/2026'), '15/10/2026');
  assert.equal(formatDateInput('15a10b202699'), '15/10/2026');
  assert.equal(formatDateInput(''), '');
});

test('converte datas ISO e brasileiras sem usar UTC', () => {
  assert.equal(isoToBrDate('2026-10-15'), '15/10/2026');
  assert.equal(brDateToIso('15/10/2026'), '2026-10-15');
  assert.equal(brDateToIso('15/10/202'), null);
});

test('valida anos bissextos e datas civis inexistentes', () => {
  assert.equal(isValidBrDate('29/02/2024'), true);
  assert.equal(isValidBrDate('29/02/2026'), false);
  assert.equal(isValidBrDate('31/04/2026'), false);
  assert.equal(isValidBrDate('00/10/2026'), false);
  assert.equal(isValidBrDate('12/13/2026'), false);
  assert.equal(isValidBrDate('31/12/2026'), true);
});

test('getLocalTodayIso respeita o calendário local em UTC-03', () => {
  const utcInstant = new Date('2026-10-10T01:30:00.000Z');
  // Date#getTimezoneOffset usa minutos UTC - horário local: UTC-03 retorna +180.
  assert.equal(getLocalTodayIso(utcInstant, 180), '2026-10-09');
  assert.equal(getLocalTodayIso(utcInstant, 0), '2026-10-10');
});
