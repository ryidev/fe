import { getCandidatesBySession, addCandidateToSession } from './supabase-candidates';
import { getEvotingContract } from '../lib/evotingContract';

// Ambil kandidat dari Supabase
export async function fetchCandidatesHybrid(sessionId: string) {
  return await getCandidatesBySession(sessionId);
}

// 2. Simpan nama kandidat ke Supabase (gunakan dummy session_id atau sesuaikan)
export async function addCandidate(name: string) {
  await addCandidateToSession(name, 0);
}

// Voting ke smart contract
type VoteParams = { index: number };
export async function voteOnChain({ index }: VoteParams) {
  const contract = await getEvotingContract();
  const tx = await contract.voting(index);
  await tx.wait();
  return tx;
}
