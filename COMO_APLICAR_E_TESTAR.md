# CORREÇÃO DIRECIONADA — MEU FINANCEIRO (16/11/2026)

Este pacote altera somente arquivos listados abaixo. Não contém `.env`, segredos,
`node_modules`, arquivos financeiros reais ou o projeto completo.

## Antes de aplicar

Execute dentro da pasta original do projeto (Fedora):

```bash
# Crie um backup SOMENTE dos fontes atuais, sem arquivos .env.
tar -czf ../meu-financeiro-fontes-antes-correcoes.tar.gz App.js src tests package.json package-lock.json
```

Extraia este ZIP por cima da raiz do projeto (substituição controlada), por exemplo:

```bash
unzip -o ~/Downloads/meu-financeiro-correcoes-5-pontos.zip -d .
npx expo install expo-file-system
npm test
npx expo-doctor
npx expo start --clear
```

Se o ZIP estiver em outra pasta, ajuste o caminho. Preserve suas alterações locais
anteriores ao aplicar e revise o `git diff` antes do commit.

## O que foi alterado

- `src/services/authCallback.mjs`: identifica `/auth/recovery` mesmo em PKCE,
  trata erros retornados no link e cobre Expo Go/URL Web nos testes.
- `App.js`: listener global sem chamar métodos Supabase dentro do callback;
  operações assíncronas agendadas fora do evento, guarda contra fluxo de
  recuperação, remove login antigo e mantém a navegação pelo estado React.
- `src/screens/AuthWebScreen.js`: não faz mais `window.location.reload()`;
  sem listener de sessão duplicado dentro do componente.
- `src/database/transactions.js` e `.web.js`: alteração de e-mail pela API
  Supabase Auth; não mostra novo e-mail como confirmado antes do processo;
  nome e avatar continuam no perfil. Sincroniza a cópia do e-mail na próxima
  leitura de perfil após confirmação.
- `src/services/profileImages.js`: faz upload do avatar mobile no Storage
  Supabase, em vez de gravar uma URI local no perfil remoto.
- `package.json`, `package-lock.json`: expo-file-system declarado diretamente
  em versão compatível com o Expo SDK 58.
- `src/services/reminderWorkflow.mjs`: persiste primeiro, agenda depois; se
  a vinculação do novo agendamento falhar, tenta cancelá-lo. Mostra aviso em
  caso de falha parcial, sem afirmar que todo o processo foi concluído.
- Testes adicionais para parser e lembretes.

## O que foi validado neste ambiente

- `npm test`: **25 de 25 testes passaram**.
- Exportação Web: concluída.
- Exportação JavaScript Android/Hermes: concluída.
- Sintaxe de App.js, AuthWebScreen.js e componentes afetados: validada.

Esses resultados NÃO comprovam e-mails reais, RLS remoto, upload de avatar
em aparelho físico ou APK instalado.

## Dependências de serviços reais

Em Supabase > Authentication > URL Configuration, permita apenas URLs
correspondentes aos seus ambientes reais, incluindo na fase de testes:

- `http://localhost:8081/**` (desenvolvimento Web)
- `meufinanceiro://auth/callback`
- `meufinanceiro://auth/recovery`

Para validar upload de fotos, o bucket `avatars` deve existir e as políticas
Storage RLS devem permitir acesso somente às pastas do usuário autenticado.
Veja `supabase/schema.sql` do projeto, mas NÃO o execute cegamente em um banco
existente, pois há criação de policies e possíveis conflitos.

O bucket atual do projeto é público: avatares enviados serão acessíveis por
URL pública. Se desejar privacidade para fotos, será necessário usar bucket
privado e URLs assinadas com expiração.

### Limites importantes

- Não foi enviado nenhum e-mail real nesta validação. Faça teste de confirmação
  e recuperação quando o limite do provedor permitir.
- `expo-sqlite/localStorage/install` já fornece `localStorage` no native:
  não foi necessária troca de armazenamento; validar onboarding após reabrir.
- Não existe transação atômica entre PostgreSQL e agendador do celular. O
  fluxo agora evita notificação órfã quando a gravação inicial falha e tenta
  compensar falhas posteriores. Uma queda do app no meio da operação ou falha
  ao cancelar uma notificação ainda exige reconciliação em etapa posterior.
- Fotos locais antigas permanecem preservadas, mas não se tornam compartilháveis
  automaticamente. Escolha uma nova foto para enviá-la ao Storage.
- A atualização de e-mail pode exigir confirmação no e-mail atual e no novo;
  respeite a configuração Secure Email Change do Supabase.
- O Expo Go não reproduz todos os deep links de uma build instalável.
