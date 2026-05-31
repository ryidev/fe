"use client";
import React from 'react';
import { CheckCircle2, AlertCircle, X } from "lucide-react";

export type ToastType = 'success' | 'error';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

const Toast = ({ message, type, onClose }: ToastProps) => (
  <div className={`fixed top-24 right-4 md:right-8 z-[200] flex items-start gap-4 px-6 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-right-8 duration-500 max-w-[90vw] md:max-w-md ${
    type === 'success' ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-900' : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-900'
  }`}>
    <div className="mt-1">
      {type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{type === 'success' ? 'Transaction Success' : 'Execution Error'}</p>
      <p className="text-xs font-bold leading-relaxed break-words">{message}</p>
    </div>
    <button onClick={onClose} className="mt-1 opacity-50 hover:opacity-100 transition-opacity cursor-pointer"><X size={16} /></button>
  </div>
);

export default Toast;
