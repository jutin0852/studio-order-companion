import type { View } from "./types";

export const storageKeyPrefix = "studio-state-v1";

export const viewPaths: Record<View, string> = {
  today: "/",
  orders: "/orders",
  add: "/orders/new",
  products: "/products",
  new_product: "/products/new",
  profile: "/profile",
  summary: "/summary",
  summary_orders: "/summary/orders",
  settings: "/settings",
  settings_orders: "/settings/orders",
  settings_notifications: "/settings/notifications",
  settings_receipts: "/settings/receipts",
};

export function viewForPathname(pathname: string | null): View {
  if (pathname?.startsWith("/products/") && pathname.endsWith("/edit"))
    return "new_product";
  switch (pathname) {
    case "/orders":
      return "orders";
    case "/orders/new":
      return "add";
    case "/products":
      return "products";
    case "/products/new":
      return "new_product";
    case "/profile/edit":
    case "/profile":
      return "profile";
    case "/summary/orders":
      return "summary_orders";
    case "/summary":
      return "summary";
    case "/settings":
      return "settings";
    case "/settings/orders":
      return "settings_orders";
    case "/settings/notifications":
      return "settings_notifications";
    case "/settings/receipts":
      return "settings_receipts";
    default:
      return "today";
  }
}

export function studioNavigate(path: string) {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
