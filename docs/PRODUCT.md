# DietUrso — visão do produto

O DietUrso é um aplicativo pessoal, local-first, para alimentação, hidratação e treinos. Prescrições permanecem separadas dos registros efetivamente realizados.

## Funcionalidades atuais

- Dashboard diário com planejado, consumido, diferença, hidratação, XP e conquistas.
- Hidratação inteligente com ritmo proporcional, registros individuais, recipientes, lembretes internos e histórico.
- Banco de alimentos global e pessoal, com nutrientes por quantidade de referência.
- Receitas com ingredientes, rendimento e cálculo automático por porção.
- Registro de refeições conforme o plano, com quantidade real, substituição, horário e observação.
- Registro editável de refeições fora do plano, sem alterar a dieta futura.
- Planos editáveis com refeições, opções, alimentos, receitas, horários, dias e substituições.
- Histórico diário e semanal baseado em snapshots imutáveis.
- Lista de compras automática por período, agregada por categoria.
- Estatísticas de adesão, níveis, XP, sequência e conquistas.
- Painel diário, calendário, planos e modelos de treino com múltiplas sessões independentes no mesmo dia.
- Catálogo de exercícios global/pessoal e execução detalhada de musculação, mobilidade, corrida, bike, CrossFit e atividades personalizadas.
- Histórico esportivo com volume válido, distâncias, duração, frequência e recordes pessoais sem duplicidade.
- Navegação responsiva com Dock de cinco áreas no mobile, barra contextual e sidebar completa no desktop.
- Seletores e listas longas adaptativos, com pesquisa normalizada, rolagem independente, foco visível e suporte a teclado.

## Arquitetura

- Expo Router e React Native Web.
- Persistência local-first com AsyncStorage.
- Autenticação e sincronização remota com Supabase.
- Snapshot por usuário em `public.user_app_state`, protegido por RLS.
- Hospedagem web estática no Render.
- Interface em Português do Brasil.
- Snapshot remoto versão 5, retrocompatível com as versões 1 a 4.
- Configuração central de navegação compartilhada entre mobile e desktop.

## Persistência e histórico

Sem autenticação, os dados pertencem ao navegador ou dispositivo. Com a mesma conta conectada, o snapshot é sincronizado entre aparelhos. O plano continua separado do consumo; cada novo registro preserva os itens realmente consumidos e a meta planejada daquele dia. Na hidratação, cada dia também preserva a meta, os horários e o fuso vigentes. Nos treinos, rotina, sessão planejada e execução são entidades distintas e a execução mantém uma cópia da prescrição original. Assim, preferências ou planos futuros não reescrevem o histórico.
