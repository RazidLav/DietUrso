# DietUrso

Aplicativo pessoal de planejamento alimentar, acompanhamento de refeições e lista de compras.

O projeto usa Expo Router e React Native Web. Os dados são gravados primeiro no armazenamento local para o app continuar rápido e funcionar sem internet. Quando o usuário conecta uma conta, o estado também é sincronizado pelo Supabase.

## Desenvolvimento

Requisitos: Node.js LTS e pnpm 11.

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm start
```

Para validar o projeto:

```bash
pnpm run typecheck
pnpm run lint
pnpm run build:web
```

O build web é gerado em `frontend/dist`.

Copie `frontend/.env.example` para `frontend/.env.local` para habilitar a sincronização durante o desenvolvimento.

## Render Static Site

O arquivo `render.yaml` configura o serviço com:

- raiz do projeto: `frontend`
- comando de build: `pnpm install --frozen-lockfile && pnpm run build:web`
- diretório publicado: `dist`
- fallback de SPA para `index.html`
- variáveis públicas `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Ao criar um Blueprint no Render, selecione este repositório e confirme a configuração detectada.

## Sincronização

O schema do banco e as políticas de acesso ficam em `supabase/migrations`. A tabela usa Row Level Security: cada usuário só pode ler e alterar o próprio registro.

Sem login, os dados permanecem somente no aparelho. Após entrar com a mesma conta em dois dispositivos, planos, refeições registradas, opções escolhidas, água, XP e conquistas são sincronizados. Alterações feitas offline são enviadas quando o app volta a ter conexão.

## Gamificação

O catálogo modular de conquistas fica em `frontend/src/gamification/achievements.ts` e os valores de XP, níveis e meta de água ficam em `frontend/src/gamification/config.ts`. O motor usa chaves determinísticas para impedir que marcar e desmarcar a mesma refeição gere XP repetido.

A sequência considera dias com ao menos um registro alimentar. Nenhuma regra remove XP ou pune o usuário por ultrapassar metas; o sistema recompensa registro, consistência, hidratação, variedade e retorno à rotina.
