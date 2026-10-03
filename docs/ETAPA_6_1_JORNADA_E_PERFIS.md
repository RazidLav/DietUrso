# Etapa 6.1 — Jornada dos 100 níveis e fundação dos perfis

## Fonte narrativa

O catálogo técnico tem 100 níveis e 10 capítulos, com IDs, XP, ordem, versão e chave de asset estáveis. O arquivo `UrsoGame_Documento_Mestre_Producao_UrsoFit.docx` não estava no repositório nem nos anexos acessíveis durante a implementação. Por isso, nenhum título ou texto narrativo ausente foi inventado.

Estão marcados como oficiais apenas os nomes já confirmados nas fontes disponíveis:

- nível 1 — Ursinho Desperto;
- nível 2 — Saindo da Toca;
- nível 10 — Primeira Insígnia;
- nível 100 — Lenda UrsoFit.

Os outros registros usam título técnico (`Nível N`) e `content_status = awaiting_master_document`. A importação posterior deve atualizar os registros por `id`, sem recriar tabelas, alterar XP ou duplicar conteúdo.

## Compatibilidade

- O XP histórico continua no snapshot local-first.
- O nível narrativo é limitado a 100.
- O maior nível legado já alcançado é preservado em `legacyLevelFloor`/`legacy_level`.
- XP excedente após o nível 100 permanece registrado.
- Recompensas continuam idempotentes por chave de evento.

## Perfil e privacidade

O perfil nasce privado, sem busca pública ou rota de perfil de terceiros. Nome, username, bio, foto, avatar, preferências de visibilidade, itens equipados e até três destaques já têm modelo próprio. Fotos ficam no bucket privado `profile-photos`, em uma pasta cujo primeiro segmento é o `auth.uid()` do usuário, e são lidas por URL assinada.

## Aplicação da migration

1. Fazer backup do projeto Supabase.
2. Revisar `supabase/migrations/20261003200000_create_journey_profiles.sql`.
3. Aplicar primeiro em um projeto de staging com Supabase CLI.
4. Verificar que os 100 níveis, 10 capítulos e catálogos globais foram criados uma única vez.
5. Validar RLS com dois usuários distintos e confirmar que fotos/perfis/destaques não vazam entre contas.
6. Somente depois aplicar em produção.

A migration não é aplicada automaticamente pelo build ou pelo deploy do site.
