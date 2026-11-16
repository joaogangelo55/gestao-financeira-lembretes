// Orquestra dois sistemas sem transação distribuída: Supabase e agenda local.
// Primeiro persistimos o lembrete. Só depois criamos a notificação.
export async function persistAndScheduleReminder({ reminder, id = null, previousNotificationId = null, save, schedule, cancel }) {
  // Erro na persistência inicial impede que uma notificação sem registro seja criada.
  const savedId = await save(reminder, null, id);
  let nextNotificationId = null;
  let warning = null;

  try {
    nextNotificationId = await schedule(reminder);
  } catch (error) {
    warning = `O lembrete foi salvo, mas a notificação não pôde ser agendada: ${error.message || 'erro desconhecido'}`;
  }

  if (nextNotificationId) {
    try {
      await save(reminder, nextNotificationId, savedId);
    } catch (error) {
      // O registro existe (sem notification_id). Desfaça o novo agendamento.
      try { await cancel(nextNotificationId); } catch { /* explicar limitação ao usuário */ }
      nextNotificationId = null;
      warning = `O lembrete foi salvo, mas não foi possível vincular a notificação: ${error.message || 'erro desconhecido'}`;
    }
  } else if (!warning) {
    warning = 'Lembrete salvo sem notificação: permissão indisponível ou plataforma sem notificações locais.';
  }

  if (previousNotificationId && previousNotificationId !== nextNotificationId) {
    try {
      await cancel(previousNotificationId);
    } catch {
      warning = `${warning || 'Lembrete salvo.'} Verifique a agenda do aparelho: não foi possível cancelar a notificação anterior.`;
    }
  }
  return { savedId, notificationId: nextNotificationId, warning };
}
