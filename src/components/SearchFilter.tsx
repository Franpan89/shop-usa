'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

interface SearchFilterProps {
  placeholder?: string;
  paramName?: string;
}

export default function SearchFilter({ placeholder = 'Buscar...', paramName = 'q' }: SearchFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleSearch(term: string) {
    const params = new URLSearchParams(searchParams);
    if (term) {
      params.set(paramName, term);
    } else {
      params.delete(paramName);
    }

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="input-container" style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
      <label>Buscar</label>
      <input
        type="text"
        className="input-field"
        placeholder={placeholder}
        defaultValue={searchParams.get(paramName) || ''}
        onChange={(e) => handleSearch(e.target.value)}
        style={{ paddingRight: '40px' }}
      />
      {isPending && (
        <div style={{ position: 'absolute', right: '12px', bottom: '12px' }}>
          <div className="loader-small"></div>
        </div>
      )}

      <style jsx>{`
        .loader-small {
          width: 16px;
          height: 16px;
          border: 2px solid var(--accent-color);
          border-bottom-color: transparent;
          border-radius: 50%;
          display: inline-block;
          animation: rotation 1s linear infinite;
        }

        @keyframes rotation {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
