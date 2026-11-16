import { Platform } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import { createAuthRedirectUrl } from '../services/authRedirect.mjs';
import { getLocalTodayIso } from '../utils/dates.mjs';
import { getSupabase } from '../services/supabaseClient';

function preferences() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

function throwIfError(error) {
  if (error) throw new Error(error.message);
}

async function currentUser() {
  const { data, error } = await getSupabase().auth.getUser();
  throwIfError(error);
  if (!data.user) throw new Error('Sua sessão expirou. Entre novamente.');
  return data.user;
}

async function profileFromUser(user) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('profiles').select('name, email, avatar_uri').eq('id', user.id).maybeSingle();
  throwIfError(error);
  if (data) {
    // Sincroniza cópia de email do perfil após a confirmação oficial no Auth.
    if (user.email && data.email !== user.email) {
      void supabase.from('profiles').update({ email: user.email }).eq('id', user.id)
        .then(({ error }) => { if (error) console.warn('Não foi possível sincronizar o e-mail de perfil.'); })
        .catch(() => { /* sincronização será tentada no próximo login */ });
    }
    return { name: data.name, email: user.email, avatarUri: data.avatar_uri };
  }

  const fallback = {
    id: user.id,
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário',
    email: user.email,
  };
  const { error: insertError } = await supabase.from('profiles').upsert(fallback);
  throwIfError(insertError);
  return { name: fallback.name, email: fallback.email, avatarUri: null };
}

export async function initDatabase() {
  getSupabase();
}

export async function getUserSession() {
  const { data, error } = await getSupabase().auth.getSession();
  throwIfError(error);
  return data.session ? profileFromUser(data.session.user) : null;
}

export async function saveUserSession(credentials, mode = 'signin') {
  const supabase = getSupabase();
  const { name, email, password } = credentials;
  const response = mode === 'signup'
    ? await supabase.auth.signUp({ email, password, options: { data: { name } } })
    : await supabase.auth.signInWithPassword({ email, password });
  throwIfError(response.error);
  if (!response.data.session) {
    throw new Error('Confira seu e-mail para confirmar a conta e depois entre com sua senha.');
  }
  return profileFromUser(response.data.user);
}

export async function updateUserProfile(profile) {
  const supabase = getSupabase();
  const user = await currentUser();
  const requestedEmail = String(profile.email || '').trim().toLowerCase();
  const currentEmail = String(user.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(requestedEmail)) throw new Error('E-mail inválido.');

  // O e-mail exibido continua vindo de Supabase Auth até a nova confirmação.
  const { error } = await supabase.from('profiles').update({
    name: profile.name.trim(),
    avatar_uri: profile.avatarUri ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', user.id);
  throwIfError(error);

  if (requestedEmail === currentEmail) return { email: user.email, emailChangePending: false };
  const emailRedirectTo = createAuthRedirectUrl({
    platform: Platform.OS,
    origin: typeof window !== 'undefined' ? window.location.origin : undefined,
    createUrl: ExpoLinking.createURL,
  });
  const { error: emailError } = await supabase.auth.updateUser(
    { email: requestedEmail },
    { emailRedirectTo }
  );
  if (emailError) {
    // Nome e avatar já foram salvos; deixe claro que apenas a mudança de e-mail falhou.
    return { email: user.email, emailChangePending: false, emailChangeError: emailError.message };
  }
  return { email: user.email, emailChangePending: true };
}

export async function getPreference(key) {
  return preferences()?.getItem(`meu-financeiro:${key}`) ?? null;
}

export async function setPreference(key, value) {
  preferences()?.setItem(`meu-financeiro:${key}`, String(value));
}

export async function clearUserSession() {
  const { error } = await getSupabase().auth.signOut();
  throwIfError(error);
}

export async function getTransactions(filter = 'todos') {
  let query = getSupabase().from('transactions').select('*').order('due_date', { ascending: true }).order('created_at', { ascending: false });
  if (filter === 'pendente') query = query.eq('status', 'pendente');
  if (filter === 'concluida') query = query.eq('status', 'concluida');
  if (filter === 'futuras') query = query.gt('due_date', getLocalTodayIso()).eq('status', 'pendente');
  const { data, error } = await query;
  throwIfError(error);
  return data ?? [];
}

export async function saveTransaction(transaction, id = null) {
  const payload = {
    type: transaction.type,
    description: transaction.description,
    amount: transaction.amount,
    category: transaction.category,
    due_date: transaction.dueDate,
  };
  const supabase = getSupabase();
  const response = id
    ? await supabase.from('transactions').update(payload).eq('id', id).select('id').single()
    : await supabase.from('transactions').insert(payload).select('id').single();
  throwIfError(response.error);
  return response.data.id;
}

export async function deleteTransaction(id) {
  const { data, error } = await getSupabase().from('transactions').delete().eq('id', id).select('id');
  throwIfError(error);
  if (!data?.length) throw new Error('A transação não foi excluída. Confira sua sessão e tente novamente.');
}

export async function changeTransactionStatus(id, status) {
  const { error } = await getSupabase().from('transactions').update({ status }).eq('id', id);
  throwIfError(error);
}

export async function getMonthlySummary() {
  const month = getLocalTodayIso().slice(0, 7);
  const startDate = `${month}-01`;
  const nextMonthStart = new Date(`${startDate}T00:00:00Z`);
  nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);
  // due_date é do tipo DATE no PostgreSQL, não texto (LIKE não se aplica).
  const { data, error } = await getSupabase().from('transactions')
    .select('type, amount, status')
    .gte('due_date', startDate)
    .lt('due_date', nextMonthStart.toISOString().slice(0, 10));
  throwIfError(error);
  return (data ?? []).reduce((summary, item) => ({
    receitas: summary.receitas + (item.type === 'receita' ? Number(item.amount) : 0),
    despesas: summary.despesas + (item.type === 'despesa' ? Number(item.amount) : 0),
    comprometido: summary.comprometido + (item.type === 'despesa' && item.status === 'pendente' ? Number(item.amount) : 0),
  }), { receitas: 0, despesas: 0, comprometido: 0 });
}

export async function getReminders() {
  const { data, error } = await getSupabase().from('reminders').select('*, transactions(description)').order('reminder_date', { ascending: true }).order('reminder_time', { ascending: true });
  throwIfError(error);
  return (data ?? []).map(({ transactions, ...reminder }) => ({ ...reminder, transaction_description: transactions?.description ?? null }));
}

export async function saveReminder(reminder, notificationId, id = null) {
  const payload = {
    title: reminder.title,
    notes: reminder.notes,
    reminder_date: reminder.reminderDate,
    reminder_time: reminder.reminderTime,
    transaction_id: reminder.transactionId || null,
    notification_id: notificationId || null,
  };
  const supabase = getSupabase();
  const response = id
    ? await supabase.from('reminders').update(payload).eq('id', id).select('id').single()
    : await supabase.from('reminders').insert(payload).select('id').single();
  throwIfError(response.error);
  return response.data.id;
}

export async function deleteReminder(id) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('reminders').select('notification_id').eq('id', id).single();
  throwIfError(error);
  const { data: deleted, error: deleteError } = await supabase.from('reminders').delete().eq('id', id).select('id');
  throwIfError(deleteError);
  if (!deleted?.length) throw new Error('O lembrete não foi excluído. Confira sua sessão e tente novamente.');
  return data?.notification_id ?? null;
}
