import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
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

// Error tracking — loaded LAZILY after the app renders so the (heavy) Sentry
// SDK stays out of the initial bundle and off the critical render path. DSN
// comes from the server at runtime, with a build-time VITE_ fallback for local
// dev. No-op when neither is set. The trade-off: errors in the first moment
// before this chunk loads aren't captured — acceptable for a much faster load.
function initErrorTracking() {
  const sentryDsn =
    window.__ENV__?.SENTRY_DSN ??
    (import.meta.env.VITE_SENTRY_DSN as string | undefined);
  if (!sentryDsn) return;
  void import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn: sentryDsn,
      environment: import.meta.env.MODE,
      // Capture a small sample of performance traces; errors are always sent.
      tracesSampleRate: 0.1,
      // Drop noise from browser extensions (crypto wallets, etc.) and in-app
      // browsers (Facebook/Instagram/Messenger) — these errors come from
      // injected scripts, not our app, and would otherwise flood Sentry. e.g.
      // "Java object is gone" is thrown by the Facebook in-app browser's own
      // tracking bridge when a shop opens our link from inside FB/Messenger.
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

// Kick off error tracking once the app is interactive and the browser is idle,
// so downloading/initialising Sentry never delays the first paint.
if ("requestIdleCallback" in window) {
  requestIdleCallback(initErrorTracking);
} else {
  setTimeout(initErrorTracking, 2000);
}
