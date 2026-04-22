import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircleIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { nanoid } from "nanoid";

type NotificationTone = "info" | "success" | "warning" | "danger";

type NotificationOptions = {
  tone?: NotificationTone;
  actionLabel?: string;
  onAction?: () => void;
};

type ToastOptions = NotificationOptions & {
  durationMs?: number;
};

type PersistentNotification = {
  message: string;
  tone: NotificationTone;
  actionLabel?: string;
  onAction?: () => void;
};

type ToastNotification = {
  id: string;
  message: string;
  tone: NotificationTone;
};

type NotificationContextValue = {
  showPersistentNotification: (message: string, options?: NotificationOptions) => void;
  hidePersistentNotification: () => void;
  notify: (message: string, options?: ToastOptions) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

function toneStyles(tone: NotificationTone) {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "danger":
      return "border-red-200 bg-red-50 text-red-950";
    case "info":
    default:
      return "border-slate-200 bg-white text-slate-900";
  }
}

function ToneIcon({ tone }: { tone: NotificationTone }) {
  const className = "h-5 w-5";

  if (tone === "success") {
    return <CheckCircleIcon className={className} />;
  }

  return <InformationCircleIcon className={className} />;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [persistentNotification, setPersistentNotification] = useState<PersistentNotification | null>(null);
  const [isPersistentVisible, setIsPersistentVisible] = useState(false);
  const [toastNotification, setToastNotification] = useState<ToastNotification | null>(null);
  const [isToastVisible, setIsToastVisible] = useState(false);
  const toastTimeoutRef = useRef<number | null>(null);
  const toastFadeTimeoutRef = useRef<number | null>(null);
  const persistentFadeTimeoutRef = useRef<number | null>(null);

  const FADE_DURATION_MS = 220;

  const clearToastFadeTimeout = useCallback(() => {
    if (toastFadeTimeoutRef.current !== null) {
      window.clearTimeout(toastFadeTimeoutRef.current);
      toastFadeTimeoutRef.current = null;
    }
  }, []);

  const clearPersistentFadeTimeout = useCallback(() => {
    if (persistentFadeTimeoutRef.current !== null) {
      window.clearTimeout(persistentFadeTimeoutRef.current);
      persistentFadeTimeoutRef.current = null;
    }
  }, []);

  const clearToastTimeout = useCallback(() => {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearToastTimeout();
      clearToastFadeTimeout();
      clearPersistentFadeTimeout();
    };
  }, [clearPersistentFadeTimeout, clearToastFadeTimeout, clearToastTimeout]);

  const showPersistentNotification = useCallback((message: string, options?: NotificationOptions) => {
    clearPersistentFadeTimeout();

    setPersistentNotification({
      message,
      tone: options?.tone ?? "danger",
      actionLabel: options?.actionLabel,
      onAction: options?.onAction,
    });

    setIsPersistentVisible(false);
    window.requestAnimationFrame(() => {
      setIsPersistentVisible(true);
    });
  }, [clearPersistentFadeTimeout]);

  const hidePersistentNotification = useCallback(() => {
    setIsPersistentVisible(false);
    clearPersistentFadeTimeout();
    persistentFadeTimeoutRef.current = window.setTimeout(() => {
      setPersistentNotification(null);
      persistentFadeTimeoutRef.current = null;
    }, FADE_DURATION_MS);
  }, [clearPersistentFadeTimeout]);

  const notify = useCallback((message: string, options?: ToastOptions) => {
    clearToastTimeout();
    clearToastFadeTimeout();

    setToastNotification({
      id: nanoid(),
      message,
      tone: options?.tone ?? "success",
    });

    setIsToastVisible(false);
    window.requestAnimationFrame(() => {
      setIsToastVisible(true);
    });

    toastTimeoutRef.current = window.setTimeout(() => {
      setIsToastVisible(false);
      toastTimeoutRef.current = null;
      toastFadeTimeoutRef.current = window.setTimeout(() => {
        setToastNotification(null);
        toastFadeTimeoutRef.current = null;
      }, FADE_DURATION_MS);
    }, options?.durationMs ?? 2200);
  }, [clearToastFadeTimeout, clearToastTimeout]);

  const value = useMemo<NotificationContextValue>(() => ({
    showPersistentNotification,
    hidePersistentNotification,
    notify,
  }), [showPersistentNotification, hidePersistentNotification, notify]);

  return (
    <NotificationContext.Provider value={value}>
      {children}

      {persistentNotification && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[80] flex w-[24rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 justify-center px-4">
          <div
            className={`pointer-events-auto flex w-full items-center gap-2 rounded-lg border px-4 py-3 shadow-lg ${toneStyles(persistentNotification.tone)} ${
              persistentNotification.tone === "danger"
                ? "bg-red-600 text-white border-red-500"
                : ""
            } transition-all duration-200 ${isPersistentVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"}`}
            role="status"
            aria-live="polite"
          >
            <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-current opacity-90" />
            <span className="text-sm font-medium">{persistentNotification.message}</span>
            {persistentNotification.actionLabel && persistentNotification.onAction && (
              <button
                type="button"
                onClick={persistentNotification.onAction}
                className="ml-auto rounded-md border border-current/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-current transition hover:bg-white/20 cursor-pointer"
              >
                {persistentNotification.actionLabel}
              </button>
            )}
          </div>
        </div>
      )}

      {toastNotification && (
        <div className="pointer-events-none fixed inset-0 z-[79] flex items-center justify-center p-4">
            <div
                key={toastNotification.id}
            className={`pointer-events-auto inline-flex w-fit max-w-[calc(100vw-2rem)] items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${toneStyles(toastNotification.tone)} transition-all duration-200 ${isToastVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
                role="status"
                aria-live="polite"
            >
                <ToneIcon tone={toastNotification.tone} />
                <span className="text-sm font-medium leading-5">{toastNotification.message}</span>
            </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }

  return context;
}