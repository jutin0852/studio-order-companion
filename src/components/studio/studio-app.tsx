"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Add } from "./add-order";
import { monthKey } from "./format";
import { AppHeader, MobileNav, Sidebar } from "./navigation";
import { OrderDetail } from "./order-detail";
import { OrderManagement } from "./orders";
import { ProductCatalog, ProductEditor } from "./products";
import { Profile } from "./profile";
import { ReceiptsSettingsPage, SettingsHome, SettingsPanel } from "./settings";
import { BusinessSummary, SummaryOrderHistory } from "./summary";
import { SetupGuide, WelcomeDialog } from "./onboarding";
import { PushPrompt } from "./push-prompt";
import { usePushPrompt } from "./use-push-prompt";
import { setupComplete, setupSteps } from "./onboarding-steps";
import { Today } from "./today";
import { useOnboarding } from "./use-onboarding";
import { useStudioUi } from "./use-studio-ui";
import { useStudioRouting } from "./use-studio-routing";
import { useActionMessage } from "./use-action-message";
import { useStudioData } from "./use-studio-data";
import { useStudioDerived } from "./use-studio-derived";
import { useStudioActions } from "./use-studio-actions";

export function StudioLoading() {
  return (
    <main className="min-h-screen bg-mist text-stone-900">
      <div className="mx-auto min-h-screen max-w-6xl bg-white sm:border-x sm:border-stone-200">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 sm:px-8">
          <div className="h-8 w-24 animate-pulse rounded-lg bg-plaster" />
          <div className="h-10 w-10 animate-pulse rounded-full bg-plaster" />
        </div>
        <section
          className="app-content space-y-5 px-5 pt-6 sm:px-8 sm:pt-9"
          aria-busy="true"
          aria-label="Loading Studio"
        >
          <div className="h-9 w-48 animate-pulse rounded-lg bg-plaster" />
          <div className="h-24 rounded-xl bg-plaster/70" />
          <div className="h-48 rounded-xl bg-plaster/70" />
        </section>
      </div>
    </main>
  );
}

