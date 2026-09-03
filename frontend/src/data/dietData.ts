// Projeto Urso — Dieta inicial (2.200 kcal base)
// Todos os pesos são cozidos/prontos, salvo indicação (CRU, SECO, CONGELADO).

import { Plan } from "../types/plan";

export const MEAL_TYPES = [
  { key: "pre_treino", label: "Pré-treino" },
  { key: "cafe", label: "Café da manhã" },
  { key: "almoco", label: "Almoço" },
  { key: "lanche", label: "Lanche" },
  { key: "jantar", label: "Jantar" },
  { key: "ceia", label: "Ceia" },
] as const;

export const MEAL_LABELS: Record<string, string> = {
  pre_treino: "Pré-treino",
  pos_treino: "Pós-treino",
  cafe: "Café da manhã",
  almoco: "Almoço",
  lanche: "Lanche",
  jantar: "Jantar",
  ceia: "Ceia",
};

// Substitution helper
const s = (
  name: string,
  quantity: number,
  unit: "g" | "ml" | "un",
  macros?: { kcal?: number; p?: number; c?: number; f?: number }
) => ({
  id: `${name}-${quantity}${unit}`.replace(/\s+/g, "-").toLowerCase(),
  name,
  quantity,
  unit,
  kcal: macros?.kcal ?? null,
  protein: macros?.p ?? null,
  carbs: macros?.c ?? null,
  fats: macros?.f ?? null,
});

// Food factory
const f = (
  name: string,
  quantity: number,
  unit: "g" | "ml" | "un",
  macros: { kcal: number | null; p: number | null; c: number | null; f: number | null },
  substitutions: any[] = [],
  notes?: string
) => ({
  id: `${name}-${quantity}${unit}`.replace(/\s+/g, "-").toLowerCase(),
  name,
  quantity,
  unit,
  kcal: macros.kcal,
  protein: macros.p,
  carbs: macros.c,
  fats: macros.f,
  notes,
  substitutions,
});

