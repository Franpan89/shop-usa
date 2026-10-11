'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export interface PickableClient {
  id: string;
  name: string;
  code: string;
  country?: string;
}

interface ClientPickerProps {
  clients: PickableClient[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}

/** Buscador de clientes por nombre o código (EC001…). */
export default function ClientPicker({
  clients,
  value,
  onChange,
  label = 'Cliente',
  disabled,
  autoFocus,
  placeholder = 'Buscar por nombre o código…',
}: ClientPickerProps) {
  const selected = clients.find((c) => c.id === value);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? clients.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
      : clients;
    return list.slice(0, 40);
  }, [clients, query]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function choose(c: PickableClient) {
    onChange(c.id);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="input-container" ref={boxRef} style={{ position: 'relative' }}>
      <label>{label}</label>
      {selected && !open ? (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button
            type="button"
            className="input-field"
            disabled={disabled}
            onClick={() => setOpen(true)}
            style={{ flex: 1, textAlign: 'left', cursor: 'pointer' }}
          >
            <strong>{selected.name}</strong> <span className="muted mono">· {selected.code}</span>
          </button>
        </div>
      ) : (
        <input
          type="text"
          className="input-field"
          autoFocus={autoFocus || open}
          disabled={disabled}
          placeholder={placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, matches.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === 'Enter' && open && matches[highlight]) {
              e.preventDefault();
              choose(matches[highlight]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
      )}
      {open && (
        <div
          className="glass-panel static"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 30,
            maxHeight: 280,
            overflowY: 'auto',
            marginTop: 4,
            padding: 6,
            background: 'var(--bg-surface-solid)',
          }}
        >
          {matches.length === 0 && <div className="muted small" style={{ padding: 12 }}>Sin resultados</div>}
          {matches.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => choose(c)}
              onMouseEnter={() => setHighlight(i)}
              style={{
                display: 'flex',
                width: '100%',
                justifyContent: 'space-between',
                gap: 12,
                padding: '9px 12px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--text-main)',
                background: i === highlight ? 'var(--accent-soft)' : 'transparent',
              }}
            >
              <span>{c.name}</span>
              <span className="muted mono small">
                {c.code}
                {c.country ? ` · ${c.country}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
