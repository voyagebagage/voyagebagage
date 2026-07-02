// Web Push helpers. The VAPID public key is injected at build time.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as
  | string
  | undefined;

export function pushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function notificationPermission(): NotificationPermission {
  return "Notification" in window ? Notification.permission : "denied";
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  // Back the array with a concrete ArrayBuffer so it satisfies BufferSource.
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

type SaveSub = (args: {
  endpoint: string;
  p256dh: string;
  auth: string;
}) => Promise<unknown>;

type RemoveSub = (args: { endpoint: string }) => Promise<unknown>;

/** Ask permission, subscribe to push, and persist the subscription server-side. */
export async function enablePush(save: SaveSub): Promise<void> {
  if (!pushSupported()) {
    throw new Error("This device/browser doesn't support push notifications.");
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error("VITE_VAPID_PUBLIC_KEY is not set. See README.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      "Notifications are blocked. Enable them in your browser/OS settings.",
    );
  }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  const json = sub.toJSON();
  if (!json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Subscription is missing encryption keys.");
  }
  await save({
    endpoint: sub.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
  });
}

/** Unsubscribe this device and drop it from the server. */
export async function disablePush(remove: RemoveSub): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await remove({ endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
}

/** Is this device currently subscribed? */
export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub !== null;
}
