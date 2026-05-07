import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
  Transaction,
} from "@solana/web3.js";

export const ESCROW_PROGRAM_ID = new PublicKey("fcJqPBDpSNmdRQZqmZxF2V1yJDtSEqn44wSCcjy6gcg");
export const USDC_DEVNET_MINT = new PublicKey("AKZ8aZN6jLVLZbvvcTGvihz7sE6EzLm4vwD9cCcdkjDh");

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bM");

async function disc(name) {
  const input = new TextEncoder().encode(`global:${name}`);
  const hash = await crypto.subtle.digest("SHA-256", input);
  return new Uint8Array(hash).slice(0, 8);
}

function encodeCreateEscrowArgs(projectId, amountUsdc, freelancerKey) {
  const idBytes = new TextEncoder().encode(projectId);
  const buf = new Uint8Array(4 + idBytes.length + 8 + 32);
  const view = new DataView(buf.buffer);
  let off = 0;

  view.setUint32(off, idBytes.length, true);
  off += 4;
  buf.set(idBytes, off);
  off += idBytes.length;

  view.setBigUint64(off, BigInt(amountUsdc), true);
  off += 8;

  buf.set(freelancerKey.toBytes(), off);
  return buf;
}

function enc(str) {
  return new TextEncoder().encode(str);
}

function escrowPda(clientKey, projectId) {
  return PublicKey.findProgramAddressSync(
    [enc("escrow"), enc(projectId), clientKey.toBytes()],
    ESCROW_PROGRAM_ID
  );
}

function vaultPda(escrowKey) {
  return PublicKey.findProgramAddressSync(
    [enc("vault"), escrowKey.toBytes()],
    ESCROW_PROGRAM_ID
  );
}

function ata(ownerKey, mintKey) {
  return PublicKey.findProgramAddressSync(
    [ownerKey.toBytes(), TOKEN_PROGRAM_ID.toBytes(), mintKey.toBytes()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
}

export async function buildCreateEscrowTx(connection, clientKey, freelancerKey, projectId, amountUsdc) {
  const [escrow] = escrowPda(clientKey, projectId);
  const [vault] = vaultPda(escrow);
  const [clientAta] = ata(clientKey, USDC_DEVNET_MINT);

  const d = await disc("create_escrow");
  const args = encodeCreateEscrowArgs(projectId, amountUsdc, freelancerKey);
  const data = new Uint8Array(d.length + args.length);
  data.set(d);
  data.set(args, d.length);

  const ix = new TransactionInstruction({
    programId: ESCROW_PROGRAM_ID,
    keys: [
      { pubkey: clientKey, isSigner: true, isWritable: true },
      { pubkey: freelancerKey, isSigner: false, isWritable: false },
      { pubkey: escrow, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: clientAta, isSigner: false, isWritable: true },
      { pubkey: USDC_DEVNET_MINT, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });

  const { blockhash } = await connection.getLatestBlockhash();
  const tx = new Transaction({ feePayer: clientKey, recentBlockhash: blockhash });
  tx.add(ix);
  return tx;
}

export async function buildReleasePaymentTx(connection, clientKey, freelancerKey, projectId) {
  const [escrow] = escrowPda(clientKey, projectId);
  const [vault] = vaultPda(escrow);
  const [freelancerAta] = ata(freelancerKey, USDC_DEVNET_MINT);

  const d = await disc("release_payment");

  const ix = new TransactionInstruction({
    programId: ESCROW_PROGRAM_ID,
    keys: [
      { pubkey: clientKey, isSigner: true, isWritable: true },
      { pubkey: freelancerKey, isSigner: false, isWritable: true },
      { pubkey: escrow, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: freelancerAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: d,
  });

  const { blockhash } = await connection.getLatestBlockhash();
  const tx = new Transaction({ feePayer: clientKey, recentBlockhash: blockhash });
  tx.add(ix);
  return tx;
}

export async function buildRefundTx(connection, clientKey, projectId) {
  const [escrow] = escrowPda(clientKey, projectId);
  const [vault] = vaultPda(escrow);
  const [clientAta] = ata(clientKey, USDC_DEVNET_MINT);

  const d = await disc("refund");

  const ix = new TransactionInstruction({
    programId: ESCROW_PROGRAM_ID,
    keys: [
      { pubkey: clientKey, isSigner: true, isWritable: true },
      { pubkey: escrow, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: clientAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: d,
  });

  const { blockhash } = await connection.getLatestBlockhash();
  const tx = new Transaction({ feePayer: clientKey, recentBlockhash: blockhash });
  tx.add(ix);
  return tx;
}
