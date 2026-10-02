"use client";

import { RequireAuth } from "@/lib/session";

// Every editor route lives in this group: logged-out visitors are sent to sign-in.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
