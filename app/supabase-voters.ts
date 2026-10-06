import { supabase } from '@/lib/supabaseClient';

export interface SessionVoter {
  id: number;
  session_id: number;
  identifier: string;
  full_name: string;
  wallet_address: string | null;
  is_claimed: boolean;
  created_at?: string;
}

export async function getVotersBySession(sessionId: number): Promise<SessionVoter[]> {
  const { data, error } = await supabase
    .from('session_voters')
    .select('*')
    .eq('session_id', sessionId)
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching session voters:', error);
    throw new Error(error.message);
  }
  return data || [];
}

export async function addVoterToSession(
  sessionId: number,
  identifier: string,
  fullName: string
): Promise<SessionVoter> {
  const cleanId = identifier.trim();
  const cleanName = fullName.trim();

  // Cek duplikasi di sesi yang sama
  const { data: existing } = await supabase
    .from('session_voters')
    .select('id, identifier')
    .eq('session_id', sessionId)
    .eq('identifier', cleanId)
    .maybeSingle();

  if (existing) {
    throw new Error(`NPM/NIM "${cleanId}" sudah terdaftar dalam DPT sesi ini!`);
  }

  const { data, error } = await supabase
    .from('session_voters')
    .insert([
      {
        session_id: sessionId,
        identifier: cleanId,
        full_name: cleanName,
        wallet_address: null,
        is_claimed: false,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error adding voter:', error);
    throw new Error(error.message);
  }
  return data;
}

export async function deleteVoterFromSession(voterId: number): Promise<void> {
  const { error } = await supabase
    .from('session_voters')
    .delete()
    .eq('id', voterId);

  if (error) {
    console.error('Error deleting voter:', error);
    throw new Error(error.message);
  }
}

export async function lookupVoterInSession(
  sessionId: number,
  identifier: string
): Promise<SessionVoter | null> {
  const cleanId = identifier.trim();
  const { data, error } = await supabase
    .from('session_voters')
    .select('*')
    .eq('session_id', sessionId)
    .eq('identifier', cleanId)
    .maybeSingle();

  if (error) {
    console.error('Error lookup voter:', error);
    throw new Error(error.message);
  }
  return data;
}

export async function linkWalletToVoter(
  sessionId: number,
  identifier: string,
  walletAddress: string
): Promise<SessionVoter> {
  const cleanId = identifier.trim();
  const cleanWallet = walletAddress.toLowerCase();

  // 1. Cek apakah wallet ini sudah terhubung ke identitas lain di sesi ini
  const { data: walletOwner } = await supabase
    .from('session_voters')
    .select('*')
    .eq('session_id', sessionId)
    .eq('wallet_address', cleanWallet)
    .maybeSingle();

  if (walletOwner && walletOwner.identifier !== cleanId) {
    throw new Error(
      `Dompet ini sudah digunakan oleh mahasiswa lain (${walletOwner.full_name} - ${walletOwner.identifier}) di sesi ini!`
    );
  }

  // 2. Hubungkan wallet dan tandai is_claimed
  const { data, error } = await supabase
    .from('session_voters')
    .update({
      wallet_address: cleanWallet,
      is_claimed: true,
    })
    .eq('session_id', sessionId)
    .eq('identifier', cleanId)
    .select()
    .single();

  if (error) {
    console.error('Error linking wallet to voter:', error);
    throw new Error(error.message);
  }
  return data;
}
