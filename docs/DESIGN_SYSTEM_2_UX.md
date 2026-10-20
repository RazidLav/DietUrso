# UrsoFit — Design System 2.0 e fundação multiplataforma

## Escopo desta fase

Esta fase cria a fundação visual e responsiva e aplica o novo padrão às três telas de referência solicitadas: Home, plano alimentar e banco de exercícios. Regras de negócio, autenticação, sincronização, tabelas e dados existentes foram preservados.

Não houve migration, alteração de RLS, mudança de contrato com o Supabase nem publicação em produção.

## Diagnóstico do produto existente

O UrsoFit usa Expo Router, React Native, React Native Web e TypeScript, com Supabase para autenticação e sincronização e AsyncStorage para persistência local. As rotas estão agrupadas por domínio — autenticação, Home, alimentação, hidratação, treinos, evolução/social e perfil — e compartilham navegação, temas, cartões e estados de carregamento.

### Priorização encontrada

- P0: nenhuma quebra impeditiva foi encontrada no escopo auditado.
- P1: navegação desktop exibia todos os submenus ao mesmo tempo; breakpoints e larguras eram decididos localmente; o banco de exercícios mostrava filtros demais de uma vez; telas de referência usavam pouco o espaço de tablet e desktop.
- P2: excesso de bordas, cartões e heróis altos; estilos de página repetidos; controles com densidade e hierarquia inconsistentes.
- P3: tooltips do rail, microinterações adicionais e migração das demais telas para os novos primitivos.

## Design System 2.0

### Tokens

`src/theme.ts` permanece como fonte central e passa a incluir:

- cores semânticas de fundo, superfície interativa e borda sutil;
- escala ampliada de espaçamento e raios;
- tipografia semântica (`typeScale`);
- limites de conteúdo e medidas de navegação (`layout`);
- breakpoints para telefone, tablet, rail e desktop;
- tempos de movimento curtos e padronizados.

Os dois temas existentes — Emo e Gratiluz — continuam funcionais e receberam os mesmos papéis semânticos.

### Componentes compartilhados

`src/components/DesignSystem.tsx` oferece uma camada pequena e reutilizável:

- `ContentContainer`, `PageHeader` e `SectionHeader` para hierarquia;
- `ResponsiveGrid` para densidade adaptativa;
- `CompactCard` e `SummaryCard` para superfícies;
- `StatusBadge`, `SegmentedControl` e `FilterChip` para estados e escolha;
- `IconButton` e `PrimaryButton` para ações;
- `ResponsiveSheet`, que vira bottom sheet no telefone e painel lateral em telas maiores.

Os estados existentes de carregamento, erro e vazio continuam em `ProgressiveUI` e não foram duplicados.

### Acessibilidade e movimento

- alvo mínimo de toque centralizado em 44 px;
- rótulos e papéis acessíveis nas ações novas;
- foco visível ampliado para controles nativos e elementos com `tabIndex`;
- preferência de movimento reduzido exposta por hook compartilhado;
- fluxo não depende exclusivamente de gestos.

## Arquitetura multiplataforma

A interface é decidida pela largura útil, e não pelo sistema operacional:

- telefone: menos de 768 px, uma coluna, navegação inferior e sheets pela base;
- tablet: de 768 a 1023 px, duas colunas quando útil e rail compacto a partir de 840 px;
- desktop: a partir de 1024 px, conteúdo limitado, sidebar inteligente e painéis lado a lado;
- telas amplas: até três colunas, sem esticar o conteúdo indefinidamente.

A sidebar desktop pode ser expandida, compactada ou ocultada, guarda a preferência local e exibe somente as opções da seção ativa. Quando ocultada, permanece um controle claro para reabri-la.

## Reformulação das telas-piloto

### Home

- herói e ações rápidas ficaram mais baixos;
- bordas decorativas sem função foram removidas;
- cartões de refeições ficaram compactos;
- refeições usam duas colunas no desktop e três em telas amplas;
- breakpoints locais foram substituídos pelo hook responsivo central.

### Plano alimentar

- cabeçalho, ações e navegação por dia ganharam hierarquia explícita;
- resumo de macros tem modo compacto real;
- refeições formam uma grade medida pelo espaço real do contêiner, com até três colunas e sem esticar a última linha;
- a largura útil foi reduzida para 1.100 px e o cartão externo que enquadrava toda a página no desktop foi removido;
- edição e cópia permanecem com as rotas e regras anteriores.

### Banco de exercícios

- busca e modalidade permanecem como controles primários;
- escopo, favoritos, músculo e equipamento foram movidos para filtros avançados;
- filtros ativos ficam visíveis e removíveis;
- lista/grade está disponível em telas maiores;
- tablet e desktop usam seleção mestre-detalhe;
- telefone abre detalhes e formulário em bottom sheet;
- formulário revela primeiro os campos essenciais e recolhe campos avançados;
- criação, edição, arquivamento, favoritos e variante de exercício global foram preservados.

## Expansão para os demais módulos

Após a validação das telas-piloto, a mesma fundação foi levada aos hubs de alimentação, hidratação, treino e perfil, além de evolução e conquistas:

- resumos e atalhos passaram a grades proporcionais ao conteúdo;
- cartões compartilhados ficaram mais baixos e dispensam borda quando a superfície já comunica agrupamento;
- hidratação usa limite de largura, resumo diário mais baixo e até seis atalhos rápidos por linha no desktop;
- treino usa os mesmos cabeçalhos, grade responsiva e controle segmentado do Design System;
- perfil distribui suas seis áreas em grade medida pelo contêiner e compacta a vitrine;
- evolução e Caverna de Troféus preservam seus conteúdos, mas removem containers e bordas redundantes;
- telas auxiliares passaram a consultar o hook responsivo central em vez de criar breakpoints próprios.

## Verificação e preservação funcional

Foram adicionados testes de contrato para tokens, breakpoints, componentes, navegação adaptativa e as três telas-piloto. A bateria existente continua validando rotas, busca, planejamento e execução de treinos, dieta, hidratação, autenticação, jornada e recursos sociais.

Os comandos de qualidade desta fase são:

```text
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build:web
```

Resultado em 20/10/2026:

- lint: aprovado;
- typecheck: aprovado;
- testes: 110 aprovados, 0 falhas;
- build web de produção: aprovado, exportado em `frontend/dist`;
- inspeção visual automatizada do build local: bloqueada pelo isolamento de rede do navegador incorporado; não foi criado túnel público apenas para contornar essa restrição.

## Pendências e riscos conhecidos

- as demais telas ainda usam, em graus diferentes, os estilos anteriores; a migração deve ser incremental;
- o rail compacto pode receber tooltips mais ricos em uma próxima fase;
- a validação automatizada não substitui o teste final em Safari real no iPhone e iPad;
- um build iOS nativo não é produzido neste ambiente Windows;
- esta etapa não exige migration nem alteração das políticas RLS existentes.

## Próxima fase recomendada

Migrar, nesta ordem, hidratação, evolução, perfil/conquistas e editores de treino para os mesmos primitivos. A cada domínio, medir altura inicial, número de ações simultâneas, uso em uma mão e estados de carregamento antes de avançar para o próximo.
