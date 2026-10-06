'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

interface Option {
  value: string;
  label: string;
}

interface SelectFilterProps {
  label: string;
  paramName: string;
  options: Option[];
  allLabel?: string;
}

export default function SelectFilter({ label, paramName, options, allLabel = 'Todos' }: SelectFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(paramName, value);
    } else {
      params.delete(paramName);
    }

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="input-container">
      <label>{label}</label>
      <select
        className="input-field"
        defaultValue={searchParams.get(paramName) || ''}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value="">{allLabel}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
