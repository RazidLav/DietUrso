# Etapa 5 — interface, navegação e responsividade

## Objetivo

Esta etapa consolida a navegação do DietUrso, melhora o aproveitamento de telas grandes e corrige fluxos que ficavam difíceis de usar em telas pequenas. Nenhuma regra de alimentação, hidratação, treino, sincronização ou gamificação foi alterada.

## Auditoria inicial

- O aplicativo usa Expo Router, React Native, React Native Web e TypeScript.
- A persistência continua local-first com AsyncStorage e sincronização opcional pelo Supabase.
- A navegação principal ainda era uma barra de tabs do Expo com cinco destinos diferentes da arquitetura atual do produto.
- Essa barra ficava sobreposta ao conteúdo no mobile e era apenas esticada no desktop.
- As rotas secundárias existiam, mas não formavam uma hierarquia de navegação centralizada.
- O seletor do banco de alimentos era uma `View` limitada a 260 px, com `overflow: hidden`, dentro do `ScrollView` do formulário. Não havia pesquisa e parte do catálogo ficava inacessível.
- O modal de detalhes de exercícios também tinha altura máxima sem um corpo rolável.

## Navegação implementada

A fonte de verdade fica em `frontend/src/navigation/config.ts`. Tanto o Dock quanto a barra contextual e a sidebar usam a mesma configuração.

### Mobile e tablet

O Dock possui exatamente cinco destinos, nesta ordem:

1. Home;
2. Plano alimentar;
3. Hidratação;
4. Treino;
5. Perfil.

O Dock participa do layout da página, em vez de cobrir o conteúdo. Ele é uma peça flutuante com margem externa, cantos arredondados, contorno e sombra coerentes com os cards. Acima dele, uma barra contextual horizontal exibe as opções da seção atual. A opção ativa recebe foco visual e é trazida para a área visível automaticamente.

As trocas de contexto usam uma transição lateral total de 220 ms. Quando a preferência de redução de movimento está ativa, a troca é imediata.

### Desktop

A partir de 1024 px, o Dock é substituído por uma sidebar flutuante à esquerda. Ela mostra todas as seções e subseções, possui rolagem própria e mantém o conteúdo principal em um canvas central com largura controlada.

### Mapa das seções

- Home: visão geral do dia.
- Plano alimentar: Hoje, Plano, Diário alimentar, Alimentos, Receitas e Compras.
- Hidratação: Hoje, Recipientes, Histórico e Configurações.
- Treino: Hoje e calendário, Planos e modelos, Exercícios e Histórico e evolução.
- Perfil: Meu perfil, Conquistas, Progresso e Configurações.

Formulários imersivos, onboarding e execução de treino ocultam temporariamente a navegação global. Isso evita saídas acidentais com rascunhos em andamento e preserva o comportamento existente do botão Voltar.

## Banco de alimentos

Foi criado um seletor compartilhado em `frontend/src/components/FoodCatalogPicker.tsx`.

- bottom sheet no mobile e diálogo centralizado no desktop;
- cabeçalho e campo de busca fixos;
- lista com rolagem independente por toque, roda do mouse e trackpad;
- pesquisa por nome, marca, categoria e origem;
- pesquisa sem diferença entre maiúsculas, minúsculas e acentos;
- suporte a teclado, foco visível e leitores de tela;
- estados de carregamento, erro, vazio e quantidade de resultados;
- retorno ao formulário sem perder os campos já preenchidos;
- foco devolvido ao botão que abriu o seletor.

O componente também foi reutilizado no editor de receitas. A pesquisa normalizada foi aplicada às telas de alimentos, receitas, refeição fora do plano e catálogo de exercícios.

## Outros ajustes

- O modal de alimento pessoal ganhou corpo rolável e tratamento adequado do teclado.
- O seletor de refeição fora do plano ganhou altura previsível, rolagem independente e estados vazios.
- O modal de instruções dos exercícios passou a permitir rolagem.
- Home e Alimentação usam duas colunas em telas largas, sem mudar a composição do mobile.
- O documento web bloqueia overflow horizontal, usa `100dvh`, respeita safe areas e exibe foco por teclado.
- As barras de rolagem web são finas, arredondadas e usam tons do tema, com realce verde ao passar o cursor.
- Tokens de breakpoints, movimento e camadas foram adicionados ao tema.

## Responsividade validada

| Largura | Navegação | Overflow horizontal | Resultado |
| ---: | --- | --- | --- |
| 320 px | Dock + contexto | não | aprovado |
| 375 px | Dock + contexto | não | aprovado |
| 390 px | Dock + contexto | não | aprovado |
| 768 px | Dock + contexto | não | aprovado |
| 1024 px | Sidebar | não | aprovado |
| 1366 px | Sidebar + duas colunas | não | aprovado |
| 1440 px | Sidebar + canvas central | não | aprovado |

Também foram validados o retorno do navegador, o estado ativo, a rolagem automática até a última opção contextual e a seleção de um alimento pesquisado por texto sem acento.

## Testes automatizados

`frontend/tests/ui-navigation.test.ts` cobre:

- ordem e quantidade exatas dos itens do Dock;
- associação das rotas antigas às novas seções;
- ocultação da navegação nos formulários imersivos;
- duração permitida para a transição contextual;
- pesquisa sem diferença de acento e caixa.

## Capturas

- As capturas de validação são geradas localmente em `outputs/etapa-5` e não são versionadas no repositório público.
- `outputs/etapa-5/mobile-home.png`
- `outputs/etapa-5/mobile-food-picker.png`
- `outputs/etapa-5/desktop-home.png`

## Banco, ambiente e publicação

- Nenhuma migration foi criada.
- Nenhuma política RLS foi alterada.
- Nenhuma variável de ambiente nova é necessária.
- Nenhum deploy foi realizado nesta etapa.

## Limitações conhecidas

- A barra contextual é intencionalmente rolável quando todas as opções não cabem no mobile.
- Telas de edição e execução continuam usando navegação própria para proteger rascunhos.
- A verificação de leitores de tela foi feita pela semântica e pelos atributos de acessibilidade; testes manuais com VoiceOver/TalkBack ainda são recomendados antes de uma publicação pública ampla.
