# Estado operacional

## Confirmado e implementado nesta execução

- Branch de trabalho criada: `chore/meu-financeiro-1-0-completion`; alterações anteriores em `index.js` e `src/screens/AuthWebScreen.js`, além do ZIP não rastreado, foram preservadas.
- Baseline anterior: `npm test` 13/13 e Expo Doctor 20/20.
- O mobile deixou de usar a sessão SQLite demonstrativa: `src/database/transactions.js` usa agora o mesmo Supabase/Auth/RLS da Web. O SQLite legado não é apagado, lido ou associado automaticamente a uma conta.
- `expo-secure-store` 58.0.3 foi instalado e substitui `localStorage` como armazenamento de sessão no Android/iOS; Web mantém `localStorage`.
- O retorno de deep link suporta PKCE (`code`) e fluxo implícito (`access_token` + `refresh_token`); há testes para os dois formatos e ausência de dados.
- Cadastro, login, confirmação por link, reenvio e recuperação passam a usar a tela Supabase comum a Web/mobile. A tela anterior de código numérico permanece removida.
- `app.json` contém `scheme: meufinanceiro`, Android package e iOS bundle identifier `com.meufinanceiro.academico`.
- `eas.json` criado com perfis development, preview APK interno e production.

## Verificações reais após as alterações

- `npm test`: 16/16 aprovados.
- `npm run check`: export Android concluído.
- `npx expo export --platform web`: concluído.
- `npx expo-doctor`: 20/20 aprovados.
- `npx expo config --json --type public`: scheme, package e bundle identifier presentes.
- `git diff --check`: sem erros de whitespace.
- Verificação mais recente após todas as alterações: `npm run test` 16/16 aprovado; `npm run check` concluiu export Android; `npx expo-doctor` passou 20/20.

- O script `supabase/schema.sql` agora exige que `reminders.transaction_id` e `reminders.user_id` correspondam a `(transactions.id, transactions.user_id)`, bloqueando vínculo entre usuários no banco.
- `npm run test` continuou 16/16 aprovado depois da alteração do esquema.

- A etapa 1 foi iniciada: `expo-linking` foi instalado via Expo SDK 58, `AuthWebScreen` passou a usar `ExpoLinking.createURL` e o feedback nativo utiliza `Alert.alert`.
- Teste novo de URLs de callback: 2/2 aprovado; suíte total: 18/18 aprovada; export Android e Expo Doctor aprovados.
- O listener de callbacks ainda está no ciclo de vida de `AuthWebScreen`; mover para `App.js` continua pendente antes de concluir a etapa 1.

- Autenticação centralizada em `App.js`: um único listener global para eventos Supabase e deep links, deduplicação de URL, limpeza de dados em `SIGNED_OUT` e bloqueio de `SIGNED_IN` durante recuperação de senha.
- `AuthWebScreen` usa o modo entregue pelo gerenciador global e não cria listener duplicado quando renderizada pelo aplicativo.
- Última validação após esta mudança: 18/18 testes aprovados; export Android e Web concluídos; `git diff --check` sem erro.

## Limitações e riscos confirmados

- O acesso ao Supabase real, políticas RLS executadas, envio/recebimento de e-mail e callback em aparelho não foram executados. Não foram criadas contas nem enviados e-mails reais.
- O projeto Supabase precisa executar `supabase/schema.sql` e cadastrar `meufinanceiro://auth/callback` e `meufinanceiro://auth/recovery` nas Redirect URLs.
- `npm audit --omit=dev` lista 5 vulnerabilidades transitivas: 3 moderadas, 1 alta e 1 crítica. Nenhuma correção automática foi aplicada por risco de incompatibilidade com Expo.
- EAS CLI não está disponível localmente; nenhuma APK foi gerada nem instalada.
- Ainda faltam P1/P2 de pesquisa/filtros completos, centavos inteiros, testes de serviços/RLS com mock, revisão de fotos mobile remotas, teste físico e documentação acadêmica final.

## Próxima ação

- Revisar a arquitetura do componente de autenticação/App.js, concluir os fluxos e testes P1 sem apagar a compatibilidade existente, e validar em development build depois da configuração remota.
