import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  enablePush,
  isSubscribed,
  pushSupported,
  notificationPermission,
} from "../lib/push";

// Rough check: iOS only allows web push when the PWA is installed to the home screen.
function isIosNotInstalled(): boolean {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error legacy iOS Safari flag
    window.navigator.standalone === true;
  return ios && !standalone;
}

export default function NotificationsBanner({ token }: { token: string }) {
  const save = useMutation(api.subscriptions.save);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    isSubscribed().then(setSubscribed);
  }, []);

  if (!pushSupported()) return null;
  if (subscribed) return null;
  if (dismissed) return null;

  const blocked = notificationPermission() === "denied";

  async function turnOn() {
    setBusy(true);
    setError(null);
    try {
      await enablePush((args) => save({ token, ...args }));
      setSubscribed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't enable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="banner">
      <div className="banner-text">
        <strong>🔔 Turn on push notifications</strong>
        {isIosNotInstalled() ? (
          <span className="small muted">
            On iPhone: tap Share → “Add to Home Screen”, open it from there, then
            enable.
          </span>
        ) : blocked ? (
          <span className="small muted">
            Notifications are blocked — allow them in your browser/site settings.
          </span>
        ) : (
          <span className="small muted">
            Get nudges, suggestions and the morning summary.
          </span>
        )}
        {error && <span className="small error">{error}</span>}
      </div>
      <div className="banner-actions">
        <button className="primary" onClick={turnOn} disabled={busy || blocked}>
          {busy ? "…" : "Enable"}
        </button>
        <button className="ghost" onClick={() => setDismissed(true)}>
          Later
        </button>
      </div>
    </div>
  );
}
