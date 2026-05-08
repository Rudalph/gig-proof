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
const USDC_MINT = new PublicKey("AKZ8aZN6jLVLZbvvcTGvihz7sE6EzLm4vwD9cCcdkjDh");
const AIRDROP_AMOUNT = 500_000_000n; // 500 USDC (6 decimals)
const TOKEN_ACCOUNT_SIZE = 165;

// Token Program InitializeAccount3 (index 18) — no rent sysvar needed
function initializeAccount3Ix(account, mint, owner) {
  const data = Buffer.alloc(33);
  data.writeUInt8(18, 0);
  owner.toBytes().forEach((b, i) => data.writeUInt8(b, 1 + i));
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
    ],
    data,
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

    if (!process.env.SOLANA_KEYPAIR) {
      return NextResponse.json({ error: "SOLANA_KEYPAIR env var not configured" }, { status: 500 });
    }
    const keypairBytes = JSON.parse(process.env.SOLANA_KEYPAIR);
    const payer = Keypair.fromSecretKey(Uint8Array.from(keypairBytes));

    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

    const existing = await connection.getTokenAccountsByOwner(recipient, { mint: USDC_MINT });

    const tx = new Transaction();
    let destination;
    let newTokenAccount = null;

    if (existing.value.length > 0) {
      destination = existing.value[0].pubkey;
    } else {
      // Create a new token account using only System Program + Token Program.
      // Avoids calling the ATA program directly (incompatible with Agave 2.x devnet).
      newTokenAccount = Keypair.generate();
      destination = newTokenAccount.publicKey;

      const lamports = await connection.getMinimumBalanceForRentExemption(TOKEN_ACCOUNT_SIZE);

      tx.add(
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: destination,
          lamports,
          space: TOKEN_ACCOUNT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        })
      );
      tx.add(initializeAccount3Ix(destination, USDC_MINT, recipient));
    }

    tx.add(mintToIx(USDC_MINT, destination, payer.publicKey, AIRDROP_AMOUNT));

    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer.publicKey;

    // Sign with payer always; also sign with the new token account keypair if we created one
    const signers = newTokenAccount ? [payer, newTokenAccount] : [payer];
    tx.sign(...signers);

    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig, "confirmed");

    return NextResponse.json({ success: true, signature: sig });
  } catch (err) {
    console.error("USDC airdrop error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
