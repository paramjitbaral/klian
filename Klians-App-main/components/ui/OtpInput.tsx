import React, { useRef } from 'react';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
}

export const OtpInput: React.FC<OtpInputProps> = ({ value, onChange, length = 6 }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.focus();
  };

  return (
    <div className="relative flex justify-center w-full max-w-[320px] mx-auto cursor-text" onClick={handleClick}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={length}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10"
        autoComplete="one-time-code"
      />
      
      <div className="flex gap-2 sm:gap-3 justify-between w-full pointer-events-none">
        {Array.from({ length }).map((_, index) => {
          const char = value[index];
          const isFocused = value.length === index;
          return (
            <div 
              key={index}
              className={`w-10 h-14 sm:w-12 sm:h-16 flex items-center justify-center text-2xl sm:text-3xl font-bold font-mono rounded-xl border-2 transition-all duration-200
                ${char ? 'border-red-500 text-slate-900 dark:text-white bg-white dark:bg-slate-800 shadow-sm transform scale-105' : 
                  isFocused ? 'border-red-400 bg-red-50/50 dark:bg-slate-800 ring-4 ring-red-500/10 scale-100' : 
                  'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-300 dark:text-slate-600 scale-100'
                }`}
            >
              {char ? char : <span className="opacity-50">-</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};
