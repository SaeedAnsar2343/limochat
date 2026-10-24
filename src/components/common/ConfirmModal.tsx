import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import { navigationManager } from '../../utils/navigationManager';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary' | 'info';
  icon?: React.ReactNode;
  singleAction?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  icon,
  singleAction = false,
  onConfirm,
  onCancel,
}) => {
  React.useEffect(() => {
    if (isOpen) {
      window.dispatchEvent(new CustomEvent('limochat_close_all_menus'));
      const unregister = navigationManager.registerModal('confirm_modal', () => {
        if (onCancel) onCancel();
        else onConfirm();
      }, 50);
      return unregister;
    }
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  const handleClose = onCancel || onConfirm;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          iconBg: 'bg-red-500/20 text-red-400',
          btnBg: 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 active:scale-95',
          defaultIcon: <AlertTriangle className="w-5 h-5 text-red-400" />,
        };
      case 'warning':
        return {
          iconBg: 'bg-amber-500/20 text-amber-400',
          btnBg: 'bg-amber-500 hover:bg-amber-600 text-black font-semibold shadow-lg shadow-amber-500/20 active:scale-95',
          defaultIcon: <AlertCircle className="w-5 h-5 text-amber-400" />,
        };
      case 'primary':
      default:
        return {
          iconBg: 'bg-[#00a884]/20 text-[#00a884]',
          btnBg: 'bg-[#00a884] hover:bg-[#02906f] text-white shadow-lg shadow-[#00a884]/20 active:scale-95',
          defaultIcon: <CheckCircle2 className="w-5 h-5 text-[#00a884]" />,
        };
    }
  };

  const vStyles = getVariantStyles();

  const modalElement = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 pt-safe pb-safe pointer-events-auto">
      {/* Outside Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md animate-fade-in cursor-default"
        onClick={handleClose}
      />

      {/* Glass Card */}
      <div className="relative z-[10000] w-full max-w-sm bg-white dark:bg-[#202c33] backdrop-blur-2xl border border-gray-200 dark:border-[#2e3b44] rounded-2xl p-5 shadow-2xl animate-scale-in">
        <div className="flex items-start gap-3.5 mb-3.5">
          <div className={`p-2.5 rounded-xl flex-shrink-0 ${vStyles.iconBg}`}>
            {icon || vStyles.defaultIcon}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 leading-snug">
              {title}
            </h3>
            {description && (
              <p className="text-xs text-gray-600 dark:text-[#8696a0] leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 mt-5">
          {!singleAction && (
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#182229] transition cursor-pointer active:scale-95"
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${vStyles.btnBg}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modalElement;
  return createPortal(modalElement, document.body);
};
