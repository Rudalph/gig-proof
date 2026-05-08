import { NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bM");
const USDC_MINT = new PublicKey("AKZ8aZN6jLVLZbvvcTGvihz7sE6EzLm4vwD9cCcdkjDh");
const AIRDROP_AMOUNT = 500_000_000n; // 500 USDC (6 decimals)

function findAta(owner, mint) {
  return PublicKey.findProgramAddressSync(
    [owner.toBytes(), TOKEN_PROGRAM_ID.toBytes(), mint.toBytes()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
}

function createAtaIdempotentIx(payer, ata, owner, mint) {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]), // instruction 1 = CreateIdempotent
  });
}

function mintToIx(mint, destination, authority, amount) {
  const data = Buffer.allocUnsafe(9);
  data.writeUInt8(7, 0); // MintTo = index 7
  data.writeBigUInt64LE(amount, 1);
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data,
  });
}

export async function POST(req) {
  try {
    const { wallet } = await req.json();
    if (!wallet) return NextResponse.json({ error: "Missing wallet address" }, { status: 400 });

    let recipient;
    try {
      recipient = new PublicKey(wallet);
    } catch {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const keypairBytes = JSON.parse(process.env.SOLANA_KEYPAIR);
    const payer = Keypair.fromSecretKey(Uint8Array.from(keypairBytes));

    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

    const existing = await connection.getTokenAccountsByOwner(recipient, { mint: USDC_MINT });

    const tx = new Transaction();
    let destination;

    if (existing.value.length > 0) {
      destination = existing.value[0].pubkey;
    } else {
      destination = findAta(recipient, USDC_MINT);
      tx.add(createAtaIdempotentIx(payer.publicKey, destination, recipient, USDC_MINT));
    }

    tx.add(mintToIx(USDC_MINT, destination, payer.publicKey, AIRDROP_AMOUNT));

    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer.publicKey;
    tx.sign(payer);

    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig, "confirmed");

    return NextResponse.json({ success: true, signature: sig });
  } catch (err) {
    console.error("USDC airdrop error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
