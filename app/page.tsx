"use client";
import React, { useState, useEffect } from 'react';
import { getEvotingContract } from '@/lib/evotingContract';
import { ShieldCheck, ArrowRight, Lock, Fingerprint } from "lucide-react";

export default function Home() {
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkOwner() {
      try {
        if (typeof window !== 'undefined' && (window as any).ethereum) {
          const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            const contract = await getEvotingContract();
            const ownerAddr = (await contract.owner()).toLowerCase();
            if (accounts[0].toLowerCase() === ownerAddr) {
              setIsOwner(true);
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    checkOwner();
    
    // Listen for account changes
    if ((window as any).ethereum) {
      (window as any).ethereum.on('accountsChanged', checkOwner);
    }
  }, []);

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center font-mono text-[10px] tracking-widest text-muted">BOOTING_SYSTEM...</div>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 relative overflow-hidden">
      {/* BACKGROUND DECO */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="max-w-2xl w-full text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted/10 rounded-full mb-8">
          <ShieldCheck size={14} className="text-indigo-600" />
          <span className="text-[10px] font-black uppercase tracking-widest text-muted">Secured_by_Blockchain</span>
        </div>
        
        <h1 className="text-7xl md:text-8xl font-black tracking-tighter text-foreground mb-8 uppercase italic leading-[0.8]">
          Ryi.Dev <br /> <span className="text-indigo-600">E-Voting</span>
        </h1>
        
        <p className="text-muted text-lg font-medium mb-12 leading-relaxed max-w-lg mx-auto">
          The next generation of decentralized voting. Transparent, immutable, and identity-verified.
        </p>

        {isOwner ? (
          <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-4">Admin_Access_Detected</p>
            <a 
              href="/admin" 
              className="group flex items-center gap-4 bg-foreground text-background px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-indigo-500/20"
            >
              Enter Admin Dashboard <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
            </a>
          </div>
        ) : (
          <div className="minimal-card p-8 border-dashed border-2 bg-muted/5 inline-flex flex-col items-center">
            <div className="w-12 h-12 bg-muted/10 rounded-xl flex items-center justify-center text-muted mb-4">
              <Lock size={20} />
            </div>
            <p className="text-xs font-bold text-foreground uppercase tracking-widest mb-1">Public_Access_Limited</p>
            <p className="text-[10px] text-muted max-w-[250px] mx-auto">
              Please use the direct voting link provided by your administrator to participate.
            </p>
          </div>
        )}
      </div>

      {/* FOOTER INFO */}
      <div className="absolute bottom-12 left-12 flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-muted/10 rounded-lg flex items-center justify-center text-muted"><Fingerprint size={16} /></div>
          <div><p className="text-[8px] font-black uppercase text-muted">Identity</p><p className="text-[10px] font-bold text-foreground uppercase">Verified</p></div>
        </div>
        <div className="w-[1px] h-6 bg-border" />
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-muted/10 rounded-lg flex items-center justify-center text-muted"><ShieldCheck size={16} /></div>
          <div><p className="text-[8px] font-black uppercase text-muted">Network</p><p className="text-[10px] font-bold text-foreground uppercase">Ethereum</p></div>
        </div>
      </div>
    </div>
  );
}
