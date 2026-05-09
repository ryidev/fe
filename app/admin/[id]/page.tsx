"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getEvotingContract } from '@/lib/evotingContract';
import { useToast } from '@/app/components/ToastProvider';
import { addCandidateToSession, deleteCandidate, updateCandidate, uploadCandidateAvatar } from '@/app/supabase-candidates';
import { ArrowLeft, UserPlus, Play, Square, Trophy, Trash2, Activity, CheckCircle2, Settings, X, Upload, Camera } from "lucide-react";

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
  const { showToast } = useToast();
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

  // State untuk Editing
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [editName, setEditName] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      showToast(`Status updated.`, 'success');
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
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
      showToast('Session successfully finalized.', 'success');
    } catch (err: any) {
      showToast(`Finalization Error: ${err.message}`, 'error');
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
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setAdding(false);
    }
  };

  // LOGIKA EDIT KANDIDAT
  const openEditModal = (candidate: Candidate) => {
    setEditingCandidate(candidate);
    setEditName(candidate.name);
  };

  const handleUpdateCandidate = async () => {
    if (!editingCandidate) return;
    setUploading(true);
    try {
      const updated = await updateCandidate(editingCandidate.id, { name: editName });
      setCandidates(candidates.map(c => c.id === updated.id ? { ...c, name: updated.name } : c));
      setEditingCandidate(null);
      showToast('Candidate updated successfully.', 'success');
    } catch (err: any) {
      showToast(`Update Error: ${err.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !editingCandidate) return;
    setUploading(true);
    try {
      const url = await uploadCandidateAvatar(e.target.files[0], editingCandidate.id);
      const updated = await updateCandidate(editingCandidate.id, { image_url: url });
      setCandidates(candidates.map(c => c.id === updated.id ? { ...c, image_url: updated.image_url } : c));
      setEditingCandidate({ ...editingCandidate, image_url: url });
      showToast('Photo uploaded successfully.', 'success');
    } catch (err: any) {
      showToast(`Upload Error: ${err.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted font-mono text-xs tracking-widest">LOADING_TERMINAL...</div>;

  const winnerName = candidates.find(
    c => c.wallet_address?.toLowerCase() === winner?.toLowerCase()
  )?.name;

  return (
    <div className="max-w-4xl mx-auto pt-24 px-8 pb-32">
      {/* HEADER */}
      <div className="mb-12 border-b border-border pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <button onClick={() => router.push('/admin')} className="flex items-center gap-2 text-xs font-bold text-muted hover:text-foreground transition-colors mb-4">
            <ArrowLeft size={14} /> SESSION_CONTROL
          </button>
          <h1 className="text-4xl font-black tracking-tight text-foreground uppercase">{session?.title}</h1>
          <div className="flex items-center gap-3 mt-4">
            <div className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${isFinished ? 'bg-muted/10 text-muted' : isVotingActive ? 'bg-green-100 dark:bg-green-950/30 text-green-700' : 'bg-red-100 dark:bg-red-950/30 text-red-700'}`}>
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
                className="btn-primary flex items-center gap-2"
              >
                <Trophy size={14} /> Finalize
              </button>
            </>
          )}
        </div>
      </div>

      {/* WINNER SECTION */}
      {isFinished && (
        <div className="mb-12 p-8 rounded-3xl bg-white border-2 border-indigo-600 shadow-xl flex items-center justify-between">
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-2">👑 Winner_Identified</h2>
            <p className="text-3xl font-black italic uppercase tracking-tighter leading-none text-slate-900">
              {winnerName || 'WINNER_FOUND'}
            </p>
            <p className="text-[10px] font-mono text-slate-400 mt-3 break-all">{winner}</p>
          </div>
          <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white">
            <CheckCircle2 size={24} />
          </div>
        </div>
      )}

      {/* ADMIN FORM */}
      {!isVotingActive && !isFinished && (
        <section className="minimal-card mb-12 p-8 border-dashed border-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted mb-8 flex items-center gap-2">
            <UserPlus size={14} /> New_Candidate
          </h2>
          <form onSubmit={handleAddCandidate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-muted ml-1">Name</label>
              <input 
                type="text" placeholder="Candidate Name"
                className="w-full bg-transparent border-b border-border py-2 px-1 text-sm outline-none focus:border-indigo-500 transition-all text-foreground"
                value={newName} onChange={(e) => setNewName(e.target.value)} required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-muted ml-1">Wallet</label>
              <input 
                type="text" placeholder="0x..."
                className="w-full bg-transparent border-b border-border py-2 px-1 text-sm outline-none focus:border-indigo-500 transition-all font-mono text-foreground"
                value={newWallet} onChange={(e) => setNewWallet(e.target.value)} required
              />
            </div>
            <button 
              type="submit" disabled={adding}
              className="md:col-span-2 btn-primary py-4 uppercase tracking-[0.2em] text-[10px] font-black"
            >
              {adding ? 'SYNCHING...' : 'REGISTER_KANDIDAT'}
            </button>
          </form>
        </section>
      )}

      {/* ANALYTICS / AUDIT LOG */}
      <div className="space-y-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted flex items-center gap-2">
          <Activity size={14} /> Audit_Log
        </h2>
        
        <div className="grid grid-cols-1 gap-3">
          {candidates.map((c) => (
            <div key={c.id} className={`minimal-card flex items-center justify-between p-6 ${c.wallet_address?.toLowerCase() === winner?.toLowerCase() ? 'border-indigo-600 ring-4 ring-indigo-500/10' : ''}`}>
              <div className="flex items-center gap-5">
                {/* PHOTO PROFILE PREVIEW */}
                <div className="w-12 h-12 bg-muted/10 rounded-xl overflow-hidden flex items-center justify-center border border-border">
                  {c.image_url ? (
                    <img src={c.image_url} className="w-full h-full object-cover" alt={c.name} />
                  ) : (
                    <span className="text-xs font-bold text-muted uppercase tracking-tighter">No_IMG</span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{c.name}</h3>
                  <p className="text-[10px] text-muted font-mono tracking-tighter truncate max-w-[150px]">{c.wallet_address}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right mr-4">
                  <div className="text-2xl font-black text-foreground tracking-tighter">{c.votes}</div>
                  <div className="text-[8px] font-bold text-muted uppercase tracking-widest">Votes</div>
                </div>
                
                {/* SETTINGS BUTTON */}
                <button 
                  onClick={() => openEditModal(c)}
                  className="p-2 text-muted hover:text-foreground hover:bg-muted/10 rounded-lg transition-all"
                  title="Settings"
                >
                  <Settings size={18} />
                </button>

                {!isVotingActive && !isFinished && (
                  <button onClick={() => deleteCandidate(c.id)} className="p-2 text-muted hover:text-red-500 transition-all">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* EDIT MODAL */}
      {editingCandidate && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-card w-full max-w-md rounded-[2rem] border border-border shadow-2xl p-8 relative overflow-hidden">
             <button onClick={() => setEditingCandidate(null)} className="absolute top-6 right-6 p-2 text-muted hover:text-foreground">
               <X size={20} />
             </button>

             <h2 className="text-xl font-black tracking-tight text-foreground mb-8">EDIT_CANDIDATE</h2>

             <div className="flex flex-col items-center mb-8">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                   <div className="w-24 h-24 rounded-2xl bg-muted/10 border border-border overflow-hidden flex items-center justify-center">
                      {editingCandidate.image_url ? (
                        <img src={editingCandidate.image_url} className="w-full h-full object-cover" />
                      ) : (
                        <Camera size={32} className="text-muted" />
                      )}
                   </div>
                   <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Upload size={20} className="text-white" />
                   </div>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                <p className="text-[10px] font-bold text-muted uppercase mt-3 tracking-widest">Change_Profile_Photo</p>
             </div>

             <div className="space-y-6">
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-muted ml-1">Candidate_Name</label>
                   <input 
                     type="text" className="w-full bg-transparent border-b border-border py-2 px-1 text-lg outline-none focus:border-indigo-500 transition-all text-foreground"
                     value={editName} onChange={(e) => setEditName(e.target.value)}
                   />
                </div>
                
                <button 
                  onClick={handleUpdateCandidate} disabled={uploading}
                  className="w-full btn-primary py-4 uppercase tracking-[0.2em] text-[10px] font-black mt-4"
                >
                  {uploading ? 'PROCESSING...' : 'SAVE_CHANGES'}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
