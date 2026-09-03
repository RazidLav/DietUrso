// Classifica alimentos em categorias para a lista de compras.
// Baseado em palavras-chave — sem dependências externas, tudo local.

export type Category =
  | "Proteínas"
  | "Carboidratos"
  | "Laticínios"
  | "Frutas"
  | "Vegetais"
  | "Gorduras & Temperos"
  | "Outros";

const RULES: { cat: Category; keywords: string[] }[] = [
  {
    cat: "Proteínas",
    keywords: [
      "frango", "patinho", "carne", "coxão", "peito", "atum", "sardinha",
      "ovo", "ovos", "peixe", "whey", "pernil", "lombo", "salmão", "salmao",
      "hambúrguer", "hamburguer", "moída", "moida",
    ],
  },
  {
    cat: "Laticínios",
    keywords: [
      "leite", "iogurte", "requeijão", "requeijao", "queijo", "muçarela",
      "mucarela", "coalho", "manteiga", "creme", "ricota",
    ],
  },
  {
    cat: "Carboidratos",
    keywords: [
      "arroz", "feijão", "feijao", "pão", "pao", "torrada", "cuscuz",
      "aveia", "macarrão", "macarrao", "batata", "mandioca", "tapioca",
      "goma", "flocão", "flocao", "wrap", "biscoito",
    ],
  },
  {
    cat: "Frutas",
    keywords: [
      "banana", "maçã", "maca", "mamão", "mamao", "melancia", "abacaxi",
      "morango", "uva", "abacate", "geleia", "laranja", "manga",
      "kiwi", "pera", "melão", "melao",
    ],
  },
  {
    cat: "Vegetais",
    keywords: [
      "salada", "verdura", "legume", "tomate", "cenoura", "folhas",
      "abobrinha", "brócolis", "brocolis", "chuchu", "beterraba",
      "pimentão", "pimentao", "vegetais", "vegetal", "repolho", "alface",
      "cebola", "alho", "cheiro-verde",
    ],
  },
  {
    cat: "Gorduras & Temperos",
    keywords: [
      "azeite", "óleo", "oleo", "amendoim", "castanha", "pasta",
      "sal", "páprica", "paprica", "pimenta", "limão", "limao", "ervas",
    ],
  },
];

const CATEGORY_ORDER: Category[] = [
  "Proteínas",
  "Carboidratos",
  "Laticínios",
  "Frutas",
  "Vegetais",
  "Gorduras & Temperos",
  "Outros",
];

export function categorizeFood(name: string): Category {
  const n = name.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => n.includes(k))) return rule.cat;
  }
  return "Outros";
}

export function sortCategories(a: Category, b: Category) {
  return CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b);
}

export const CATEGORY_ICONS: Record<Category, string> = {
  "Proteínas": "food-drumstick",
  "Carboidratos": "grain",
  "Laticínios": "cheese",
  "Frutas": "fruit-cherries",
  "Vegetais": "leaf",
  "Gorduras & Temperos": "shaker-outline",
  "Outros": "basket-outline",
};
