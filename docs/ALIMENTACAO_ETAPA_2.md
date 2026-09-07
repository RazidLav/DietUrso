# Etapa 2 — Alimentação completa

## Arquitetura adotada

O DietUrso continua local-first. Alimentos, receitas, diário e lista de compras são gravados primeiro no AsyncStorage e entram no snapshot versão 3 sincronizado em `public.user_app_state`. Essa decisão reaproveita a sincronização atômica já existente e evita criar duas fontes de verdade.

A lista de compras aceita atalhos de período e um intervalo personalizado de 1 a 60 dias, sempre contado a partir da data atual. A escolha também faz parte do snapshot sincronizado.

Os alimentos derivados do plano original formam o catálogo global local, somente leitura. Cadastros e duplicações são pessoais. No Supabase, todo o snapshot pertence ao `user_id` autenticado; portanto, alimentos pessoais, receitas e registros herdam o mesmo isolamento RLS do restante do aplicativo.

Plano e registro nunca são a mesma estrutura. Um registro novo contém:

- snapshot da refeição planejada;
- snapshot dos itens efetivamente consumidos;
- substituição e quantidade real, quando existirem;
- nutrientes consumidos calculados;
- snapshot da meta completa e da quantidade de refeições planejadas daquele dia.

Assim, mudanças posteriores no plano, no catálogo ou em uma receita não alteram o histórico já registrado.

## Migração Supabase

O arquivo `supabase/migrations/20260907140000_harden_user_app_state.sql` é incremental e não apaga dados. Ele:

- habilita e força RLS em `public.user_app_state`;
- restringe a tabela ao papel `authenticated`;
- recria políticas de leitura, criação, atualização e exclusão com `auth.uid() = user_id`;
- adiciona um índice em `updated_at`;
- documenta o formato do snapshot versão 3.

Para aplicar manualmente, abra o SQL Editor do projeto Supabase, copie integralmente o arquivo, revise o projeto selecionado e execute uma única vez. Não use uma chave `service_role` no frontend. O app continua compatível com o schema anterior enquanto essa migração não for aplicada.

## Variáveis públicas

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

A chave publishable/anon é própria para o cliente quando combinada com RLS. Nenhuma credencial administrativa é necessária.

## Compatibilidade

Snapshots remotos versões 1 e 2 continuam legíveis. Registros criados antes da versão 3 podem não ter snapshots completos de itens ou da meta diária; nesses casos, a interface usa os valores legados disponíveis e o plano atual como último recurso. Todo novo registro já usa o formato íntegro.

## Validação local

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm test
pnpm run typecheck
pnpm run lint
pnpm run build:web
```

O diretório publicado pelo Render continua sendo `frontend/dist`.
