# Publicação Web com Supabase

Esta versão mantém o comportamento local no Android/iOS e usa Supabase no navegador. O banco remoto é protegido por autenticação e Row Level Security (RLS): um usuário autenticado só pode acessar o próprio perfil, transações e lembretes.

## O que já está preparado no código

- `src/database/transactions.web.js`: repositório remoto usado somente em Web.
- `src/services/supabaseClient.js`: cliente que aceita apenas variáveis públicas `EXPO_PUBLIC_*`.
- `supabase/schema.sql`: tabelas, índices, RLS, políticas e bucket público de avatares.
- `.env.example`: modelo sem chaves reais.
- `src/services/notifications.web.js`: na Web o lembrete é salvo, mas não agenda notificação local.

A chave `service_role`, senha do banco, token de acesso pessoal e credenciais de login nunca devem ser colocados em `.env`, código-fonte ou hospedagem do frontend.

## 1. Criar o projeto gratuito no Supabase

1. Acesse `https://supabase.com/dashboard` e crie um projeto.
2. Escolha uma senha forte para o banco, mas **não compartilhe essa senha** nem a use no aplicativo.
3. Após o projeto ficar pronto, abra **SQL Editor**.
4. Cole e execute por inteiro o conteúdo de `supabase/schema.sql`.
5. Em **Authentication > Providers > Email**, mantenha o provedor Email ativo. Para testes simples, a confirmação de e-mail pode ficar ativa; o app avisará o usuário para confirmar antes de entrar.

## 2. Configurar o aplicativo sem expor segredos

1. Em **Connect / API Keys**, copie somente:
   - Project URL;
   - Publishable key (ou anon key, se o painel ainda mostrar essa denominação).
2. Na raiz do projeto, crie um arquivo `.env` baseado em `.env.example`:

```bash
cp .env.example .env
```

3. Preencha apenas estes valores:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`.env` é ignorado pelo Git. A chave pública pode aparecer no bundle Web; a segurança é garantida pelas políticas RLS do banco, não pelo segredo dessa chave.

## 3. Testar localmente no navegador

```bash
npm install
npx expo start --web
```

No navegador, conclua a apresentação, crie uma conta, confirme o e-mail se o Supabase solicitar e entre. Teste criar, editar, filtrar e excluir transações, bem como lembretes e perfil.

Para validar a exportação estática:

```bash
npx expo export --platform web
```

A saída fica em `dist/`. Ela não deve ser commitada.

## 4. Publicar gratuitamente na Vercel

1. Crie uma conta gratuita em `https://vercel.com`.
2. Instale a CLI apenas se desejar publicar pelo terminal:

```bash
npm install --global vercel
```

3. Na raiz do projeto, configure no painel da Vercel as mesmas variáveis de ambiente públicas usadas no `.env`.
4. Execute:

```bash
npx expo export --platform web
vercel --prod dist
```

A Vercel exibirá uma URL HTTPS pública. Copie essa URL para os redirecionamentos de autenticação do Supabase em **Authentication > URL Configuration**. Também adicione `http://localhost:8081` para desenvolvimento local.

## Checklist antes de compartilhar o link

- [ ] `supabase/schema.sql` executado sem erros.
- [ ] RLS está habilitado nas três tabelas.
- [ ] `.env` não foi adicionado ao Git.
- [ ] Conta nova só enxerga os próprios registros.
- [ ] Conta A não consegue consultar registros da conta B.
- [ ] Cadastro, confirmação de e-mail e login foram testados.
- [ ] Foto de perfil foi testada no navegador.
- [ ] Link Vercel HTTPS foi adicionado a Authentication > URL Configuration.
- [ ] Política de privacidade e informação de contato foram incluídas antes de divulgar amplamente.

## Limitações conhecidas

- O navegador não oferece a mesma confiabilidade para notificações locais, principalmente no Safari/iPhone. Lembretes ficam registrados no banco; push web é uma etapa futura.
- O plano gratuito do Supabase e da Vercel tem limites de uso e pode mudar. Este roteiro é apropriado para MVP/uso acadêmico, não para dados bancários reais ou operação comercial.
- O aplicativo não faz integração bancária, não processa pagamentos e não deve armazenar informações financeiras sensíveis além dos lançamentos informados pelo usuário.
