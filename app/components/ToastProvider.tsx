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
    // CLEAN ERROR MESSAGE: Extract text inside quotes if it's a long blockchain error
    let cleanMessage = message;
    if (type === 'error') {
      const match = message.match(/"([^"]+)"/);
      if (match && match[1]) cleanMessage = match[1];
      else if (message.toLowerCase().includes('user rejected')) cleanMessage = "Transaction rejected by user.";
      else if (message.length > 100) cleanMessage = "Blockchain execution reverted. Check your status.";
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
