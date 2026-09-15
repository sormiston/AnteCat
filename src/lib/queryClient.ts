import { QueryClient } from "@tanstack/react-query";

// Module-level singleton: Fast Refresh re-runs the root layout's render, and a
// client constructed there would drop the whole cache on every save.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Realtime (ticket 5) drives invalidation, so background polling would
      // only duplicate work.
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 30_000,
    },
  },
});
