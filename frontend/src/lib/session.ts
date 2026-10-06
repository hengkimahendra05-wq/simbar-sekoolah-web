// Session boundary: auth is an httpOnly cookie the backend owns; the frontend's one
// duty is wiping the react-query cache so one account's data never renders for the next.
import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPost } from "./api";
import { queryClient } from "./queryClient";
import type { AuthUser, SchoolProfile } from "./types";

// Call after every successful login/signup.
export function beginSession(): void {
  queryClient.clear();
}

// Call from every sign-out control; the hard redirect resets all in-memory state.
export async function endSession(redirectTo: string = "/login"): Promise<void> {
  try {
    await apiPost("/auth/logout");
  } finally {
    queryClient.clear();
    window.location.assign(redirectTo);
  }
}

// Sesi aktif: GET /api/auth/me — 401 berarti belum login.
export function useAuth() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<AuthUser>("/auth/me"),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

// Profil sekolah untuk kop laporan & badge header.
export function useSchoolProfile() {
  return useQuery({
    queryKey: ["school-profile"],
    queryFn: () => apiGet<SchoolProfile>("/school-profile"),
    retry: false,
    staleTime: 60_000,
  });
}

// Login: set cookie sesi di backend, lalu tulis cache ["me"] dan bersihkan cache lama.
export async function login(username: string, password: string): Promise<AuthUser> {
  const user = await apiPost<AuthUser>("/auth/login", { username, password });
  queryClient.clear();
  queryClient.setQueryData(["me"], user);
  return user;
}
