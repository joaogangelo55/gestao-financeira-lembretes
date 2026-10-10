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
  A[Splash nativa] --> B[initDatabase]
  B --> C[Ler sessão e preferências]
  C --> D{Sessão?}
  D -->|sim| E[Dashboard]
  D -->|não e onboarding pendente| F[Onboarding]
  D -->|não e onboarding concluído| G[Entrada demonstrativa]
```

## Persistência e dados
```mermaid
flowchart LR
 UI[Componentes React] --> V[Validação e datas]
 V --> DB[(SQLite financeiro.db)]
 DB --> T[transactions]
 DB --> R[reminders]
 DB --> S[user_session + avatar_uri]
 DB --> P[app_preferences]
 UI --> N[expo-notifications]
 UI --> I[ImagePicker + FileSystem]
 I --> S
```

## Cadastro de transação
1. O formulário recebe a data com máscara brasileira.
2. `validateTransaction` valida e transforma `DD/MM/AAAA` em ISO.
3. `saveTransaction` usa SQL parametrizado.
4. O painel relê a lista e resumo mensal.

## Lembretes
O agendamento é solicitado antes de substituir o identificador persistido. A notificação anterior só é cancelada após a nova ser criada e salva com sucesso. Caso a permissão seja negada, o lembrete ainda é salvo e a interface explica a limitação.
