# Meu Financeiro — MVP evoluído

Aplicativo acadêmico Expo para organizar receitas, despesas e lembretes. No mobile, os dados permanecem locais; na Web, o Supabase armazena os dados de cada conta com regras de acesso próprias.

## Executar no VS Code
1. Abra `/home/jg/Faculdade/Disp. Moveis/App - Gestao Finanças/gestao-financeira-lembretes`.
2. Execute `npm install`.
3. Execute `npm start` e leia o QR Code com Expo Go. Se a rede local falhar, use `npx expo start --tunnel`.

## Verificar
```bash
npm test
npm run check
npx expo-doctor
```

## Recursos atuais
- Splash configurada para Expo SDK 57, onboarding persistente e entrada local no mobile.
- Datas em `DD/MM/AAAA` na tela e ISO no SQLite.
- Perfil com avatar por iniciais; no navegador a foto é armazenada no Supabase Storage.
- Ajustes, reabertura da apresentação e permissões de notificações reais.

Para a versão Web, configure o Supabase conforme `docs/PUBLICACAO_WEB_SUPABASE.md`, então execute `npx expo start --web`. O banco remoto ainda não é conectado até que o arquivo `.env` seja preenchido com a URL e a chave pública do projeto Supabase. Não há integração bancária. Consulte `docs/TESTES-E-VALIDACAO.md` para o roteiro do iPhone.
