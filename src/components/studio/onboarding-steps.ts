export type SetupStepId = "product" | "order" | "reminders" | "logo";

export type SetupStep = {
  id: SetupStepId;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  done: boolean;
};

export type SetupProgress = {
  hasProduct: boolean;
  hasOrder: boolean;
  remindersOn: boolean;
  hasLogo: boolean;
};

// Ordered the way a new owner naturally works: what you sell, your first order,
// then the extras that make Studio more useful.
export function setupSteps(progress: SetupProgress): SetupStep[] {
  return [
    {
      id: "product",
      title: "Add your first product",
      description: "List what you sell so orders are quick to enter.",
      actionLabel: "Add product",
      href: "/products/new",
      done: progress.hasProduct,
    },
    {
      id: "order",
      title: "Record your first order",
      description: "Add an order once the customer has paid.",
      actionLabel: "Add order",
      href: "/orders/new",
      done: progress.hasOrder,
    },
    {
      id: "reminders",
      title: "Turn on reminders",
      description: "Get a nudge before an order is due.",
      actionLabel: "Turn on",
      href: "/settings/notifications",
      done: progress.remindersOn,
    },
    {
      id: "logo",
      title: "Add your logo",
      description: "Your logo and name appear on your receipts.",
      actionLabel: "Add logo",
      href: "/profile/edit",
      done: progress.hasLogo,
    },
  ];
}

export const nextSetupStep = (steps: SetupStep[]) => steps.find((step) => !step.done) ?? null;
export const completedSetupSteps = (steps: SetupStep[]) => steps.filter((step) => step.done).length;
export const setupComplete = (steps: SetupStep[]) => steps.every((step) => step.done);
