import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import * as Sentry from "@sentry/react";
import { routeTree } from "./routeTree.gen";
import "./index.css";

// Runtime config injected by the server into index.html (see apps/server). Lets
// production read secrets/keys at runtime instead of baking them in at build
// time (Railway doesn't reliably pass VITE_ build args to the Docker build).
declare global {
  interface Window {
    __ENV__?: { SENTRY_DSN?: string | null };
  }
}

// Error tracking — DSN from the server at runtime, with a build-time VITE_ var
// fallback for local dev. No-op when neither is set (keeps dev quiet).
const sentryDsn =
  window.__ENV__?.SENTRY_DSN ??
  (import.meta.env.VITE_SENTRY_DSN as string | undefined);
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    // Capture a small sample of performance traces; errors are always sent.
    tracesSampleRate: 0.1,
  });
}

const queryClient = new QueryClient();

const router = createRouter({ routeTree, context: { queryClient } });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} context={{ queryClient }} />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
);
