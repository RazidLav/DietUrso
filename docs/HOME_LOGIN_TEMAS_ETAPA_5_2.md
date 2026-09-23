# Etapa 5.2 — Home, autenticação e temas

## Entrega

- Boas-vindas e autenticação redesenhadas com o mascote oficial, hierarquia progressiva e ações separadas para cadastro, login e uso local.
- Home reorganizada em seletor semanal, mensagem contextual, ações rápidas e cards independentes para alimentação, hidratação, treinos e conquistas.
- Temas semânticos **Emo** e **Gratiluz**, aplicados em todo o aplicativo por variáveis CSS e tokens compartilhados.
- Preferência de tema salva localmente, aplicada antes da hidratação da aplicação e sincronizada no snapshot da conta.
- Estados de carregamento e erro independentes na Home: uma falha não apaga os demais domínios.

## Arquitetura de temas

`src/theme.ts` contém as duas paletas e gera o mesmo conjunto de tokens semânticos. `ThemeProvider` distribui a preferência e atualiza as variáveis CSS. `themeStore` persiste a escolha no AsyncStorage e no armazenamento web. O script em `public/index.html` restaura a preferência antes do bundle para evitar clarão de tema incorreto.

No primeiro uso, Emo é o padrão. Em uma sessão autenticada, a preferência local é carregada primeiro para renderização imediata; depois, o snapshot remoto versão 6 pode assumir a precedência. Uma alteração feita pelo usuário atualiza a marca de modificação local e é enviada pelo sincronizador já existente.

## Persistência e banco

Nenhuma tabela nova foi criada. A preferência `themePreference` passou a fazer parte do payload de `user_app_state`, que já possui `user_id`, RLS e políticas por `auth.uid()`. Snapshots das versões 1 a 5 continuam válidos e recebem Emo como fallback seguro.

## Autenticação

O fluxo continua usando o mesmo cliente Supabase e preserva cadastro, confirmação de e-mail, reenvio, login por senha, recuperação, renovação e logout. O formulário normaliza o e-mail, bloqueia envios duplicados e apresenta mensagens específicas. Quando a nuvem não está configurada, a interface informa a limitação sem esconder o formulário nem impedir o modo local.

## Validação

- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm test`
- `pnpm run build:web`
- Inspeção visual em 390 × 844 e 1280 × 720
- Troca e recarga dos dois temas
- Navegação por teclado/semântica de botões, abas e seletores de tema

Não há migration nem variável de ambiente nova nesta etapa.
