import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/lib/evotingContract';
import { supabase } from '@/lib/supabaseClient';

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
    const { voterAddress, sessionId, identifier } = body;

    if (!voterAddress || sessionId === undefined) {
      return NextResponse.json(
        { error: 'Parameter tidak lengkap (voterAddress dan sessionId dibutuhkan)' },
        { status: 400, headers: corsHeaders }
      );
    }

    const cleanWallet = voterAddress.toLowerCase();
    const sessIdNum = Number(sessionId);

    // 1. Verifikasi apakah wallet terdaftar di tabel session_voters untuk sesi ini
    let isAuthorized = false;
    let voterName = 'Verified Voter';

    const { data: sessionVoter } = await supabase
      .from('session_voters')
      .select('id, identifier, full_name, wallet_address')
      .eq('session_id', sessIdNum)
      .eq('wallet_address', cleanWallet)
      .maybeSingle();

    if (sessionVoter) {
      isAuthorized = true;
      voterName = sessionVoter.full_name;
    } else if (identifier) {
      // Jika identifier disertakan, cek apakah identifier tersebut cocok
      const { data: byId } = await supabase
        .from('session_voters')
        .select('id, identifier, full_name, wallet_address')
        .eq('session_id', sessIdNum)
        .eq('identifier', identifier.trim())
        .maybeSingle();

      if (byId) {
        // Tautkan wallet jika belum terhubung
        await supabase
          .from('session_voters')
          .update({ wallet_address: cleanWallet, is_claimed: true })
          .eq('id', byId.id);
        isAuthorized = true;
        voterName = byId.full_name;
      }
    }

    // Fallback cek tabel legacy verified_voters
    if (!isAuthorized) {
      const { data: legacyVoter } = await supabase
        .from('verified_voters')
        .select('id, nik, wallet_address, full_name')
        .eq('wallet_address', cleanWallet)
        .maybeSingle();

      if (legacyVoter) {
        isAuthorized = true;
        voterName = legacyVoter.full_name || 'Verified Voter';
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Dompet ini belum terdaftar atau terhubung dengan DPT pada sesi voting ini. Silakan masukkan NPM terlebih dahulu.' },
        { status: 403, headers: corsHeaders }
      );
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const ownerWallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, ownerWallet);

    // 2. Cek apakah sudah punya tiket di smart contract
    const [hasTicket, tokenId, isUsed] = await contract.checkVoterTicket(voterAddress, BigInt(sessionId));
    if (hasTicket) {
      return NextResponse.json(
        {
          success: true,
          message: `Pemilih (${voterName}) sudah memiliki tiket SBT untuk sesi ini.`,
          alreadyMinted: true,
          tokenId: tokenId.toString(),
          isUsed,
        },
        { headers: corsHeaders }
      );
    }

    // 3. Panitia mencetak (mint) tiket SBT ke alamat pemilih (Panitia menanggung gas)
    const tx = await contract.mintBallot(voterAddress, BigInt(sessionId));
    const receipt = await tx.wait();

    // Dapatkan data tiket terbaru
    const [, newTokenId] = await contract.checkVoterTicket(voterAddress, BigInt(sessionId));

    // Tandai is_claimed di session_voters jika ada
    await supabase
      .from('session_voters')
      .update({ is_claimed: true })
      .eq('session_id', sessIdNum)
      .eq('wallet_address', cleanWallet);

    return NextResponse.json(
      {
        success: true,
        message: `NFT Tiket Suara Resmi (SBT) berhasil diterbitkan untuk ${voterName}! 🛡️🎫`,
        tokenId: newTokenId.toString(),
        txHash: receipt.hash,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Mint SBT Error:', error);
    const message = error.reason || error.shortMessage || error.message || 'Gagal menerbitkan tiket SBT';
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
