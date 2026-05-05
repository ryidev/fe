"use client";
import React, { useState, useEffect } from 'react';
import { useTheme } from "next-themes";
import { Sun, Moon, Wallet } from "lucide-react";
import { ethers } from 'ethers';

export default function Navbar() {
  const [account, setAccount] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Auto-check if already connected
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      (window as any).ethereum.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
        if (accounts.length > 0) setAccount(accounts[0]);
      });
    }
  }, []);

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accounts[0]);
      } catch (err) {
        console.error(err);
      }
    } else {
      alert('Please install MetaMask!');
    }
  };

  if (!mounted) return null;

  return (
    <nav className="glass-nav px-8 py-4 flex justify-between items-center">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-slate-900 dark:bg-white rounded-md" />
        <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white uppercase">Ryi.Dev</span>
      </div>
      
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2.5 rounded-full bg-slate-100 dark:bg-zinc-800 hover:ring-2 ring-slate-200 dark:ring-zinc-700 transition-all text-slate-600 dark:text-zinc-300"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button
          onClick={connectWallet}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-medium text-sm transition-all hover:opacity-90"
        >
          <Wallet size={16} />
          {account ? `${account.substring(0, 6)}...` : 'Connect Wallet'}
        </button>
      </div>
    </nav>
  );
}
