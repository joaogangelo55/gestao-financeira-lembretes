# Testes e validação

## Execuções realizadas
Em 09/10/2026, neste ambiente Fedora:

```bash
npm test
npm run check
npx expo-doctor
```

Resultados reais:
- `npm test`: 12 testes aprovados, 0 falhas.
- `npm run check`: exportação Android concluída com bundle gerado.
- `npx expo-doctor`: 21 de 21 verificações aprovadas.

## Cobertura automatizada
`tests/dates.test.mjs` valida máscara incremental, colagem de números/barras, limite de dígitos, ISO ↔ brasileiro, anos bissextos, datas inexistentes e data local em UTC-03.

`tests/validation.test.mjs` mantém a linha de base original e adiciona a validação de data brasileira preservando ISO no domínio.

APIs nativas (SQLite em dispositivo, permissões, seletor de foto, arquivos e entrega de notificação) não rodam no Node; exigem validação manual.

## Roteiro manual no iPhone 15 Pro Max
1. Instale/abra o app e confira a marca durante a inicialização.
2. Percorra as três páginas, volte uma página e conclua.
3. Faça a entrada demonstrativa.
4. Cadastre despesa digitando `15102026`; espere `15/10/2026`.
5. Edite a despesa e confirme que a data continua correta.
6. Crie um lembrete futuro e trate a permissão de notificação.
7. Abra Ajustes, Perfil, escolha/remova uma foto e altere o nome.
8. Feche e abra o aplicativo: sessão, nome e avatar devem persistir.
9. Reabra a apresentação por Ajustes e volte ao app.
10. Saia: a sessão deve encerrar sem apagar finanças ou lembretes.

Use `npm start`; se a rede local impedir conexão use `npx expo start --tunnel`. Interface, SQLite, ImagePicker e formulários podem ser validados no Expo Go. A aparência final da splash nativa deve ser conferida em development/production build instalada.
