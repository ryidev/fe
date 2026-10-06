"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import SbtBadge from '@/app/components/SbtBadge';
import { getEvotingContract, CONTRACT_ADDRESS, EIP712_DOMAIN, EIP712_TYPES } from '@/lib/evotingContract';
import { lookupVoterInSession, linkWalletToVoter, SessionVoter } from '@/app/supabase-voters';
import { ethers } from 'ethers';
import { useToast } from '@/app/components/ToastProvider';
import { 
  CheckCircle2, TrendingUp, Info, Trophy, ShieldAlert, Fingerprint, 
  X, AlertCircle, Smartphone, Check, UserCheck, Search 
} from "lucide-react";

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
  const [isOwner, setIsOwner] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [npmInput, setNpmInput] = useState('');
  const [showAppBanner, setShowAppBanner] = useState(true);
  const [hasVoted, setHasVoted] = useState(false);

  // --- MODAL KONFIRMASI NAMA MAHASISWA ---
  const [foundVoter, setFoundVoter] = useState<SessionVoter | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [linking, setLinking] = useState(false);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);

  // --- STATE SBT (SOULBOUND TOKEN) ---
  const [hasSbtTicket, setHasSbtTicket] = useState(false);
  const [sbtTokenId, setSbtTokenId] = useState<string | null>(null);
  const [isSbtUsed, setIsSbtUsed] = useState(false);
  const [isMintingSbt, setIsMintingSbt] = useState(false);

  // --- STATE INLINE ALERT DPT & RATE LIMITING (3X KESALAHAN) ---
  const [dptAlert, setDptAlert] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockCountdown, setLockCountdown] = useState(0);

  // Timer countdown untuk lockout keamanan 60 detik jika gagal 3x
  useEffect(() => {
    if (lockCountdown > 0) {
      const timer = setTimeout(() => {
        setLockCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (isLocked) {
      setIsLocked(false);
      setFailedAttempts(0);
      setDptAlert(null);
    }
  }, [lockCountdown, isLocked]);

  const recordFailedAttempt = (customMsg: string) => {
    const nextAttempts = failedAttempts + 1;
    setFailedAttempts(nextAttempts);
    if (nextAttempts >= 3) {
      setIsLocked(true);
      setLockCountdown(60);
      const lockMsg = `Akses Dikunci Demi Keamanan (3/3 Kesalahan)! Anda telah 3 kali salah memasukkan data DPT. Silakan tunggu 60 detik atau hubungi panitia admin.`;
      setDptAlert(lockMsg);
      showToast(lockMsg, 'error');
    } else {
      const remaining = 3 - nextAttempts;
      const warningMsg = `${customMsg} (Percobaan gagal: ${nextAttempts}/3 — Sisa: ${remaining}x lagi)`;
      setDptAlert(warningMsg);
      showToast(warningMsg, 'error');
    }
  };

  const { showToast } = useToast();

  async function checkSbtTicket(wallet: string): Promise<boolean> {
    if (!wallet || !id) return false;
    try {
      const contract = await getEvotingContract();
      const [hasTicket, tokenId, isUsed] = await contract.checkVoterTicket(wallet, BigInt(id as string));
      const has = Boolean(hasTicket);
      setHasSbtTicket(has);
      setSbtTokenId(has ? tokenId.toString() : null);
      setIsSbtUsed(Boolean(isUsed));
      if (isUsed) {
        setHasVoted(true);
      }
      return has;
    } catch (e) {
      console.warn('Failed to check voter SBT ticket', e);
      return false;
    }
  }

  // Menerbitkan / mencetak tiket SBT resmi on-chain via backend relayer (0 ETH)
  // Menerbitkan / mencetak tiket SBT resmi on-chain via backend relayer (0 ETH)
  const handleMintSbtTicket = async (targetWallet?: string) => {
    const activeW = (targetWallet || userWallet)?.toLowerCase();
    if (!activeW || !id) return;
    setIsMintingSbt(true);
    try {
      const res = await fetch('/api/mint-sbt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          voterAddress: activeW, 
          sessionId: id
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(`Tiket SBT resmi berhasil diterbitkan untuk ${verifiedName || 'Anda'}! 🛡️🎫`, 'success');
      await checkSbtTicket(activeW);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsMintingSbt(false);
    }
  };

  // Cek apakah wallet sudah terdaftar di DPT sesi ini
  async function checkWalletInSession(wallet: string) {
    if (!wallet || !id) return;
    setVerifying(true);
    try {
      const cleanW = wallet.trim().toLowerCase();
      const { data } = await supabase
        .from('session_voters')
        .select('*')
        .eq('session_id', Number(id))
        .ilike('wallet_address', cleanW)
        .maybeSingle();

      const hasTicket = await checkSbtTicket(wallet);

      if (data) {
        setIsVerified(true);
        setVerifiedName(data.full_name);
        setDptAlert(null);
        setFailedAttempts(0);
        // Jika terdaftar di DPT tapi smart contract belum mencetak tiket (misal Hardhat baru dideploy ulang),
        // otomatis cetak tiket SBT resmi on-chain (0 ETH)
        if (!hasTicket) {
          handleMintSbtTicket(wallet);
        }
      } else if (hasTicket) {
        setIsVerified(true);
        setDptAlert(null);
        setFailedAttempts(0);
      } else {
        setIsVerified(false);
        setVerifiedName(null);
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
      setHasVoted(Boolean(voted));
    } catch (e) {
      console.warn('Failed to check if user has voted', e);
      setHasVoted(false);
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const handleAccountsChanged = async (accounts: string[]) => {
        if (accounts.length > 0) {
          const wallet = accounts[0].toLowerCase();
          setUserWallet(wallet);
          // Reset form input & alerts saat ganti akun
          setDptAlert(null);
          setFailedAttempts(0);
          setIsLocked(false);
          setLockCountdown(0);
          setNpmInput('');
          setFoundVoter(null);
          setShowConfirmModal(false);
          try {
            const contract = await getEvotingContract();
            const ownerAddr = (await contract.owner()).toLowerCase();
            setIsOwner(wallet === ownerAddr);
          } catch (e) {}
          await checkWalletInSession(wallet);
          await checkUserVoted(wallet);
          await checkSbtTicket(wallet);
          showToast(`Akun berganti: ${wallet.substring(0, 6)}...${wallet.substring(38)}`, 'info');
        } else {
          setUserWallet(null);
          setIsVerified(false);
          setHasVoted(false);
          setHasSbtTicket(false);
        }
      };
      (window as any).ethereum.on('accountsChanged', handleAccountsChanged);
      return () => (window as any).ethereum.removeListener('accountsChanged', handleAccountsChanged);
    }
  }, [id]);

  async function fetchBlockchainData() {
    try {
      const contract = await getEvotingContract();
      const active = await contract.sudahBisaVoting();
      setIsVotingActive(active);

      try {
        const ownerAddr = (await contract.owner()).toLowerCase();
        if (userWallet) setIsOwner(userWallet.toLowerCase() === ownerAddr);
      } catch (e) {}

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
          setHasVoted(Boolean(voted));
          await checkSbtTicket(userWallet);
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
      await fetchBlockchainData();
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          const wallet = accounts[0].toLowerCase();
          setUserWallet(wallet);
          try {
            const contract = await getEvotingContract();
            const ownerAddr = (await contract.owner()).toLowerCase();
            setIsOwner(wallet === ownerAddr);
          } catch (e) {}
          await checkWalletInSession(wallet);
          await checkUserVoted(wallet);
          await checkSbtTicket(wallet);
        }
      }
      setLoading(false);
    }
    init();

    // Polling cepat setiap 2 detik untuk hasil voting real-time
    const interval = setInterval(fetchBlockchainData, 2000);

    // Event listener smart contract on-chain untuk update instan begitu ada transaksi coblos
    let cleanupContract: any = null;
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      getEvotingContract().then(contract => {
        const onBallotConsumed = () => {
          fetchBlockchainData();
        };
        contract.on('BallotConsumed', onBallotConsumed);
        cleanupContract = () => contract.off('BallotConsumed', onBallotConsumed);
      }).catch(() => {});
    }

    return () => {
      clearInterval(interval);
      if (cleanupContract) cleanupContract();
    };
  }, [id]);

  // --- STEP 1: CARI IDENTITAS (NPM/NIK/NIM) DI DPT RUANGAN INI ---
  const handleSearchNpm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      showToast(`Akses masih terkunci demi keamanan. Silakan tunggu ${lockCountdown} detik.`, 'error');
      return;
    }

    const idLabel = session?.id_label || 'NPM';
    const idLength = Number(session?.id_length) || 0;
    const inputVal = npmInput.trim();

    // Dapatkan alamat dompet aktif secara pasti dari window.ethereum jika state belum ready
    let activeWallet = userWallet;
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const accs = await (window as any).ethereum.request({ method: 'eth_accounts' });
        if (accs && accs.length > 0) {
          activeWallet = accs[0].toLowerCase();
          setUserWallet(activeWallet);
        }
      } catch (e) {}
    }

    if (!activeWallet) return showToast("Hubungkan wallet MetaMask terlebih dahulu", 'error');
    if (!inputVal) return showToast(`Masukkan ${idLabel} Anda`, 'error');

    // Validasi batasan digit/karakter sesuai konfigurasi admin sesi
    if (idLength > 0 && inputVal.length !== idLength) {
      const msg = `${idLabel} harus terdiri dari ${idLength} digit/karakter!`;
      recordFailedAttempt(msg);
      return;
    }

    setVerifying(true);
    try {
      // 1. CARI TARGET ID DI DPT RUANGAN INI TERLEBIH DAHULU
      const targetVoter = await lookupVoterInSession(Number(id), inputVal);

      // Kasus A: ID TIDAK DITEMUKAN DI DPT
      if (!targetVoter) {
        const msg = `${idLabel} "${inputVal}" tidak terdaftar dalam Daftar Pemilih Tetap (DPT) ruangan ini!`;
        recordFailedAttempt(msg);
        return;
      }

      // Kasus B: ID SUDAH TERHUBUNG KE DOMPET
      if (targetVoter.wallet_address) {
        if (targetVoter.wallet_address.toLowerCase() === activeWallet.toLowerCase()) {
          // INI ID MILIK DOMPET INI SENDIRI! Langsung buka bilik voting
          setIsVerified(true);
          setVerifiedName(targetVoter.full_name);
          setDptAlert(null);
          setFailedAttempts(0);
          showToast(`Selamat datang kembali, ${targetVoter.full_name}! Anda sudah terdaftar di sesi ini.`, 'success');
          await checkSbtTicket(activeWallet);
          return;
        } else {
          // ID ini sudah diklaim oleh dompet lain
          const shortAddr = `${targetVoter.wallet_address.substring(0, 6)}...${targetVoter.wallet_address.substring(38)}`;
          const msg = `${idLabel} "${inputVal}" ini sudah diklaim oleh dompet lain (${shortAddr})!`;
          recordFailedAttempt(msg);
          return;
        }
      }

      // Kasus C: ID BELUM DIKLAIM (wallet_address: null)
      // CEK KEAMANAN ANTI-HIJACK: Apakah dompet aktif ini SUDAH PERNAH klaim identitas LAIN di sesi ini?
      const { data: myExistingVoter } = await supabase
        .from('session_voters')
        .select('*')
        .eq('session_id', Number(id))
        .ilike('wallet_address', activeWallet.toLowerCase())
        .maybeSingle();

      if (myExistingVoter) {
        const msg = `Anda sudah mengambil tiket SBT untuk sesi ini sebagai "${myExistingVoter.full_name}" (${idLabel}: ${myExistingVoter.identifier}). Anda tidak dapat menggunakan ID lain!`;
        recordFailedAttempt(msg);
        return;
      }

      // Cek apakah dompet ini sudah memiliki tiket on-chain untuk sesi ini
      const hasOnChain = await checkSbtTicket(activeWallet);
      if (hasOnChain) {
        const msg = `Dompet Anda sudah memegang tiket SBT resmi untuk sesi voting ini! Anda tidak dapat mengklaim identitas lain.`;
        recordFailedAttempt(msg);
        return;
      }

      // Kasus D: VALID & BELUM DIKLAIM -> BUKA MODAL KONFIRMASI NAMA PEMILIH
      setDptAlert(null);
      setFailedAttempts(0);
      setFoundVoter(targetVoter);
      setShowConfirmModal(true);
    } catch (err: any) {
      recordFailedAttempt(err.message);
    } finally {
      setVerifying(false);
    }
  };

  // --- STEP 2: USER MENGONFIRMASI "YA, SAYA USER.NAMA" ---
  const handleConfirmIdentity = async () => {
    if (!foundVoter || !userWallet) return;
    setLinking(true);
    try {
      // 1. Tautkan wallet ke record voter di DPT ruangan ini
      await linkWalletToVoter(Number(id), foundVoter.identifier, userWallet);

      // 2. Minta backend relayer mencetak token SBT secara gratis (0 ETH)
      const res = await fetch('/api/mint-sbt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          voterAddress: userWallet, 
          sessionId: id,
          identifier: foundVoter.identifier
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(`Selamat datang, ${foundVoter.full_name}! Tiket SBT resmi berhasil diterbitkan (0 ETH)! 🛡️🎫`, 'success');
      
      setIsVerified(true);
      setVerifiedName(foundVoter.full_name);
      setShowConfirmModal(false);
      await checkSbtTicket(userWallet);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLinking(false);
    }
  };

  // --- GASLESS SOULBOUND TOKEN VOTE (EIP-712 / 0 ETH GAS FEE) ---
  const handleVote = async (index: number) => {
    if (!isVerified) return showToast("Verifikasi identitas NPM terlebih dahulu", 'error');
    if (session?.status === 'finished' || !isVotingActive) return showToast("Sesi voting sedang tidak aktif", 'error');
    if (isOwner) return showToast("Owner kontrak tidak diperbolehkan melakukan voting! Silakan ganti akun pemilih.", 'error');

    if (!hasSbtTicket) {
      showToast("Anda belum memegang tiket SBT resmi.", 'error');
      return;
    }

    if (isSbtUsed || hasVoted) {
      return showToast("Tiket SBT Anda sudah pernah digunakan untuk mencoblos!", 'error');
    }
    
    setVoting(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const voterAddress = await signer.getAddress();
      const network = await provider.getNetwork();

      const contract = await getEvotingContract();
      const nonce = await contract.nonces(voterAddress);
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 jam

      const domain = EIP712_DOMAIN(CONTRACT_ADDRESS, Number(network.chainId));
      const value = {
        candidateIndex: BigInt(index),
        sessionId: BigInt(id as string),
        voter: voterAddress,
        nonce: BigInt(nonce),
        deadline: BigInt(deadline),
      };

      showToast("Silakan klik 'Sign / Tanda Tangan' di MetaMask (Gratis 0 ETH)...", 'info');
      const signature = await signer.signTypedData(domain, EIP712_TYPES, value);

      const res = await fetch('/api/relay-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateIndex: index,
          sessionId: id,
          voterAddress,
          deadline,
          signature,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast("Berhasil mencoblos dengan Tiket SBT (0 ETH Bebas Gas)! 🗳✨", 'success');
      // Update optimistik instan agar angka coblos langsung bertambah di UI tanpa jeda
      setCandidates((prev) => prev.map((c) => 
        c.blockchainIndex === index 
          ? { ...c, votes: c.votes + 1 } 
          : c
      ));
      setHasVoted(true);
      setIsSbtUsed(true);
      await fetchBlockchainData();
      await checkSbtTicket(voterAddress);
    } catch (err: any) { 
      console.error("Voting error:", err);
      const errorMessage = err.reason || err.shortMessage || err.message || "Gagal mencoblos";
      showToast(errorMessage, 'error'); 
    } finally { 
      setVoting(false); 
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted font-mono text-[10px] uppercase tracking-[0.3em]">Syncing Node...</div>;

  const isFinished = session?.status === 'finished';
  const winnerCandidate = candidates.find(c => c.wallet_address?.toLowerCase() === session?.winner_address?.toLowerCase());
  const showVerificationGate = !isVerified && !hasSbtTicket && !isFinished;

  return (
    <div className="max-w-6xl mx-auto pt-24 px-8 pb-32">
      {showAppBanner && (
        <div className="mb-10 p-5 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/5 border border-indigo-500/20 backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shrink-0">
              <Smartphone size={24} />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-foreground">Buka di Aplikasi VoteDecen (Android)</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Dapatkan pengalaman memilih Gasless SBT yang lebih lancar dan terintegrasi langsung dengan dompet MetaMask Anda di smartphone.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              onClick={() => setShowAppBanner(false)}
              className="p-3 text-muted-foreground hover:text-foreground hover:bg-muted/10 rounded-xl transition-all"
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
      
      <header className="mb-12 text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className={`w-2 h-2 rounded-full ${isFinished ? 'bg-muted' : isVotingActive ? 'bg-indigo-600 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">{isFinished ? 'Archived Session' : isVotingActive ? 'Live Voting' : 'Session Paused'}</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight text-foreground uppercase italic mb-4">{session?.title}</h1>
        
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/30 rounded-full mb-6">
          <ShieldAlert size={12} className="text-indigo-600" />
          <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">DPT Whitelist & Tiket SBT Required</span>
        </div>
        <p className="text-muted-foreground max-w-xl mx-auto font-medium leading-relaxed">{session?.description}</p>
      </header>

      {/* TAMPILAN TIKET SOULBOUND TOKEN (SBT) JIKA PEMILIH SUDAH TERVERIFIKASI */}
      {!showVerificationGate && !isFinished && (
        <div className="max-w-2xl mx-auto mb-12 space-y-3">
          {verifiedName && (
            <div className="px-4 py-2 bg-indigo-600/10 border border-indigo-500/20 rounded-xl flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Pemilih Terverifikasi: <strong className="text-foreground">{verifiedName}</strong></span>
              <span className="text-indigo-600 dark:text-indigo-400 font-bold font-mono text-[10px]">DPT Terdaftar ✓</span>
            </div>
          )}
          <SbtBadge
            hasTicket={hasSbtTicket}
            tokenId={sbtTokenId}
            isUsed={isSbtUsed || hasVoted}
            isMinting={isMintingSbt}
            onClaim={!hasSbtTicket && isVerified ? handleMintSbtTicket : undefined}
          />
        </div>
      )}

      {/* GATE VERIFIKASI IDENTITAS DPT (JIKA BELUM TERHUBUNG) */}
      {showVerificationGate ? (
        <section className="max-w-md mx-auto mb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
           <div className="minimal-card p-10 border-2 border-indigo-600 shadow-2xl shadow-indigo-500/10">
              <div className="flex flex-col items-center text-center mb-8">
                 <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-xl shadow-indigo-600/30">
                   {verifying ? <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" /> : <Fingerprint size={32} />}
                 </div>
                 <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">Klaim Hak Suara SBT</h2>
                 <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                   Masukkan {session?.id_label || 'NPM'} Anda untuk mencocokkan data pada Daftar Pemilih Tetap (DPT) ruangan ini.
                 </p>
              </div>

              <form onSubmit={handleSearchNpm} className="space-y-6">
                 <div className="space-y-1">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-[10px] font-black text-muted-foreground uppercase">
                        Nomor Identitas ({session?.id_label || 'NPM'})
                      </label>
                      {session?.id_length && Number(session.id_length) > 0 && (
                        <span className="text-[9px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          Wajib {session.id_length} Digit
                        </span>
                      )}
                    </div>
                    <input 
                      type="text" 
                      disabled={verifying || isLocked}
                      placeholder={isLocked ? `Akses Dikunci (${lockCountdown}s)` : `Masukkan ${session?.id_length ? `${session.id_length} digit ` : ''}${session?.id_label || 'NPM'}`} 
                      maxLength={session?.id_length ? Number(session.id_length) : undefined}
                      className="w-full bg-transparent border-b border-border py-3 px-1 text-lg outline-none focus:border-indigo-500 transition-all font-mono text-foreground tracking-wider uppercase disabled:opacity-40 disabled:cursor-not-allowed" 
                      value={npmInput} 
                      onChange={(e) => {
                        setNpmInput(e.target.value);
                        if (dptAlert) setDptAlert(null);
                      }} 
                      required 
                      autoFocus
                    />
                 </div>

                 {/* PROPER INLINE ALERT BANNER JIKA IDENTITAS TIDAK DITEMUKAN ATAU TERKUNCI */}
                 {dptAlert && (
                   <div 
                     role="alert"
                     className={`p-4 rounded-2xl border-2 shadow-xl flex items-start gap-3.5 animate-in fade-in slide-in-from-top-2 duration-200 ${
                       isLocked 
                         ? 'bg-red-950 border-red-500 shadow-red-950/80 ring-2 ring-red-500/50' 
                         : 'bg-rose-950/90 border-rose-500 shadow-rose-950/60'
                     }`}
                   >
                     <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/40 shrink-0 mt-0.5">
                       <AlertCircle size={20} />
                     </div>
                     <div className="flex-1 min-w-0">
                       <p className="text-[10px] font-black uppercase tracking-widest text-rose-400 mb-1">
                         {isLocked ? `AKSES DIKUNCI (${lockCountdown} DETIK)` : 'PERINGATAN SISTEM DPT'}
                       </p>
                       <p className="text-xs font-bold leading-relaxed text-white break-words">
                         {dptAlert}
                       </p>
                       <p className="text-[10px] text-rose-200/80 mt-1 font-medium">
                         {isLocked 
                           ? 'Sistem mendeteksi 3x kesalahan input berturut-turut demi melindungi akun pemilih.' 
                           : 'Maksimal 3 kali kesalahan input sebelum akses dikunci otomatis.'}
                       </p>
                     </div>
                   </div>
                 )}

                 <button 
                   type="submit" 
                   disabled={verifying || isLocked} 
                   className="w-full btn-primary py-4 mt-4 uppercase tracking-[0.2em] text-[10px] font-black shadow-xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                 >
                   {isLocked ? (
                     <span>AKSES DIKUNCI SEMENTARA ({lockCountdown}S)</span>
                   ) : verifying ? (
                     'MENGECEK DPT...'
                   ) : (
                     <>
                       <Search size={14} />
                       <span>CARI & VERIFIKASI {session?.id_label?.toUpperCase() || 'NPM'}</span>
                     </>
                   )}
                 </button>
              </form>
           </div>
        </section>
      ) : (
        <>
          {isFinished && winnerCandidate && (
            <section className="mb-16 p-6 md:p-8 rounded-3xl bg-white dark:bg-zinc-900 border-2 border-indigo-600 shadow-xl flex items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute -top-6 -left-6 opacity-[0.03] text-indigo-900"><Trophy size={150} /></div>
              <div className="relative z-10 flex flex-col">
                <div className="flex items-center gap-2 mb-2"><Trophy size={12} className="text-indigo-600" /><h2 className="text-[9px] font-black tracking-[0.4em] uppercase text-indigo-600">Official Winner Declared</h2></div>
                <div className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic text-foreground leading-none mb-2">{winnerCandidate.name}</div>
                <p className="text-[9px] font-mono text-muted-foreground break-all">{winnerCandidate.wallet_address}</p>
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
                  {isFinished && <div className={`absolute top-0 left-0 px-4 py-2 rounded-br-2xl text-[10px] font-black tracking-widest uppercase ${idx === 0 ? 'bg-indigo-600 text-white' : 'bg-muted/10 text-muted-foreground'}`}>RANK #{idx + 1}</div>}
                  <div className="mt-4">
                    <div className="flex justify-between items-start mb-10">
                      <div className="w-16 h-16 bg-muted/5 rounded-[1.25rem] overflow-hidden border border-border"><img src={candidate.image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${candidate.name}`} className="w-full h-full object-cover" alt={candidate.name} /></div>
                      <div className="text-right"><div className="text-3xl font-black text-foreground tracking-tighter leading-none">{candidate.votes}</div><div className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mt-1">Votes Cast</div></div>
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-1">{candidate.name}</h3>
                    <p className="text-[10px] font-mono text-muted-foreground tracking-tighter truncate opacity-80 mb-8 uppercase">{candidate.wallet_address?.substring(0, 18)}...</p>
                  </div>
                   <button 
                    onClick={() => {
                      if (!hasSbtTicket && isVerified) {
                        handleMintSbtTicket();
                      } else {
                        handleVote(candidate.blockchainIndex);
                      }
                    }} 
                    disabled={voting || !isVotingActive || isFinished || candidate.blockchainIndex === -1 || hasVoted || isSbtUsed || isOwner || isMintingSbt} 
                    className={`w-full py-4 rounded-xl font-black tracking-[0.2em] text-[10px] transition-all ${
                      isWinner 
                        ? 'bg-indigo-600 text-white' 
                        : (!hasSbtTicket && isVerified)
                        ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30 ring-2 ring-amber-400'
                        : 'bg-muted/10 text-foreground border border-border'
                    } hover:bg-indigo-600 hover:text-white disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed`}
                  >
                    {isFinished ? 'SESSION ARCHIVED' 
                      : voting ? 'SIGNING & RELAYING...' 
                      : isMintingSbt ? 'MENERBITKAN TIKET SBT...'
                      : candidate.blockchainIndex === -1 ? 'NOT SYNCED ON-CHAIN' 
                      : isOwner ? 'OWNER TIDAK BISA VOTING'
                      : (hasVoted || isSbtUsed) ? 'TIKET SBT TELAH TERPAKAI' 
                      : (!hasSbtTicket && isVerified) ? '⚡ KLAIM TIKET SBT SEKARANG (0 ETH)'
                      : !hasSbtTicket ? 'KLAIM TIKET SBT DAHULU'
                      : isVotingActive ? 'COBLOS DENGAN SBT (0 ETH)' 
                      : 'PAUSED'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* MODAL KONFIRMASI NAMA PEMILIH ("Apakah Anda benar [Nama]?") */}
      {showConfirmModal && foundVoter && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md rounded-[2.5rem] border-2 border-indigo-600 shadow-2xl p-8 relative overflow-hidden">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center mb-5">
                <UserCheck size={36} />
              </div>

              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-1">
                Data DPT Ditemukan
              </span>
              <h3 className="text-xl font-black text-foreground">
                Apakah Anda benar:
              </h3>
              
              <div className="my-6 p-5 w-full rounded-2xl bg-muted/10 border border-border">
                <p className="text-2xl font-black text-foreground tracking-tight">
                  {foundVoter.full_name}
                </p>
                <p className="text-xs font-mono text-muted-foreground mt-1">
                  {session?.id_label || 'NPM'}: <strong className="text-foreground">{foundVoter.identifier}</strong>
                </p>
                {userWallet && (
                  <p className="text-[9px] font-mono text-muted-foreground mt-3 pt-3 border-t border-border/50 truncate">
                    Dompet: {userWallet}
                  </p>
                )}
              </div>

              <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
                Jika dikonfirmasi, dompet Anda akan dikunci ke identitas ini dan Anda akan langsung menerima <strong>1 Tiket Soulbound (SBT)</strong> resmi untuk sesi ini secara bebas biaya gas (0 ETH).
              </p>

              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={handleConfirmIdentity}
                  disabled={linking}
                  className="w-full btn-primary py-4 uppercase tracking-[0.2em] text-[10px] font-black shadow-xl flex items-center justify-center gap-2"
                >
                  {linking ? 'MENERBITKAN TIKET SBT...' : (
                    <>
                      <Check size={16} />
                      <span>YA, SAYA {foundVoter.full_name.split(' ')[0].toUpperCase()}</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  disabled={linking}
                  className="w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  Bukan Saya (Ganti {session?.id_label || 'NPM'})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-24 flex flex-col md:flex-row items-center justify-between gap-8 py-12 border-t border-border">
        <div className="flex items-center gap-4 text-muted-foreground"><Info size={16} /><span className="text-[10px] font-bold uppercase tracking-widest">Powered by ERC-5192 Soulbound Token & EIP-712 Meta-Transactions</span></div>
        <div className="flex items-center gap-2 text-muted-foreground"><TrendingUp size={16} /><span className="text-[10px] font-bold uppercase tracking-widest">Gasless Voting Enabled (0 ETH)</span></div>
      </footer>
    </div>
  );
}
