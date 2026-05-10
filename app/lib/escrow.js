import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
  Transaction,
} from "@solana/web3.js";

export const ESCROW_PROGRAM_ID = new PublicKey("4routMSHngGLj5DbzUozx3Q9f86a5E46SsTDtj7S3Vca");
// ProgramData account required by BPFLoaderUpgradeable in Agave 3.x
const ESCROW_PROGRAM_DATA = new PublicKey("4kJWau4mHXcbDjkLG9n4Xn9ps4MbZDgBjSX8d8de3HsN");
export const USDC_DEVNET_MINT = new PublicKey("AKZ8aZN6jLVLZbvvcTGvihz7sE6EzLm4vwD9cCcdkjDh");

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

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


async function findTokenAccountWithBalance(connection, ownerKey, mintKey) {
  const accounts = await connection.getParsedTokenAccountsByOwner(ownerKey, { mint: mintKey });
  if (accounts.value.length === 0) throw new Error("No USDC token account found — fund the wallet first");
  const info = accounts.value[0].account.data.parsed.info;
  return {
    pubkey: accounts.value[0].pubkey,
    balance: BigInt(info.tokenAmount.amount),
  };
}

async function findTokenAccount(connection, ownerKey, mintKey) {
  const accounts = await connection.getTokenAccountsByOwner(ownerKey, { mint: mintKey });
  if (accounts.value.length === 0) throw new Error("No USDC token account found — fund the wallet first");
  return accounts.value[0].pubkey;
}

export function getEscrowPDA(clientKey, projectId) {
  const [pda] = escrowPda(clientKey, projectId);
  return pda;
}

export async function buildMilestoneEscrowTxs(connection, clientKey, freelancerKey, projectId, milestones, totalAmountUsdc) {
  const { pubkey: clientAta, balance } = await findTokenAccountWithBalance(connection, clientKey, USDC_DEVNET_MINT);
  if (balance < BigInt(totalAmountUsdc)) {
    const have = (Number(balance) / 1_000_000).toFixed(2);
    const need = (totalAmountUsdc / 1_000_000).toFixed(2);
    throw new Error(`Insufficient devnet USDC — wallet has ${have} USDC but all milestones require ${need} USDC total.`);
  }

  const { blockhash } = await connection.getLatestBlockhash();
  const d = await disc("create_escrow");
  const txs = [];
  const milestoneProjectIds = [];
  const milestoneAmounts = [];

  for (let i = 0; i < milestones.length; i++) {
    const msProjectId = `${projectId}_m${i}`;
    const msAmount = Math.round((milestones[i].percentage / 100) * totalAmountUsdc);
    const [escrow] = escrowPda(clientKey, msProjectId);
    const [vault] = vaultPda(escrow);
    const args = encodeCreateEscrowArgs(msProjectId, msAmount, freelancerKey);
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
        { pubkey: ESCROW_PROGRAM_DATA, isSigner: false, isWritable: false },
      ],
      data,
    });
    const tx = new Transaction({ feePayer: clientKey, recentBlockhash: blockhash });
    tx.add(ix);
    txs.push(tx);
    milestoneProjectIds.push(msProjectId);
    milestoneAmounts.push(msAmount);
  }

  return { txs, milestoneProjectIds, milestoneAmounts };
}

export async function buildCreateEscrowTx(connection, clientKey, freelancerKey, projectId, amountUsdc) {
  const [escrow] = escrowPda(clientKey, projectId);
  const [vault] = vaultPda(escrow);
  const { pubkey: clientAta, balance } = await findTokenAccountWithBalance(connection, clientKey, USDC_DEVNET_MINT);
  if (balance < BigInt(amountUsdc)) {
    const have = (Number(balance) / 1_000_000).toFixed(2);
    const need = (amountUsdc / 1_000_000).toFixed(2);
    throw new Error(`Insufficient devnet USDC — wallet has ${have} USDC but escrow requires ${need} USDC. Get devnet USDC from a faucet first.`);
  }

  const d = await disc("create_escrow");
  const args = encodeCreateEscrowArgs(projectId, amountUsdc, freelancerKey);
  const data = new Uint8Array(d.length + args.length);
  data.set(d);
  data.set(args, d.length);

  const escrowIx = new TransactionInstruction({
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
      { pubkey: ESCROW_PROGRAM_DATA, isSigner: false, isWritable: false },
    ],
    data,
  });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction({ feePayer: clientKey, recentBlockhash: blockhash });
  tx.add(escrowIx);
  return { tx, blockhash, lastValidBlockHeight };
}

