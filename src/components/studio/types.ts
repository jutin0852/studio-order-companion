

export type Status = "not_started" | "in_progress" | "ready" | "delivered";

export type View =
  | "today"
  | "orders"
  | "add"
  | "products"
  | "new_product"
  | "profile"
  | "summary"
  | "summary_orders"
  | "settings"
  | "settings_orders"
  | "settings_notifications"
  | "settings_receipts";

export type Product = {
  id: string;
  name: string;
  price: number;
  color: string;
  image?: string;
  archived?: boolean;
};

export type Order = {
  id: string;
  customer: string;
  product: string;
  productId?: string | null;
  due: string;
  dueDate?: string;
  total: number;
  status: Status;
  createdAt: string;
  notes?: string;
  clientRequestId?: string;
  synced?: boolean;
};

export type Message = { type: "success" | "error"; text: string };

export type ActionFeedback = { id: number; type: "success" | "error"; text: string };

export type Expense = { id: string; label: string; amount: number; date: string };

export type BusinessProfile = {
  logo?: string;
  ownerName?: string;
  businessName?: string;
};

export type Settings = {
  workingDays: number;
  reminderTime: string;
  timeZone: string;
  attentionDaysBefore: number;
  dueSoonDaysBefore: number[];
  overdueGraceDays: number;
  overdueRepeatDays: number;
  stalledRemindersEnabled: boolean;
  stalledAfterDays: number;
  stalledRepeatDays: number;
};

export type StoredStudioState = {
  orders?: Order[];
  products?: Product[];
  expenses?: Expense[];
  settings?: Settings;
  snoozed?: Record<string, string> | string[];
  businessProfile?: Pick<
    BusinessProfile,
    "ownerName" | "logo" | "businessName"
  >;
};

export type BootstrapPayload = {
  orders?: Array<Order & { dueDate?: string }>;
  products?: Product[];
  expenses?: Expense[];
  settings?: Settings;
  profile?: BusinessProfile;
  snoozed?: Record<string, string>;
};
