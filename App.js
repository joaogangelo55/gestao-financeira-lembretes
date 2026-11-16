import AuthWebScreen from './src/screens/AuthWebScreen';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as ExpoLinking from 'expo-linking';
import { getSupabase } from './src/services/supabaseClient';
import { parseAuthCallback } from './src/services/authCallback.mjs';
import Avatar from './src/components/Avatar';
import DateInput from './src/components/DateInput';
import { changeTransactionStatus, clearUserSession, deleteReminder, deleteTransaction, getMonthlySummary, getPreference, getReminders, getTransactions, getUserSession, initDatabase, saveReminder, saveTransaction, setPreference, updateUserProfile } from './src/database/transactions';
import { cancelReminder, prepareNotifications, scheduleReminder } from './src/services/notifications';
import { persistAndScheduleReminder } from './src/services/reminderWorkflow.mjs';
import { chooseProfileImage, removeProfileImage } from './src/services/profileImages';
import { getLocalTodayIso, isoToBrDate } from './src/utils/dates.mjs';
import { validateReminder, validateTransaction } from './src/utils/validation.mjs';

SplashScreen.preventAutoHideAsync().catch(() => {});

const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const newTransaction = () => ({ type: 'despesa', description: '', amount: '', category: '', dueDate: isoToBrDate(getLocalTodayIso()) });
const newReminder = () => ({ title: '', notes: '', reminderDate: isoToBrDate(getLocalTodayIso()), reminderTime: '09:00', transactionId: null });

// Alert.alert não exibe mensagens de forma consistente no navegador.
function showFeedback(title, message) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

// Usa confirmação nativa no celular e window.confirm no navegador.
function confirmAction(title, message, confirmLabel, onConfirm) {
  const execute = async () => {
    try {
      await onConfirm();
    } catch (cause) {
      console.error('Falha na ação confirmada', cause);
      showFeedback('Não foi possível concluir', cause?.message || 'Tente novamente.');
    }
  };
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(`${title}\n\n${message}`)) void execute();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: () => { void execute(); } },
  ]);
}

// Mantém o botão de cadastro visível acima da lista, inclusive na versão Web.
const financeActions = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  add: { borderRadius: 18, backgroundColor: '#9FE870', paddingHorizontal: 16, paddingVertical: 12 },
  addText: { fontWeight: '900', color: '#163300' },
});

