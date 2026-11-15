
import { useState } from 'react';

import {
  ActivityIndicator,
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

import { getSupabase } from '../services/supabaseClient';

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
  if (typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
  }
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

export default function AuthWebScreen() {
  const [mode, setMode] = useState(
    recoveryUrl() ? 'reset' : 'signin'
  );

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] =
    useState('');
  const [confirmNewPassword, setConfirmNewPassword] =
    useState('');

  const [busy, setBusy] = useState(false);

  function changeMode(next) {
    setPassword('');
    setConfirmPassword('');
    setCode('');
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
      mode === 'verify' &&
      !/^\d{6,8}$/.test(code.trim())
    ) {
      notice(
        'Código inválido',
        'Informe o código numérico recebido por e-mail.'
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
        // Recarrega para abrir o painel financeiro.
        window.location.reload();
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
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) throw error;

        // Se a confirmação de e-mail estiver desativada,
        // o Supabase poderá retornar uma sessão diretamente.
        if (data.session) {
          window.location.reload();
          return;
        }

        // Com confirmação ativada, session=null é normal.
        setPassword('');
        setConfirmPassword('');
        setMode('verify');

        notice(
          'Verifique seu e-mail',
          'Se o cadastro puder ser concluído, chegará um código ou link de confirmação. Confira também o spam.'
        );
      }

      // CONFIRMAÇÃO DE CADASTRO COM CÓDIGO
      else if (mode === 'verify') {
        const { data, error } = await auth.verifyOtp({
          email: emailClean(email),
          token: code.trim(),
          type: 'email',
        });

        if (error) throw error;

        if (!data.session) {
          throw new Error(
            'Confirmação recebida, mas nenhuma sessão foi criada.'
          );
        }

        // Usuário verificado: abrir o painel.
        window.location.reload();
      }

      // SOLICITAÇÃO DE RECUPERAÇÃO
      else if (mode === 'forgot') {
        const { error } =
          await auth.resetPasswordForEmail(
            emailClean(email),
            {
              redirectTo:
                `${window.location.origin}/?recover=1`,
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

        window.history.replaceState(
          {},
          '',
          window.location.pathname
        );

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
            emailRedirectTo: window.location.origin,
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
    verify: 'Confirmar meu e-mail',
    forgot: 'Recuperar senha',
    reset: 'Cadastrar nova senha',
  };

  const subtitles = {
    signin:
      'Entre usando sua conta cadastrada no Meu Financeiro.',
    signup:
      'Use um e-mail que você realmente consegue acessar.',
    verify:
      'Digite o código enviado ao e-mail ou abra o link de confirmação recebido.',
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

            {mode === 'verify' && (
              <Input
                label="Código de confirmação"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={8}
                placeholder="000000"
              />
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

            <Action
              disabled={busy}
              title={
                busy
                  ? 'Aguarde…'
                  : mode === 'signin'
                    ? 'Entrar no meu painel'
                    : mode === 'signup'
                      ? 'Criar minha conta'
                      : mode === 'verify'
                        ? 'Confirmar e entrar'
                        : mode === 'forgot'
                          ? 'Enviar link de recuperação'
                          : 'Salvar nova senha'
              }
              onPress={runRequest}
            />

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

            {mode === 'verify' && (
              <Link
                title="Reenviar e-mail de confirmação"
                disabled={busy}
                onPress={resendConfirmation}
              />
            )}

            {(mode === 'signup' ||
              mode === 'verify' ||
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
