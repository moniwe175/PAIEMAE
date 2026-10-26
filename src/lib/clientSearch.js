export function normalizeClientSearch(value) {
  return String(value || '')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function editDistance(left, right) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

export function scoreClientSearch(client, rawQuery) {
  const query = normalizeClientSearch(rawQuery);
  if (!query) return 1;

  const name = normalizeClientSearch(client?.nome ?? client?.name);
  const words = name.split(' ').filter(Boolean);
  const queryDigits = String(rawQuery || '').replace(/\D/g, '');
  const phone = String(client?.telefone ?? client?.phone ?? '').replace(/\D/g, '');

  if (name === query) return 10000;
  if (name.startsWith(query)) return 9000 - Math.min(name.length - query.length, 500);

  const wordPrefixIndex = words.findIndex((word) => word.startsWith(query));
  if (wordPrefixIndex >= 0) return 8000 - (wordPrefixIndex * 50);

  const containsAt = name.indexOf(query);
  if (containsAt >= 0) return 7000 - containsAt;

  if (queryDigits.length >= 2 && phone.includes(queryDigits)) {
    return phone.endsWith(queryDigits) ? 6800 : 6500;
  }

  // A aproximacao so entra com pelo menos 3 letras. Assim, uma busca curta
  // nao enche a lista com nomes sem relacao.
  if (query.length >= 3) {
    const tolerance = query.length >= 7 ? 2 : 1;
    const candidates = [name, ...words].map((candidate) => (
      candidate.slice(0, Math.max(query.length, Math.min(candidate.length, query.length + 1)))
    ));
    const prefixDistance = Math.min(...candidates.map((candidate) => editDistance(query, candidate)));
    if (prefixDistance <= tolerance) {
      return 5000 - (prefixDistance * 200) - Math.abs((words[0] || '').length - query.length);
    }
  }

  return 0;
}

export function searchClients(clients = [], rawQuery = '', limit = 12) {
  const query = normalizeClientSearch(rawQuery);
  return clients
    .map((client, originalIndex) => ({
      client,
      originalIndex,
      score: query ? scoreClientSearch(client, rawQuery) : 1,
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => (
      right.score - left.score
      || normalizeClientSearch(left.client?.nome ?? left.client?.name)
        .localeCompare(normalizeClientSearch(right.client?.nome ?? right.client?.name), 'pt-BR')
      || left.originalIndex - right.originalIndex
    ))
    .slice(0, limit)
    .map((item) => item.client);
}

export function findUniqueExactClient(clients = [], rawQuery = '') {
  const query = normalizeClientSearch(rawQuery);
  if (!query) return null;
  const exact = clients.filter((client) => normalizeClientSearch(client?.nome ?? client?.name) === query);
  return exact.length === 1 ? exact[0] : null;
}
