"use client";
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getEvotingContract } from '@/lib/evotingContract';
import { addCandidateToSession, deleteCandidate } from '@/app/supabase-candidates';
import { ArrowLeft, UserPlus, Play, Square, Trophy, Trash2, Activity, CheckCircle2 } from "lucide-react";

interface Candidate {
  id: number;
  name: string;
  wallet_address: string;
  description: string;
  image_url: string;
  session_id: number;
  votes?: number;
}

export default function AdminForumPage() {
  const { id } = useParams();
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newWallet, setNewWallet] = useState('');
  const [isVotingActive, setIsVotingActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  async function fetchBlockchainData() {
    try {
      const contract = await getEvotingContract();
      const status = await contract.sudahBisaVoting();
      setIsVotingActive(status);

      const { data: candData } = await supabase.from('candidates').select('*').eq('session_id', id);
      const updatedCandidates = await Promise.all((candData || []).map(async (c: any, index: number) => {
        try {
          const blockchainCand = await contract.kandidat(index);
          return { ...c, votes: Number(blockchainCand.jumlahSuara) };
        } catch (e) {
          return { ...c, votes: 0 };
        }
      }));
      setCandidates(updatedCandidates);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    async function init() {
      if (!id) return;
      const { data: sData, error } = await supabase.from('voting_sessions').select('*').eq('id', id).single();
      if (error || !sData) return router.push('/admin');
      
      setSession(sData);
      setWinner(sData.winner_address);
      if (sData.status === 'finished') setIsFinished(true);

      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          const contract = await getEvotingContract();
          const ownerAddr = (await contract.owner()).toLowerCase();
          if (accounts[0].toLowerCase() === ownerAddr) {
            setIsOwner(true);
            await fetchBlockchainData();
          }
        }
      }
      setLoading(false);
    }
    init();
  }, [id]);

  const toggleVoting = async () => {
    setProcessing(true);
    try {
      const contract = await getEvotingContract();
      const tx = await contract.statusVoting(!isVotingActive);
      await tx.wait();
      setIsVotingActive(!isVotingActive);
      alert(`Status updated.`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const finishVoting = async () => {
    if (!confirm('Finalize this session? This action is permanent.')) return;
    setProcessing(true);
    try {
      const contract = await getEvotingContract();
      const tx = await contract.votingSudahSelesai();
      await tx.wait();

      const result = await contract.hasilVoting();
      const winnerAddr = result.alamatPemenang;
      
      const { error } = await supabase
        .from('voting_sessions')
        .update({ winner_address: winnerAddr, status: 'finished' })
        .eq('id', id);
      
      if (error) throw new Error(error.message);
      
      setWinner(winnerAddr);
      setIsFinished(true);
      setIsVotingActive(false);
      alert('Session successfully finalized.');
    } catch (err: any) {
      alert(`Finalization Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const contract = await getEvotingContract();
      const tx = await contract.tambahKandidat(newWallet);
      await tx.wait();

      const newCand = await addCandidateToSession(newName, newWallet, Number(id));
      setCandidates([...candidates, { ...newCand, votes: 0 } as Candidate]);
      setNewName('');
      setNewWallet('');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center text-slate-400 font-mono text-xs tracking-widest">LOADING_TERMINAL...</div>;

  const winnerName = candidates.find(
    c => c.wallet_address?.toLowerCase() === winner?.toLowerCase()
  )?.name;

  return (
    <div className="max-w-4xl mx-auto pt-24 px-8 pb-32">
      {/* HEADER */}
      <div className="mb-12 border-b border-slate-100 dark:border-zinc-900 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <button onClick={() => router.push('/admin')} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors mb-4">
            <ArrowLeft size={14} /> SESSION_CONTROL
          </button>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-zinc-100 uppercase">{session?.title}</h1>
          <div className="flex items-center gap-3 mt-4">
            <div className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${isFinished ? 'bg-slate-100 text-slate-500' : isVotingActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {isFinished ? 'Archived' : isVotingActive ? 'Live' : 'Paused'}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {!isFinished && (
            <>
              <button 
                onClick={toggleVoting} disabled={processing}
                className={`p-3 rounded-xl border transition-all ${isVotingActive ? 'border-red-200 text-red-600 bg-red-50 dark:bg-red-950/20' : 'border-green-200 text-green-600 bg-green-50 dark:bg-green-950/20'}`}
              >
                {isVotingActive ? <Square size={18} /> : <Play size={18} />}
              </button>
              <button 
                onClick={finishVoting} disabled={processing}
                className="px-6 py-3 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-black text-[10px] tracking-widest uppercase flex items-center gap-2 hover:opacity-90 transition-all"
              >
                <Trophy size={14} /> Finalize
              </button>
            </>
          )}
        </div>
      </div>

      {/* WINNER SECTION */}
      {isFinished && (
        <div className="mb-12 p-8 rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 flex items-center justify-between">
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">👑 Winner_Identified</h2>
            <p className="text-3xl font-black italic uppercase tracking-tighter leading-none">
              {winnerName || 'WINNER_FOUND'}
            </p>
            <p className="text-[10px] font-mono opacity-40 mt-3 break-all">{winner}</p>
          </div>
          <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md">
            <CheckCircle2 size={24} />
          </div>
        </div>
      )}

      {/* ADMIN FORM */}
      {!isVotingActive && !isFinished && (
        <section className="minimal-card mb-12 p-8 border-dashed">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2">
            <UserPlus size={14} /> New_Candidate
          </h2>
          <form onSubmit={handleAddCandidate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Name</label>
              <input 
                type="text" placeholder="Candidate Name"
                className="w-full bg-transparent border-b border-slate-200 dark:border-zinc-800 py-2 px-1 text-sm outline-none focus:border-indigo-500 transition-all text-slate-900 dark:text-zinc-100"
                value={newName} onChange={(e) => setNewName(e.target.value)} required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Wallet</label>
              <input 
                type="text" placeholder="0x..."
                className="w-full bg-transparent border-b border-slate-200 dark:border-zinc-800 py-2 px-1 text-sm outline-none focus:border-indigo-500 transition-all font-mono text-slate-900 dark:text-zinc-100"
                value={newWallet} onChange={(e) => setNewWallet(e.target.value)} required
              />
            </div>
            <button 
              type="submit" disabled={adding}
              className="md:col-span-2 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-4 rounded-xl font-black text-[10px] tracking-widest uppercase hover:opacity-90"
            >
              {adding ? 'SYNCHING...' : 'REGISTER_KANDIDAT'}
            </button>
          </form>
        </section>
      )}

      {/* ANALYTICS */}
      <div className="space-y-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <Activity size={14} /> Audit_Log
        </h2>
        
        <div className="grid grid-cols-1 gap-3">
          {candidates.map((c) => (
            <div key={c.id} className={`minimal-card flex items-center justify-between p-6 ${c.wallet_address?.toLowerCase() === winner?.toLowerCase() ? 'border-indigo-500 bg-indigo-50/10' : ''}`}>
              <div className="flex items-center gap-5">
                <div className="w-10 h-10 bg-slate-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center font-bold text-slate-400 text-xs">
                  {c.wallet_address?.toLowerCase() === winner?.toLowerCase() ? '👑' : `#${c.id}`}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-zinc-100">{c.name}</h3>
                  <p className="text-[10px] text-slate-400 font-mono tracking-tighter truncate max-w-[150px]">{c.wallet_address}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tighter">{c.votes}</div>
                  <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Votes</div>
                </div>
                
                {!isVotingActive && !isFinished && (
                  <button onClick={() => deleteCandidate(c.id)} className="p-2 text-slate-300 hover:text-red-500 transition-all">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
