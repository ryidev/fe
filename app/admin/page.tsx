"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getEvotingContract } from '@/lib/evotingContract';
import { useToast } from '@/app/components/ToastProvider';
import { Plus, Settings, Link as LinkIcon, Layers, ShieldCheck, Lock } from "lucide-react";

export default function AdminDashboard() {
  const router = useRouter();
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requireNik, setRequireNik] = useState(false);
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
              // BUKAN OWNER -> KELUARKAN
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

  const createSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('voting_sessions')
        .insert([{ title, description, status: 'active', require_nik: requireNik }])
        .select().single();
      
      if (error) throw error;
      setSessions([data, ...sessions]);
      setTitle('');
      setDescription('');
      setRequireNik(false);
    } catch (err) { console.error(err); }
  };

  const copyToClipboard = (id: number) => {
    const url = `${window.location.origin}/vote/${id}`;
    navigator.clipboard.writeText(url);
    showToast('Voting link copied!', 'success');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted font-mono text-[10px] uppercase tracking-widest">Verifying_Owner_Privileges...</div>;

  if (!isOwner) return null;

  return (
    <div className="max-w-4xl mx-auto pt-24 px-8 pb-32">
      <div className="flex items-center justify-between mb-12">
        <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
          <Lock size={28} className="text-indigo-600" /> ADMIN_DASHBOARD
        </h1>
      </div>
      
      <section className="minimal-card mb-16 p-8 border-foreground border-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted mb-8 flex items-center gap-2"><Plus size={14} /> Initialize_New_Forum</h2>
        <form onSubmit={createSession} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted ml-1">Session_Title</label>
            <input type="text" placeholder="e.g. Presidential Election" className="w-full bg-transparent border-b border-border py-3 px-1 text-lg outline-none focus:border-indigo-500 transition-all text-foreground" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted ml-1">Context_Description</label>
            <input placeholder="Describe purpose..." className="w-full bg-transparent border-b border-border py-3 px-1 text-sm outline-none focus:border-indigo-500 transition-all text-foreground" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex items-center justify-between p-4 bg-muted/5 rounded-2xl border border-border">
             <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${requireNik ? 'bg-indigo-600 text-white' : 'bg-muted/20 text-muted'}`}><ShieldCheck size={18} /></div>
                <div><p className="text-xs font-bold text-foreground">NIK Verification Gateway</p><p className="text-[10px] text-muted">Enforce age (17+) and ID validation.</p></div>
             </div>
             <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={requireNik} onChange={(e) => setRequireNik(e.target.checked)} />
                <div className="w-11 h-6 bg-muted/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
             </label>
          </div>
          <button type="submit" className="w-full btn-primary py-4 mt-4 uppercase tracking-[0.2em] text-xs font-black">CREATE_VOTING_FORUM</button>
        </form>
      </section>

      <div className="space-y-6">
        {sessions.map((s) => (
          <div key={s.id} className="minimal-card flex items-center justify-between group">
            <div className="flex items-center gap-6">
              <div className="w-10 h-10 bg-muted/10 rounded-xl flex items-center justify-center text-muted group-hover:bg-foreground group-hover:text-background transition-all"><Layers size={18} /></div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-foreground">{s.title}</h3>
                  {s.require_nik && <ShieldCheck size={14} className="text-indigo-600" />}
                </div>
                <p className="text-xs text-muted font-mono uppercase">ID: #{s.id} | {s.status}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => copyToClipboard(s.id)} className="p-3 rounded-xl hover:bg-muted/10 text-muted hover:text-foreground transition-all"><LinkIcon size={18} /></button>
              <a href={`/admin/${s.id}`} className="p-3 rounded-xl hover:bg-muted/10 text-muted hover:text-foreground transition-all"><Settings size={18} /></a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
