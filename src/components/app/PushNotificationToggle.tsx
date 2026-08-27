"use client";

import { useEffect, useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  isPushSupported,
  getPermissionState,
  subscribeToPush,
  unsubscribeFromPush,
  getExistingSubscription,
  subscriptionToJson,
} from "../../lib/push-notifications";
import { Button } from "../ui/button";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

/**
 * Compact push notification toggle for the dashboard sidebar icon row.
 */
export function PushNotificationToggle() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const subscribeMutation = useMutation(api.pushSubscriptions.subscribe);
  const unsubscribeMutation = useMutation(api.pushSubscriptions.unsubscribe);
  const mySubscriptions = useQuery(api.pushSubscriptions.getMySubscriptions);

  useEffect(() => {
    const s = isPushSupported();
    setSupported(s);
    if (s) {
      getExistingSubscription().then((sub) => setSubscribed(!!sub));
    }
  }, []);

  useEffect(() => {
    if (mySubscriptions && mySubscriptions.length > 0) setSubscribed(true);
  }, [mySubscriptions]);

  const handleToggle = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (subscribed) {
        const sub = await getExistingSubscription();
        if (sub) {
          await unsubscribeFromPush();
          await unsubscribeMutation({ endpoint: sub.endpoint });
        }
        setSubscribed(false);
        toast.success("Notifications muted");
      } else {
        const sub = await subscribeToPush();
        if (!sub) {
          toast.info("Notifications blocked by browser — enable in browser settings");
          setLoading(false);
          return;
        }
        const json = subscriptionToJson(sub);
        await subscribeMutation({
          endpoint: sub.endpoint,
          p256dh: (json.keys as Record<string, string>)?.p256dh || "",
          auth: (json.keys as Record<string, string>)?.auth || "",
          userAgent: navigator.userAgent,
        });
        setSubscribed(true);
        toast.success("Notifications enabled — you'll get review & streak reminders");
      }
    } catch (err) {
      console.error("Push toggle failed:", err);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [subscribed, loading, subscribeMutation, unsubscribeMutation]);

  if (!supported) return null;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleToggle}
      disabled={loading}
      aria-label={subscribed ? "Mute notifications" : "Enable notifications"}
    >
      {subscribed ? <Bell className="size-4" /> : <BellOff className="size-4 text-muted-foreground" />}
    </Button>
  );
}
