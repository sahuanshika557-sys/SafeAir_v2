import type { ReactElement } from 'react';

interface ProfileSelectFieldProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (nextValue: T) => void;
}

/**
 * Reusable accessible select control that safely resolves enum values without type assertions.
 */
export function ProfileSelectField<T extends string>({
  id,
  label,
  value,
  options,
  labels,
  onChange,
}: Readonly<ProfileSelectFieldProps<T>>): ReactElement {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
        {label}
      </label>
      <select
        id={id}
        aria-required="true"
        value={value}
        onChange={(e) => {
          const matched = options.find((option) => option === e.target.value);
          if (matched !== undefined) {
            onChange(matched);
          }
        }}
        className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </select>
    </div>
  );
}
