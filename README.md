# DietUrso

Aplicativo pessoal de planejamento alimentar, acompanhamento de refeições e lista de compras.

O projeto usa Expo Router e React Native Web. Todos os dados ficam no armazenamento local do navegador ou dispositivo; não existe backend nem conta de usuário.

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

## Render Static Site

O arquivo `render.yaml` configura o serviço com:

- raiz do projeto: `frontend`
- comando de build: `pnpm install --frozen-lockfile && pnpm run build:web`
- diretório publicado: `dist`
- fallback de SPA para `index.html`

Ao criar um Blueprint no Render, selecione este repositório e confirme a configuração detectada.

## Persistência

Os dados são locais e não sincronizam entre navegadores ou dispositivos. Limpar os dados do navegador remove planos e histórico. Exportação e restauração de backup devem ser implementadas antes de depender do app como registro permanente.
