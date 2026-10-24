import React, { useRef, useEffect } from 'react';

interface OtpBoxInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  isError?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export const OtpBoxInput: React.FC<OtpBoxInputProps> = ({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  isError = false,
  autoFocus = true,
  className = '',
}) => {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Convert string value to array of characters
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  // Auto-focus first input on mount
  useEffect(() => {
    if (autoFocus && inputsRef.current[0]) {
      setTimeout(() => {
        inputsRef.current[0]?.focus();
      }, 50);
    }
  }, [autoFocus]);

  const handleInputChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const rawVal = e.target.value;
    
    // Extract only digits
    const cleanNumbers = rawVal.replace(/\D/g, '');
    
    if (cleanNumbers.length > 1) {
      // Multi-character input (e.g., mobile autofill, paste, or fast typing)
      const newDigits = [...digits];
      const chars = cleanNumbers.slice(0, length);
      for (let i = 0; i < chars.length; i++) {
        if (index + i < length) {
          newDigits[index + i] = chars[i];
        }
      }
      const newFull = newDigits.join('').slice(0, length);
      onChange(newFull);
      const nextIdx = Math.min(index + chars.length, length - 1);
      inputsRef.current[nextIdx]?.focus();
      if (newFull.length === length && onComplete) {
        setTimeout(() => onComplete(newFull), 50);
      }
      return;
    }

    const cleanDigit = cleanNumbers.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = cleanDigit;
    const newFullValue = newDigits.join('').slice(0, length);
    onChange(newFullValue);

    // Auto-advance to next box if digit was typed
    if (cleanDigit && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
      inputsRef.current[index + 1]?.select();
    }

    // Auto-verify when all boxes are filled
    if (newFullValue.length === length && onComplete) {
      setTimeout(() => onComplete(newFullValue), 50);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // If current box is empty, jump to previous and clear it
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange(newDigits.join(''));
        inputsRef.current[index - 1]?.focus();
      } else {
        const newDigits = [...digits];
        newDigits[index] = '';
        onChange(newDigits.join(''));
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
      inputsRef.current[index - 1]?.select();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
      inputsRef.current[index + 1]?.select();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (disabled) return;

    const pastedData = e.clipboardData.getData('text');
    const cleanNumbers = pastedData.replace(/\D/g, '').slice(0, length);
    if (!cleanNumbers) return;

    onChange(cleanNumbers);

    // Focus last filled box or next empty box
    const nextIndex = Math.min(cleanNumbers.length, length - 1);
    inputsRef.current[nextIndex]?.focus();

    // If completely filled, trigger auto-complete immediately
    if (cleanNumbers.length === length && onComplete) {
      onComplete(cleanNumbers);
    }
  };

  return (
    <div className={`flex items-center justify-center gap-1.5 sm:gap-2.5 my-2 select-none ${className}`}>
      {Array.from({ length }).map((_, index) => {
        const isMiddleSplit = length === 6 && index === 3;
        const isFilled = !!digits[index];

        return (
          <React.Fragment key={index}>
            {/* Split dash divider between group 1 and group 2 */}
            {isMiddleSplit && (
              <div className="w-2 sm:w-3 h-0.5 bg-gray-400 dark:bg-[#2e3b44] rounded-full mx-0.5 sm:mx-1 flex-shrink-0" />
            )}

            <div className="relative">
              <input
                ref={(el) => { inputsRef.current[index] = el; }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                value={digits[index]}
                disabled={disabled}
                onChange={(e) => handleInputChange(index, e)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                onFocus={(e) => e.target.select()}
                className={`w-11 h-14 sm:w-12 sm:h-16 text-center text-xl sm:text-2xl font-mono font-bold rounded-2xl transition-all duration-200 focus:outline-none cursor-pointer ${
                  isError
                    ? 'bg-red-500/10 border-2 border-red-500 text-red-400 ring-2 ring-red-500/20'
                    : isFilled
                    ? 'bg-[#182229] border-2 border-[#00a884] text-white shadow-md shadow-[#00a884]/15 ring-1 ring-[#00a884]/30'
                    : 'bg-gray-100 dark:bg-[#111b21] border-2 border-gray-300 dark:border-[#2e3b44] text-gray-900 dark:text-white hover:border-[#00a884]/50 focus:border-[#00a884] focus:ring-4 focus:ring-[#00a884]/20'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label={`Digit ${index + 1}`}
              />

              {/* Bottom active pill underline indicator */}
              <div
                className={`absolute bottom-1.5 left-3 right-3 h-0.5 rounded-full transition-all duration-200 pointer-events-none ${
                  isFilled
                    ? 'bg-[#00a884]'
                    : 'bg-transparent'
                }`}
              />
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};
