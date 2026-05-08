export async function uploadGigRecord(record) {
  const res = await fetch("/api/arweave/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Arweave upload failed");
  }
  const { id } = await res.json();
  return id;
}

export function arweaveUrl(txId) {
  return `https://devnet.irys.xyz/${txId}`;
}
