import { hc } from "hono/client";
import type { AppType } from "../../../server/src/app";

export const api = hc<AppType>("/", {
  init: { credentials: "include" },
});
