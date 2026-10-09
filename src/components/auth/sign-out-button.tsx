"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    await authClient.signOut();
    router.replace("/sign-in");
    router.refresh();
  };

  return <Button type="button" variant="ghost" onClick={signOut} disabled={isSigningOut} className="text-sm text-stone-600">{isSigningOut ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Signing out"/> : "Sign out"}</Button>;
}
