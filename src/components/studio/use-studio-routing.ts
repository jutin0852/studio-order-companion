import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { viewForPathname, viewPaths } from "./routing";
import type { View } from "./types";

export function useStudioRouting() {
  const pathname = usePathname();
  const [clientPathname, setClientPathname] = useState(pathname);
  useEffect(() => {
    const syncPathname = () => setClientPathname(window.location.pathname);
    window.addEventListener("popstate", syncPathname);
    return () => window.removeEventListener("popstate", syncPathname);
  }, []);
  // App Router redirects can update pathname before the popstate listener gets
  // a chance to run. Prefer that newer pathname for the current render so a
  // sign-in redirect cannot briefly show the previous screen.
  const view = viewForPathname(
    pathname !== clientPathname ? pathname : clientPathname,
  );
  const navigate = (path: string) => {
    const destination = new URL(path, window.location.href);
    const nextUrl = `${destination.pathname}${destination.search}${destination.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (currentUrl === nextUrl) return;
    window.history.pushState(null, "", nextUrl);
    setClientPathname(destination.pathname);
  };
  const setView = (nextView: View) => navigate(viewPaths[nextView]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    const frame = window.requestAnimationFrame(() =>
      document.querySelector<HTMLElement>("[data-page-heading]")?.focus(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [view]);
  return { clientPathname, view, navigate, setView };
}
