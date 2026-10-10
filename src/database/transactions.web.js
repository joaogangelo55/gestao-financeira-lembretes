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
  if (data) return { name: data.name, email: data.email, avatarUri: data.avatar_uri };

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
  const user = await currentUser();
  const { error } = await getSupabase().from('profiles').update({
    name: profile.name,
    email: profile.email,
    avatar_uri: profile.avatarUri ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', user.id);
  throwIfError(error);
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
  const { error } = await getSupabase().from('transactions').delete().eq('id', id);
  throwIfError(error);
}

export async function changeTransactionStatus(id, status) {
  const { error } = await getSupabase().from('transactions').update({ status }).eq('id', id);
  throwIfError(error);
}

export async function getMonthlySummary() {
  const month = getLocalTodayIso().slice(0, 7);
  const { data, error } = await getSupabase().from('transactions').select('type, amount, status').like('due_date', `${month}-%`);
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
  const { error: deleteError } = await supabase.from('reminders').delete().eq('id', id);
  throwIfError(deleteError);
  return data?.notification_id ?? null;
}
