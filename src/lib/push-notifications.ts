/**
 * Web Push Notification utilities — VAPID subscription management.
 *
 * Uses the VAPID key pair from Firebase Cloud Messaging console.
 * Subscriptions are stored server-side via Convex mutations so the
 * cron job can fan out pushes to all registered devices.
 */

/** VAPID public key from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates */
const VAPID_PUBLIC_KEY =
  "BES1sfuKagTTie8bRFbLy2_e5p-bzTRK8FgLFwVpwyAPBU0LgUjRk3a9m5iCLXcLY2rbIsMcGmKtaiVEuZXGz0s";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

/** Check if push notifications are supported in this browser */
export function isPushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Get the current notification permission state */
export function getPermissionState(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Request notification permission and subscribe to push.
 * Returns the subscription object (to store in Convex) or null.
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  return subscription;
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;

  return subscription.unsubscribe();
}

/**
 * Get the current push subscription (if any).
 */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/**
 * Convert a PushSubscription to a storable JSON object for Convex.
 */
export function subscriptionToJson(sub: PushSubscription): Record<string, unknown> {
  return sub.toJSON() as Record<string, unknown>;
}
