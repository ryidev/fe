"use client";
import React, { useState } from 'react';
import { addCandidateToSession } from '../supabase-candidates';
import { getEvotingContract } from '../../lib/evotingContract';

export default function AddCandidateForm({ onSuccess }: { onSuccess?: () => void }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      // 1. Daftarkan e-wallet ke smart contract
      const contract = await getEvotingContract();
      const tx = await contract.tambahKandidat(address);
      await tx.wait();
      
      // 2. Simpan nama kandidat ke Supabase (session_id 0 sebagai default di halaman lama)
      await addCandidateToSession(name, 0);
      
      setSuccess('Kandidat berhasil ditambahkan!');
      setName('');
      setAddress('');
      if (onSuccess) onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 border rounded shadow">
      <h2 className="text-lg font-semibold mb-2">Tambah Kandidat</h2>
      <div className="mb-2">
        <input
          type="text"
          className="border px-2 py-1 rounded w-full"
          placeholder="Nama Kandidat"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
      </div>
      <div className="mb-2">
        <input
          type="text"
          className="border px-2 py-1 rounded w-full"
          placeholder="Alamat E-Wallet Kandidat (0x...)"
          value={address}
          onChange={e => setAddress(e.target.value)}
          required
        />
      </div>
      <button
        type="submit"
        className="bg-green-600 text-white px-4 py-1 rounded disabled:opacity-50"
        disabled={loading}
      >
        {loading ? 'Menambah...' : 'Tambah Kandidat'}
      </button>
      {success && <div className="text-green-600 mt-2">{success}</div>}
      {error && <div className="text-red-600 mt-2">{error}</div>}
    </form>
  );
}
