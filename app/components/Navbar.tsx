"use client";
import React, { useState, useEffect } from 'react';
import { useTheme } from "next-themes";
import { Sun, Moon, Wallet } from "lucide-react";
import { ethers } from 'ethers';
import { useToast } from './ToastProvider';

export default function Navbar() {
  const { showToast } = useToast();
  const [account, setAccount] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      (window as any).ethereum.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
        if (accounts.length > 0) setAccount(accounts[0]);
      });

      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) setAccount(accounts[0]);
        else setAccount(null);
      };

      (window as any).ethereum.on('accountsChanged', handleAccountsChanged);
      return () => {
        (window as any).ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
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
      showToast('Please install MetaMask!', 'error');
    }
  };

  if (!mounted) return null;

  return (
    <nav className="glass-nav px-8 py-4 flex justify-between items-center">
      <div className="flex items-center">
        {/* Kotak dihapus sesuai permintaan */}
        <span className="text-xl font-black tracking-tighter text-foreground uppercase italic">Ryi.Dev</span>
      </div>
      
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2.5 rounded-full bg-muted/10 hover:bg-muted/20 transition-all text-muted"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button
          onClick={connectWallet}
          className="flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-xl font-black text-[10px] tracking-widest uppercase transition-all hover:opacity-90 shadow-lg shadow-foreground/5"
        >
          <Wallet size={14} />
          {account ? `${account.substring(0, 6)}...${account.substring(account.length - 4)}` : 'Connect Wallet'}
        </button>
      </div>
    </nav>
  );
}
