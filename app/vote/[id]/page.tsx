"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Navbar from '@/app/components/Navbar';
import { getEvotingContract } from '@/lib/evotingContract';
import { useToast } from '@/app/components/ToastProvider';
import { CheckCircle2, TrendingUp, Info, Trophy, ShieldAlert, Fingerprint, Calendar, UserPlus, LogIn, X, AlertCircle, Smartphone } from "lucide-react";

interface Candidate {
  id: number;
  name: string;
  wallet_address: string;
  description: string;
  image_url: string;
  session_id: number;
  votes: number;
  blockchainIndex: number;
}

interface VotingSession {
  id: number;
  title: string;
  description: string;
  winner_address?: string;
  status?: string;
  require_nik?: boolean;
  enforce_age?: boolean;
  id_label?: string;
  id_length?: number;
}

export default function VotePage() {
  const { id } = useParams();
  const [session, setSession] = useState<VotingSession | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [isVotingActive, setIsVotingActive] = useState(false);
  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [nik, setNik] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [showAppBanner, setShowAppBanner] = useState(true);
  const [hasVoted, setHasVoted] = useState(false);
  const { showToast } = useToast();

  const calculateAge = (birthDateString: string) => {
    if (!birthDateString) return 0;
    const birth = new Date(birthDateString);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if ((today.getMonth() - birth.getMonth()) < 0 || ((today.getMonth() - birth.getMonth()) === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  async function checkVerification(wallet: string, currentSession?: VotingSession) {
    if (!wallet) return;
    setVerifying(true);
    try {
      const { data } = await supabase.from('verified_voters').select('*').eq('wallet_address', wallet.toLowerCase()).single();
      if (data) {
        const sess = currentSession || session;
        if (sess?.enforce_age) {
          const age = calculateAge(data.birth_date);
          if (age < 17) {
            setIsVerified(false);
            showToast("Age must be 17+ to participate.", 'error');
            return;
          }
        }
        setIsVerified(true);
      } else {
        setIsVerified(false);
      }
    } catch (err) {
      setIsVerified(false);
    } finally {
      setVerifying(false);
    }
  }

  async function checkUserVoted(wallet: string) {
    if (!wallet) {
      setHasVoted(false);
      return;
    }
    try {
      const contract = await getEvotingContract();
      const voted = await contract.userSudahVoting(wallet);
      setHasVoted(voted);
    } catch (e) {
      console.warn('Failed to check if user has voted', e);
      setHasVoted(false);
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          const wallet = accounts[0].toLowerCase();
          setUserWallet(wallet);
          checkVerification(wallet);
          checkUserVoted(wallet);
          showToast(`Account Switched`, 'success');
        } else {
          setUserWallet(null);
          setIsVerified(false);
          setHasVoted(false);
        }
      };
      (window as any).ethereum.on('accountsChanged', handleAccountsChanged);
      return () => (window as any).ethereum.removeListener('accountsChanged', handleAccountsChanged);
    }
  }, []);

  async function fetchBlockchainData() {
    try {
      const contract = await getEvotingContract();
      const active = await contract.sudahBisaVoting();
      setIsVotingActive(active);

      let totalOnChain = 0;
      try {
        const total = await contract.totalKandidat();
        totalOnChain = Number(total);
      } catch (e) {
        console.warn('Failed to fetch total candidates from blockchain', e);
      }

      const onChainMapping: { [address: string]: { index: number; votes: number } } = {};
      for (let i = 0; i < totalOnChain; i++) {
        try {
          const blockchainCand = await contract.kandidat(i);
          onChainMapping[blockchainCand.alamatKandidat.toLowerCase()] = {
            index: i,
            votes: Number(blockchainCand.jumlahSuara)
          };
        } catch (e) {
          console.warn('Error fetching on-chain candidate at index', i, e);
        }
      }

      if (userWallet) {
        try {
          const voted = await contract.userSudahVoting(userWallet);
          setHasVoted(voted);
        } catch (e) {
          console.warn('Failed to refresh userSudahVoting status', e);
        }
      }

      const { data: candData } = await supabase.from('candidates').select('*').eq('session_id', id);
      const updatedCandidates = (candData || []).map((c: any) => {
        const wallet = c.wallet_address?.toLowerCase();
        const mapped = onChainMapping[wallet];
        return {
          ...c,
          blockchainIndex: mapped ? mapped.index : -1,
          votes: mapped ? mapped.votes : 0
        };
      });

      const { data: freshSession } = await supabase.from('voting_sessions').select('*').eq('id', id).single();
      if (freshSession?.status === 'finished') updatedCandidates.sort((a, b) => b.votes - a.votes);
      setSession(freshSession);
      setCandidates(updatedCandidates);
      return freshSession;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  useEffect(() => {
    async function init() {
      const freshSession = await fetchBlockchainData();
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          const wallet = accounts[0].toLowerCase();
          setUserWallet(wallet);
          await checkVerification(wallet, freshSession || undefined);
          await checkUserVoted(wallet);
        }
      }
      setLoading(false);
    }
    init();
    const interval = setInterval(fetchBlockchainData, 10000);
    return () => clearInterval(interval);
  }, [id]);

  const idLabel = session?.id_label || 'NIK';
  const idLength = session?.id_length || 16;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userWallet) return showToast("Connect wallet first", 'error');
    if (nik.length !== idLength) return showToast(`${idLabel} must be ${idLength} digits`, 'error');

    setVerifying(true);
    try {
      if (authMode === 'register') {
        // Pre-validation to avoid database constraint violations and provide clear error messages
        const { data: existingNik } = await supabase
          .from('verified_voters')
          .select('nik')
          .eq('nik', nik)
          .maybeSingle();
        if (existingNik) {
          throw new Error(`This ${idLabel} is already registered.`);
        }

        const { data: existingWallet } = await supabase
          .from('verified_voters')
          .select('wallet_address')
          .eq('wallet_address', userWallet.toLowerCase())
          .maybeSingle();
        if (existingWallet) {
          throw new Error("This wallet address is already linked to an identity. Please use the LOGIN tab instead.");
        }

        if (session?.enforce_age) {
          const age = calculateAge(birthDate);
          if (age < 17) throw new Error("Age must be 17+ to participate.");
        }

        const { error } = await supabase.from('verified_voters').insert([{ 
          nik, 
          birth_date: session?.enforce_age ? birthDate : "2000-01-01", 
          wallet_address: userWallet.toLowerCase(), 
          full_name: "Verified Voter" 
        }]);
        if (error) throw new Error(error.message);
        showToast("Registration successful", 'success');
      } else {
        const { data, error } = await supabase.from('verified_voters').select('*').eq('nik', nik).eq('wallet_address', userWallet.toLowerCase()).single();
        if (error || !data) throw new Error(`${idLabel} mismatch with wallet`);

        if (session?.enforce_age) {
          if (!data.birth_date) throw new Error("Age verification is required, but birth date is not recorded for this identity");
          const age = calculateAge(data.birth_date);
          if (age < 17) throw new Error("Age must be 17+ to participate.");
        }

        showToast("Login successful", 'success');
      }
      setIsVerified(true);
    } catch (err: any) { showToast(err.message, 'error'); } 
    finally { setVerifying(false); }
  };

  const handleVote = async (index: number) => {
    if (session?.require_nik && !isVerified) return showToast("Verify NIK first", 'error');
    if (session?.status === 'finished' || !isVotingActive) return showToast("Voting closed", 'error');
    
    setVoting(true);
    try {
      const contract = await getEvotingContract();
      const tx = await contract.voting(index);
      await tx.wait();
      showToast('Vote cast successfully', 'success');
      setHasVoted(true);
      await fetchBlockchainData();
    } catch (err: any) { 
      // Handle the complex blockchain error object
      const errorMessage = err.reason || err.message || "Execution reverted";
      showToast(errorMessage, 'error'); 
    } 
    finally { setVoting(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted font-mono text-[10px] uppercase tracking-[0.3em]">Syncing Node...</div>;

  const isFinished = session?.status === 'finished';
  const winnerCandidate = candidates.find(c => c.wallet_address?.toLowerCase() === session?.winner_address?.toLowerCase());
  const showVerificationGate = session?.require_nik && !isVerified && !isFinished;

  return (
    <div className="max-w-6xl mx-auto pt-24 px-8 pb-32">
      {showAppBanner && (
        <div className="mb-10 p-5 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/5 border border-indigo-500/20 backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shrink-0">
              <Smartphone size={24} />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-foreground">Buka di Aplikasi VoteDecen</h3>
              <p className="text-[11px] text-muted mt-0.5">Dapatkan pengalaman memilih yang lebih aman, cepat, dan terintegrasi langsung dengan dompet MetaMask Anda di Android.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              onClick={() => setShowAppBanner(false)}
              className="p-3 text-muted hover:text-foreground hover:bg-muted/10 rounded-xl transition-all"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
            <a
              href={`votedecen://vote/${id}`}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 px-6 text-[10px] font-black uppercase tracking-wider shadow-lg shadow-indigo-600/20 text-center shrink-0 transition-all active:scale-[0.98]"
            >
              Buka Aplikasi
            </a>
          </div>
        </div>
      )}
      
      <header className="mb-20 text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className={`w-2 h-2 rounded-full ${isFinished ? 'bg-muted' : isVotingActive ? 'bg-indigo-600 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted">{isFinished ? 'Archived Session' : isVotingActive ? 'Live Voting' : 'Session Paused'}</span>
        </div>
        <h1 className="text-6xl font-black tracking-tight text-foreground uppercase italic mb-4">{session?.title}</h1>
        {session?.require_nik && <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/30 rounded-full mb-6"><ShieldAlert size={12} className="text-indigo-600" /><span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{idLabel} Verification Required</span></div>}
        <p className="text-muted max-w-xl mx-auto font-medium leading-relaxed">{session?.description}</p>
      </header>

      {showVerificationGate ? (
        <section className="max-w-md mx-auto mb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
           <div className="minimal-card p-10 border-2 border-indigo-600 shadow-2xl shadow-indigo-500/10">
              <div className="flex bg-muted/10 p-1 rounded-xl mb-10">
                <button onClick={() => setAuthMode('register')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${authMode === 'register' ? 'bg-white dark:bg-zinc-800 text-indigo-600 shadow-sm' : 'text-muted'}`}><UserPlus size={14} /> Register</button>
                <button onClick={() => setAuthMode('login')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${authMode === 'login' ? 'bg-white dark:bg-zinc-800 text-indigo-600 shadow-sm' : 'text-muted'}`}><LogIn size={14} /> Login</button>
              </div>
              <div className="flex flex-col items-center text-center mb-8">
                 <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mb-6">{verifying ? <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" /> : <Fingerprint size={32} />}</div>
                 <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">{verifying ? 'VERIFYING...' : authMode === 'register' ? 'New Registration' : 'Verify Connection'}</h2>
                 <p className="text-xs text-muted mt-2">{authMode === 'register' ? `Link your ${idLabel} to this wallet.` : `Enter your ${idLabel} to verify linkage.`}</p>
              </div>
              <form onSubmit={handleAuth} className="space-y-6">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted uppercase ml-1">Identifier ({idLabel})</label>
                    <input type="text" placeholder={`${idLength} Digit Number`} maxLength={idLength} className="w-full bg-transparent border-b border-border py-3 px-1 text-lg outline-none focus:border-indigo-500 transition-all font-mono text-foreground" value={nik} onChange={(e) => setNik(e.target.value.replace(/\D/g, '').slice(0, idLength))} required />
                 </div>
                 {authMode === 'register' && session?.enforce_age && (
                   <div className="space-y-1 animate-in fade-in duration-500">
                      <label className="text-[10px] font-black text-muted uppercase ml-1">Birth Date</label>
                      <input type="date" className="w-full bg-transparent border-b border-border py-3 px-1 text-lg outline-none focus:border-indigo-500 transition-all text-foreground" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />
                   </div>
                 )}
                 <button type="submit" disabled={verifying} className="w-full btn-primary py-4 mt-4 uppercase tracking-[0.2em] text-[10px] font-black shadow-xl">{verifying ? 'SYNCING NODE...' : authMode === 'register' ? 'REGISTER & LINK' : 'LOGIN & VERIFY'}</button>
              </form>
           </div>
        </section>
      ) : (
        <>
          {isFinished && winnerCandidate && (
            <section className="mb-16 p-6 md:p-8 rounded-3xl bg-white border-2 border-indigo-600 shadow-xl flex items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute -top-6 -left-6 opacity-[0.03] text-indigo-900"><Trophy size={150} /></div>
              <div className="relative z-10 flex flex-col">
                <div className="flex items-center gap-2 mb-2"><Trophy size={12} className="text-indigo-600" /><h2 className="text-[9px] font-black tracking-[0.4em] uppercase text-indigo-600">Official Winner Declared</h2></div>
                <div className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic text-slate-900 leading-none mb-2">{winnerCandidate.name}</div>
                <p className="text-[9px] font-mono text-slate-500 break-all">{winnerCandidate.wallet_address}</p>
              </div>
              <div className="relative z-10 flex flex-col items-center gap-2 pr-2">
                 <div className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center text-white"><CheckCircle2 size={28} /></div>
                 <span className="text-[8px] font-black text-indigo-600 tracking-widest uppercase">Verified</span>
              </div>
            </section>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {candidates.map((candidate, idx) => {
              const isWinner = candidate.wallet_address?.toLowerCase() === session?.winner_address?.toLowerCase();
              return (
                <div key={candidate.id} className={`minimal-card flex flex-col justify-between p-8 relative ${isWinner ? 'border-indigo-600 ring-4 ring-indigo-500/10' : ''}`}>
                  {isFinished && <div className={`absolute top-0 left-0 px-4 py-2 rounded-br-2xl text-[10px] font-black tracking-widest uppercase ${idx === 0 ? 'bg-indigo-600 text-white' : 'bg-muted/10 text-muted'}`}>RANK #{idx + 1}</div>}
                  <div className="mt-4">
                    <div className="flex justify-between items-start mb-10">
                      <div className="w-16 h-16 bg-muted/5 rounded-[1.25rem] overflow-hidden border border-border"><img src={candidate.image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${candidate.name}`} className="w-full h-full object-cover" /></div>
                      <div className="text-right"><div className="text-3xl font-black text-foreground tracking-tighter leading-none">{candidate.votes}</div><div className="text-[8px] font-black text-muted uppercase tracking-widest mt-1">Votes Cast</div></div>
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-1">{candidate.name}</h3>
                    <p className="text-[10px] font-mono text-muted tracking-tighter truncate opacity-80 mb-8 uppercase">{candidate.wallet_address?.substring(0, 18)}...</p>
                  </div>
                   <button 
                    onClick={() => handleVote(candidate.blockchainIndex)} 
                    disabled={voting || !isVotingActive || isFinished || candidate.blockchainIndex === -1 || hasVoted} 
                    className={`w-full py-4 rounded-xl font-black tracking-[0.2em] text-[10px] transition-all ${isWinner ? 'bg-indigo-600 text-white' : 'bg-muted/10 text-foreground border border-border'} hover:bg-indigo-600 hover:text-white disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed`}
                  >
                    {isFinished ? 'SESSION ARCHIVED' : voting ? 'CASTING...' : candidate.blockchainIndex === -1 ? 'NOT SYNCED ON-CHAIN' : hasVoted ? 'ANDA SUDAH MEMILIH' : isVotingActive ? 'CAST YOUR VOTE' : 'PAUSED'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
      <footer className="mt-24 flex flex-col md:flex-row items-center justify-between gap-8 py-12 border-t border-border">
        <div className="flex items-center gap-4 text-muted"><Info size={16} /><span className="text-[10px] font-bold uppercase tracking-widest">Powered by Ethereum Network</span></div>
        <div className="flex items-center gap-2 text-muted"><TrendingUp size={16} /><span className="text-[10px] font-bold uppercase tracking-widest">Real-time analytics active</span></div>
      </footer>
    </div>
  );
}
