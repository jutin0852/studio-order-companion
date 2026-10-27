export const PUSH_PROMPT_DISMISS_DAYS = 7;

export type PushPromptInput = {
  /** The browser can do web push here (service workers, Push API, secure page). */
  supported: boolean;
  permission: "default" | "granted" | "denied";
  /** This device already has an active push subscription. */
  subscribed: boolean;
  /** Epoch ms until which the person asked not to be asked again, if they did. */
  dismissedUntil: number | null;
  now: number;
  isIos: boolean;
  /** Running as an installed app (Home Screen), not in a browser tab. */
  standalone: boolean;
};

export type PushPromptState = "hidden" | "enable" | "ios-install";

/**
 * Decides what, if anything, to ask. Browsers never allow notifications to be
 * switched on silently, so the best we can do is ask clearly and at a calm moment.
 */
export function pushPromptState(input: PushPromptInput): PushPromptState {
  if (input.dismissedUntil !== null && input.now < input.dismissedUntil) return "hidden";
  // iPhones only support web push once the app is added to the Home Screen.
  if (!input.supported) return input.isIos && !input.standalone ? "ios-install" : "hidden";
  if (input.subscribed || input.permission === "denied") return "hidden";
  return "enable";
}

export const dismissedUntilFrom = (now: number) => now + PUSH_PROMPT_DISMISS_DAYS * 24 * 60 * 60 * 1000;
