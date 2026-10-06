"use client";
import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

const Toast = ({ message, type, onClose }: ToastProps) => {
  const isError = type === 'error';
  const isSuccess = type === 'success';

  return (
    <div
      role="alert"
      className={`fixed top-20 right-4 md:right-8 z-[300] flex items-start gap-4 px-5 py-4 rounded-2xl shadow-2xl border-2 backdrop-blur-2xl animate-in slide-in-from-right-8 duration-300 max-w-[92vw] md:max-w-md ${
        isSuccess
          ? 'bg-emerald-950/95 border-emerald-500 shadow-emerald-500/20'
          : isError
          ? 'bg-rose-950/95 border-rose-500 shadow-rose-500/30'
          : 'bg-indigo-950/95 border-indigo-500 shadow-indigo-500/20'
      }`}
    >
      <div
        className={`mt-0.5 p-2 rounded-xl shrink-0 ${
          isSuccess
            ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40'
            : isError
            ? 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/40'
            : 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/40'
        }`}
      >
        {isSuccess ? <CheckCircle2 size={20} /> : isError ? <AlertCircle size={20} /> : <Info size={20} />}
      </div>

      <div className="flex-1 min-w-0 pt-0.5">
        <p
          className={`text-[10px] font-black uppercase tracking-widest mb-1 ${
            isSuccess ? 'text-emerald-400' : isError ? 'text-rose-400' : 'text-indigo-400'
          }`}
        >
          {isSuccess ? 'BERHASIL' : isError ? 'PERINGATAN SISTEM' : 'INFORMASI'}
        </p>
        <p className="text-xs md:text-sm font-semibold leading-relaxed break-words text-white">
          {message}
        </p>
      </div>

      <button
        onClick={onClose}
        className="mt-0.5 p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
        aria-label="Tutup Notifikasi"
      >
        <X size={18} />
      </button>
    </div>
  );
};

export default Toast;
