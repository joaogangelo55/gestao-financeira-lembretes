
import { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import * as ExpoLinking from 'expo-linking';
import { getSupabase } from '../services/supabaseClient';
import { createAuthRedirectUrl } from '../services/authRedirect.mjs';

// Validação básica de formato.
// A confirmação da propriedade do e-mail é feita pelo Supabase.
const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const emailClean = (value) =>
  value.trim().toLowerCase();

const recoveryUrl = () =>
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search)
    .get('recover') === '1';

function notice(title, message) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

function authRedirectUrl(recovery = false) {
  return createAuthRedirectUrl({
    platform: Platform.OS,
    recovery,
    origin: typeof window !== 'undefined' ? window.location.origin : undefined,
    createUrl: ExpoLinking.createURL,
  });
}

function Input({ label, ...props }) {
  return (
    <View>
      <Text style={styles.label}>
        {label}
      </Text>

      <TextInput
        style={styles.input}
        placeholderTextColor="#7A8277"
        autoCorrect={false}
        {...props}
      />
    </View>
  );
}

function Action({ title, onPress, disabled }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={styles.buttonText}>
        {title}
      </Text>
    </Pressable>
  );
}

function Link({ title, onPress, disabled }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.link}>
        {title}
      </Text>
    </Pressable>
  );
}

