"use client";
import React, { useEffect, useState } from 'react';
import { fetchCandidatesHybrid, voteOnChain } from '../hybrid-evoting';
import AddCandidateForm from './AddCandidateForm';
import AnimatedContainer from './AnimatedContainer';

export default function VotingPage() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');


  const loadCandidates = () => {
    setLoading(true);
    fetchCandidatesHybrid()
      .then(setCandidates)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCandidates();
    // eslint-disable-next-line
  }, []);

  const handleVote = async (index: number) => {
    setVoting(true);
    setError('');
    setSuccess('');
    try {
      await voteOnChain({ index });
      setSuccess('Vote berhasil!');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setVoting(false);
    }
  };

  if (loading) return <div>Loading kandidat...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-green-100 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900 py-10">
      <AnimatedContainer>
        <h1 className="text-3xl font-extrabold mb-6 text-center text-blue-700 dark:text-blue-300 tracking-tight drop-shadow">E-Voting Kandidat</h1>
        <AddCandidateForm onSuccess={loadCandidates} />
        <ul className="space-y-4 mt-6">
          {candidates.map((c: any, idx: number) => (
            <li key={c.id} className="flex items-center justify-between border-b pb-2">
              <span className="font-medium text-lg text-zinc-800 dark:text-zinc-100">{c.name}</span>
              <button
                className="bg-gradient-to-r from-blue-600 to-green-500 text-white px-4 py-1 rounded shadow hover:scale-105 transition-transform disabled:opacity-50"
                onClick={() => handleVote(idx)}
                disabled={voting}
              >
                Vote
              </button>
            </li>
          ))}
        </ul>
        {success && <div className="text-green-600 mt-4 text-center font-semibold">{success}</div>}
        {error && <div className="text-red-600 mt-4 text-center font-semibold">{error}</div>}
      </AnimatedContainer>
    </div>
  );
}
