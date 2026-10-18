import { useCallback, useEffect, useState } from 'react';

// Unknown/unauthorized hashes remain visible to the access guard; never redirect silently.
export function useWorkspaceRoute(defaultPage: string): [string, (page: string) => void] {
  const readRoute = () => window.location.hash.replace(/^#\/?/, '') || window.location.pathname.replace(/^\/+|\/+$/g, '') || defaultPage;
  const [page, setPage] = useState(readRoute);
  useEffect(() => { const onChange = () => setPage(readRoute()); window.addEventListener('hashchange', onChange); return () => window.removeEventListener('hashchange', onChange); }, [defaultPage]);
  const navigate = useCallback((next: string) => { window.location.hash = '/' + next; setPage(next); }, []);
  return [page, navigate];
}
