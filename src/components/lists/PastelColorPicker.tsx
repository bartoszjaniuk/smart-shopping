import type { FC } from "react";
import type { PastelColorOption } from "../../types";

interface PastelColorPickerProps {
  value?: string;
  options: PastelColorOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

const PastelColorPicker: FC<PastelColorPickerProps> = ({ value, options, onChange, disabled = false, className }) => {
  const handleSelect = (colorValue: string) => {
    if (disabled) {
      return;
    }

    onChange(colorValue);
  };

  return (
    <div
      className={`grid grid-cols-4 gap-3 sm:grid-cols-6 ${className ?? ""}`}
      role="radiogroup"
      aria-label="Wybierz kolor listy"
    >
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={option.label}
            disabled={disabled}
            onClick={() => handleSelect(option.value)}
            className={`relative flex h-9 w-9 items-center justify-center rounded-full border transition
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring
              ${isSelected ? "border-ring ring-2 ring-ring ring-offset-2" : "border-transparent hover:border-muted"}
              ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span
              className="inline-block h-7 w-7 rounded-full shadow-sm"
              style={{ backgroundColor: option.value }}
              aria-hidden="true"
            />

            {option.isRecommended && (
              <span className="pointer-events-none absolute -bottom-1 right-0 rounded-full bg-background px-1 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm">
                domyślny
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default PastelColorPicker;
