'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // isOpen only ever flips to true from a client-side event handler (never
  // during the initial server render), so document is always available here.
  // Several call sites nest the trigger (and so this component) inside a
  // .glass-panel, which sets backdrop-filter — that creates a new containing
  // block for fixed-position descendants, trapping the overlay inside the
  // panel instead of covering the viewport. Render straight into <body> so
  // the overlay is never subject to an ancestor's CSS.
  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="glass-panel modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(16, 31, 30, 0.45);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease-out;
        }

        .modal-content {
          width: 100%;
          max-width: 780px;
          margin: 20px;
          padding: 32px;
          border-radius: 16px;
          border: 1px solid var(--border-color);
          background: var(--bg-surface-solid) !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          box-shadow: none !important;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .modal-title {
          font-size: 24px;
          font-weight: 400;
          letter-spacing: 0.01em;
          margin: 0;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 2rem;
          color: var(--text-muted);
          cursor: pointer;
          line-height: 1;
          transition: color 0.2s;
        }

        .modal-close:hover {
          color: var(--text-main);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
}
