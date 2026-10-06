"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getEvotingContract } from '@/lib/evotingContract';
import { useToast } from '@/app/components/ToastProvider';
import { addCandidateToSession, deleteCandidate, updateCandidate, uploadCandidateAvatar } from '@/app/supabase-candidates';
import { getVotersBySession, addVoterToSession, deleteVoterFromSession, SessionVoter } from '@/app/supabase-voters';
import { 
  ArrowLeft, UserPlus, Play, Square, Trophy, Trash2, Activity, 
  CheckCircle2, Settings, X, Upload, Camera, Users, ShieldCheck, UserCheck, AlertCircle, SlidersHorizontal, Fingerprint 
} from "lucide-react";

interface Candidate {
  id: number;
  name: string;
  wallet_address: string;
  description: string;
  image_url: string;
  session_id: number;
  votes?: number;
  blockchainIndex?: number;
}

export default function AdminForumPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [voters, setVoters] = useState<SessionVoter[]>([]);
  const [activeTab, setActiveTab] = useState<'candidates' | 'voters'>('candidates');

  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newWallet, setNewWallet] = useState('');

  // State DPT (Daftar Pemilih Tetap)
  const [newVoterName, setNewVoterName] = useState('');
  const [newVoterId, setNewVoterId] = useState('');
  const [addingVoter, setAddingVoter] = useState(false);

  const [isVotingActive, setIsVotingActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  // State untuk Editing Kandidat
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [editName, setEditName] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State untuk Edit Format Identitas Sesi (Dinamis)
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingTitle, setSettingTitle] = useState('');
  const [settingDescription, setSettingDescription] = useState('');
  const [settingIdLabel, setSettingIdLabel] = useState('NPM');
  const [settingIdLength, setSettingIdLength] = useState(8);
  const [savingSettings, setSavingSettings] = useState(false);

  async function fetchBlockchainData() {
    try {
      const contract = await getEvotingContract();
      const status = await contract.sudahBisaVoting();
      setIsVotingActive(status);

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
      setCandidates(updatedCandidates);
    } catch (err) {
      console.error(err);
    }
  }

  async function refreshVoters() {
    if (!id) return;
    try {
      const vData = await getVotersBySession(Number(id));
      setVoters(vData);
    } catch (e) {
      console.warn('Error loading voters', e);
    }
  }

  useEffect(() => {
    async function init() {
      if (!id) return;
      const { data: sData, error } = await supabase.from('voting_sessions').select('*').eq('id', id).single();
      if (error || !sData) return router.push('/admin');
      
      setSession(sData);
      setSettingTitle(sData.title || '');
      setSettingDescription(sData.description || '');
      setSettingIdLabel(sData.id_label || 'NPM');
      setSettingIdLength(sData.id_length || 8);
      setWinner(sData.winner_address);
      if (sData.status === 'finished') setIsFinished(true);

      await refreshVoters();

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

    // Polling real-time setiap 2 detik untuk data kandidat, suara, dan status DPT
    const interval = setInterval(() => {
      fetchBlockchainData();
      refreshVoters();
    }, 2000);

    // Supabase Realtime subscription untuk mendeteksi perubahan DPT/klaim identitas secara instan
    const channel = supabase
      .channel(`admin-session-voters-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_voters', filter: `session_id=eq.${id}` },
        () => {
          refreshVoters();
        }
      )
      .subscribe();

    // Event listener smart contract on-chain untuk update hasil suara instan
    let cleanupEvents: any = null;
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      getEvotingContract().then(contract => {
        const onBallot = () => fetchBlockchainData();
        const onMint = () => refreshVoters();
        contract.on('BallotConsumed', onBallot);
        contract.on('BallotMinted', onMint);
        cleanupEvents = () => {
          contract.off('BallotConsumed', onBallot);
          contract.off('BallotMinted', onMint);
        };
      }).catch(() => {});
    }

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
      if (cleanupEvents) cleanupEvents();
    };
  }, [id]);

  const toggleVoting = async () => {
    setProcessing(true);
    try {
      const contract = await getEvotingContract();
      const tx = await contract.statusVoting(!isVotingActive);
      await tx.wait();
      setIsVotingActive(!isVotingActive);
      showToast(`Status voting berhasil diubah.`, 'success');
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const finishVoting = async () => {
    if (!confirm('Akhiri sesi voting ini secara permanen?')) return;
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
      showToast('Sesi voting berhasil diselesaikan dan pemenang dikunci.', 'success');
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
      showToast('Kandidat berhasil didaftarkan secara on-chain!', 'success');
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setAdding(false);
    }
  };

  // HANDLER DPT DENGAN VALIDASI DIGIT DINAMIS
  const handleAddVoter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVoterName || !newVoterId) return;

    // Validasi panjang digit/karakter sesuai konfigurasi admin sesi
    const targetLength = Number(session?.id_length) || 0;
    if (targetLength > 0 && newVoterId.trim().length !== targetLength) {
      showToast(`${session?.id_label || 'NPM'} harus memiliki panjang ${targetLength} digit/karakter!`, 'error');
      return;
    }

    setAddingVoter(true);
    try {
      const added = await addVoterToSession(Number(id), newVoterId, newVoterName);
      setVoters([...voters, added]);
      setNewVoterName('');
      setNewVoterId('');
      showToast(`Mahasiswa "${added.full_name}" (${session?.id_label || 'NPM'}: ${added.identifier}) berhasil ditambahkan ke DPT sesi ini!`, 'success');
    } catch (err: any) {
      showToast(`Gagal: ${err.message}`, 'error');
    } finally {
      setAddingVoter(false);
    }
  };

  const handleDeleteVoter = async (voterId: number) => {
    if (!confirm('Hapus pemilih ini dari DPT sesi ini?')) return;
    try {
      await deleteVoterFromSession(voterId);
      setVoters(voters.filter(v => v.id !== voterId));
      showToast('Pemilih berhasil dihapus dari DPT.', 'success');
    } catch (err: any) {
      showToast(`Gagal: ${err.message}`, 'error');
    }
  };

  // HANDLER EDIT PENGATURAN IDENTITAS SESI
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const cleanLabel = settingIdLabel.trim().toUpperCase() || 'NPM';
      const cleanLen = Number(settingIdLength) > 0 ? Number(settingIdLength) : 8;

      const { data, error } = await supabase
        .from('voting_sessions')
        .update({
          title: settingTitle,
          description: settingDescription,
          id_label: cleanLabel,
          id_length: cleanLen,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setSession(data);
      setShowSettingsModal(false);
      showToast(`Format identitas berhasil diubah menjadi: ${cleanLabel} (${cleanLen} Digit)!`, 'success');
    } catch (err: any) {
      showToast(`Gagal: ${err.message}`, 'error');
    } finally {
      setSavingSettings(false);
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

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted font-mono text-xs tracking-widest">LOADING TERMINAL...</div>;

  const winnerName = candidates.find(
    c => c.wallet_address?.toLowerCase() === winner?.toLowerCase()
  )?.name;

  const currentLabel = session?.id_label || 'NPM';
  const currentLength = session?.id_length || 8;
  const claimedCount = voters.filter(v => v.wallet_address).length;

  return (
    <div className="max-w-4xl mx-auto pt-24 px-8 pb-32">
      {/* HEADER */}
      <div className="mb-10 border-b border-border pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <button onClick={() => router.push('/admin')} className="flex items-center gap-2 text-xs font-bold text-muted hover:text-foreground transition-colors mb-4">
            <ArrowLeft size={14} /> SESSION CONTROL
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tight text-foreground uppercase">{session?.title}</h1>
            {!isFinished && (
              <button 
                onClick={() => setShowSettingsModal(true)} 
                className="p-2 text-muted hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-all"
                title="Ubah Format Kolom NPM/NIK & Limit Digit"
              >
                <SlidersHorizontal size={20} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 mt-4">
            <div className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${isFinished ? 'bg-muted/10 text-muted' : isVotingActive ? 'bg-green-100 dark:bg-green-950/30 text-green-700' : 'bg-red-100 dark:bg-red-950/30 text-red-700'}`}>
              {isFinished ? 'Archived' : isVotingActive ? 'Live Voting' : 'Paused'}
            </div>
            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 px-2.5 py-0.5 rounded-md font-mono font-black">
              Identitas: {currentLabel} ({currentLength} Digit)
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {!isFinished && (
            <>
              <button 
                onClick={toggleVoting} disabled={processing}
                className={`p-3 rounded-xl border transition-all ${isVotingActive ? 'border-red-200 text-red-600 bg-red-50 dark:bg-red-950/20' : 'border-green-200 text-green-600 bg-green-50 dark:bg-green-950/20'}`}
                title={isVotingActive ? "Jeda Voting" : "Mulai Voting"}
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
        <div className="mb-12 p-8 rounded-3xl bg-white dark:bg-zinc-900 border-2 border-indigo-600 shadow-xl flex items-center justify-between">
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-2">👑 Official Winner</h2>
            <p className="text-3xl font-black italic uppercase tracking-tighter leading-none text-foreground">
              {winnerName || 'WINNER FOUND'}
            </p>
            <p className="text-[10px] font-mono text-muted mt-3 break-all">{winner}</p>
          </div>
          <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white">
            <CheckCircle2 size={24} />
          </div>
        </div>
      )}

      {/* TAB NAVIGATION: KANDIDAT VS DPT */}
      <div className="flex bg-muted/10 p-1.5 rounded-2xl mb-8">
        <button
          onClick={() => setActiveTab('candidates')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'candidates'
              ? 'bg-white dark:bg-zinc-800 text-indigo-600 shadow-md'
              : 'text-muted hover:text-foreground'
          }`}
        >
          <Activity size={16} />
          <span>Kandidat & Hasil ({candidates.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('voters')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'voters'
              ? 'bg-white dark:bg-zinc-800 text-indigo-600 shadow-md'
              : 'text-muted hover:text-foreground'
          }`}
        >
          <Users size={16} />
          <span>DPT Pemilih ({voters.length})</span>
        </button>
      </div>

      {/* TAB 1: KANDIDAT */}
      {activeTab === 'candidates' && (
        <>
          {/* ADMIN FORM TAMBAH KANDIDAT */}
          {!isVotingActive && !isFinished && (
            <section className="minimal-card mb-12 p-8 border-dashed border-2">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted mb-8 flex items-center gap-2">
                <UserPlus size={14} /> New Candidate
              </h2>
              <form onSubmit={handleAddCandidate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-muted ml-1">Candidate Name</label>
                  <input 
                    type="text" placeholder="Candidate Name"
                    className="w-full bg-transparent border-b border-border py-2 px-1 text-sm outline-none focus:border-indigo-500 transition-all text-foreground"
                    value={newName} onChange={(e) => setNewName(e.target.value)} required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-muted ml-1">Wallet Address (Testing)</label>
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
                  {adding ? 'SYNCING ON-CHAIN...' : 'REGISTER KANDIDAT ON-CHAIN'}
                </button>
              </form>
            </section>
          )}

          {/* LIST KANDIDAT */}
          <div className="space-y-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted flex items-center gap-2">
              <Activity size={14} /> Registered Candidates
            </h2>
            
            <div className="grid grid-cols-1 gap-3">
              {candidates.map((c) => (
                <div key={c.id} className={`minimal-card flex items-center justify-between p-6 ${c.wallet_address?.toLowerCase() === winner?.toLowerCase() ? 'border-indigo-600 ring-4 ring-indigo-500/10' : ''}`}>
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-muted/10 rounded-xl overflow-hidden flex items-center justify-center border border-border">
                      {c.image_url ? (
                        <img src={c.image_url} className="w-full h-full object-cover" alt={c.name} />
                      ) : (
                        <span className="text-xs font-bold text-muted uppercase tracking-tighter">No IMG</span>
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
        </>
      )}

      {/* TAB 2: DPT (DAFTAR PEMILIH TETAP RUANGAN INI) */}
      {activeTab === 'voters' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* STATS DPT */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-card border border-border">
              <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Total DPT Terdaftar</span>
              <p className="text-3xl font-black text-foreground mt-1">{voters.length}</p>
            </div>
            <div className="p-5 rounded-2xl bg-card border border-border">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Sudah Klaim Tiket SBT</span>
              <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{claimedCount}</p>
            </div>
            <div className="p-5 rounded-2xl bg-card border border-border">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Belum Terhubung</span>
              <p className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">{voters.length - claimedCount}</p>
            </div>
          </div>

          {/* FORM TAMBAH PEMILIH KE DPT DENGAN LABEL & LIMIT DINAMIS */}
          {!isFinished && (
            <section className="minimal-card p-8 border-dashed border-2">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted mb-6 flex items-center gap-2">
                <UserCheck size={14} /> Tambah Mahasiswa ke DPT ({currentLabel})
              </h2>
              <form onSubmit={handleAddVoter} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-muted ml-1">Nama Mahasiswa</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: Budi Santoso"
                    className="w-full bg-transparent border-b border-border py-2 px-1 text-sm outline-none focus:border-indigo-500 transition-all text-foreground"
                    value={newVoterName} 
                    onChange={(e) => setNewVoterName(e.target.value)} 
                    required
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase text-muted ml-1">
                      {currentLabel} Mahasiswa
                    </label>
                    <span className="text-[9px] font-mono text-indigo-600 font-bold">
                      {currentLength} Digit
                    </span>
                  </div>
                  <input 
                    type="text" 
                    placeholder={`Contoh: ${currentLength} Digit ${currentLabel}`}
                    maxLength={currentLength}
                    className="w-full bg-transparent border-b border-border py-2 px-1 text-sm outline-none focus:border-indigo-500 transition-all font-mono text-foreground tracking-wider"
                    value={newVoterId} 
                    onChange={(e) => setNewVoterId(e.target.value.trim())} 
                    required
                  />
                </div>
                <button 
                  type="submit" disabled={addingVoter}
                  className="md:col-span-2 btn-primary py-4 uppercase tracking-[0.2em] text-[10px] font-black"
                >
                  {addingVoter ? 'MENYIMPAN DPT...' : `DAFTARKAN ${currentLabel} KE DPT RUANGAN INI`}
                </button>
              </form>
            </section>
          )}

          {/* DAFTAR MAHASISWA DPT */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted flex items-center gap-2">
              <Users size={14} /> Daftar Mahasiswa Berhak Memilih ({voters.length})
            </h2>

            {voters.length === 0 ? (
              <div className="p-8 text-center text-muted font-mono text-xs border border-border rounded-2xl">
                Belum ada data mahasiswa di DPT ruangan ini. Tambahkan {currentLabel} mahasiswa di atas agar mereka bisa mengklaim tiket SBT.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {voters.map((v) => (
                  <div key={v.id} className="minimal-card flex items-center justify-between p-5">
                    <div>
                      <div className="flex items-center gap-3">
                        <h4 className="font-bold text-foreground text-sm">{v.full_name}</h4>
                        <span className="text-[10px] bg-muted/20 text-muted px-2 py-0.5 rounded font-mono font-bold">
                          {currentLabel}: {v.identifier}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px]">
                        {v.wallet_address ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1 font-bold">
                            <ShieldCheck size={12} /> Terhubung: {v.wallet_address.substring(0, 10)}...{v.wallet_address.substring(34)}
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-mono flex items-center gap-1">
                            <AlertCircle size={12} /> Belum diklaim dompet
                          </span>
                        )}
                      </div>
                    </div>

                    {!isFinished && (
                      <button 
                        onClick={() => handleDeleteVoter(v.id)} 
                        className="p-2 text-muted hover:text-red-500 transition-all"
                        title="Hapus dari DPT"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL EDIT PENGATURAN IDENTITAS SESI (LABEL & DIGIT LIMIT) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-card w-full max-w-lg rounded-[2.5rem] border-2 border-indigo-600 shadow-2xl p-8 relative overflow-hidden">
            <button onClick={() => setShowSettingsModal(false)} className="absolute top-6 right-6 p-2 text-muted hover:text-foreground">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
                <SlidersHorizontal size={22} />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-foreground uppercase">Pengaturan Format Identitas</h2>
                <p className="text-xs text-muted">Sesuaikan kolom identitas dan batas digit untuk ruangan ini.</p>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-muted ml-1">Judul Sesi</label>
                <input 
                  type="text" 
                  className="w-full bg-transparent border-b border-border py-2 px-1 text-sm outline-none focus:border-indigo-500 transition-all text-foreground"
                  value={settingTitle} 
                  onChange={(e) => setSettingTitle(e.target.value)} 
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-muted ml-1">Deskripsi</label>
                <input 
                  type="text" 
                  className="w-full bg-transparent border-b border-border py-2 px-1 text-sm outline-none focus:border-indigo-500 transition-all text-foreground"
                  value={settingDescription} 
                  onChange={(e) => setSettingDescription(e.target.value)} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-muted ml-1">Label Kolom (Bebas)</label>
                  <input 
                    type="text" 
                    placeholder="NPM, NIM, NIK"
                    className="w-full bg-transparent border-b border-border py-2 px-1 text-sm outline-none focus:border-indigo-500 transition-all font-mono font-bold text-foreground uppercase"
                    value={settingIdLabel} 
                    onChange={(e) => setSettingIdLabel(e.target.value.toUpperCase())} 
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-muted ml-1">Batas Digit (Limit)</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={50}
                    className="w-full bg-transparent border-b border-border py-2 px-1 text-sm outline-none focus:border-indigo-500 transition-all font-mono font-bold text-foreground"
                    value={settingIdLength} 
                    onChange={(e) => setSettingIdLength(Number(e.target.value))} 
                    required
                  />
                </div>
              </div>

              <button 
                type="submit" disabled={savingSettings}
                className="w-full btn-primary py-4 uppercase tracking-[0.2em] text-[10px] font-black mt-4"
              >
                {savingSettings ? 'MENYIMPAN...' : 'SIMPAN PENGATURAN SESI'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CANDIDATE MODAL */}
      {editingCandidate && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-card w-full max-w-md rounded-[2rem] border border-border shadow-2xl p-8 relative overflow-hidden">
             <button onClick={() => setEditingCandidate(null)} className="absolute top-6 right-6 p-2 text-muted hover:text-foreground">
               <X size={20} />
             </button>

             <h2 className="text-xl font-black tracking-tight text-foreground mb-8">EDIT CANDIDATE</h2>

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
                <p className="text-[10px] font-bold text-muted uppercase mt-3 tracking-widest">Change Profile Photo</p>
             </div>

             <div className="space-y-6">
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-muted ml-1">Candidate Name</label>
                   <input 
                     type="text" className="w-full bg-transparent border-b border-border py-2 px-1 text-lg outline-none focus:border-indigo-500 transition-all text-foreground"
                     value={editName} onChange={(e) => setEditName(e.target.value)}
                   />
                </div>
                
                <button 
                  onClick={handleUpdateCandidate} disabled={uploading}
                  className="w-full btn-primary py-4 uppercase tracking-[0.2em] text-[10px] font-black mt-4"
                >
                  {uploading ? 'PROCESSING...' : 'SAVE CHANGES'}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