export const INITIAL_PLAN: Plan = {
  id: "projeto-urso-default",
  name: "Projeto Urso — Dieta base 2.200 kcal",
  description:
    "Faixa-base ~2.200 kcal. Escolha UMA opção por refeição. Pesos correspondem aos alimentos cozidos/prontos salvo quando indicado CRU, SECO ou CONGELADO.",
  archived: false,
  createdAt: new Date().toISOString(),
  meals: [
    // ------- PRÉ-TREINO -------
    {
      id: "pre_treino",
      type: "pre_treino",
      name: "Pré-treino",
      options: [
        {
          id: "pre_treino-1",
          name: "Pré-treino 1 — Torradas com geleia",
          approxKcal: 190,
          notes: "≈ 190 kcal · P 4 g · C 41 g · G 2 g",
          foods: [
            f("Torradas Bauducco tradicionais", 37.5, "g", { kcal: 148, p: 3, c: 30, f: 2 }, [
              s("Pão francês", 40, "g"),
              s("Cuscuz cozido", 90, "g"),
              s("Goma de tapioca", 30, "g"),
            ], "5 torradas"),
            f("Geleia", 20, "g", { kcal: 42, p: 0, c: 11, f: 0 }, [
              s("Banana", 70, "g"),
              s("Maçã", 115, "g"),
              s("Mamão", 150, "g"),
            ]),
            f("Café sem açúcar", 200, "ml", { kcal: 0, p: 0, c: 0, f: 0 }),
          ],
        },
        {
          id: "pre_treino-2",
          name: "Pré-treino 2 — Pão com banana",
          approxKcal: 170,
          notes: "≈ 170 kcal · P 4 g · C 36 g · G 2 g",
          foods: [
            f("Pão francês", 40, "g", { kcal: 110, p: 3, c: 22, f: 1 }, [
              s("Cuscuz cozido", 90, "g"),
              s("Goma de tapioca", 30, "g"),
              s("Batata-doce cozida", 125, "g"),
            ]),
            f("Banana-prata", 70, "g", { kcal: 60, p: 1, c: 14, f: 0 }, [
              s("Maçã", 115, "g"),
              s("Mamão", 150, "g"),
              s("Melancia", 215, "g"),
            ]),
            f("Café sem açúcar", 200, "ml", { kcal: 0, p: 0, c: 0, f: 0 }),
          ],
        },
        {
          id: "pre_treino-3",
          name: "Pré-treino 3 — Cuscuz com creme de whey",
          approxKcal: 150,
          notes: "≈ 150 kcal · P 14 g · C 22 g · G 2 g. Se treinar à tarde/noite, mover 60–120 min antes do treino.",
          foods: [
            f("Cuscuz cozido", 80, "g", { kcal: 90, p: 2, c: 20, f: 0 }, [
              s("Pão francês", 35, "g"),
              s("Goma de tapioca", 25, "g"),
              s("Batata-doce", 110, "g"),
            ]),
            f("Whey preparado com pouca água", 15, "g", { kcal: 60, p: 12, c: 2, f: 2 }, [
              s("Frango cozido", 40, "g"),
              s("Patinho pronto", 35, "g"),
            ], "Consumir como acompanhamento salgado se substituído"),
            f("Café sem açúcar", 200, "ml", { kcal: 0, p: 0, c: 0, f: 0 }),
          ],
        },
      ],
    },
    // ------- CAFÉ / PÓS-TREINO -------
    {
      id: "cafe",
      type: "cafe",
      name: "Café da manhã / Pós-treino",
      options: [
        {
          id: "cafe-1",
          name: "Café/pós 1 — Cuscuz, ovo e frango",
          approxKcal: 415,
          notes: "≈ 415 kcal · P 34 g · C 45 g · G 11 g",
          foods: [
            f("Cuscuz cozido", 110, "g", { kcal: 125, p: 3, c: 27, f: 0 }, [
              s("Pão francês", 50, "g"),
              s("Goma de tapioca", 35, "g"),
              s("Batata-doce", 150, "g"),
            ]),
            f("Ovo", 1, "un", { kcal: 72, p: 6, c: 0, f: 5 }, [], "≈ 50 g"),
            f("Frango cozido", 70, "g", { kcal: 115, p: 22, c: 0, f: 3 }, [
              s("Patinho pronto", 62, "g"),
              s("Atum escorrido", 85, "g"),
              s("Sardinha", 70, "g"),
            ]),
            f("Requeijão light", 25, "g", { kcal: 40, p: 2, c: 1, f: 3 }),
            f("Mamão", 150, "g", { kcal: 65, p: 1, c: 17, f: 0 }, [
              s("Banana", 70, "g"),
              s("Maçã", 115, "g"),
              s("Melancia", 215, "g"),
            ]),
          ],
        },
        {
          id: "cafe-2",
          name: "Café/pós 2 — Pão, ovos e frango",
          approxKcal: 445,
          notes: "≈ 445 kcal · P 38 g · C 38 g · G 15 g",
          foods: [
            f("Pão francês", 50, "g", { kcal: 138, p: 4, c: 28, f: 1 }, [
              s("Cuscuz cozido", 110, "g"),
              s("Goma de tapioca", 40, "g"),
              s("Batata-doce", 160, "g"),
            ], "2 fatias"),
            f("Ovos", 2, "un", { kcal: 144, p: 12, c: 0, f: 10 }, [], "≈ 100 g. Alternativa: 1 ovo + 45 g de frango ou 40 g de patinho"),
            f("Frango cozido", 50, "g", { kcal: 82, p: 15, c: 0, f: 2 }, [
              s("Patinho pronto", 44, "g"),
              s("Atum escorrido", 60, "g"),
              s("Sardinha", 50, "g"),
            ]),
            f("Requeijão light", 20, "g", { kcal: 32, p: 2, c: 1, f: 3 }),
            f("Mamão", 150, "g", { kcal: 65, p: 1, c: 17, f: 0 }),
          ],
        },
        {
          id: "cafe-3",
          name: "Café/pós 3 — Vitamina completa",
          approxKcal: 430,
          notes: "≈ 430 kcal · P 38 g · C 58 g · G 7 g",
          foods: [
            f("Leite desnatado", 250, "ml", { kcal: 88, p: 8, c: 12, f: 0 }, [
              s("Iogurte natural desnatado", 250, "g"),
              s("Leite sem lactose", 250, "ml"),
            ]),
            f("Banana", 80, "g", { kcal: 72, p: 1, c: 18, f: 0 }, [
              s("Maçã", 130, "g"),
              s("Mamão", 170, "g"),
              s("Melancia", 250, "g"),
            ]),
            f("Aveia", 30, "g", { kcal: 116, p: 4, c: 20, f: 3 }, [
              s("Pão francês", 35, "g"),
              s("Cuscuz cozido", 80, "g"),
              s("Batata-doce", 110, "g"),
            ]),
            f("Whey", 30, "g", { kcal: 120, p: 24, c: 3, f: 2 }, [
              s("Frango cozido", 80, "g"),
              s("Patinho pronto", 70, "g"),
            ]),
            f("Amendoim", 5, "g", { kcal: 28, p: 1, c: 1, f: 2 }),
          ],
        },
      ],
    },
    // ------- ALMOÇO -------
    {
      id: "almoco",
      type: "almoco",
      name: "Almoço",
      options: [
        {
          id: "almoco-1",
          name: "Almoço 1 — Arroz, feijão e frango",
          approxKcal: 550,
          notes: "≈ 550 kcal · P 52 g · C 60 g · G 10 g",
          foods: [
            f("Arroz cozido", 130, "g", { kcal: 168, p: 3, c: 36, f: 0 }, [
              s("Cuscuz", 145, "g"),
              s("Macarrão cozido", 120, "g"),
              s("Batata-doce", 200, "g"),
              s("Mandioca", 120, "g"),
            ]),
            f("Feijão", 100, "g", { kcal: 75, p: 5, c: 13, f: 0 }),
            f("Frango cozido", 130, "g", { kcal: 215, p: 40, c: 0, f: 5 }, [
              s("Patinho pronto", 115, "g"),
              s("Atum escorrido", 160, "g"),
              s("Sardinha", 125, "g"),
            ]),
            f("Verduras e legumes", 200, "g", { kcal: 50, p: 3, c: 10, f: 0 }),
            f("Azeite", 5, "g", { kcal: 44, p: 0, c: 0, f: 5 }, [
              s("Requeijão light misturado ao frango", 30, "g"),
              s("Amendoim em outra refeição", 10, "g"),
            ]),
          ],
        },
        {
          id: "almoco-2",
          name: "Almoço 2 — Arroz, feijão e patinho",
          approxKcal: 540,
          notes: "≈ 540 kcal · P 46 g · C 60 g · G 12 g",
          foods: [
            f("Arroz cozido", 130, "g", { kcal: 168, p: 3, c: 36, f: 0 }, [
              s("Cuscuz", 145, "g"),
              s("Macarrão cozido", 120, "g"),
              s("Batata-doce", 200, "g"),
              s("Mandioca", 120, "g"),
            ]),
            f("Feijão", 100, "g", { kcal: 75, p: 5, c: 13, f: 0 }),
            f("Patinho pronto", 100, "g", { kcal: 190, p: 32, c: 0, f: 7 }, [
              s("Frango cozido", 115, "g"),
              s("Atum escorrido", 140, "g"),
              s("Sardinha", 110, "g"),
            ]),
            f("Verduras e legumes", 200, "g", { kcal: 50, p: 3, c: 10, f: 0 }),
            f("Azeite", 3, "g", { kcal: 27, p: 0, c: 0, f: 3 }, [
              s("Requeijão light", 20, "g"),
            ], "Se a carne estiver mais gordurosa, não acrescentar azeite/requeijão"),
          ],
        },
      ],
    },
    // ------- LANCHE -------
    {
      id: "lanche",
      type: "lanche",
      name: "Lanche da tarde",
      options: [
        {
          id: "lanche-1",
          name: "Lanche 1 — Hambúrguer caseiro",
          approxKcal: 470,
          notes: "≈ 460–480 kcal · P 32 g · C 52 g · G 13 g",
          foods: [
            f("Pão francês", 50, "g", { kcal: 138, p: 4, c: 28, f: 1 }, [
              s("Pão de hambúrguer", 50, "g"),
              s("Pão integral (2 fatias)", 50, "g"),
            ], "1 unidade"),
            f("Patinho CRU (hambúrguer)", 120, "g", { kcal: 156, p: 25, c: 0, f: 6 }, [
              s("Coxão mole cru", 120, "g"),
              s("Peito de frango cru moído", 120, "g"),
            ]),
            f("Requeijão light", 30, "g", { kcal: 48, p: 2, c: 2, f: 4 }, [
              s("Muçarela", 20, "g"),
              s("Queijo coalho light", 22, "g"),
            ]),
            f("Salada", 100, "g", { kcal: 20, p: 1, c: 4, f: 0 }),
            f("Batata-inglesa CRUA (air fryer)", 130, "g", { kcal: 100, p: 3, c: 22, f: 0 }, [
              s("Batata-doce cozida", 200, "g"),
              s("Batata congelada pré-frita (congelada)", 55, "g"),
            ]),
          ],
        },
        {
          id: "lanche-2",
          name: "Lanche 2 — Sanduíche de frango",
          approxKcal: 440,
          notes: "≈ 435–450 kcal · P 38 g · C 52 g · G 8 g",
          foods: [
            f("Pão", 60, "g", { kcal: 165, p: 5, c: 33, f: 1 }, [
              s("Cuscuz cozido", 130, "g"),
              s("Goma de tapioca", 45, "g"),
            ]),
            f("Frango cozido", 90, "g", { kcal: 148, p: 28, c: 0, f: 3 }, [
              s("Patinho pronto", 80, "g"),
              s("Atum escorrido", 110, "g"),
              s("Sardinha", 90, "g"),
            ]),
            f("Requeijão light", 30, "g", { kcal: 48, p: 2, c: 2, f: 4 }),
            f("Tomate e folhas", 100, "g", { kcal: 20, p: 1, c: 4, f: 0 }),
            f("Melancia", 200, "g", { kcal: 60, p: 1, c: 15, f: 0 }, [
              s("Abacaxi", 150, "g"),
              s("Mamão", 170, "g"),
              s("Banana", 80, "g"),
            ]),
          ],
        },
        {
          id: "lanche-3",
          name: "Lanche 3 — Crepioca cremosa",
          approxKcal: 400,
          notes: "≈ 400 kcal · P 39 g · C 29 g · G 15 g",
          foods: [
            f("Goma de tapioca", 35, "g", { kcal: 88, p: 0, c: 22, f: 0 }, [
              s("Pão", 40, "g"),
              s("Cuscuz cozido", 90, "g"),
              s("Batata-doce", 125, "g"),
            ]),
            f("Ovos", 2, "un", { kcal: 144, p: 12, c: 0, f: 10 }, [], "≈ 100 g"),
            f("Frango cozido", 60, "g", { kcal: 100, p: 19, c: 0, f: 2 }, [
              s("Patinho pronto", 53, "g"),
              s("Atum escorrido", 75, "g"),
              s("Sardinha", 60, "g"),
            ]),
            f("Requeijão light", 30, "g", { kcal: 48, p: 2, c: 2, f: 4 }, [
              s("Muçarela", 20, "g"),
              s("Queijo coalho light", 22, "g"),
            ]),
            f("Tomate e folhas", 100, "g", { kcal: 20, p: 1, c: 4, f: 0 }),
          ],
        },
        {
          id: "lanche-4",
          name: "Lanche 4 — Pão de queijo, whey e iogurte",
          approxKcal: 410,
          notes: "≈ 400–420 kcal · P 32 g · C 42 g · G 13 g. Pão de queijo varia entre marcas — conferir rótulo.",
          foods: [
            f("Pão de queijo PRONTO", 60, "g", { kcal: 175, p: 4, c: 20, f: 8 }, [
              s("Pão francês", 50, "g"),
              s("Cuscuz", 110, "g"),
            ]),
            f("Whey", 30, "g", { kcal: 120, p: 24, c: 3, f: 2 }, [
              s("Frango cozido", 80, "g"),
              s("Patinho pronto", 70, "g"),
              s("Atum escorrido", 100, "g"),
            ]),
            f("Iogurte natural desnatado", 170, "g", { kcal: 75, p: 6, c: 10, f: 0 }, [
              s("Leite desnatado", 170, "ml"),
            ]),
          ],
        },
        {
          id: "lanche-5",
          name: "Lanche 5 — Vitamina",
          approxKcal: 410,
          notes: "≈ 410 kcal · P 38 g · C 51 g · G 7 g",
          foods: [
            f("Leite desnatado", 250, "ml", { kcal: 88, p: 8, c: 12, f: 0 }, [
              s("Iogurte desnatado", 250, "g"),
              s("Leite sem lactose", 250, "ml"),
            ]),
            f("Banana", 80, "g", { kcal: 72, p: 1, c: 18, f: 0 }, [
              s("Maçã", 130, "g"),
              s("Mamão", 170, "g"),
              s("Melancia", 250, "g"),
            ]),
            f("Aveia", 25, "g", { kcal: 97, p: 3, c: 17, f: 2 }, [
              s("Pão", 30, "g"),
              s("Cuscuz", 70, "g"),
              s("Batata-doce", 90, "g"),
            ]),
            f("Whey", 30, "g", { kcal: 120, p: 24, c: 3, f: 2 }, [
              s("Frango cozido", 80, "g"),
              s("Patinho pronto", 70, "g"),
            ]),
            f("Amendoim", 5, "g", { kcal: 28, p: 1, c: 1, f: 2 }),
          ],
        },
        {
          id: "lanche-6",
          name: "Lanche 6 — Torta fit de frango",
          approxKcal: 460,
          notes: "≈ 450–470 kcal · P 39 g · C 47 g · G 12 g. Preparo: misturar ovo, aveia e leite; acrescentar frango, requeijão e vegetais; assar até firmar.",
          foods: [
            f("Ovo", 1, "un", { kcal: 72, p: 6, c: 0, f: 5 }),
            f("Aveia", 25, "g", { kcal: 97, p: 3, c: 17, f: 2 }),
            f("Leite", 50, "ml", { kcal: 18, p: 2, c: 2, f: 0 }),
            f("Frango cozido", 80, "g", { kcal: 132, p: 25, c: 0, f: 3 }, [
              s("Patinho pronto", 70, "g"),
              s("Atum escorrido", 100, "g"),
              s("Sardinha", 80, "g"),
            ]),
            f("Requeijão light", 30, "g", { kcal: 48, p: 2, c: 2, f: 4 }, [
              s("Muçarela", 20, "g"),
              s("Queijo coalho light", 22, "g"),
            ]),
            f("Vegetais", 100, "g", { kcal: 25, p: 1, c: 5, f: 0 }),
            f("Banana (acompanhamento)", 65, "g", { kcal: 58, p: 1, c: 14, f: 0 }, [
              s("Maçã", 110, "g"),
              s("Mamão", 140, "g"),
              s("Melancia", 200, "g"),
            ]),
          ],
        },
      ],
    },
    // ------- JANTAR -------
    {
      id: "jantar",
      type: "jantar",
      name: "Jantar",
      options: [
        {
          id: "jantar-1",
          name: "Jantar 1 — Arroz, feijão e frango",
          approxKcal: 500,
          notes: "≈ 500 kcal · P 47 g · C 55 g · G 8 g",
          foods: [
            f("Arroz", 130, "g", { kcal: 168, p: 3, c: 36, f: 0 }, [
              s("Cuscuz", 145, "g"),
              s("Macarrão cozido", 120, "g"),
              s("Batata-doce", 200, "g"),
            ]),
            f("Feijão", 80, "g", { kcal: 60, p: 4, c: 11, f: 0 }),
            f("Frango cozido", 120, "g", { kcal: 200, p: 37, c: 0, f: 5 }, [
              s("Patinho pronto", 105, "g"),
              s("Atum escorrido", 145, "g"),
              s("Sardinha", 115, "g"),
            ]),
            f("Vegetais", 200, "g", { kcal: 50, p: 3, c: 10, f: 0 }),
            f("Azeite", 3, "g", { kcal: 27, p: 0, c: 0, f: 3 }, [
              s("Requeijão light", 20, "g"),
            ]),
          ],
        },
        {
          id: "jantar-2",
          name: "Jantar 2 — Cuscuz cremoso",
          approxKcal: 465,
          notes: "≈ 465 kcal · P 44 g · C 45 g · G 12 g",
          foods: [
            f("Cuscuz", 140, "g", { kcal: 160, p: 3, c: 34, f: 0 }, [
              s("Pão", 60, "g"),
              s("Goma de tapioca", 45, "g"),
              s("Batata-doce", 190, "g"),
              s("Arroz", 125, "g"),
            ]),
            f("Ovo", 1, "un", { kcal: 72, p: 6, c: 0, f: 5 }),
            f("Frango cozido", 100, "g", { kcal: 165, p: 31, c: 0, f: 4 }, [
              s("Patinho pronto", 88, "g"),
              s("Atum escorrido", 125, "g"),
              s("Sardinha", 100, "g"),
            ]),
            f("Requeijão light", 20, "g", { kcal: 32, p: 2, c: 1, f: 3 }, [
              s("Muçarela", 15, "g"),
              s("Queijo coalho light", 17, "g"),
            ]),
            f("Vegetais", 150, "g", { kcal: 38, p: 2, c: 8, f: 0 }),
          ],
        },
        {
          id: "jantar-3",
          name: "Jantar 3 — Batata-doce com patinho",
          approxKcal: 470,
          notes: "≈ 460–480 kcal · P 39 g · C 50 g · G 12 g",
          foods: [
            f("Batata-doce", 220, "g", { kcal: 189, p: 3, c: 44, f: 0 }, [
              s("Arroz", 145, "g"),
              s("Cuscuz", 160, "g"),
              s("Macarrão cozido", 130, "g"),
              s("Mandioca", 135, "g"),
            ]),
            f("Patinho pronto", 100, "g", { kcal: 190, p: 32, c: 0, f: 7 }, [
              s("Frango cozido", 115, "g"),
              s("Atum escorrido", 140, "g"),
              s("Sardinha", 110, "g"),
            ]),
            f("Vegetais", 200, "g", { kcal: 50, p: 3, c: 10, f: 0 }),
            f("Azeite", 3, "g", { kcal: 27, p: 0, c: 0, f: 3 }, [
              s("Requeijão light", 20, "g"),
            ]),
          ],
        },
        {
          id: "jantar-4",
          name: "Jantar 4 — Macarrão cremoso com frango",
          approxKcal: 465,
          notes: "≈ 455–475 kcal · P 39 g · C 56 g · G 8 g",
          foods: [
            f("Macarrão SECO", 60, "g", { kcal: 210, p: 7, c: 43, f: 1 }, [
              s("Macarrão cozido", 170, "g"),
              s("Arroz", 180, "g"),
              s("Cuscuz", 200, "g"),
            ]),
            f("Frango cozido", 90, "g", { kcal: 148, p: 28, c: 0, f: 3 }, [
              s("Patinho pronto", 80, "g"),
              s("Atum escorrido", 110, "g"),
              s("Sardinha", 90, "g"),
            ]),
            f("Requeijão light", 30, "g", { kcal: 48, p: 2, c: 2, f: 4 }, [
              s("Muçarela", 20, "g"),
              s("Queijo coalho light", 22, "g"),
            ]),
            f("Vegetais", 150, "g", { kcal: 38, p: 2, c: 8, f: 0 }),
          ],
        },
        {
          id: "jantar-5",
          name: "Jantar 5 — Hambúrguer com batata",
          approxKcal: 460,
          notes: "≈ 450–475 kcal · P 32 g · C 48 g · G 13 g",
          foods: [
            f("Pão francês", 50, "g", { kcal: 138, p: 4, c: 28, f: 1 }, [
              s("Pão de hambúrguer", 50, "g"),
              s("Pão integral (2 fatias)", 50, "g"),
            ]),
            f("Patinho CRU (hambúrguer)", 120, "g", { kcal: 156, p: 25, c: 0, f: 6 }, [
              s("Frango cru moído", 120, "g"),
              s("Coxão mole cru", 120, "g"),
            ]),
            f("Requeijão light", 30, "g", { kcal: 48, p: 2, c: 2, f: 4 }, [
              s("Muçarela", 20, "g"),
              s("Queijo coalho light", 22, "g"),
            ]),
            f("Salada", 150, "g", { kcal: 30, p: 2, c: 6, f: 0 }),
            f("Batata-inglesa CRUA (air fryer)", 100, "g", { kcal: 77, p: 2, c: 17, f: 0 }, [
              s("Batata-doce", 150, "g"),
              s("Batata congelada pré-frita", 45, "g"),
            ]),
          ],
        },
        {
          id: "jantar-6",
          name: "Jantar 6 — Cuscuz com carne moída",
          approxKcal: 460,
          notes: "≈ 450–470 kcal · P 39 g · C 47 g · G 12 g",
          foods: [
            f("Cuscuz", 160, "g", { kcal: 183, p: 4, c: 39, f: 0 }, [
              s("Arroz", 145, "g"),
              s("Macarrão cozido", 155, "g"),
              s("Batata-doce", 220, "g"),
            ]),
            f("Patinho moído PRONTO", 90, "g", { kcal: 170, p: 29, c: 0, f: 6 }, [
              s("Frango cozido", 100, "g"),
              s("Atum escorrido", 125, "g"),
              s("Sardinha", 100, "g"),
            ]),
            f("Requeijão light", 20, "g", { kcal: 32, p: 2, c: 1, f: 3 }, [
              s("Muçarela", 15, "g"),
              s("Queijo coalho light", 17, "g"),
            ]),
            f("Vegetais", 150, "g", { kcal: 38, p: 2, c: 8, f: 0 }),
          ],
        },
      ],
    },
    // ------- CEIA -------
    {
      id: "ceia",
      type: "ceia",
      name: "Ceia / Sobremesa",
      options: [
        {
          id: "ceia-1",
          name: "Ceia 1 — Iogurte proteico",
          approxKcal: 200,
          notes: "≈ 200 kcal · P 22 g · C 16 g · G 6 g",
          foods: [
            f("Iogurte natural desnatado", 200, "g", { kcal: 88, p: 8, c: 12, f: 0 }, [
              s("Leite desnatado", 200, "ml"),
            ]),
            f("Whey", 15, "g", { kcal: 60, p: 12, c: 2, f: 1 }, [
              s("Frango cozido", 40, "g"),
              s("Patinho pronto", 35, "g"),
              s("Atum escorrido", 50, "g"),
            ]),
            f("Amendoim", 10, "g", { kcal: 57, p: 3, c: 2, f: 5 }, [
              s("Abacate", 50, "g"),
              s("Azeite em outra preparação", 5, "g"),
            ]),
          ],
        },
        {
          id: "ceia-2",
          name: "Ceia 2 — Leite, whey e abacate",
          approxKcal: 200,
          notes: "≈ 200 kcal · P 20 g · C 17 g · G 8 g",
          foods: [
            f("Leite desnatado", 200, "ml", { kcal: 70, p: 7, c: 10, f: 0 }, [
              s("Iogurte natural desnatado", 200, "g"),
            ]),
            f("Whey", 15, "g", { kcal: 60, p: 12, c: 2, f: 1 }, [
              s("Frango cozido", 40, "g"),
              s("Patinho pronto", 35, "g"),
            ]),
            f("Abacate", 50, "g", { kcal: 80, p: 1, c: 4, f: 7 }),
            f("Amendoim", 5, "g", { kcal: 28, p: 1, c: 1, f: 2 }, [
              s("Pasta de amendoim (substituindo abacate + amendoim)", 15, "g"),
              s("Castanha de caju", 15, "g"),
            ]),
          ],
        },
        {
          id: "ceia-3",
          name: "Ceia 3 — Ovos com requeijão",
          approxKcal: 215,
          notes: "≈ 210–220 kcal · P 16 g · C 12 g · G 13 g",
          foods: [
            f("Ovos", 2, "un", { kcal: 144, p: 12, c: 0, f: 10 }, [
              s("Frango cozido", 70, "g"),
              s("Patinho pronto", 60, "g"),
            ], "≈ 100 g. Se trocar por carne, manter 30 g de requeijão"),
            f("Requeijão light", 20, "g", { kcal: 32, p: 2, c: 1, f: 3 }, [
              s("Muçarela", 15, "g"),
              s("Queijo coalho light", 17, "g"),
            ]),
            f("Mamão", 100, "g", { kcal: 43, p: 1, c: 11, f: 0 }, [
              s("Banana", 45, "g"),
              s("Maçã", 75, "g"),
              s("Melancia", 145, "g"),
            ]),
          ],
        },
        {
          id: "ceia-4",
          name: "Ceia 4 — Fruta com amendoim",
          approxKcal: 190,
          notes: "≈ 190 kcal · P 4 g · C 34 g · G 5 g. Menor teor proteico — usar quando a meta de proteína do dia já estiver atingida.",
          foods: [
            f("Melancia", 400, "g", { kcal: 120, p: 2, c: 30, f: 0 }, [
              s("Mamão", 340, "g"),
              s("Morango", 400, "g"),
              s("Uva", 240, "g"),
            ]),
            f("Amendoim", 10, "g", { kcal: 57, p: 3, c: 2, f: 5 }, [
              s("Abacate", 50, "g"),
              s("Pasta de amendoim", 10, "g"),
            ]),
          ],
        },
      ],
    },
  ],
};
