import { registerSW } from "virtual:pwa-register";

// Register the service worker and auto-update in the background.
export function setupPWA(): void {
  registerSW({ immediate: true });
}