export default function Home({
  userId,
  initialUserName,
  initialSummaryMonth,
  notificationsPaused = false,
}: {
  userId: string;
  initialUserName?: string | null;
  initialSummaryMonth?: string | null;
  notificationsPaused?: boolean;
}) {
  const ui = useStudioUi({ initialSummaryMonth });
  const routing = useStudioRouting();
  const messages = useActionMessage();
  const data = useStudioData({ userId, initialUserName, ui, messages });
  const derived = useStudioDerived({ ui, data, routing });
  const actions = useStudioActions({ ui, derived, routing, data, messages });
  const { today, summaryMonth, filter, setFilter, custom, setCustom, productId, setProductId, saveProduct, setSaveProduct, message, savedOrderConfirmation, setSavedOrderConfirmation, setSelectedOrderId } = ui;
  const { view, navigate, setView } = routing;
  const { actionMessage, setActionMessage } = messages;
  const { orders, products, snoozed, expenses, settings, setSettings, businessProfile, setBusinessProfile, hydrated, serverLoaded } = data;
  const onboarding = useOnboarding({ userId, serverLoaded, hasData: orders.length > 0 || products.length > 0 });
  const pushPrompt = usePushPrompt({ userId, paused: notificationsPaused, onEnabled: () => setActionMessage("Notifications are on.") });
  const steps = setupSteps({
    hasProduct: products.length > 0,
    hasOrder: orders.length > 0,
    remindersOn: pushPrompt.subscribed,
    remindersPaused: notificationsPaused,
    hasLogo: Boolean(businessProfile.logo),
  });
  const { dueOptions, editingProduct, activeProducts, selected, active, attentionOrders, selectedOrder } = derived;
  const guideVisible = onboarding.ready && !onboarding.guideHidden && !setupComplete(steps);
  const { openAdd, openNewProduct, openEditProduct, saveProductRecord, toggleProductArchive, deleteProduct, advance, saveOrder, deleteOrder, toggleSnooze, addExpense, addOrder, saveBusinessProfile, replaceLogo, changeSummaryMonth } = actions;
  if (!hydrated) return <StudioLoading />;
  return (
    <main className="min-h-screen bg-mist text-stone-900">
      <div className="mx-auto min-h-screen max-w-6xl bg-white sm:border-x sm:border-stone-200">
        <AppHeader
          setView={setView}
          businessLogo={businessProfile.logo}
          ownerName={businessProfile.ownerName}
        />
        <div className="grid lg:grid-cols-[190px_minmax(0,1fr)]">
          <Sidebar view={view} setView={setView} onAdd={openAdd} />
          <section className="app-content min-w-0 px-5 pb-24 pt-6 sm:px-8 sm:pt-9 lg:pb-10">
            {actionMessage && !savedOrderConfirmation && (
              <div
                key={actionMessage.id}
                role={actionMessage.type === "error" ? "alert" : "status"}
                aria-live={actionMessage.type === "error" ? "assertive" : "polite"}
                aria-atomic="true"
                className="pointer-events-none fixed inset-0 z-[100] grid place-items-center px-5"
              >
                <div
                  className={`studio-toast-enter flex w-full max-w-sm items-center gap-3 rounded-2xl border bg-white px-5 py-4 text-sm font-semibold shadow-xl shadow-stone-950/15 ${actionMessage.type === "error" ? "border-rose-200 text-rose-800" : "border-brand/20 text-brand"}`}
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${actionMessage.type === "error" ? "bg-rose-50" : "bg-brand-soft"}`}
                  >
                    {actionMessage.type === "error" ? (
                      <X className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Check className="h-5 w-5" aria-hidden="true" />
                    )}
                  </span>
                  <p>{actionMessage.text}</p>
                </div>
              </div>
            )}
            {view === "today" && (
              <Today
                today={today}
                ownerName={businessProfile.ownerName}
                attention={attentionOrders}
                attentionDaysBefore={settings.attentionDaysBefore}
                overdueGraceDays={settings.overdueGraceDays}
                active={active}
                advance={advance}
                goAdd={openAdd}
                goOrders={() => setView("orders")}
                snoozed={snoozed}
                toggleSnooze={toggleSnooze}
                selectOrder={(order) => setSelectedOrderId(order.id)}
                guide={
                  <>
                    {guideVisible && (
                      <SetupGuide
                        steps={steps}
                        onNavigate={navigate}
                        onHide={onboarding.hideGuide}
                        onShowWelcome={onboarding.openWelcome}
                        inlineActions={pushPrompt.state === "enable" ? { reminders: pushPrompt.enable } : undefined}
                        busy={pushPrompt.busy}
                        error={pushPrompt.error}
                      />
                    )}
                    {!guideVisible && pushPrompt.state !== "hidden" && (
                      <PushPrompt
                        state={pushPrompt.state}
                        busy={pushPrompt.busy}
                        error={pushPrompt.error}
                        onEnable={pushPrompt.enable}
                        onDismiss={pushPrompt.dismiss}
                      />
                    )}
                  </>
                }
              />
            )}{" "}
            {view === "orders" && (
              <OrderManagement
                today={today}
                orders={orders}
                attentionDaysBefore={settings.attentionDaysBefore}
                overdueGraceDays={settings.overdueGraceDays}
                filter={filter}
                setFilter={setFilter}
                advance={advance}
                goAdd={openAdd}
                selectOrder={(order) => setSelectedOrderId(order.id)}
              />
            )}{" "}
            {view === "add" && (
              <Add
                dueOptions={dueOptions}
                products={activeProducts}
                selected={selected}
                productId={productId}
                setProductId={setProductId}
                custom={custom}
                setCustom={setCustom}
                saveProduct={saveProduct}
                setSaveProduct={setSaveProduct}
                addOrder={addOrder}
                message={message}
                workingDays={settings.workingDays}
                today={today}
              />
            )}{" "}
            {view === "products" && (
              <ProductCatalog
                products={products}
                goAdd={openNewProduct}
                onEdit={openEditProduct}
                onToggleArchive={toggleProductArchive}
                onDelete={deleteProduct}
              />
            )}{" "}
            {view === "new_product" && (
              <ProductEditor
                key={editingProduct?.id ?? "new"}
                initial={editingProduct}
                onCancel={() => setView("products")}
                onSave={saveProductRecord}
              />
            )}{" "}
            {view === "profile" && (
              <Profile
                today={today}
                businessLogo={businessProfile.logo}
                ownerName={businessProfile.ownerName}
                businessName={businessProfile.businessName}
                onOwnerNameChange={(ownerName) =>
                  setBusinessProfile((profile) => ({ ...profile, ownerName }))
                }
                onBusinessNameChange={(businessName) =>
                  setBusinessProfile((profile) => ({
                    ...profile,
                    businessName,
                  }))
                }
                onLogoChange={replaceLogo}
                onSaveProfile={saveBusinessProfile}
                onSettings={() => setView("settings")}
                onSummary={() => setView("summary")}
                revenue={orders.reduce((sum, order) => sum + order.total, 0)}
                delivered={
                  orders.filter((order) => order.status === "delivered").length
                }
                expenses={expenses}
                onAddExpense={addExpense}
              />
            )}{" "}
            {view === "summary" && (
              <BusinessSummary
                today={today}
                orders={orders}
                expenses={expenses}
                selectedMonth={summaryMonth ?? monthKey(today)}
                onSelectMonth={changeSummaryMonth}
                onBack={() => setView("profile")}
                onAddOrder={openAdd}
                onViewOrders={(month) => {
                  changeSummaryMonth(month);
                  navigate(`/summary/orders?month=${encodeURIComponent(month)}`);
                }}
                selectOrder={(order) => setSelectedOrderId(order.id)}
              />
            )}{" "}
            {view === "summary_orders" && (
              <SummaryOrderHistory
                today={today}
                orders={orders}
                selectedMonth={summaryMonth ?? monthKey(today)}
                onSelectMonth={changeSummaryMonth}
                onBack={() => setView("summary")}
                onAddOrder={openAdd}
                selectOrder={(order) => setSelectedOrderId(order.id)}
              />
            )}{" "}
            {view === "settings" && (
              <SettingsHome
                onOpen={setView}
                onBack={() => setView("profile")}
              />
            )}
            {(view === "settings_orders" || view === "settings_notifications") && (
              <SettingsPanel
                section={view === "settings_orders" ? "orders" : "notifications"}
                settings={settings}
                notificationsPaused={notificationsPaused}
                onSave={(nextSettings) => {
                  setSettings(nextSettings);
                  setActionMessage("Settings saved.");
                }}
                onBack={() => setView("settings")}
              />
            )}
            {view === "settings_receipts" && (
              <ReceiptsSettingsPage onBack={() => setView("settings")} />
            )}
          </section>
        </div>
        <MobileNav view={view} setView={setView} onAdd={openAdd} />
        <WelcomeDialog open={onboarding.welcomeOpen} onClose={onboarding.closeWelcome} />
        {selectedOrder && (
          <OrderDetail
            order={selectedOrder}
            advance={advance}
            onSave={saveOrder}
            onDelete={deleteOrder}
            close={() => setSelectedOrderId(null)}
          />
        )}
        <Dialog
          open={Boolean(savedOrderConfirmation)}
          onOpenChange={(open) => {
            if (!open) {
              setSavedOrderConfirmation(null);
              setActionMessage("");
            }
          }}
        >
          <DialogContent centered className="max-w-sm text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check className="h-7 w-7" aria-hidden="true" />
            </span>
            <DialogTitle className="mt-4 text-xl font-bold text-stone-950">
              {savedOrderConfirmation?.title}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-6 text-stone-600">
              {savedOrderConfirmation?.description}
            </DialogDescription>
            <Button
              type="button"
              autoFocus
              onClick={() => {
                setSavedOrderConfirmation(null);
                setActionMessage("");
              }}
              className="mt-5 w-full bg-stone-950 text-white hover:bg-stone-700"
            >
              Continue to orders
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
