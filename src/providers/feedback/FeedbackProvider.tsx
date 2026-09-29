import type { ReactNode } from "react";

export type FeedbackProviderProps = {
  projectId: string;
  children: ReactNode;
};

/**
 * Native (and any non-web) build: renders its children and nothing else.
 *
 * The real widget is `FeedbackProvider.web.tsx`, which re-exports
 * `@fasterfixes/react`. Metro picks the `.web` file when it bundles for web
 * and this one otherwise, so the package -- a DOM widget that screenshots and
 * annotates real elements -- is never resolved into the iOS or Android bundle
 * at all. A `Platform.OS === "web"` check at the call site would not do that:
 * the import would still be bundled and evaluated on device.
 */
export function FeedbackProvider({ children }: FeedbackProviderProps) {
  return <>{children}</>;
}
