# Etapa 3 — Hidratação inteligente

## Arquitetura adotada

A hidratação segue a arquitetura local-first já usada pelo DietUrso. O estado completo é salvo no AsyncStorage sob `urso:hydration_v1` e incluído no snapshot remoto versão 4 de `public.user_app_state`.

Não foi criada uma segunda tabela no Supabase. A tabela existente já armazena o snapshot JSONB por usuário e já está protegida por Row Level Security, políticas por `auth.uid()` e índice de atualização entregues na Etapa 2. Reutilizar essa estrutura mantém a sincronização atômica, evita duas fontes de verdade e não exige mudança no banco de produção.

O estado de hidratação contém:

- configuração pessoal de meta, rotina, fuso e lembretes;
- recipientes ativos ou arquivados, favoritos e ordem de exibição;
- registros individuais de consumo;
- snapshot da meta, horários e fuso de cada dia;
- recibos de lembretes exibidos, dispensados ou adiados.

O mapa legado `urso:water` continua sendo derivado dos registros individuais e sincronizado. Isso mantém compatibilidade com versões anteriores e com as regras de gamificação existentes.

## Migração de dados antigos

Na primeira abertura, se ainda não houver estado da Etapa 3, os totais antigos são convertidos em um único registro `legacy` por data. A operação usa uma chave determinística por dia e não roda novamente depois da criação de `urso:hydration_v1`.

Cada data importada recebe um snapshot com a meta anterior padrão de 2.500 ml. Nenhum total anterior é apagado ou limitado.

Snapshots remotos versões 1, 2 e 3 continuam legíveis. Eles não removem um estado de hidratação local já migrado. A próxima alteração local autenticada publica o snapshot versão 4 completo.

## Cálculo do ritmo

Para a data de hidratação ativa:

```text
progresso = limitar((agora - acordar) / (dormir - acordar), 0, 1)
esperado_ml = meta_diária_ml × progresso
diferença_ml = consumido_ml - esperado_ml
```

A tolerância de ritmo é o maior valor entre 100 ml e 5% da meta diária. Acima dela o usuário está adiantado; abaixo do negativo dela, abaixo do ritmo; dentro da faixa, no ritmo.

Quando o horário de dormir é igual ou anterior ao de acordar, a janela cruza a meia-noite. Horários depois da meia-noite e antes da próxima hora de acordar continuam associados ao dia em que a rotina começou. O cálculo usa explicitamente o fuso IANA configurado, por exemplo `America/Fortaleza`.

O percentual textual pode ultrapassar 100%. Apenas a largura visual da barra é limitada, evitando overflow sem esconder o valor real.

## Registros e recipientes

Cada registro guarda quantidade, instante, data local de hidratação, origem, observação e, quando aplicável, uma fotografia do nome/volume/ícone/cor do recipiente. Alterar ou arquivar o recipiente depois não modifica registros históricos.

As inclusões usam chave de idempotência e fila local para proteger contra toque duplo e reenvio. Na interface, inclusão e exclusão aparecem imediatamente. Se uma sincronização autenticada falhar, o estado anterior é restaurado e uma mensagem acionável é exibida.

## Lembretes internos

Os lembretes existem somente dentro do aplicativo; não solicitam permissão de notificação do sistema. As regras podem sinalizar ritmo atrasado, intervalo longo, proximidade da meta e meta alcançada.

Uma chave por data, tipo e faixa de progresso, combinada ao intervalo mínimo, impede repetição excessiva. O usuário pode dispensar ou adiar o lembrete. O período silencioso aceita janelas normais ou que cruzam a meia-noite.

## Histórico e gamificação

As visões diária, semanal e mensal somam os registros e comparam cada data com seu próprio snapshot. São mostrados total, média dos dias ativos, metas alcançadas e melhor sequência.

As conquistas de primeira água e primeiro uso de recipiente foram acrescentadas. Meta diária, sequência de 7 dias e sequência de 30 dias continuam disponíveis, agora comparadas à meta histórica correta. XP de meta usa a chave `water:AAAA-MM-DD`, portanto sincronizar ou recalcular não duplica recompensa. Ultrapassar a meta não gera punição.

## Segurança e sincronização

- Todo o snapshot remoto continua associado ao `user_id` autenticado.
- O frontend usa somente a chave pública publishable/anon.
- Nenhuma chave `service_role` é usada ou necessária.
- Sem login, o funcionamento é local.
- Com login, o mesmo snapshot é compartilhado entre iPhone, iPad e navegador.
- Não há migração SQL nova nesta etapa porque o schema seguro da Etapa 2 já comporta o payload versão 4.

## Validação

```bash
cd frontend
pnpm test
pnpm run typecheck
pnpm run lint
pnpm run build:web
```

A suíte cobre horários antes/depois da rotina, cruzamento da meia-noite, fuso, seis atalhos, registro manual e por recipiente, edição, exclusão, desfazer, idempotência, percentual acima de 100%, snapshots históricos, silêncio/deduplicação/adiamento de alertas e rollback após falha de persistência.

O Render continua usando `frontend/dist`. Esta etapa não exige nova variável de ambiente nem alteração manual no Supabase.
