export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function matchesSearch(query: string, ...fields: (string | undefined | null)[]) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  return normalizeSearchText(fields.filter(Boolean).join(" ")).includes(normalizedQuery);
}
