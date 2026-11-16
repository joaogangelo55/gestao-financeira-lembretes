# Arquitetura do aplicativo

## Diretórios
- `App.js`: composição do fluxo e telas do MVP.
- `src/components`: `Avatar` e `DateInput` reutilizáveis.
- `src/database`: SQLite, migração aditiva e operações de domínio.
- `src/services`: notificações e cópia segura de avatar.
- `src/utils`: regras puras de datas e validação.
- `tests`: testes Node de regras sem APIs nativas.

## Inicialização
```mermaid
flowchart TD
  A[Splash nativa] --> B[Inicializar cliente Supabase]
  B --> C[Ler sessão persistida]
  C --> D{Sessão válida?}
  D -->|sim| E[Perfil + Dashboard]
  D -->|não e onboarding pendente| F[Onboarding]
  D -->|não e onboarding concluído| G[Autenticação Supabase]
```

## Autenticação e dados
```mermaid
flowchart LR
 UI[Componentes React] --> V[Validação e datas]
 UI --> A[Supabase Auth]
 A --> S[SecureStore nativo / localStorage Web]
 A --> RLS[PostgreSQL com RLS]
 V --> RLS
 RLS --> T[transactions por user_id]
 RLS --> R[reminders por user_id]
 RLS --> P[profiles por auth.users.id]
 UI --> N[expo-notifications]
 UI --> I[ImagePicker]
```

No Android/iOS a sessão é persistida no `expo-secure-store`. Links de confirmação e recuperação usam `meufinanceiro://auth/callback` e `meufinanceiro://auth/recovery`; a URL também deve ser cadastrada em Authentication > URL Configuration no projeto Supabase. Os dados SQLite legados não são apagados nem atribuídos automaticamente a uma conta.

## Cadastro de transação
1. O formulário recebe a data com máscara brasileira.
2. `validateTransaction` valida e transforma `DD/MM/AAAA` em ISO.
3. `saveTransaction` usa SQL parametrizado.
4. O painel relê a lista e resumo mensal.

## Lembretes
O agendamento é solicitado antes de substituir o identificador persistido. A notificação anterior só é cancelada após a nova ser criada e salva com sucesso. Caso a permissão seja negada, o lembrete ainda é salvo e a interface explica a limitação.
