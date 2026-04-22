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
import { XMarkIcon } from "@heroicons/react/24/outline";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
};

type ConfirmationContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

type ConfirmationModalState = ConfirmOptions & {
  isOpen: boolean;
};

const ConfirmationContext = createContext<ConfirmationContextValue | null>(null);

const DEFAULT_STATE: ConfirmationModalState = {
  isOpen: false,
  title: "",
  message: "",
  confirmText: "Confirm",
  cancelText: "Cancel",
  isDangerous: false,
};

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ConfirmationModalState>(DEFAULT_STATE);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const close = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setModal(DEFAULT_STATE);
  }, []);

  useEffect(() => {
    return () => {
      if (resolverRef.current) {
        resolverRef.current(false);
        resolverRef.current = null;
      }
    };
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }

    setModal({
      isOpen: true,
      title: options.title,
      message: options.message,
      confirmText: options.confirmText ?? "Confirm",
      cancelText: options.cancelText ?? "Cancel",
      isDangerous: options.isDangerous ?? false,
    });

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const value = useMemo<ConfirmationContextValue>(() => ({ confirm }), [confirm]);

  useEffect(() => {
    if (!modal.isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(false);
      }

      if (event.key === "Enter") {
        const target = event.target as HTMLElement | null;
        const isTypingField =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target?.isContentEditable;

        if (!isTypingField) {
          event.preventDefault();
          close(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [modal.isOpen, close]);

  return (
    <ConfirmationContext.Provider value={value}>
      {children}
      {modal.isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 pointer-events-auto"
          role="presentation"
          onClick={() => close(false)}
        >
          <div
            className="bg-white rounded-lg shadow-lg w-96 max-w-[calc(100vw-2rem)] p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="global-confirmation-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h2 id="global-confirmation-title" className="text-lg font-semibold text-gray-900">{modal.title}</h2>
              <button
                type="button"
                onClick={() => close(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
                aria-label="Close"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-6">{modal.message}</p>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                {modal.cancelText}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className={`rounded border px-3 py-2 text-sm font-medium transition cursor-pointer ${
                  modal.isDangerous
                    ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                    : "border-gray-300 bg-gray-100 text-gray-900 hover:bg-gray-200"
                }`}
              >
                {modal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmationContext.Provider>
  );
}

export function useConfirmation() {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error("useConfirmation must be used within ConfirmationProvider");
  }
  return context;
}
