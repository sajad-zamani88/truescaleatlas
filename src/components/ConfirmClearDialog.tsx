import { useId } from 'react';
import { Trash2, X } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmClearDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmClearDialog({
  open,
  onClose,
  onConfirm,
}: ConfirmClearDialogProps) {
  const titleId = useId();

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId={titleId}
      className="confirm-backdrop"
    >
      <div className="confirm-view">
        <header className="dialog-head">
          <p className="eyebrow">Clear the survey sheet</p>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cancel clearing the map"
          >
            <X size={19} />
          </button>
        </header>
        <h2 id={titleId}>Clear every active place?</h2>
        <p className="dialog-lede">
          This removes all outlines and resets the comparison. The map returns
          to its default world view, and the share URL updates.
        </p>
        <div className="confirm-actions">
          <button
            type="button"
            className="button button--ghost"
            onClick={onClose}
            data-autofocus
          >
            Keep the atlas
          </button>
          <button
            type="button"
            className="button button--danger"
            onClick={onConfirm}
          >
            <Trash2 size={15} />
            Clear map
          </button>
        </div>
      </div>
    </Modal>
  );
}
