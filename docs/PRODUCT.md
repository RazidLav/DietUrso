# DietUrso — visão do produto

O DietUrso é um aplicativo pessoal, local-first, para planejamento alimentar. O plano prescrito permanece separado do registro do consumo real.

## Funcionalidades atuais

- Dashboard diário com planejado, consumido, diferença, hidratação, XP e conquistas.
- Banco de alimentos global e pessoal, com nutrientes por quantidade de referência.
- Receitas com ingredientes, rendimento e cálculo automático por porção.
- Registro de refeições conforme o plano, com quantidade real, substituição, horário e observação.
- Registro editável de refeições fora do plano, sem alterar a dieta futura.
- Planos editáveis com refeições, opções, alimentos, receitas, horários, dias e substituições.
- Histórico diário e semanal baseado em snapshots imutáveis.
- Lista de compras automática por período, agregada por categoria.
- Estatísticas de adesão, níveis, XP, sequência e conquistas.

## Arquitetura

- Expo Router e React Native Web.
- Persistência local-first com AsyncStorage.
- Autenticação e sincronização remota com Supabase.
- Snapshot por usuário em `public.user_app_state`, protegido por RLS.
- Hospedagem web estática no Render.
- Interface em Português do Brasil.

## Persistência e histórico

Sem autenticação, os dados pertencem ao navegador ou dispositivo. Com a mesma conta conectada, o snapshot é sincronizado entre aparelhos. O plano continua separado do consumo; cada novo registro preserva os itens realmente consumidos e a meta planejada daquele dia.
