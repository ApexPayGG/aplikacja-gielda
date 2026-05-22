import { useState } from "react";
import { useTranslation } from "react-i18next";
import { colors } from "../styles/designSystem";

type BulkActionsProps = {
  totalCount: number;
  selectedCount: number;
  allSelected: boolean;
  disabled?: boolean;
  closeDisabled?: boolean;
  onToggleAll: (checked: boolean) => void;
  onCloseSelected: () => void | Promise<void>;
  onExportSelected: () => void;
  onClearSelection: () => void;
};

type BulkRowCheckboxProps = {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

export function BulkRowCheckbox({ checked, disabled, label, onChange }: BulkRowCheckboxProps) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 rounded border"
      style={{ borderColor: colors.borderStrong, accentColor: colors.brandDark }}
    />
  );
}

export function BulkActions({
  totalCount,
  selectedCount,
  allSelected,
  disabled,
  closeDisabled,
  onToggleAll,
  onCloseSelected,
  onExportSelected,
  onClearSelection,
}: BulkActionsProps) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const hasRows = totalCount > 0;

  async function confirmClose(): Promise<void> {
    await onCloseSelected();
    setConfirmOpen(false);
  }

  return (
    <>
      <div
        className="border-b border-white/10 bg-[#1e1b4b]/35 px-4 py-3 backdrop-blur-sm"
        style={{ borderColor: colors.border }}
      >
        <label className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: colors.textSecondary }}>
          <input
            type="checkbox"
            checked={allSelected}
            disabled={disabled || !hasRows}
            onChange={(event) => onToggleAll(event.target.checked)}
            className="h-4 w-4 rounded border"
            style={{ borderColor: colors.borderStrong, accentColor: colors.brandDark }}
          />
          {t("bulkActions.selectAll", { defaultValue: "Select all" })}
          <span className="text-xs" style={{ color: colors.textMuted }}>
            ({selectedCount}/{totalCount})
          </span>
        </label>
      </div>

      {selectedCount > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#0f111c]/80 px-4 py-3 backdrop-blur-sm"
          style={{ borderColor: colors.border }}
        >
          <button
            type="button"
            disabled={closeDisabled}
            onClick={() => setConfirmOpen(true)}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            style={{ backgroundColor: colors.negative }}
          >
            {t("bulkActions.closeSelected", { count: selectedCount, defaultValue: "Close selected ({{count}})" })}
          </button>
          <button
            type="button"
            onClick={onExportSelected}
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:brightness-95"
            style={{ borderColor: colors.brandDark, color: colors.brandDark }}
          >
            {t("bulkActions.exportSelected", { defaultValue: "Export selected" })}
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            className="px-2 py-1 text-xs font-semibold transition hover:opacity-85"
            style={{ color: colors.textMuted }}
          >
            {t("bulkActions.clearSelection", { defaultValue: "Clear selection" })}
          </button>
        </div>
      ) : null}

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(13,13,26,0.45)" }}>
          <div
            className="w-full max-w-md rounded-2xl border p-5 shadow-[0_20px_48px_rgba(168,85,247,0.26)]"
            style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgPrimary }}
          >
            <h3 className="text-base font-semibold" style={{ color: colors.brandDark }}>
              {t("bulkActions.confirmTitle", { defaultValue: "Confirm close positions" })}
            </h3>
            <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
              {t("bulkActions.confirmBody", {
                count: selectedCount,
                defaultValue: "Are you sure you want to close the selected positions ({{count}})?",
              })}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg border px-3 py-1.5 text-sm font-semibold"
                style={{ borderColor: colors.borderStrong, color: colors.textSecondary }}
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                type="button"
                onClick={() => void confirmClose()}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
                style={{ backgroundColor: colors.negative }}
              >
                {t("bulkActions.confirmClose", { defaultValue: "Close" })}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
