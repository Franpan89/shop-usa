'use client';

export default function PrintButton() {
  return (
    <button className="btn btn-secondary no-print" onClick={() => window.print()}>
      🖨️ Imprimir
    </button>
  );
}
