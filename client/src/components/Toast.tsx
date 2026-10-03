'use client';

export interface ToastData {
  id: number;
  kind: 'error' | 'success';
  message: string;
}

export default function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: ToastData[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-50 flex
      w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className={
            'pointer-events-auto rounded-lg border px-4 py-2.5 text-sm
            backdrop-blur ' +
            (t.kind === 'error'
              ? 'border-red-500/40 bg-red-950/80 text-red-200'
              : 'border-green-500/40 bg-green-950/80 text-green-200')
          }
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
