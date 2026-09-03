# DietUrso — visão do produto

O DietUrso é um aplicativo pessoal, local-first, para planejamento alimentar. O plano prescrito permanece separado do registro do consumo real.

## Funcionalidades atuais

- Dashboard diário com calorias e macronutrientes.
- Registro de refeições conforme o plano ou com alteração.
- Planos editáveis com refeições, opções, alimentos e substituições.
- Lista de compras semanal agregada por categoria.
- Estatísticas de adesão e sequência.

## Arquitetura

- Expo Router e React Native Web.
- Persistência com AsyncStorage.
- Sem backend, autenticação ou banco de dados remoto.
- Interface em Português do Brasil.

## Limitação de persistência

Os dados pertencem ao navegador ou dispositivo em que foram criados. Uma futura funcionalidade de exportação/importação deve permitir backups portáteis.

