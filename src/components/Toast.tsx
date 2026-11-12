import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export type ToastTone = 'info' | 'success' | 'error';

interface ToastProps {
  message: string;
  tone: ToastTone;
}

export function Toast({ message, tone }: ToastProps) {
  const Icon =
    tone === 'success'
      ? CheckCircle2
      : tone === 'error'
        ? AlertTriangle
        : Info;

  return (
    <div
      className={`toast toast--${tone}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Icon size={17} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
