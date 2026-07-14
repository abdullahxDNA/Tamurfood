import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";

export type SessionUser = {
  id: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  role: "admin" | "shop" | "moderator";
  isActive: boolean;
};

export const sessionQueryOptions = queryOptions<SessionUser | null>({
  queryKey: ["session"],
  queryFn: async () => {
    const res = await api.api.v1.auth.me.$get();
    if (!res.ok) return null;
    return res.json() as Promise<SessionUser>;
  },
  staleTime: 60_000,
  retry: false,
});
