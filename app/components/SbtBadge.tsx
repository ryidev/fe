import React from 'react';
import { ShieldCheck, Award, Lock, Sparkles, RefreshCw } from 'lucide-react';

interface SbtBadgeProps {
  hasTicket: boolean;
  tokenId?: number | string | null;
  isUsed: boolean;
  isMinting?: boolean;
  onClaim?: () => void;
}

export default function SbtBadge({
  hasTicket,
  tokenId,
  isUsed,
  isMinting = false,
  onClaim,
}: SbtBadgeProps) {
  if (!hasTicket) {
    return (
      <div className="p-4 md:p-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
            <Lock size={20} />
          </div>
          <div>
            <p className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Belum Memiliki Tiket Suara SBT
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Lakukan verifikasi identitas (NIK/NIM) untuk menerbitkan tiket resmi on-chain (ERC-5192).
            </p>
          </div>
        </div>
        {onClaim && (
          <button
            onClick={onClaim}
            disabled={isMinting}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
          >
            {isMinting ? (
              <>
                <RefreshCw size={12} className="animate-spin" />
                <span>Menerbitkan...</span>
              </>
            ) : (
              <>
                <Sparkles size={12} />
                <span>Klaim Tiket (0 ETH)</span>
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  if (isUsed) {
    return (
      <div className="p-4 md:p-5 rounded-2xl border border-zinc-500/30 bg-zinc-500/10 backdrop-blur-sm flex items-center justify-between gap-4 opacity-75 animate-in fade-in duration-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-500/20 text-zinc-400 flex items-center justify-center shrink-0">
            <Award size={22} />
          </div>
          <div>
            <p className="text-xs font-black text-foreground line-through">
              Tiket SBT #{tokenId || '1'} (Sudah Digunakan / Hangus)
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Hak suara Anda telah resmi disalurkan dan tercatat permanen di blockchain.
            </p>
          </div>
        </div>
        <span className="text-[9px] bg-zinc-700 text-zinc-300 font-mono px-2.5 py-1 rounded-md shrink-0 uppercase tracking-widest font-bold">
          TERPAKAI
        </span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 backdrop-blur-sm flex items-center justify-between gap-4 animate-in fade-in duration-300 shadow-lg shadow-emerald-500/5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/30">
          <ShieldCheck size={22} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Official Soulbound Ballot #{tokenId || '1'}
            </p>
            <span className="text-[8px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 px-1.5 py-0.5 rounded font-mono font-bold">
              ERC-5192
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            NFT Hak Suara Sah & Non-Transferable (Pencoblosan Bebas Gas 0 ETH)
          </p>
        </div>
      </div>
      <span className="text-[9px] bg-emerald-600 text-white font-mono px-3 py-1.5 rounded-lg shrink-0 uppercase tracking-widest font-black shadow-sm">
        SIAP DICOBLOS
      </span>
    </div>
  );
}
