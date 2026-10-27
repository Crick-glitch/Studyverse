import * as React from 'react';
export const QueryClientProvider = ({ children }: any) => children;
export function useQuery({ queryKey, queryFn }: any) {
  const [s, set] = React.useState<any>({ isPending: true });
  React.useEffect(() => {
    let on = true;
    Promise.resolve().then(queryFn).then((d: any) => on && set({ data: d, isPending: false }), (e: any) => on && set({ isPending: false, isError: true, error: e }));
    return () => { on = false; };
  }, [JSON.stringify(queryKey)]);
  return { data: s.data, isPending: !!s.isPending, isError: !!s.isError, error: s.error };
}
