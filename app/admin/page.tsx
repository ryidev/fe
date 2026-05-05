"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Plus, Settings, Link as LinkIcon, Layers } from "lucide-react";

export default function AdminDashboard() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchSessions() {
      const { data } = await supabase.from('voting_sessions').select('*').order('created_at', { ascending: false });
      setSessions(data || []);
    }
    fetchSessions();
  }, []);

  const createSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('voting_sessions')
        .insert([{ title, description, status: 'active' }])
        .select()
        .single();
      
      if (error) throw error;
      setSessions([data, ...sessions]);
      setTitle('');
      setDescription('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (id: number) => {
    const url = `${window.location.origin}/vote/${id}`;
    navigator.clipboard.writeText(url);
    alert('Voting link copied to clipboard.');
  };

  return (
    <div className="max-w-4xl mx-auto pt-24 px-8 pb-32">
      <div className="flex items-center justify-between mb-12">
        <h1 className="text-3xl font-black tracking-tight text-foreground">ADMIN_DASHBOARD</h1>
        <div className="px-3 py-1 bg-muted/10 rounded-lg text-[10px] font-bold text-muted uppercase tracking-widest">
          Secured_Session
        </div>
      </div>
      
      {/* CREATE SESSION FORM */}
      <section className="minimal-card mb-16 p-8 border-foreground border-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted mb-8 flex items-center gap-2">
          <Plus size={14} /> Initialize_New_Forum
        </h2>
        <form onSubmit={createSession} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted ml-1">Session_Title</label>
            <input
              type="text"
              placeholder="e.g. Presidential Election 2026"
              className="w-full bg-transparent border-b border-border py-3 px-1 text-lg outline-none focus:border-indigo-500 transition-all text-foreground"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted ml-1">Context_Description</label>
            <input
              placeholder="Describe the purpose of this voting session..."
              className="w-full bg-transparent border-b border-border py-3 px-1 text-sm outline-none focus:border-indigo-500 transition-all text-foreground"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-4 mt-4 uppercase tracking-[0.2em] text-xs font-black shadow-xl"
          >
            {loading ? 'CREATING...' : 'CREATE_VOTING_FORUM'}
          </button>
        </form>
      </section>

      {/* SESSION LIST */}
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">Archived_Sessions</h2>
          <div className="h-[1px] flex-1 bg-border" />
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          {sessions.map((s) => (
            <div key={s.id} className="minimal-card flex items-center justify-between group">
              <div className="flex items-center gap-6">
                <div className="w-10 h-10 bg-muted/10 rounded-xl flex items-center justify-center text-muted group-hover:bg-foreground group-hover:text-background transition-all">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">{s.title}</h3>
                  <p className="text-xs text-muted font-mono">ID: #{s.id} | STATUS: {s.status.toUpperCase()}</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => copyToClipboard(s.id)}
                  className="p-3 rounded-xl hover:bg-muted/10 text-muted hover:text-foreground transition-all"
                >
                  <LinkIcon size={18} />
                </button>
                <a 
                  href={`/admin/${s.id}`}
                  className="p-3 rounded-xl hover:bg-muted/10 text-muted hover:text-foreground transition-all"
                >
                  <Settings size={18} />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
