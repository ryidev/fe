import { supabase } from '@/lib/supabaseClient';

export type Candidate = {
  id: number;
  name: string;
  wallet_address: string;
  description?: string;
  image_url?: string;
  created_at: string;
  session_id: number;
};

export async function getCandidatesBySession(sessionId: number): Promise<Candidate[]> {
  const { data, error } = await supabase
    .from('candidates')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
    
  if (error) throw error;
  return data as Candidate[];
}

export async function addCandidateToSession(name: string, wallet: string, sessionId: number, description: string = ''): Promise<Candidate> {
  const { data, error } = await supabase
    .from('candidates')
    .insert([{ 
      name, 
      wallet_address: wallet,
      session_id: sessionId,
      description,
      image_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`
    }])
    .select()
    .single();

  if (error) throw error;
  return data as Candidate;
}

export async function deleteCandidate(id: number): Promise<void> {
  const { error } = await supabase
    .from('candidates')
    .delete()
    .eq('id', id);
    
  if (error) throw error;
}
