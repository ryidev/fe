"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getEvotingContract } from '@/lib/evotingContract';
import { useToast } from '@/app/components/ToastProvider';
import { Plus, Settings, Link as LinkIcon, Layers, ShieldCheck, Lock, Fingerprint, Sparkles } from "lucide-react";

export default function AdminDashboard() {
  const router = useRouter();
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [enforceAge, setEnforceAge] = useState(false);
  const [idLabel, setIdLabel] = useState('NPM');
  const [idLength, setIdLength] = useState(8);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        if (typeof window !== 'undefined' && (window as any).ethereum) {
          const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            const contract = await getEvotingContract();
            const ownerAddr = (await contract.owner()).toLowerCase();
            const currentAddr = accounts[0].toLowerCase();
            
            if (currentAddr === ownerAddr) {
              setIsOwner(true);
              const { data } = await supabase.from('voting_sessions').select('*').order('created_at', { ascending: false });
              setSessions(data || []);
            } else {
              router.push('/');
            }
          } else {
            router.push('/');
          }
        }
      } catch (err) {
        console.error(err);
        router.push('/');
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const setPreset = (label: string, length: number) => {
    setIdLabel(label);
    setIdLength(length);
  };

  const createSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleanLabel = idLabel.trim() || 'NPM';
      const cleanLength = Number(idLength) > 0 ? Number(idLength) : 8;

      const { data, error } = await supabase
        .from('voting_sessions')
        .insert([{ 
          title, 
          description, 
          status: 'active', 
          require_nik: true,
          enforce_age: enforceAge,
          id_label: cleanLabel,
          id_length: cleanLength
        }])
        .select().single();
      
      if (error) throw error;
      setSessions([data, ...sessions]);
      setTitle('');
      setDescription('');
      setIdLabel('NPM');
      setIdLength(8);
      setEnforceAge(false);
      showToast(`Ruang voting "${data.title}" berhasil dibuat dengan format ${cleanLabel} (${cleanLength} digit)!`, 'success');
    } catch (err: any) { 
      console.error(err);
      showToast(err.message || 'Gagal membuat forum', 'error');
    }
  };

  const copyToClipboard = (id: number) => {
    const url = `${window.location.origin}/vote/${id}`;
    navigator.clipboard.writeText(url);
    showToast('Tautan voting web berhasil disalin!', 'success');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted font-mono text-[10px] uppercase tracking-widest">Memeriksa Hak Akses Owner...</div>;

  if (!isOwner) return null;

  return (
    <div className="max-w-4xl mx-auto pt-24 px-8 pb-32">
      <div className="flex items-center justify-between mb-12">
        <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
          <Lock size={28} className="text-indigo-600" /> ADMIN DASHBOARD
        </h1>
      </div>
      
      {/* FORM BUAT SESI BARU DENGAN FORMAT IDENTITAS DINAMIS */}
      <section className="minimal-card mb-16 p-8 border-foreground border-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted mb-8 flex items-center gap-2">
          <Plus size={16} /> Buat Ruang Voting Baru
        </h2>
        <form onSubmit={createSession} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted ml-1">Judul Sesi Pemilihan</label>
            <input 
              type="text" 
              placeholder="Contoh: Pemilihan Ketua Himpunan Informatika 2026" 
              className="w-full bg-transparent border-b border-border py-3 px-1 text-lg outline-none focus:border-indigo-500 transition-all text-foreground" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              required 
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted ml-1">Deskripsi / Konteks</label>
            <input 
              placeholder="Contoh: Pemilu mahasiswa angkatan 2023-2025..." 
              className="w-full bg-transparent border-b border-border py-3 px-1 text-sm outline-none focus:border-indigo-500 transition-all text-foreground" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
            />
          </div>

          {/* KONFIGURASI IDENTIFIER & LIMIT DIGIT DINAMIS */}
          <div className="p-6 bg-muted/5 rounded-2xl border border-border space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fingerprint size={18} className="text-indigo-600" />
                <span className="text-xs font-black uppercase tracking-wider text-foreground">
                  Format Kolom Identitas Pemilih (Dinamis)
                </span>
              </div>
              <span className="text-[10px] font-mono bg-indigo-600/10 text-indigo-600 px-2 py-0.5 rounded font-bold">
                {idLabel} ({idLength} Digit)
              </span>
            </div>

            {/* PRESET CEPAT: NPM, NIM, NIK, CUSTOM */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-muted">Pilih Template Identitas:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setPreset('NPM', 8)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all border ${
                    idLabel === 'NPM' && idLength === 8
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                      : 'bg-muted/10 text-muted border-border hover:text-foreground'
                  }`}
                >
                  NPM (8 Digit)
                </button>
                <button
                  type="button"
                  onClick={() => setPreset('NIM', 10)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all border ${
                    idLabel === 'NIM' && idLength === 10
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                      : 'bg-muted/10 text-muted border-border hover:text-foreground'
                  }`}
                >
                  NIM (10 Digit)
                </button>
                <button
                  type="button"
                  onClick={() => setPreset('NIK', 16)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all border ${
                    idLabel === 'NIK' && idLength === 16
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                      : 'bg-muted/10 text-muted border-border hover:text-foreground'
                  }`}
                >
                  NIK (16 Digit)
                </button>
                <button
                  type="button"
                  onClick={() => setPreset('NISN', 10)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all border ${
                    idLabel === 'NISN' && idLength === 10
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                      : 'bg-muted/10 text-muted border-border hover:text-foreground'
                  }`}
                >
                  NISN (10 Digit)
                </button>
              </div>
            </div>

            {/* CUSTOM INPUT LABEL & DIGIT LIMIT */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-muted ml-1">
                  Nama Label Identitas (Bebas)
                </label>
                <input 
                  type="text" 
                  placeholder="Misal: NPM, NIM, NIK, ID Karyawan" 
                  className="w-full bg-transparent border-b border-border py-2 px-1 text-sm outline-none focus:border-indigo-500 transition-all font-mono text-foreground font-bold" 
                  value={idLabel} 
                  onChange={(e) => setIdLabel(e.target.value.toUpperCase())} 
                  required 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-muted ml-1">
                  Batas Panjang Digit / Karakter (Limit)
                </label>
                <input 
                  type="number" 
                  min={1} 
                  max={50} 
                  placeholder="Contoh: 8, 10, 16"
                  className="w-full bg-transparent border-b border-border py-2 px-1 text-sm outline-none focus:border-indigo-500 transition-all font-mono text-foreground font-bold" 
                  value={idLength} 
                  onChange={(e) => setIdLength(Number(e.target.value))} 
                  required 
                />
              </div>
            </div>

            {/* OPSIONAL: USIA 17+ */}
            <div className="flex items-center justify-between pt-3 border-t border-border/50">
              <div>
                <p className="text-xs font-bold text-foreground">Wajibkan Usia 17+ (Opsional)</p>
                <p className="text-[10px] text-muted">Hanya aktifkan jika pemilu mensyaratkan verifikasi tanggal lahir.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={enforceAge} 
                  onChange={(e) => setEnforceAge(e.target.checked)} 
                />
                <div className="w-11 h-6 bg-muted/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          <button type="submit" className="w-full btn-primary py-4 mt-4 uppercase tracking-[0.2em] text-xs font-black">
            BUAT RUANG VOTING & AKTIFKAN DPT
          </button>
        </form>
      </section>

      {/* LIST RUANG VOTING YANG SUDAH ADA */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">Ruang Voting Terdaftar ({sessions.length})</h2>
        {sessions.map((s) => (
          <div key={s.id} className="minimal-card flex items-center justify-between group p-6">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-muted/10 rounded-2xl flex items-center justify-center text-muted group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <Layers size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-foreground">{s.title}</h3>
                  <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 px-2 py-0.5 rounded font-mono font-black">
                    {s.id_label || 'NPM'} ({s.id_length || 8} Digit)
                  </span>
                </div>
                <p className="text-xs text-muted font-mono uppercase mt-1">ID: #{s.id} | Status: {s.status}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => copyToClipboard(s.id)} 
                className="p-3 rounded-xl hover:bg-muted/10 text-muted hover:text-foreground transition-all"
                title="Salin Tautan Voting"
              >
                <LinkIcon size={18} />
              </button>
              <a 
                href={`/admin/${s.id}`} 
                className="p-3 rounded-xl hover:bg-muted/10 text-muted hover:text-foreground transition-all"
                title="Kelola Sesi & DPT"
              >
                <Settings size={18} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
