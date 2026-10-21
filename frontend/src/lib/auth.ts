const TOKEN_KEY = "ticketflow_token";
const USER_KEY = "ticketflow_user";

export type TicketFlowUser = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
};

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function saveAuthSession(token: string, user: TicketFlowUser): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getAuthUser(): TicketFlowUser | null {
  if (typeof window === "undefined") return null;

  const value = sessionStorage.getItem(USER_KEY);
  if (!value) return null;

  try {
    return JSON.parse(value) as TicketFlowUser;
  } catch {
    sessionStorage.removeItem(USER_KEY);
    return null;
  }
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}
