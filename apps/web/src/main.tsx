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
    // Drop noise from browser extensions (crypto wallets, etc.) and in-app
    // browsers (Facebook/Instagram/Messenger) — these errors come from injected
    // scripts, not our app, and would otherwise flood Sentry. e.g. "Java object
    // is gone" is thrown by the Facebook in-app browser's own tracking bridge
    // when a shop opens our link from inside the FB/Messenger app.
    ignoreErrors: [
      "Cannot redefine property: ethereum",
      "Cannot set property ethereum",
      "MetaMask",
      "evmAsk",
      "Non-Error promise rejection captured",
      // In-app browser (FB/IG/Messenger) native-bridge noise
      "Java object is gone",
      "Object Not Found Matching Id",
      "invoking postMessage",
      "sendDataToNative",
    ],
    denyUrls: [
      /^chrome-extension:\/\//i,
      /^moz-extension:\/\//i,
      /extensions\//i,
      /evmAsk\.js/i,
      /inpage\.js/i,
      /contentscript\.js/i,
      /contentScript\.js/i,
      /kleoContentScript\.js/i,
      // In-app browser injected scripts (Facebook/Instagram/Messenger)
      /iabjs:\/\//i,
      /navigation_performance_logger/i,
    ],
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