export default function App() {
  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('início');
  const [transactions, setTransactions] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [summary, setSummary] = useState({ receitas: 0, despesas: 0, comprometido: 0 });
  const [filter, setFilter] = useState('todos');
  const [transactionForm, setTransactionForm] = useState(null);
  const [reminderForm, setReminderForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [authScreenMode, setAuthScreenMode] = useState(null);
  const recoveryFlowRef = useRef(false);
  const authLoadSequenceRef = useRef(0);

  async function refresh(currentFilter = filter) {
    const [items, reminderItems, monthly] = await Promise.all([getTransactions(currentFilter), getReminders(), getMonthlySummary()]);
    setTransactions(items); setReminders(reminderItems); setSummary(monthly || {});
  }
  async function initialize() {
    try {
      setError(null); setPhase('loading');
      await initDatabase();
      if (Platform.OS === 'web' && typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('recover') === '1') {
        recoveryFlowRef.current = true;
        setAuthScreenMode('reset');
        setPhase('login');
        return;
      }
      const savedUser = await getUserSession();
      if (recoveryFlowRef.current) {
        setAuthScreenMode('reset');
        setPhase('login');
        return;
      }
      const onboarding = await getPreference('onboarding_completed');
      // A API financeira exige autenticação; não consultar antes do login.
      if (savedUser) {
        await refresh();
      } else {
        setTransactions([]);
        setReminders([]);
        setSummary({ receitas: 0, despesas: 0, comprometido: 0 });
      }
      if (recoveryFlowRef.current) {
        setAuthScreenMode('reset'); setPhase('login'); return;
      }
      setUser(savedUser);
      setPhase(savedUser ? 'app' : onboarding === 'true' ? 'login' : 'onboarding');
    } catch (cause) { console.error('Falha ao inicializar', cause); setError(Platform.OS === 'web' ? 'Não foi possível carregar os dados na nuvem. Verifique a conexão e consulte o Console do navegador.' : 'Não foi possível preparar os dados locais. Seus dados não foram apagados.'); setPhase('error'); }
    finally { SplashScreen.hideAsync().catch(() => {}); }
  }
  useEffect(() => { initialize(); }, []);
  // Único listener global. Nenhum método do Supabase é chamado dentro do callback.
  useEffect(() => {
    let active = true;
    const processed = new Set();
    const isWebRecovery = () => Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('recover') === '1';

    const clearInMemoryData = () => {
      setTransactions([]); setReminders([]);
      setSummary({ receitas: 0, despesas: 0, comprometido: 0 });
    };
    const loadAuthenticatedUser = async () => {
      const sequence = ++authLoadSequenceRef.current;
      if (recoveryFlowRef.current || isWebRecovery()) return;
      const authenticatedUser = await getUserSession();
      if (!active || sequence !== authLoadSequenceRef.current || !authenticatedUser || recoveryFlowRef.current || isWebRecovery()) return;
      const [items, reminderItems, monthly] = await Promise.all([
        getTransactions(filter), getReminders(), getMonthlySummary(),
      ]);
      if (!active || sequence !== authLoadSequenceRef.current || recoveryFlowRef.current || isWebRecovery()) return;
      setTransactions(items); setReminders(reminderItems); setSummary(monthly || {});
      setUser(authenticatedUser); setPhase('app'); setAuthScreenMode(null);
    };
    const deferAuthLoad = () => {
      setTimeout(() => {
        if (!active || recoveryFlowRef.current || isWebRecovery()) return;
        void loadAuthenticatedUser().catch((cause) => {
          if (active) showFeedback('Não foi possível carregar sua conta', cause.message || 'Tente novamente.');
        });
      }, 0);
    };
    const completeLink = async (url) => {
      if (Platform.OS === 'web' || !url || processed.has(url)) return;
      const callback = parseAuthCallback(url);
      if (!callback) return;
      processed.add(url);
      if (callback.kind === 'error') {
        showFeedback('Link inválido ou expirado', callback.message || 'Solicite outro link.');
        return;
      }
      if (callback.type === 'recovery') {
        recoveryFlowRef.current = true;
        authLoadSequenceRef.current++;
        setAuthScreenMode('reset'); setPhase('login');
      }
      const auth = getSupabase().auth;
      const result = callback.kind === 'pkce'
        ? await auth.exchangeCodeForSession(callback.code)
        : await auth.setSession({ access_token: callback.accessToken, refresh_token: callback.refreshToken });
      if (result.error) throw result.error;
      if (callback.type !== 'recovery') deferAuthLoad();
    };
    const { data: { subscription } } = getSupabase().auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') {
        recoveryFlowRef.current = true;
        authLoadSequenceRef.current++;
        setAuthScreenMode('reset'); setPhase('login');
        return;
      }
      if (event === 'SIGNED_OUT') {
        recoveryFlowRef.current = false;
        authLoadSequenceRef.current++;
        clearInMemoryData(); setUser(null); setAuthScreenMode(null); setPhase('login');
        return;
      }
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user &&
        !recoveryFlowRef.current && !isWebRecovery()) {
        deferAuthLoad();
      }
      // TOKEN_REFRESHED não exige recarregar todas as transações do usuário.
    });
    const linkSubscription = Platform.OS === 'web' ? null : ExpoLinking.addEventListener('url', ({ url }) => {
      void completeLink(url).catch((cause) => showFeedback('Link inválido ou expirado', cause.message || 'Solicite outro link.'));
    });
    if (Platform.OS !== 'web') ExpoLinking.getInitialURL()
      .then((url) => void completeLink(url).catch(() => {})).catch(() => {});
    return () => {
      active = false;
      authLoadSequenceRef.current++;
      subscription.unsubscribe();
      linkSubscription?.remove();
    };
  }, []);
  useEffect(() => { if (phase === 'app') refresh().catch((cause) => Alert.alert('Erro ao atualizar', cause.message)); }, [filter]);

  async function completeOnboarding() { await setPreference('onboarding_completed', 'true'); setPhase(user ? 'app' : 'login'); }
  async function handleAuthenticated() {
    try {
      setBusy(true);
      const authenticatedUser = await getUserSession();
      if (!authenticatedUser) throw new Error('A sessão não foi estabelecida. Tente entrar novamente.');
      await refresh();
      setUser(authenticatedUser);
      setPhase('app');
    } catch (cause) {
      showFeedback('Não foi possível abrir o painel', cause.message || 'Tente entrar novamente.');
    } finally {
      setBusy(false);
    }
  }
  async function logout() { try { await clearUserSession(); setUser(null); setTransactions([]); setReminders([]); setSummary({ receitas: 0, despesas: 0, comprometido: 0 }); setTab('início'); setPhase('login'); } catch (cause) { Alert.alert('Não foi possível sair', cause.message); } }
  async function submitTransaction() {
    const result = validateTransaction(transactionForm); if (!result.valid) return showFeedback('Revise os dados', result.error);
    try { setBusy(true); await saveTransaction(result.value, transactionForm.id); setTransactionForm(null); await refresh(); } catch (cause) { showFeedback('Não foi possível salvar', cause.message); } finally { setBusy(false); }
  }
  async function submitReminder() {
    const result = validateReminder(reminderForm);
    if (!result.valid) return showFeedback('Revise os dados', result.error);
    try {
      setBusy(true);
      const operation = await persistAndScheduleReminder({
        reminder: result.value,
        id: reminderForm.id ?? null,
        previousNotificationId: reminderForm.notificationId ?? null,
        save: saveReminder,
        schedule: scheduleReminder,
        cancel: cancelReminder,
      });
      setReminderForm(null);
      await refresh();
      if (operation.warning) showFeedback('Lembrete salvo', operation.warning);
    } catch (cause) {
      showFeedback('Não foi possível salvar o lembrete', cause.message || 'Tente novamente.');
    } finally {
      setBusy(false);
    }
  }
  const balance = Number(summary.receitas || 0) - Number(summary.despesas || 0);
  if (phase === 'loading') return <Loading />;
  if (phase === 'error') return <Failure message={error} onRetry={initialize} />;
  if (phase === 'onboarding') return <Onboarding onDone={completeOnboarding} />;
  if (phase === 'login') return <LoginScreen onAuthenticated={handleAuthenticated} requestedMode={authScreenMode} />;
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" />
    <View style={styles.app}>
      {tab === 'início' && <Dashboard user={user} balance={balance} summary={summary} reminders={reminders} onFinance={() => { setTab('finanças'); setTransactionForm(newTransaction()); }} onReminder={() => { setTab('lembretes'); setReminderForm(newReminder()); }} onProfile={() => setTab('ajustes')} />}
      {tab === 'finanças' && <Finance transactions={transactions} filter={filter} setFilter={setFilter} onAdd={() => setTransactionForm(newTransaction())} onEdit={(item) => setTransactionForm({ ...item, dueDate: isoToBrDate(item.due_date) })} onDelete={(item) => confirmAction('Excluir transação?', `${item.description}\nEsta ação não pode ser desfeita.`, 'Excluir', async () => { await deleteTransaction(item.id); await refresh(); })} onStatus={async (item) => { await changeTransactionStatus(item.id, item.status === 'pendente' ? 'concluida' : 'pendente'); refresh(); }} />}
      {tab === 'lembretes' && <Reminders reminders={reminders} onAdd={() => setReminderForm(newReminder())} onEdit={(item) => setReminderForm({ ...item, reminderDate: isoToBrDate(item.reminder_date), reminderTime: item.reminder_time, transactionId: item.transaction_id, notificationId: item.notification_id })} onDelete={(item) => confirmAction('Excluir lembrete?', `${item.title}\nEsta ação não pode ser desfeita.`, 'Excluir', async () => { const id = await deleteReminder(item.id); await cancelReminder(id); await refresh(); })} />}
      {tab === 'ajustes' && <Settings user={user} setUser={setUser} onProfile={() => setTab('perfil')} onOnboarding={() => setPhase('onboarding')} onLogout={logout} />}
      {tab === 'perfil' && <Profile user={user} onBack={() => setTab('ajustes')} onSaved={setUser} />}
      {tab !== 'perfil' && <Nav tab={tab} setTab={setTab} />}
    </View>
    <TransactionModal value={transactionForm} setValue={setTransactionForm} onSave={submitTransaction} busy={busy} />
    <ReminderModal value={reminderForm} setValue={setReminderForm} transactions={transactions} onSave={submitReminder} busy={busy} />
  </SafeAreaView>;
}

