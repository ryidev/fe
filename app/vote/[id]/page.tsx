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

      const { data: candData } = await supabase.from('candidates').select('*').eq('session_id', id);
      const updatedCandidates = await Promise.all((candData || []).map(async (c: any, index: number) => {
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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted font-mono text-[10px] uppercase tracking-[0.3em]">Synching_Node...</div>;

  const isFinished = session?.status === 'finished';
  const winnerCandidate = candidates.find(
    c => c.wallet_address?.toLowerCase() === session?.winner_address?.toLowerCase()
  );

  return (
    <div className="max-w-6xl mx-auto pt-24 px-8 pb-32">
      
      <header className="mb-20 text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className={`w-2 h-2 rounded-full ${isFinished ? 'bg-muted' : isVotingActive ? 'bg-indigo-600 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted">
            {isFinished ? 'Archived_Session' : isVotingActive ? 'Live_Voting' : 'Session_Paused'}
          </span>
        </div>
        <h1 className="text-6xl font-black tracking-tight text-foreground uppercase italic mb-4">
          {session?.title || 'Unknown_Session'}
        </h1>
        <p className="text-muted max-w-xl mx-auto font-medium leading-relaxed">
          {session?.description}
        </p>
      </header>

      {/* WINNER BANNER: Background Putih Solid (Force) */}
      {isFinished && winnerCandidate && (
        <section className="mb-16 p-6 md:p-8 rounded-3xl bg-white border-2  shadow-xl flex items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute -top-6 -left-6 opacity-[0.03] text-indigo-900">
            <Trophy size={150} />
          </div>
          
          <div className="relative z-10 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Trophy size={12} className="text-indigo-600" />
              <h2 className="text-[9px] font-black tracking-[0.4em] uppercase text-indigo-600">Official_Winner_Declared</h2>
            </div>
            <div className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic text-slate-900 leading-none mb-2">
              {winnerCandidate.name}
            </div>
            <p className="text-[9px] font-mono text-slate-500 break-all">{winnerCandidate.wallet_address}</p>
          </div>

          <div className="relative z-10 flex flex-col items-center gap-2 pr-2">
             <div className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center text-white">
                <CheckCircle2 size={28} />
             </div>
             <span className="text-[8px] font-black text-indigo-600 tracking-widest uppercase">Verified</span>
          </div>
        </section>
      )}

      {/* CANDIDATES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {candidates.map((candidate, idx) => {
          const isWinner = candidate.wallet_address?.toLowerCase() === session?.winner_address?.toLowerCase();
          return (
            <div 
              key={candidate.id} 
              className={`minimal-card flex flex-col justify-between p-8 relative ${isWinner ? 'border-indigo-600 ring-4 ring-indigo-500/10' : ''}`}
            >
              {isFinished && (
                <div className={`absolute top-0 left-0 px-4 py-2 rounded-br-2xl text-[10px] font-black tracking-widest uppercase ${idx === 0 ? 'bg-indigo-600 text-white' : 'bg-muted/10 text-muted'}`}>
                  RANK #{idx + 1}
                </div>
              )}

              <div className="mt-4">
                <div className="flex justify-between items-start mb-10">
                  <div className="w-16 h-16 bg-muted/5 rounded-[1.25rem] overflow-hidden border border-border">
                    <img 
                      src={candidate.image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${candidate.name}`} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-foreground tracking-tighter leading-none">{candidate.votes}</div>
                    <div className="text-[8px] font-black text-muted uppercase tracking-widest mt-1">Votes_Cast</div>
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-foreground mb-1">{candidate.name}</h3>
                <p className="text-[10px] font-mono text-muted tracking-tighter truncate opacity-80 mb-8 uppercase">
                  {candidate.wallet_address?.substring(0, 18)}...
                </p>
              </div>

              <button 
                onClick={() => handleVote(idx)}
                disabled={voting || !isVotingActive || isFinished}
                className={`w-full py-4 rounded-xl font-black tracking-[0.2em] text-[10px] transition-all
                  ${isWinner 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-muted/10 text-foreground border border-border'}
                  hover:bg-indigo-600 hover:text-white disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed`}
              >
                {isFinished ? 'SESSION_ARCHIVED' : voting ? 'CASTING...' : isVotingActive ? 'CAST_YOUR_VOTE' : 'PAUSED'}
              </button>
            </div>
          );
        })}
      </div>
      
      <footer className="mt-24 flex flex-col md:flex-row items-center justify-between gap-8 py-12 border-t border-border">
        <div className="flex items-center gap-4 text-muted">
          <Info size={16} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Powered_by_Ethereum_Network</span>
        </div>
        <div className="flex items-center gap-2 text-muted">
          <TrendingUp size={16} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Real-time_analytics_active</span>
        </div>
      </footer>
    </div>
  );
}
