# Meu Financeiro — MVP evoluído

Aplicativo acadêmico Expo para organizar receitas, despesas e lembretes localmente.

## Executar no VS Code
1. Abra `/home/jg/Faculdade/Disp. Moveis/gestao-financeira-lembretes-mvp`.
2. Execute `npm install`.
3. Execute `npm start` e leia o QR Code com Expo Go. Se a rede local falhar, use `npx expo start --tunnel`.

## Verificar
```bash
npm test
npm run check
npx expo-doctor
```

## Recursos atuais
- Splash configurada para Expo SDK 57, onboarding persistente e entrada demonstrativa local.
- Datas em `DD/MM/AAAA` na tela e ISO no SQLite.
- Perfil com avatar por iniciais e foto local da galeria.
- Ajustes, reabertura da apresentação e permissões de notificações reais.

Os dados ficam somente no aparelho. Não há sincronização em nuvem, banco real, integração bancária ou autenticação de servidor. Consulte `docs/TESTES-E-VALIDACAO.md` para o roteiro do iPhone.
