# Consolidação do UrsoFit

## Auditoria e diagnóstico

O app usa Expo Router 57, React Native Web, AsyncStorage e Supabase Auth. Dieta, hidratação, treino e conquistas são módulos locais existentes, sincronizados como um snapshot JSONB por usuário em `public.user_app_state`. A RLS da tabela permanece habilitada; esta etapa não exige tabela nem migration nova. Planos, dias, itens de plano, sessões planejadas e execuções já eram estruturas separadas, e as execuções guardam snapshots da prescrição.

As variáveis públicas do Render apontam para o mesmo projeto Supabase visto no dashboard (`zaprfvxgtccalauimxih`). A confirmação de e-mail está habilitada e o endereço web atual está autorizado para redirecionamento. Há uma conta confirmada no projeto; não houve acesso às credenciais dela. Por isso a causa **específica** do relato de senha recusada não foi comprovada com uma tentativa real de login.

Havia um defeito comprovável no fluxo do app: o login aguardava a leitura/escrita do snapshot na nuvem, de modo que uma falha de sincronização podia ser apresentada como falha de login mesmo depois de o Supabase aceitar a senha. A autenticação e a sincronização agora têm estados separados. E-mail é normalizado; erros de credenciais, confirmação pendente e conexão são tratados distintamente. Cadastro pendente explica a necessidade de confirmar o e-mail; há reenvio, recuperação de senha e retorno seguro pelo link. O formulário bloqueia envios simultâneos. A abertura espera a sessão local ser resolvida antes de mostrar os dados.

O falso “não há plano” vinha de telas que começavam com `null`/lista vazia enquanto sessão e snapshot ainda carregavam. Home, Dieta e telas principais de treino agora distinguem carregamento, dados, vazio e erro. O vazio só aparece após consulta concluída; erro real oferece nova tentativa. Leituras independentes da Home foram paralelizadas, e dados já visíveis permanecem durante revalidação.

## Planos e preservação de dados

A entrada de criação pede nome e descrição; período e observações gerais ficam em opções avançadas. Depois abre o editor semanal. Em cada dia cabem múltiplas sessões da mesma modalidade ou de modalidades diferentes. O editor mobile é progressivo; no desktop, dias e editor aparecem lado a lado. É possível copiar/duplicar dias, reordenar por botões, salvar rascunho e retomá-lo ao voltar. Modelos reutilizáveis continuam disponíveis, mas recolhidos por padrão para não competir com a criação simples de planos. Exclusão só é oferecida a planos sem sessões materializadas; os demais podem ser arquivados. As prescrições de modalidades existentes são reutilizadas, não duplicadas.

As observações ficam em três níveis: instrução do catálogo (`exerciseSnapshot.instructions`), orientação do exercício no plano (`planNotes`, com leitura compatível de `executionNotes` antigos) e nota de execução (`StrengthSetResult.notes` e notas da sessão). Itens de plano, sessões planejadas e execuções mantêm IDs separados. A edição do plano não altera snapshots já planejados ou executados. Rascunhos do plano não são materializados no calendário.

## Marca e compatibilidade

Nome público, navegação, login, título HTML, Open Graph, PWA e documentação principal usam **UrsoFit**. Continuam com `dieturso` por compatibilidade: URL já publicada, nome do repositório e do serviço Render, `slug`/`scheme` e IDs de pacote Expo, nome interno do pacote npm, nomes de políticas e comentários em migrations já aplicadas, e fixtures de teste que verificam o endereço atual. Renomear esses itens requer uma migração coordenada separada.

## Validação e pendências manuais

Rodar em `frontend`: `pnpm run lint`, `pnpm run typecheck`, `pnpm test` e `pnpm run build:web`. Há testes de marca, helpers de autenticação, estados de carregamento, múltiplas modalidades, rascunho, notas e snapshots, além da suíte anterior de dieta, hidratação, treino e RLS. O preview local foi inspecionado em larguras de 390, 820 e 1366 px; um plano de teste recebeu musculação e corrida no mesmo dia, depois ambas foram copiadas para terça-feira. Não foi feito teste em Safari real.

Antes de publicar, testar com **uma conta de teste controlada pelo proprietário**, sem compartilhar senha: criar conta, confirmar o e-mail recebido, abrir o link de retorno, entrar após sair, recuperar a senha, reabrir no iPhone e no iPad, e verificar o mesmo plano nos dois dispositivos. Se o login ainda falhar, registrar a mensagem exata retornada e conferir no Supabase Auth o estado de confirmação dessa conta. Conferir no Render as duas variáveis `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; nunca usar service-role key no frontend. Nenhuma migration ou alteração de configuração foi aplicada em produção nesta etapa.

Limitação anterior mantida: o armazenamento offline é por instalação, não por conta local. A RLS impede leitura cruzada no Supabase, mas a troca de contas no mesmo navegador merece uma etapa própria de isolamento/migração de dados locais antes de uso multiusuário no mesmo aparelho.
