# Etapa 4 — Treinos completos

## Arquitetura adotada

O módulo segue a arquitetura local-first existente. O estado é persistido em `urso:training_v1` no AsyncStorage e incluído no snapshot remoto versão 5. Quando há uma conta autenticada, o snapshot completo é sincronizado na linha do usuário em `public.user_app_state`.

Não foi criada uma segunda fonte de verdade relacional para treinos. A tabela de snapshot já oferece gravação atômica, sincronização entre dispositivos e compatibilidade com dados offline. A modelagem lógica abaixo vive no campo `payload.trainingState` e é validada por tipos TypeScript e sanitização na leitura.

## Entidades lógicas

- `plans`: planos com validade, repetição semanal, dias e várias prescrições ordenadas por dia;
- `templates`: modelos reutilizáveis, independentes de sessões e planos;
- `exercises`: catálogo global canônico e exercícios pessoais ligados ao proprietário;
- `plannedSessions`: sessões planejadas avulsas ou materializadas de um plano;
- `sessions`: execuções reais, sempre independentes e ligadas opcionalmente a uma sessão planejada;
- `personalRecords`: recordes deduplicados por sessão, métrica e exercício.

Cada `plannedSession` armazena `activityType`, nome, data, horário, status, duração estimada, observações, ordem e `prescriptionSnapshot`. Cada `session` guarda outro snapshot da prescrição, resultado progressivo, pausa, status, início, fim, duração real e chave idempotente.

Os status de planejamento são `planned`, `skipped` e `canceled`. Os status de execução são `in_progress`, `completed` e `partial`. Uma execução nunca altera sessões de outras modalidades.

## Modalidades

- Musculação: exercícios ordenados, alternativas, agrupamentos, séries preparatórias/válidas, repetições fixas ou faixa, carga em kg/lb, descanso, RIR, RPE, cadência, observações e técnicas normal, superset, biset, triset, circuito, drop set, strip set, rest-pause e pirâmides. A falha precisa ser marcada explicitamente.
- Mobilidade: movimento, região corporal, duração, séries, repetições, lados, instruções, observações e tempo total.
- Corrida: tipo, local, distância, duração, ritmo, velocidade, inclinação, frequência cardíaca, RPE, calorias, dor/desconforto e blocos intervalados.
- Bike: tipo, distância, duração, velocidades, cadência, frequência cardíaca, potência, resistência, RPE, calorias e blocos. Métricas técnicas são opcionais.
- CrossFit: aquecimento, habilidade, força, WOD, mobilidade e volta à calma; formatos AMRAP, EMOM, For Time, Rounds for Time, Tabata, Chipper e circuito; movimentos, rounds, time cap, intervalos, escala e resultado.
- Personalizada: campos livres, notas e duração sem misturar a sessão com outra modalidade.

## Histórico e recordes

Alterar um plano ou modelo não modifica sessões já materializadas ou executadas. O volume de musculação soma apenas séries concluídas que possuam carga e repetições maiores que zero.

Os recordes usam métricas consistentes: maior carga, maior número de repetições, maior volume de uma série, melhor tempo nos 5 km e 10 km e maior distância de bike. Cada recorde recebe uma `dedupeKey`; reprocessar uma sessão não duplica a marca.

## Conquistas

O motor existente foi ampliado, não substituído. Ele recebe sessões concluídas, recordes, distâncias, sequência, semanas e modalidades. XP usa as chaves `workout:<sessionId>` e a chave determinística do recorde. Há conquistas para primeiro treino, primeira sessão de cada modalidade, primeiro WOD, mobilidade, recorde, 5 km, 10 km, semana de treinos, sequência e múltiplas modalidades no mesmo dia.

Sessões puladas ou canceladas não removem XP, troféus ou sequência já conquistada.

## Banco, índice e RLS

A estrutura física continua sendo:

```sql
public.user_app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null
)
```

O índice `user_app_state_updated_at_idx` cobre sincronização por atualização. A chave primária cobre acesso por `user_id`. RLS está habilitado e forçado; as políticas de `select`, `insert`, `update` e `delete` exigem `auth.uid() = user_id`. `anon` não possui privilégios e `authenticated` possui apenas as operações protegidas pelas políticas.

Não há migration nova nesta etapa porque nenhuma coluna, índice ou política física mudou. Em uma instalação nova, aplique as migrations existentes em ordem com `supabase db push` ou pelo fluxo controlado da equipe. Em produção, revise o diff e faça backup antes; esta implementação não executa migrations automaticamente.

## Confiabilidade

- fila serial de mutações para evitar disputas entre gravações;
- chaves idempotentes para materialização, início, XP e recordes;
- atualização local otimista com restauração do estado anterior quando a sincronização autenticada falha;
- rascunhos persistentes e retomáveis;
- confirmação antes de descartar ou remover dados;
- snapshots compatíveis com versões remotas anteriores;
- catálogo global restaurado da versão canônica, impedindo edição global pelo usuário.

## Variáveis de ambiente

As únicas variáveis necessárias continuam sendo:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Sem elas, o aplicativo continua funcional localmente, mas sem login e sincronização entre dispositivos.

## Validação

A suíte cobre sessões simultâneas e independentes, todas as modalidades, planos, catálogo global/pessoal, séries e técnicas, rascunhos, snapshots históricos, recordes, conquistas, isolamento por proprietário, RLS e rollback em falha do Supabase. A entrega deve ser validada com:

```bash
pnpm test
pnpm run typecheck
pnpm run lint
pnpm run build:web
```

Integrações com relógios, GPS, Apple Health, Google Fit, Strava, Garmin, COROS, notificações push, IA e câmera permanecem fora do escopo.
