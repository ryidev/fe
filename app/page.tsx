import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { ArrowRight, Circle } from "lucide-react";

export default async function Home() {
  const { data: sessions } = await supabase.from('voting_sessions').select('*').order('created_at', { ascending: false });

  return (
    <main className="max-w-5xl mx-auto pt-24 px-8 pb-32">
      <header className="mb-24 text-center">
        <h1 className="text-6xl font-black tracking-tight text-foreground mb-6">
          Decentralized <span className="text-muted">Democracy.</span>
        </h1>
        <p className="text-lg text-muted font-light max-w-xl mx-auto leading-relaxed">
          The most elegant way to conduct secure, blockchain-verified voting sessions. Simple, transparent, and private.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-10">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="text-sm font-bold tracking-[0.2em] uppercase text-muted">Active_Voting_Sessions</h2>
          <span className="text-[10px] font-mono text-muted">{sessions?.length || 0} TOTAL_FOUND</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sessions?.map((session) => (
            <Link 
              key={session.id} 
              href={`/vote/${session.id}`}
              className="minimal-card group flex flex-col justify-between hover:border-foreground"
            >
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Circle size={8} className={session.status === 'finished' ? 'fill-muted text-muted' : 'fill-indigo-500 text-indigo-500'} />
                  <span className="text-[10px] font-bold tracking-widest uppercase text-muted">
                    {session.status === 'finished' ? 'Archived' : 'Live'}
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-2 group-hover:text-indigo-600 transition-colors">
                  {session.title}
                </h3>
                <p className="text-sm text-muted font-light line-clamp-2">
                  {session.description || 'No description provided for this session.'}
                </p>
              </div>
              
              <div className="mt-8 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground group-hover:gap-4 transition-all">
                Enter_Session <ArrowRight size={14} />
              </div>
            </Link>
          ))}
        </div>
      </div>
      
      <footer className="mt-24 pt-12 border-t border-border flex justify-center">
        <Link href="/admin" className="text-xs font-mono text-muted hover:text-foreground transition-colors">
          TERMINAL_ACCESS_LOCKED &gt;_
        </Link>
      </footer>
    </main>
  );
}
