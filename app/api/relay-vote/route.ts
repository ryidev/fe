import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/lib/evotingContract';

const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { candidateIndex, sessionId, voterAddress, deadline, signature } = body;

    if (candidateIndex === undefined || sessionId === undefined || !voterAddress || !signature) {
      return NextResponse.json(
        { error: 'Parameter tidak lengkap (candidateIndex, sessionId, voterAddress, deadline, signature dibutuhkan)' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Pecah signature menjadi komponen r, s, v
    const sig = ethers.Signature.from(signature);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const relayerWallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, relayerWallet);

    // Cek status tiket sebelum broadcast
    const [hasTicket, , isUsed] = await contract.checkVoterTicket(voterAddress, BigInt(sessionId));
    if (!hasTicket) {
      return NextResponse.json(
        { error: 'Pemilih tidak memiliki tiket SBT untuk sesi ini. Harap klaim tiket terlebih dahulu.' },
        { status: 400, headers: corsHeaders }
      );
    }
    if (isUsed) {
      return NextResponse.json(
        { error: 'Tiket SBT Anda sudah pernah digunakan untuk mencoblos!' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Broadcast transaksi on-chain (Panitia/Relayer yang membayar biaya gas)
    const tx = await contract.voteWithBallotBySig(
      BigInt(candidateIndex),
      BigInt(sessionId),
      voterAddress,
      BigInt(deadline),
      sig.v,
      sig.r,
      sig.s
    );

    const receipt = await tx.wait();

    return NextResponse.json(
      {
        success: true,
        message: 'Suara berhasil dicatat on-chain bebas biaya gas (SBT Terpakai)! 🗳✨',
        txHash: receipt.hash,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Relay Vote Error:', error);
    const message = error.reason || error.shortMessage || error.message || 'Gagal relay suara';
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
