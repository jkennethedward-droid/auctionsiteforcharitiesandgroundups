"use client";

import { getIdTokenResult } from "firebase/auth";
import type { User } from "firebase/auth";

export type RoleClaim = "admin" | "staff" | null;

export async function getRoleClaim(user: User, forceRefresh = false): Promise<RoleClaim> {
  const token = await getIdTokenResult(user, forceRefresh);
  const role = token.claims?.role;
  if (role === "admin" || role === "staff") return role;
  return null;
}

