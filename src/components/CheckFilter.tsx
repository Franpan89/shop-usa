'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

/** Casilla que activa o quita un filtro de la URL (?param=1). */
export default function CheckFilter({ label, paramName }: { label: string; paramName: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function toggle(on: boolean) {
    const params = new URLSearchParams(searchParams);
    if (on) params.set(paramName, '1');
    else params.delete(paramName);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  return (
    <label className="check" style={{ alignSelf: 'flex-end', paddingBottom: 10 }}>
      <input type="checkbox" checked={searchParams.get(paramName) === '1'} onChange={(e) => toggle(e.target.checked)} />
      {label}
    </label>
  );
}