// Creates the escrow AND releases it in one atomic transaction.
// Used when an escrow is missing on-chain but needs to be funded and immediately paid out.
export async function buildCreateAndReleaseTx(connection, clientKey, freelancerKey, projectId, amountUsdc) {
  const [escrow] = escrowPda(clientKey, projectId);
  const [vault] = vaultPda(escrow);
  const { pubkey: clientAta, balance } = await findTokenAccountWithBalance(connection, clientKey, USDC_DEVNET_MINT);
  if (balance < BigInt(amountUsdc)) {
    const have = (Number(balance) / 1_000_000).toFixed(2);
    const need = (amountUsdc / 1_000_000).toFixed(2);
    throw new Error(`Insufficient devnet USDC — wallet has ${have} USDC but escrow requires ${need} USDC.`);
  }

  const freelancerAccts = await connection.getTokenAccountsByOwner(freelancerKey, { mint: USDC_DEVNET_MINT });
  if (freelancerAccts.value.length === 0) throw new Error("Freelancer has no USDC token account — they need to set up a USDC wallet first.");
  const freelancerAta = freelancerAccts.value[0].pubkey;

  const createDisc = await disc("create_escrow");
  const createArgs = encodeCreateEscrowArgs(projectId, amountUsdc, freelancerKey);
  const createData = new Uint8Array(createDisc.length + createArgs.length);
  createData.set(createDisc);
  createData.set(createArgs, createDisc.length);

  const createIx = new TransactionInstruction({
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
      { pubkey: ESCROW_PROGRAM_DATA, isSigner: false, isWritable: false },
    ],
    data: createData,
  });

  const releaseDisc = await disc("release_payment");
  const releaseIx = new TransactionInstruction({
    programId: ESCROW_PROGRAM_ID,
    keys: [
      { pubkey: clientKey, isSigner: true, isWritable: true },
      { pubkey: freelancerKey, isSigner: false, isWritable: true },
      { pubkey: escrow, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: freelancerAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ESCROW_PROGRAM_DATA, isSigner: false, isWritable: false },
    ],
    data: releaseDisc,
  });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction({ feePayer: clientKey, recentBlockhash: blockhash });
  tx.add(createIx);
  tx.add(releaseIx);
  return { tx, blockhash, lastValidBlockHeight };
}

export async function buildReleasePaymentTx(connection, clientKey, freelancerKey, projectId) {
  const [escrow] = escrowPda(clientKey, projectId);
  const [vault] = vaultPda(escrow);

  const freelancerAccts = await connection.getTokenAccountsByOwner(freelancerKey, { mint: USDC_DEVNET_MINT });
  if (freelancerAccts.value.length === 0) throw new Error("Freelancer has no USDC token account — they need to set up a USDC wallet first.");
  const freelancerAta = freelancerAccts.value[0].pubkey;

  const d = await disc("release_payment");

  const releaseIx = new TransactionInstruction({
    programId: ESCROW_PROGRAM_ID,
    keys: [
      { pubkey: clientKey, isSigner: true, isWritable: true },
      { pubkey: freelancerKey, isSigner: false, isWritable: true },
      { pubkey: escrow, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: freelancerAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ESCROW_PROGRAM_DATA, isSigner: false, isWritable: false },
    ],
    data: d,
  });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction({ feePayer: clientKey, recentBlockhash: blockhash });
  tx.add(releaseIx);
  return { tx, blockhash, lastValidBlockHeight };
}

export async function buildRefundTx(connection, clientKey, projectId) {
  const [escrow] = escrowPda(clientKey, projectId);
  const [vault] = vaultPda(escrow);
  const clientAta = await findTokenAccount(connection, clientKey, USDC_DEVNET_MINT);

  const d = await disc("refund");

  const ix = new TransactionInstruction({
    programId: ESCROW_PROGRAM_ID,
    keys: [
      { pubkey: clientKey, isSigner: true, isWritable: true },
      { pubkey: escrow, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: clientAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ESCROW_PROGRAM_DATA, isSigner: false, isWritable: false },
    ],
    data: d,
  });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction({ feePayer: clientKey, recentBlockhash: blockhash });
  tx.add(ix);
  return { tx, blockhash, lastValidBlockHeight };
}
