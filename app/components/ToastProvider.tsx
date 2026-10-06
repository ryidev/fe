"use client";
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import Toast, { ToastType } from './Toast';

interface ToastContextType {
  showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = useCallback((message: string, type: ToastType) => {
    // CLEAN ERROR MESSAGE: Only sanitize long low-level blockchain reverts, keep full user message
    let cleanMessage = message;
    if (type === 'error') {
      const lower = message.toLowerCase();
      if (lower.includes('user rejected') || lower.includes('user denied')) {
        cleanMessage = "Transaksi dibatalkan oleh pengguna.";
      } else if (lower.includes('reverted with reason string')) {
        const revertMatch = message.match(/reverted with reason string '([^']+)'/i);
        if (revertMatch && revertMatch[1]) cleanMessage = revertMatch[1];
      } else if (message.length > 150 && !message.includes('DPT') && !message.includes('Daftar')) {
        cleanMessage = "Terjadi kesalahan transaksi blockchain. Silakan periksa status tiket Anda.";
      }
    }

    setToast({ message: cleanMessage, type });
    
    // Auto-close after 6 seconds
    const timer = setTimeout(() => {
      setToast(null);
    }, 6000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
