export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

let nextToastId = 1;

export function useToast() {
  const toasts = useState<ToastItem[]>('lims:toasts', () => []);

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }

  function push(kind: ToastKind, title: string, message?: string, duration = 4_500): number {
    const id = nextToastId++;
    toasts.value = [...toasts.value, { id, kind, title, message }];
    if (import.meta.client) {
      window.setTimeout(() => dismiss(id), duration);
    }
    return id;
  }

  return {
    toasts,
    push,
    dismiss,
    success: (title: string, message?: string) => push('success', title, message),
    error: (title: string, message?: string) => push('error', title, message, 6_500),
    info: (title: string, message?: string) => push('info', title, message),
  };
}
