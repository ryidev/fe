import { supabase } from '@/lib/supabaseClient';

export async function getCandidatesBySession(sessionId: number) {
  const { data, error } = await supabase
    .from('candidates')
    .select('*')
    .eq('session_id', sessionId);
  
  if (error) throw error;
  return data;
}

export async function addCandidateToSession(name: string, wallet: string, sessionId: number) {
  const { data, error } = await supabase
    .from('candidates')
    .insert([{ name, wallet_address: wallet, session_id: sessionId }])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteCandidate(candidateId: number) {
  const { error } = await supabase
    .from('candidates')
    .delete()
    .eq('id', candidateId);
  
  if (error) throw error;
  return true;
}

// FUNGSI BARU: Update Nama & Foto
export async function updateCandidate(id: number, updates: { name?: string; image_url?: string }) {
  const { data, error } = await supabase
    .from('candidates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// FUNGSI BARU: Upload Foto ke Storage
export async function uploadCandidateAvatar(file: File, candidateId: number) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${candidateId}-${Math.random()}.${fileExt}`;
  const filePath = `avatars/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  return publicUrl;
}
