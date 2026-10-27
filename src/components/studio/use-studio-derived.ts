import { useMemo } from "react";
import { addCalendarDays, dueOptionsFor } from "./format";
import type { useStudioUi } from "./use-studio-ui";
import type { useStudioData } from "./use-studio-data";
import type { useStudioRouting } from "./use-studio-routing";

export function useStudioDerived({ ui, data, routing }: { ui: ReturnType<typeof useStudioUi>; data: ReturnType<typeof useStudioData>; routing: ReturnType<typeof useStudioRouting> }) {
  const { productId, selectedOrderId, today } = ui;
  const { orders, products, settings } = data;
  const { clientPathname } = routing;
  const dueOptions = useMemo(
    () => dueOptionsFor(today, settings.workingDays),
    [today, settings.workingDays],
  );
  const editingProductId = clientPathname?.match(
    /^\/products\/([^/]+)\/edit$/,
  )?.[1];
  const editingProduct =
    products.find((product) => product.id === editingProductId) ?? null;
  const activeProducts = products.filter((product) => !product.archived);
  const selected =
    products.find((product) => product.id === productId && !product.archived) ??
    activeProducts[0] ??
    products[0];
  const active = orders.filter((order) => order.status !== "delivered");
  const attentionOrders = useMemo(
    () =>
      active
        .filter(
          (order) =>
            !order.dueDate || order.dueDate <= addCalendarDays(today, settings.attentionDaysBefore),
        )
        .sort((a, b) => (a.dueDate ?? a.due).localeCompare(b.dueDate ?? b.due)),
    [active, today, settings.attentionDaysBefore],
  );
  const selectedOrder = orders.find((order) => order.id === selectedOrderId);
  return { dueOptions, editingProduct, activeProducts, selected, active, attentionOrders, selectedOrder };
}
