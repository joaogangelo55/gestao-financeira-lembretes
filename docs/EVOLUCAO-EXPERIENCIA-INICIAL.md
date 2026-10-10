# Evolução da experiência inicial — Meu Financeiro

## Situação anterior
O MVP possuía entrada demonstrativa, finanças, lembretes e SQLite, mas concentrava a interface em `App.js`, mostrava datas ISO e usava UTC para datas civis. Não havia apresentação inicial, perfil ou ajustes.

## O que foi implementado
- Splash nativa configurada com `expo-splash-screen`; o JavaScript retém a splash até inicializar SQLite, sessão e preferências. Falhas mostram uma tela recuperável com nova tentativa.
- Onboarding de três páginas com Próximo, Voltar, Pular, indicador e reabertura por Ajustes.
- Preferência `onboarding_completed` persistida em SQLite. Sessões existentes ignoram o onboarding para não interromper usuários antigos; ele continua acessível por Ajustes.
- Datas visíveis em `DD/MM/AAAA`, máscara numérica e conversão para ISO somente antes da persistência.
- Perfil local: iniciais como avatar, edição de nome/e-mail, seleção de foto da galeria e remoção.
- Aba Ajustes com perfil, permissões reais de notificação, convenções regionais, apresentação, privacidade e saída.

## Bibliotecas
`expo-splash-screen ~57.0.9` e `expo-image-picker ~57.0.20` foram instaladas com `npx expo install`, compatíveis com Expo SDK 57. `expo-file-system` já existia e copia a imagem para o diretório de documentos do aplicativo.

## Como a persistência funciona
A migração é aditiva: `user_session` recebe a coluna opcional `avatar_uri` apenas quando ausente; uma tabela `app_preferences` guarda preferências por chave. Não há `DROP TABLE` e transações, lembretes e sessões existentes são preservados.

Ao sair, somente a sessão local é removida. Dados financeiros permanecem no aparelho. A próxima entrada não recebe o avatar da sessão anterior, porque ele está associado ao registro de sessão removido.

## Limitações honestas
A entrada continua demonstrativa e local; não existe servidor, sincronização, criptografia bancária ou autenticação real. A splash nativa final não é totalmente reproduzida por Expo Go/development build desde o SDK 52; valide-a em build instalada. Foto e permissões dependem do dispositivo.

## Onde está o código e como testar
- Inicialização e fluxo: `App.js`.
- Datas: `src/utils/dates.mjs`, `src/utils/validation.mjs`, `src/components/DateInput.js`.
- Banco e migração: `src/database/transactions.js`.
- Imagem: `src/services/profileImages.js`.

Estado é o dado temporário da interface React. Componente é uma parte reutilizável da tela. Persistência é manter dados após fechar o app. Migração é uma mudança de esquema que preserva dados. Operações assíncronas são tarefas que terminam depois, como SQLite e permissões; elas recebem tratamento de erro no fluxo principal.