export default function AuthWebScreen({ onAuthenticated, requestedMode = null }) {
  const [mode, setMode] = useState(requestedMode || (recoveryUrl() ? 'reset' : 'signin'));

  useEffect(() => {
    if (requestedMode) setMode(requestedMode);
  }, [requestedMode]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [newPassword, setNewPassword] =
    useState('');
  const [confirmNewPassword, setConfirmNewPassword] =
    useState('');

  const [busy, setBusy] = useState(false);

  async function openPanel() {
    // A navegação pertence ao App.js; nunca reiniciar a página para trocar de tela.
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.replaceState({}, '', window.location.pathname);
    }
    await onAuthenticated?.();
  }

  function changeMode(next) {
    setPassword('');
    setConfirmPassword('');
    setMode(next);
  }

  async function runRequest() {
    if (busy) return;

    if (mode !== 'reset' && !isValidEmail(email)) {
      notice(
        'E-mail inválido',
        'Informe um endereço de e-mail válido.'
      );
      return;
    }

    if (
      (mode === 'signin' || mode === 'signup') &&
      password.length < 6
    ) {
      notice(
        'Senha inválida',
        'A senha precisa ter ao menos 6 caracteres.'
      );
      return;
    }

    if (mode === 'signup' && name.trim().length < 2) {
      notice(
        'Nome inválido',
        'Digite seu nome.'
      );
      return;
    }

    if (
      mode === 'signup' &&
      password !== confirmPassword
    ) {
      notice(
        'Senhas diferentes',
        'A confirmação deve ser igual à senha.'
      );
      return;
    }

    if (
      mode === 'reset' &&
      newPassword.length < 8
    ) {
      notice(
        'Senha muito curta',
        'Defina uma senha com pelo menos 8 caracteres.'
      );
      return;
    }

    if (
      mode === 'reset' &&
      newPassword !== confirmNewPassword
    ) {
      notice(
        'Senhas diferentes',
        'Repita corretamente a nova senha.'
      );
      return;
    }

    setBusy(true);

    try {
      const auth = getSupabase().auth;

      // LOGIN DE USUÁRIO EXISTENTE
      if (mode === 'signin') {
        const { error } =
          await auth.signInWithPassword({
            email: emailClean(email),
            password,
          });

        if (error) throw error;

        // A sessão fica salva pelo cliente Supabase.
        await openPanel();
      }

      // CRIAR NOVA CONTA
      else if (mode === 'signup') {
        const { data, error } = await auth.signUp({
          email: emailClean(email),
          password,
          options: {
            data: {
              name: name.trim(),
            },
            emailRedirectTo: authRedirectUrl(),
          },
        });

        if (error) throw error;

        // Se a confirmação de e-mail estiver desativada,
        // o Supabase poderá retornar uma sessão diretamente.
        if (data.session) {
          await openPanel();
          return;
        }

        // A confirmação é feita SOMENTE pelo link enviado por e-mail.
        // Esta tela não pede um código de segurança.
        setPassword('');
        setConfirmPassword('');
        setMode('pending');
      }

      // SOLICITAÇÃO DE RECUPERAÇÃO
      else if (mode === 'forgot') {
        const { error } =
          await auth.resetPasswordForEmail(
            emailClean(email),
            {
              redirectTo: authRedirectUrl(true),
            }
          );

        if (error) throw error;

        notice(
          'Confira seu e-mail',
          'Se existir uma conta com esse endereço, você receberá o link de recuperação.'
        );

        changeMode('signin');
      }

      // SALVAR SENHA APÓS ABRIR O LINK
      else if (mode === 'reset') {
        const {
          data,
          error: sessionError,
        } = await auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!data.session) {
          throw new Error(
            'Link inválido ou expirado. Solicite outro pelo botão Esqueci minha senha.'
          );
        }

        const { error } = await auth.updateUser({
          password: newPassword,
        });

        if (error) throw error;

        // Encerra a sessão de recuperação.
        const {
          error: logoutError,
        } = await auth.signOut();

        if (logoutError) {
          throw logoutError;
        }

        if (Platform.OS === 'web') {
          window.history.replaceState({}, '', window.location.pathname);
        }

        setNewPassword('');
        setConfirmNewPassword('');

        notice(
          'Senha alterada',
          'Agora você pode entrar usando sua nova senha.'
        );

        changeMode('signin');
      }
    } catch (error) {
      notice(
        'Não foi possível concluir',
        error.message || 'Tente novamente.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    if (busy || !isValidEmail(email)) {
      return;
    }

    setBusy(true);

    try {
      const { error } =
        await getSupabase().auth.resend({
          type: 'signup',
          email: emailClean(email),
          options: {
            emailRedirectTo: authRedirectUrl(),
          },
        });

      if (error) throw error;

      notice(
        'Solicitação recebida',
        'Se a conta estiver aguardando confirmação, um novo e-mail será enviado.'
      );
    } catch (error) {
      notice(
        'Não foi possível reenviar',
        error.message || 'Tente novamente.'
      );
    } finally {
      setBusy(false);
    }
  }

  const titles = {
    signin: 'Seu dinheiro,\ndo seu jeito.',
    signup: 'Criar minha conta',
    pending: 'Confira seu e-mail',
    forgot: 'Recuperar senha',
    reset: 'Cadastrar nova senha',
  };

  const subtitles = {
    signin:
      'Entre usando sua conta cadastrada no Meu Financeiro.',
    signup:
      'Use um e-mail que você realmente consegue acessar.',
    pending:
      'Enviamos um link de confirmação para seu endereço. Abra o e-mail e toque em Confirmar. Depois disso, o Meu Financeiro abrirá seu painel automaticamente.',
    forgot:
      'Enviaremos um link para redefinir sua senha.',
    reset:
      'Defina uma nova senha para sua conta.',
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>
                $
              </Text>
            </View>

            <Text style={styles.brandText}>
              Meu Financeiro
            </Text>
          </View>

          <Text style={styles.title}>
            {titles[mode]}
          </Text>

          <Text style={styles.subtitle}>
            {subtitles[mode]}
          </Text>

          <View style={styles.card}>
            {mode === 'signup' && (
              <Input
                label="Seu nome"
                value={name}
                onChangeText={setName}
                placeholder="Ex.: Ana Silva"
              />
            )}

            {mode !== 'reset' && (
              <Input
                label="E-mail"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={mode !== 'pending'}
                placeholder="voce@email.com"
              />
            )}

            {(mode === 'signin' ||
              mode === 'signup') && (
              <Input
                label="Senha"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Pelo menos 6 caracteres"
              />
            )}

            {mode === 'signup' && (
              <Input
                label="Confirmar senha"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            )}

            {mode === 'pending' && (
              <Text style={styles.subtitle}>
                Se não encontrar o link, verifique também a pasta de spam.
                Se este e-mail já tiver uma conta, use a opção de entrar.
              </Text>
            )}

            {mode === 'reset' && (
              <>
                <Input
                  label="Nova senha"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  placeholder="Pelo menos 8 caracteres"
                />

                <Input
                  label="Confirmar nova senha"
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  secureTextEntry
                />
              </>
            )}

            {mode !== 'pending' && (
              <Action
                disabled={busy}
                title={
                  busy
                    ? 'Aguarde…'
                    : mode === 'signin'
                      ? 'Entrar no meu painel'
                      : mode === 'signup'
                        ? 'Criar minha conta'
                        : mode === 'forgot'
                          ? 'Enviar link de recuperação'
                          : 'Salvar nova senha'
                }
                onPress={runRequest}
              />
            )}

            {busy && (
              <ActivityIndicator color="#356D17" />
            )}

            {mode === 'signin' && (
              <>
                <Link
                  title="Esqueci minha senha"
                  onPress={() => changeMode('forgot')}
                />

                <Link
                  title="Ainda não tenho conta: criar agora"
                  onPress={() => changeMode('signup')}
                />
              </>
            )}

            {mode === 'pending' && (
              <Link
                title="Reenviar e-mail de confirmação"
                disabled={busy}
                onPress={resendConfirmation}
              />
            )}

            {(mode === 'signup' ||
              mode === 'pending' ||
              mode === 'forgot') && (
              <Link
                title="Já tenho uma conta: entrar"
                onPress={() => changeMode('signin')}
              />
            )}

            {mode === 'reset' && (
              <Text style={styles.subtitle}>
                Se o link não funcionar, solicite outro em
                Esqueci minha senha.
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8FAF4',
  },

  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  logo: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#163300',
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoText: {
    color: '#9FE870',
    fontWeight: '900',
    fontSize: 26,
  },

  brandText: {
    color: '#163300',
    fontSize: 20,
    fontWeight: '900',
  },

  title: {
    color: '#0E0F0C',
    fontWeight: '900',
    fontSize: 36,
    lineHeight: 41,
    marginTop: 18,
  },

  subtitle: {
    color: '#62695F',
    fontSize: 15,
    lineHeight: 22,
  },

  card: {
    backgroundColor: '#FFF',
    borderColor: '#E1E5DC',
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    gap: 12,
  },

  label: {
    color: '#163300',
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 6,
  },

  input: {
    minHeight: 48,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D7DDD2',
    borderRadius: 13,
    paddingHorizontal: 13,
    color: '#0E0F0C',
    fontSize: 16,
  },

  button: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: '#9FE870',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },

  buttonText: {
    color: '#163300',
    fontWeight: '900',
  },

  link: {
    color: '#356D17',
    fontWeight: '800',
    paddingVertical: 6,
  },
});