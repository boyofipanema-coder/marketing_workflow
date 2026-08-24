"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getNotificationsAction } from "@/app/actions/collaboration";
import type { NotificationView } from "@/server/services/collaboration";

const REFRESH_INTERVAL_MS = 60_000;

interface NotificationContextValue {
  notifications: NotificationView[];
  markReadLocally: (notificationId: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({
  initialNotifications,
  children,
}: {
  initialNotifications: NotificationView[];
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const requestInFlight = useRef(false);
  const lastRefreshAt = useRef(Date.now());

  useEffect(() => {
    setNotifications(initialNotifications);
    lastRefreshAt.current = Date.now();
  }, [initialNotifications]);

  const refresh = useCallback(async () => {
    if (document.hidden || requestInFlight.current) return;

    requestInFlight.current = true;
    try {
      const result = await getNotificationsAction();
      if (result.success && result.data) setNotifications(result.data);
    } finally {
      lastRefreshAt.current = Date.now();
      requestInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    function refreshWhenVisible() {
      if (
        !document.hidden &&
        Date.now() - lastRefreshAt.current >= REFRESH_INTERVAL_MS
      ) {
        void refresh();
      }
    }
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);

  const markReadLocally = useCallback((notificationId: string) => {
    const readAt = new Date().toISOString();
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read_at: readAt }
          : notification,
      ),
    );
  }, []);

  const value = useMemo(
    () => ({ notifications, markReadLocally }),
    [markReadLocally, notifications],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const value = useContext(NotificationContext);
  if (!value) {
    throw new Error("useNotifications must be used inside NotificationProvider");
  }
  return value;
}
