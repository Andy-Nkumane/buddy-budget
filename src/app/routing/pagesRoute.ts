export const resolvePagesRoute = (search: string, hash: string, basePath: string) => {
  if (!search.startsWith('?/')) return null;
  const decoded = search
    .slice(2)
    .split('&')
    .map((part) => part.replace(/~and~/g, '&'));
  const route = `/${decoded.shift() ?? ''}`;
  const restoredSearch = decoded.length ? `?${decoded.join('&')}` : '';
  return `${basePath}${route.replace(/^\//, '')}${restoredSearch}${hash}`;
};