function Loading() { return <SafeAreaView style={styles.center}><Text style={styles.title}>Preparando o Meu Financeiro…</Text></SafeAreaView>; }
function Failure({ message, onRetry }) { return <SafeAreaView style={styles.center}><Text style={styles.title}>Algo não saiu como esperado</Text><Text style={styles.muted}>{message}</Text><Button title="Tentar novamente" onPress={onRetry} /></SafeAreaView>; }
function Onboarding({ onDone }) { const [page, setPage] = useState(0); const pages = [['Organize seu dinheiro com facilidade', 'Registre receitas, despesas e contas a pagar. Acompanhe suas movimentações e tenha uma visão clara das suas finanças.', '◔'], ['Não esqueça seus compromissos', 'Crie lembretes, acompanhe vencimentos e receba notificações locais para organizar melhor sua rotina.', '◷'], ['Mais controle, menos preocupação', 'Visualize seu resumo financeiro, acompanhe suas pendências e organize tudo em um único aplicativo.', '↗']]; const [title, copy, icon] = pages[page]; return <SafeAreaView style={styles.onboarding}><Pressable accessibilityRole="button" style={styles.skip} onPress={onDone}><Text style={styles.link}>Pular</Text></Pressable><View style={styles.onboardingBody}><Text style={styles.onboardingIcon}>{icon}</Text><Text style={styles.onboardingTitle}>{title}</Text><Text style={styles.onboardingCopy}>{copy}</Text></View><View style={styles.dots}>{pages.map((_, index) => <View key={index} style={[styles.dotPage, page === index && styles.dotPageActive]} />)}</View><View style={styles.onboardingActions}>{page > 0 && <Button title="Voltar" variant="secondary" onPress={() => setPage(page - 1)} />}{page < 2 ? <Button title="Próximo" onPress={() => setPage(page + 1)} /> : <Button title="Começar a usar" onPress={onDone} />}</View></SafeAreaView>; }
function LoginScreen({ onAuthenticated, requestedMode }) {
  return <AuthWebScreen onAuthenticated={onAuthenticated} requestedMode={requestedMode} />;
}
function Dashboard({ user, balance, summary, reminders, onFinance, onReminder, onProfile }) { return <ScrollView contentContainerStyle={styles.scroll}><View style={styles.top}><Brand compact/><Pressable onPress={onProfile} accessibilityLabel="Abrir perfil"><Avatar name={user.name} uri={user.avatarUri} /></Pressable></View><Text style={styles.eyebrow}>VISÃO GERAL</Text><Text style={styles.heading}>Olá, {user.name.split(' ')[0]}.</Text><View style={styles.balanceCard}><Text style={styles.balanceLabel}>Saldo previsto</Text><Text style={styles.balance}>{money(balance)}</Text><Text style={styles.light}>Considerando receitas e despesas deste mês</Text></View><View style={styles.stats}><Stat label="Receitas" value={money(summary.receitas)} color="#075e35"/><Stat label="Despesas" value={money(summary.despesas)} color="#b42318"/></View><Text style={styles.section}>Ações rápidas</Text><View style={styles.quick}><Quick title="Nova transação" icon="＋" onPress={onFinance}/><Quick title="Novo lembrete" icon="◷" onPress={onReminder}/></View><Text style={styles.section}>Próximos lembretes</Text>{reminders.slice(0, 3).map((item) => <View style={styles.row} key={item.id}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.muted}>{isoToBrDate(item.reminder_date)} às {item.reminder_time}</Text></View>)}{!reminders.length && <Text style={styles.empty}>Você ainda não possui lembretes.</Text>}</ScrollView>; }
function Finance({ transactions, filter, setFilter, onAdd, onEdit, onDelete, onStatus }) { return <View style={styles.page}><View style={financeActions.header}><Text style={styles.heading}>Finanças</Text><Pressable accessibilityRole="button" accessibilityLabel="Adicionar nova transação" onPress={onAdd} style={financeActions.add}><Text style={financeActions.addText}>＋ Nova transação</Text></Pressable></View><ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>{[['todos','Todas'],['pendente','Pendentes'],['concluida','Pagas'],['futuras','Futuras']].map(([id, label]) => <Pressable key={id} onPress={() => setFilter(id)} style={[styles.chip, filter === id && styles.chipActive]}><Text>{label}</Text></Pressable>)}</ScrollView><FlatList data={transactions} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.empty}>Nenhuma transação neste filtro.</Text>} renderItem={({ item }) => <View style={styles.item}><View style={styles.itemMain}><Text style={styles.rowTitle}>{item.description}</Text><Text style={styles.muted}>{item.category} · vence em {isoToBrDate(item.due_date)}</Text><View style={styles.actions}><Text style={styles.link} onPress={() => onStatus(item)}>{item.status === 'pendente' ? 'Marcar paga' : 'Reabrir'}</Text><Text style={styles.link} onPress={() => onEdit(item)}>Editar</Text><Text style={styles.delete} onPress={() => onDelete(item)}>Excluir</Text></View></View><Text style={[styles.amount, { color: item.type === 'receita' ? '#075e35' : '#b42318' }]}>{item.type === 'receita' ? '+' : '-'}{money(item.amount)}</Text></View>}/></View>; }
function Reminders({ reminders, onAdd, onEdit, onDelete }) { return <View style={styles.page}><View style={financeActions.header}><Text style={styles.heading}>Lembretes</Text><Pressable accessibilityRole="button" accessibilityLabel="Adicionar novo lembrete" onPress={onAdd} style={financeActions.add}><Text style={financeActions.addText}>＋ Novo lembrete</Text></Pressable></View><Text style={styles.subheading}>{Platform.OS === 'web' ? 'Lembretes salvos na nuvem. Avisos automáticos ainda não estão disponíveis na versão Web.' : 'Notificações são locais e dependem da permissão do aparelho.'}</Text><FlatList data={reminders} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.empty}>Nenhum lembrete agendado.</Text>} renderItem={({ item }) => <View style={styles.item}><View style={styles.itemMain}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.muted}>{isoToBrDate(item.reminder_date)} às {item.reminder_time}</Text><View style={styles.actions}><Text style={styles.link} onPress={() => onEdit(item)}>Editar</Text><Text style={styles.delete} onPress={() => onDelete(item)}>Excluir</Text></View></View></View>}/></View>; }
function Settings({ user, onProfile, onOnboarding, onLogout }) { const [notice, setNotice] = useState(''); return <ScrollView contentContainerStyle={styles.scroll}><Text style={styles.heading}>Ajustes</Text><Text style={styles.section}>Meu perfil</Text><Pressable style={styles.setting} onPress={onProfile}><Avatar name={user.name} uri={user.avatarUri}/><View><Text style={styles.rowTitle}>{user.name}</Text><Text style={styles.muted}>{user.email}</Text></View><Text style={styles.link}>Editar</Text></Pressable><Text style={styles.section}>Notificações</Text><Button title="Verificar e solicitar permissão" onPress={async () => { const granted = await prepareNotifications(); setNotice(granted ? 'Notificações locais permitidas neste aparelho.' : 'Permissão não concedida. Ative nas configurações do sistema se desejar receber avisos.'); }} variant="secondary"/><Text style={styles.muted}>{notice}</Text><Text style={styles.section}>Preferências regionais</Text><View style={styles.card}><Text>Idioma: Português (Brasil)</Text><Text>Moeda: Real brasileiro (BRL)</Text><Text>Datas: DD/MM/AAAA</Text></View><Text style={styles.section}>Introdução</Text><Button title="Ver apresentação novamente" onPress={onOnboarding} variant="secondary"/><Text style={styles.section}>Sobre e privacidade</Text><View style={styles.card}><Text style={styles.rowTitle}>Meu Financeiro · versão 1.0.0</Text><Text style={styles.muted}>Projeto acadêmico. Sua autenticação, seus dados financeiros e seu perfil utilizam o Supabase. Notificações são locais no celular. Não há integração com contas bancárias.</Text></View><Button title="Sair da sessão" onPress={() => confirmAction('Sair da sessão?', 'Seus registros permanecerão na sua conta do Supabase.', 'Sair', onLogout)} variant="danger"/></ScrollView>; }
function Profile({ user, onBack, onSaved }) { const [draft, setDraft] = useState(user); const [busy, setBusy] = useState(false); async function photo() { try { const result = await chooseProfileImage(); if (!result.cancelled) setDraft({ ...draft, avatarUri: result.uri }); else if (result.reason === 'permission') Alert.alert('Permissão necessária', 'Permita acesso às fotos para escolher um avatar.'); } catch (cause) { Alert.alert('Não foi possível usar a foto', cause.message); } } async function save() { if (draft.name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(draft.email)) return Alert.alert('Revise o perfil', 'Informe nome e e-mail válidos.'); try { setBusy(true); const result = await updateUserProfile({ ...draft, name: draft.name.trim(), email: draft.email.trim().toLowerCase() }); if (user.avatarUri && user.avatarUri !== draft.avatarUri) { try { await removeProfileImage(user.avatarUri); } catch (cleanupError) { console.warn('Não foi possível remover a foto anterior.'); } } onSaved({ ...draft, name: draft.name.trim(), email: result.email }); showFeedback('Perfil atualizado', result.emailChangePending ? 'Nome e foto salvos. Confirme a troca de e-mail pelos links enviados antes de usar o novo endereço.' : result.emailChangeError ? `Nome e foto salvos, mas a troca de e-mail não foi solicitada: ${result.emailChangeError}` : 'As alterações foram salvas na sua conta.'); onBack(); } catch (cause) { Alert.alert('Não foi possível salvar', cause.message); } finally { setBusy(false); } } return <ScrollView contentContainerStyle={styles.scroll}><Text style={styles.link} onPress={onBack}>‹ Voltar aos ajustes</Text><Text style={styles.heading}>Meu perfil</Text><View style={styles.profileAvatar}><Avatar name={draft.name} uri={draft.avatarUri} size={112}/></View><Button title="Alterar foto" onPress={photo} variant="secondary"/>{draft.avatarUri && <Button title="Remover foto" onPress={() => setDraft({ ...draft, avatarUri: null })} variant="danger"/>}<Field label="Nome" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })}/><Field label="E-mail" value={draft.email} keyboardType="email-address" autoCapitalize="none" onChangeText={(email) => setDraft({ ...draft, email })}/><Button title={busy ? 'Salvando…' : 'Salvar alterações'} onPress={save} disabled={busy}/></ScrollView>; }
function TransactionModal({ value, setValue, onSave, busy }) { return <FormModal visible={!!value} title={value?.id ? 'Editar transação' : 'Nova transação'} onClose={() => setValue(null)} onSave={onSave} busy={busy}>{value && <><View style={styles.typeRow}>{['despesa', 'receita'].map((type) => <Pressable key={type} style={[styles.chip, value.type === type && styles.chipActive]} onPress={() => setValue({ ...value, type })}><Text>{type === 'despesa' ? 'Despesa' : 'Receita'}</Text></Pressable>)}</View><Field label="Descrição" value={value.description} onChangeText={(description) => setValue({ ...value, description })}/><Field label="Valor (R$)" value={String(value.amount)} keyboardType="decimal-pad" onChangeText={(amount) => setValue({ ...value, amount })}/><Field label="Categoria" value={value.category} onChangeText={(category) => setValue({ ...value, category })}/><DateField value={value.dueDate} onChangeText={(dueDate) => setValue({ ...value, dueDate })}/></>}</FormModal>; }
function ReminderModal({ value, setValue, transactions, onSave, busy }) { return <FormModal visible={!!value} title={value?.id ? 'Editar lembrete' : 'Novo lembrete'} onClose={() => setValue(null)} onSave={onSave} busy={busy}>{value && <><Field label="Título" value={value.title} onChangeText={(title) => setValue({ ...value, title })}/><Field label="Observações" value={value.notes} onChangeText={(notes) => setValue({ ...value, notes })}/><DateField value={value.reminderDate} onChangeText={(reminderDate) => setValue({ ...value, reminderDate })}/><Field label="Horário" value={value.reminderTime} placeholder="HH:MM" onChangeText={(reminderTime) => setValue({ ...value, reminderTime })}/><Text style={styles.label}>Associar transação (opcional)</Text><ScrollView horizontal>{[null, ...transactions].map((item) => <Pressable key={item?.id ?? 'none'} onPress={() => setValue({ ...value, transactionId: item?.id ?? null })} style={[styles.chip, value.transactionId === (item?.id ?? null) && styles.chipActive]}><Text>{item?.description ?? 'Sem associação'}</Text></Pressable>)}</ScrollView></>}</FormModal>; }
function FormModal({ visible, title, children, onClose, onSave, busy }) { return <Modal visible={visible} animationType="slide" transparent><KeyboardAvoidingView style={styles.shade} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><View style={styles.modal}><View style={styles.top}><Text style={styles.title}>{title}</Text><Text style={styles.link} onPress={onClose}>Fechar</Text></View><ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>{children}</ScrollView><Button title={busy ? 'Salvando…' : 'Salvar'} onPress={onSave} disabled={busy}/></View></KeyboardAvoidingView></Modal>; }
function DateField({ value, onChangeText }) { return <View><Text style={styles.label}>Data</Text><DateInput style={styles.input} value={value} onChangeText={onChangeText} /></View>; }
function Field({ label, ...props }) { return <View><Text style={styles.label}>{label}</Text><TextInput style={styles.input} placeholderTextColor="#7A8277" {...props}/></View>; }
function Button({ title, onPress, variant = 'primary', disabled = false }) { return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, styles[`button_${variant}`], disabled && styles.disabled]}><Text style={[styles.buttonText, variant === 'secondary' && styles.buttonTextSecondary]}>{title}</Text></Pressable>; }
function Brand({ compact = false }) { return <View style={styles.brand}><View style={styles.logo}><Text style={styles.logoText}>$</Text></View>{!compact && <Text style={styles.brandName}>Meu Financeiro</Text>}</View>; }
function Stat({ label, value, color }) { return <View style={styles.stat}><Text style={styles.muted}>{label}</Text><Text style={[styles.amount, { color }]}>{value}</Text></View>; }
function Quick({ title, icon, onPress }) { return <Pressable style={styles.quickCard} onPress={onPress}><Text style={styles.quickIcon}>{icon}</Text><Text style={styles.rowTitle}>{title}</Text></Pressable>; }
function Nav({ tab, setTab }) { return <View style={styles.nav}>{[['início', '⌂', 'Início'], ['finanças', '↗', 'Finanças'], ['lembretes', '◷', 'Lembretes'], ['ajustes', '⚙', 'Ajustes']].map(([id, icon, label]) => <Pressable key={id} style={styles.navItem} onPress={() => setTab(id)} accessibilityState={{ selected: tab === id }}><Text style={[styles.navIcon, tab === id && styles.active]}>{icon}</Text><Text style={[styles.navText, tab === id && styles.active]}>{label}</Text></Pressable>)}</View>; }
const styles = StyleSheet.create({ flex:{flex:1}, safe:{flex:1,backgroundColor:'#F8FAF4'}, app:{flex:1}, center:{flex:1,alignItems:'center',justifyContent:'center',padding:28,backgroundColor:'#F8FAF4',gap:16}, login:{flex:1,backgroundColor:'#F8FAF4'}, loginScroll:{flexGrow:1,justifyContent:'center',padding:26,gap:16}, scroll:{padding:24,paddingBottom:110,gap:14}, page:{flex:1,padding:24,paddingBottom:0}, onboarding:{flex:1,backgroundColor:'#F8FAF4',padding:26}, onboardingBody:{flex:1,justifyContent:'center',alignItems:'center'}, onboardingIcon:{fontSize:100,color:'#163300',marginBottom:36}, onboardingTitle:{fontSize:32,fontWeight:'900',textAlign:'center',color:'#0E0F0C'}, onboardingCopy:{fontSize:17,lineHeight:25,textAlign:'center',color:'#62695F',marginTop:16}, onboardingActions:{flexDirection:'row',gap:10}, skip:{alignItems:'flex-end',padding:8}, dots:{flexDirection:'row',justifyContent:'center',gap:8,marginBottom:20}, dotPage:{width:8,height:8,borderRadius:4,backgroundColor:'#C9CEC5'},dotPageActive:{width:24,backgroundColor:'#163300'}, brand:{flexDirection:'row',alignItems:'center',gap:10},logo:{width:44,height:44,borderRadius:14,backgroundColor:'#163300',alignItems:'center',justifyContent:'center'},logoText:{fontSize:26,fontWeight:'900',color:'#9FE870'},brandName:{fontSize:20,fontWeight:'900',color:'#163300'},bigTitle:{fontSize:36,fontWeight:'900',lineHeight:41,color:'#0E0F0C',marginTop:22},heading:{fontSize:29,fontWeight:'900',color:'#0E0F0C'},title:{fontSize:21,fontWeight:'800',color:'#0E0F0C'},subheading:{fontSize:15,lineHeight:22,color:'#62695F'},card:{backgroundColor:'#FFF',borderColor:'#E1E5DC',borderWidth:1,borderRadius:22,padding:18,gap:10},label:{fontWeight:'800',color:'#163300',marginTop:7,marginBottom:6},input:{minHeight:48,borderWidth:1,borderColor:'#D7DDD2',borderRadius:13,backgroundColor:'#FFF',paddingHorizontal:13,color:'#0E0F0C',fontSize:16},button:{minHeight:48,borderRadius:24,justifyContent:'center',alignItems:'center',paddingHorizontal:15,marginTop:10,alignSelf:'stretch'},button_primary:{backgroundColor:'#9FE870'},button_secondary:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#163300'},button_danger:{backgroundColor:'#B42318'},buttonText:{fontWeight:'900',color:'#163300'},buttonTextSecondary:{color:'#163300'},disabled:{opacity:.55},top:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},eyebrow:{color:'#497527',fontWeight:'900',letterSpacing:1.2,marginTop:8},balanceCard:{backgroundColor:'#0E0F0C',borderRadius:26,padding:24},balanceLabel:{color:'#CDFFAD'},balance:{fontSize:32,fontWeight:'900',color:'#FFF',marginVertical:7},light:{color:'#E2E8DE'},stats:{flexDirection:'row',gap:12},stat:{flex:1,backgroundColor:'#FFF',padding:16,borderRadius:18},section:{fontSize:18,fontWeight:'900',color:'#0E0F0C',marginTop:10},quick:{flexDirection:'row',gap:12},quickCard:{flex:1,backgroundColor:'#EAF7DF',borderRadius:18,padding:15},quickIcon:{fontSize:24,color:'#163300'},row:{padding:15,backgroundColor:'#FFF',borderRadius:16,gap:4},rowTitle:{fontSize:16,fontWeight:'800',color:'#0E0F0C'},muted:{color:'#62695F',lineHeight:20},empty:{color:'#62695F',textAlign:'center',padding:24},filters:{maxHeight:52,marginVertical:10},chip:{paddingHorizontal:13,paddingVertical:9,borderRadius:16,backgroundColor:'#EDF0E9',marginRight:8},chipActive:{backgroundColor:'#9FE870'},list:{gap:10,paddingBottom:8},item:{padding:16,borderRadius:16,backgroundColor:'#FFF',flexDirection:'row',justifyContent:'space-between'},itemMain:{flex:1,gap:5},actions:{flexDirection:'row',gap:16,marginTop:4},link:{color:'#356D17',fontWeight:'800',paddingVertical:5},delete:{color:'#B42318',fontWeight:'800',paddingVertical:5},amount:{fontSize:17,fontWeight:'900'},nav:{position:'absolute',bottom:0,left:0,right:0,flexDirection:'row',backgroundColor:'#FFF',borderTopWidth:1,borderColor:'#E1E5DC',paddingVertical:8},navItem:{flex:1,alignItems:'center',gap:2},navIcon:{fontSize:19,color:'#62695F'},navText:{fontSize:11,color:'#62695F'},active:{color:'#163300',fontWeight:'900'},setting:{backgroundColor:'#FFF',borderRadius:18,padding:14,flexDirection:'row',alignItems:'center',gap:12},profileAvatar:{alignItems:'center',margin:18},typeRow:{flexDirection:'row',marginBottom:7},shade:{flex:1,backgroundColor:'#0008',justifyContent:'flex-end'},modal:{maxHeight:'88%',backgroundColor:'#F8FAF4',borderTopLeftRadius:26,borderTopRightRadius:26,padding:20,gap:10} });