'use client';

import Modal from '@/components/Modal';

// A small confirmation modal. onConfirm runs immediately; the caller decides what happens next.
// `onCancel` should be a stable function (wrap it in useCallback).
export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="mb-6">{message}</p>
      <div className="flex gap-3">
        <button onClick={onConfirm} className="rounded border border-red-600 bg-red-600 px-4 py-2 text-white">
          {confirmLabel}
        </button>
        <button onClick={onCancel} className="rounded border px-4 py-2">
          Cancel
        </button>
      </div>
    </Modal>
  );
}
