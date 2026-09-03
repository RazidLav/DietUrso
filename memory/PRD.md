# Projeto Urso — Aplicativo pessoal de planejamento alimentar

## Visão geral
"Projeto Urso" é um aplicativo React Native / Expo, 100% local (sem backend), para acompanhamento de dieta. Foi construído a partir do plano alimentar completo fornecido pelo usuário (dieta base ~2.200 kcal).

## Diferença chave
Este é um **planejador alimentar fixo**, não um mero diário de calorias. O plano prescrito permanece intacto; o consumo real é registrado separadamente sem alterar o plano.

## Stack
- Expo Router (file-based routing) com 4 abas: Hoje, Plano, Compras, Ajustes
- Persistência: `@react-native-async-storage/async-storage`
- Ícones: `@react-native-vector-icons/material-design-icons`
- Design: tema escuro "7 Dark-First Utility DARK" (verde proteína, azul carbo, laranja gordura)

## Funcionalidades implementadas
1. **Aba Hoje**: dashboard com kcal/proteína/carbo/gordura do dia + refeições em cards com status (planejado / conforme plano / alterado).
2. **Aba Plano**: navegação por dias da semana, macros do dia, lista de refeições, atalho para editor.
3. **Detalhe de refeição**: seleção de opção (Opção 1/2/3...), macros dinâmicos, ingredientes com substituições clicáveis, botão "Restaurar", CTAs "Comi conforme o plano" e "Registrar alteração".
4. **Registro de alteração**: modal com observação e macros manuais — NÃO modifica o plano original.
5. **Aba Compras**: lista semanal agregada, seleção de dias específicos, marcar itens comprados.
6. **Aba Ajustes**: listar/criar/editar/duplicar/arquivar/excluir/ativar planos.
7. **Editor de plano**: adicionar/editar/excluir refeições, opções, alimentos, substituições, duplicar refeições e opções, renomear plano.

## Dieta importada inicial
Fielmente conforme fornecida: pré-treino (3 opções), café/pós-treino (3 opções), almoço (2 opções), lanche (6 opções), jantar (6 opções), ceia (4 opções). Todas as quantidades, unidades e substituições preservadas. Macros aproximados foram estimados por alimento respeitando os totais informados na dieta.

## Persistência
Todas as chaves em AsyncStorage sob prefixo `urso:` (plans, activePlanId, consumption, chosenOptions, shoppingChecked, seeded_v1).

## Idioma
100% Português do Brasil.
