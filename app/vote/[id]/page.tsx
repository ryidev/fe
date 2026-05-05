"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Navbar from '@/app/components/Navbar';
import { getEvotingContract } from '@/lib/evotingContract';
import { CheckCircle2, TrendingUp, Info, Trophy } from "lucide-react";

interface Candidate {
  id: number;
  name: string;
  wallet_address: string;
  description: string;
  image_url: string;
  session_id: number;
  votes: number;
}

interface VotingSession {
  id: number;
  title: string;
  description: string;
  winner_address?: string;
  status?: string;
}

export default function VotePage() {
  const { id } = useParams();
  const [session, setSession] = useState<VotingSession | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [isVotingActive, setIsVotingActive] = useState(false);

  async function fetchBlockchainData() {
    try {
      const contract = await getEvotingContract();
      const active = await contract.sudahBisaVoting();
      setIsVotingActive(active);

      const { data: candData } = await supabase.from('candidates').select('*').eq('id', id); // Note: Should be session_id, fixing this too
      const { data: candDataFix } = await supabase.from('candidates').select('*').eq('session_id', id);
      
      const updatedCandidates = await Promise.all((candDataFix || []).map(async (c: any, index: number) => {
        try {
          const blockchainCand = await contract.kandidat(index);
          return { ...c, votes: Number(blockchainCand.jumlahSuara) };
        } catch (e) {
          return { ...c, votes: 0 };
        }
      }));

      const { data: freshSession } = await supabase.from('voting_sessions').select('status').eq('id', id).single();
      if (freshSession?.status === 'finished') {
        updatedCandidates.sort((a, b) => b.votes - a.votes);
      }
      
      setCandidates(updatedCandidates);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.from('voting_sessions').select('*').eq('id', id).single();
      setSession(sessionData);
      await fetchBlockchainData();
      setLoading(false);
    }
    init();

    const interval = setInterval(fetchBlockchainData, 10000);
    return () => clearInterval(interval);
  }, [id]);

  const handleVote = async (index: number) => {
    if (session?.status === 'finished') return alert("Voting has ended.");
    if (!isVotingActive) return alert("Voting is currently paused by admin.");
    setVoting(true);
    try {
      const contract = await getEvotingContract();
      const tx = await contract.voting(index);
      await tx.wait();
      alert('Vote cast successfully!');
      await fetchBlockchainData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setVoting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center text-slate-400 font-mono text-[10px] uppercase tracking-[0.3em]">Synching_Node...</div>;

  const isFinished = session?.status === 'finished';
  const winnerCandidate = candidates.find(
    c => c.wallet_address?.toLowerCase() === session?.winner_address?.toLowerCase()
  );

  return (
    <div className="max-w-6xl mx-auto pt-24 px-8 pb-32">
      
      <header className="mb-20 text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className={`w-1.5 h-1.5 rounded-full ${isFinished ? 'bg-slate-400' : isVotingActive ? 'bg-indigo-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            {isFinished ? 'Archived_Session' : isVotingActive ? 'Live_Voting' : 'Session_Paused'}
          </span>
        </div>
        <h1 className="text-6xl font-black tracking-tight text-slate-900 dark:text-zinc-100 uppercase italic mb-4">
          {session?.title || 'Unknown_Session'}
        </h1>
        <p className="text-slate-500 dark:text-zinc-400 max-w-xl mx-auto font-light leading-relaxed">
          {session?.description}
        </p>
      </header>

      {/* WINNER BANNER: Putih Minimalis */}
      {isFinished && winnerCandidate && (
        <section className="mb-20 p-8 md:p-12 rounded-[2.5rem] bg-white dark:bg-zinc-900 border-2 border-indigo-600 shadow-2xl shadow-indigo-500/10 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
          <div className="absolute -top-10 -left-10 opacity-5 text-indigo-600">
            <Trophy size={200} />
          </div>
          
          <div className="relative z-10 text-center md:text-left">
            <h2 className="text-[10px] font-black tracking-[0.5em] uppercase mb-4 text-indigo-600">🏆 Official_Winner_Declared</h2>
            <div className="text-5xl md:text-7xl font-black tracking-tighter mb-4 leading-tight uppercase italic text-slate-900 dark:text-zinc-100">
              {winnerCandidate.name}
            </div>
            <p className="text-[10px] font-mono text-slate-400 opacity-60 break-all">{winnerCandidate.wallet_address}</p>
          </div>

          <div className="relative z-10 flex flex-col items-center gap-3">
             <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-indigo-500/40">
                <CheckCircle2 size={40} />
             </div>
             <span className="text-[9px] font-black text-indigo-600 tracking-widest uppercase">Verified_On_Chain</span>
          </div>
        </section>
      )}

      {/* CANDIDATES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {candidates.map((candidate, idx) => (
          <div 
            key={candidate.id} 
            className={`minimal-card flex flex-col justify-between p-8 relative ${candidate.wallet_address?.toLowerCase() === session?.winner_address?.toLowerCase() ? 'border-indigo-600 ring-4 ring-indigo-50 dark:ring-indigo-950/30' : ''}`}
          >
            {isFinished && (
              <div className={`absolute top-0 left-0 px-4 py-2 rounded-br-2xl text-[10px] font-black tracking-widest uppercase ${idx === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'}`}>
                RANK #{idx + 1}
              </div>
            )}

            <div className="mt-4">
              <div className="flex justify-between items-start mb-10">
                <div className="w-16 h-16 bg-slate-50 dark:bg-zinc-800 rounded-[1.25rem] overflow-hidden border border-slate-100 dark:border-zinc-800">
                  <img 
                    src={candidate.image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${candidate.name}`} 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-black text-slate-900 dark:text-zinc-100 tracking-tighter leading-none">{candidate.votes}</div>
                  <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Votes_Cast</div>
                </div>
              </div>

              <h3 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 mb-1">{candidate.name}</h3>
              <p className="text-[10px] font-mono text-slate-400 tracking-tighter truncate opacity-60 mb-8 uppercase">
                {candidate.wallet_address?.substring(0, 18)}...
              </p>
            </div>

            <button 
              onClick={() => handleVote(idx)}
              disabled={voting || !isVotingActive || isFinished}
              className={`w-full py-4 rounded-xl font-black tracking-[0.2em] text-[10px] transition-all
                ${candidate.wallet_address?.toLowerCase() === session?.winner_address?.toLowerCase() 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900'}
                hover:scale-[1.02] active:scale-95 disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed`}
            >
              {isFinished ? 'SESSION_ARCHIVED' : voting ? 'CASTING...' : isVotingActive ? 'CAST_YOUR_VOTE' : 'PAUSED'}
            </button>
          </div>
        ))}
      </div>
      
      <footer className="mt-24 flex flex-col md:flex-row items-center justify-between gap-8 py-12 border-t border-slate-100 dark:border-zinc-900">
        <div className="flex items-center gap-4 text-slate-400">
          <Info size={16} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Powered_by_Ethereum_Network</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <TrendingUp size={16} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Real-time_analytics_active</span>
        </div>
      </footer>
    </div>
  );
}
