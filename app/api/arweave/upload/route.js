import Irys from "@irys/sdk";

export async function POST(req) {
  try {
    const body = await req.json();
    const keypair = JSON.parse(process.env.SOLANA_KEYPAIR || "[]");

    if (!keypair.length) {
      return Response.json({ error: "SOLANA_KEYPAIR not set in .env.local" }, { status: 500 });
    }

    const irys = new Irys({
      url: "https://devnet.irys.xyz",
      token: "solana",
      key: keypair,
      config: { providerUrl: "https://api.devnet.solana.com" },
    });

    await irys.ready();

    const receipt = await irys.upload(JSON.stringify(body), {
      tags: [
        { name: "Content-Type", value: "application/json" },
        { name: "App-Name", value: "GigProof" },
        { name: "Type", value: "completed-gig" },
        { name: "Project-Id", value: body.projectId || "" },
        { name: "Freelancer", value: body.freelancerWallet || "" },
      ],
    });

    return Response.json({ id: receipt.id });
  } catch (e) {
    console.error("Arweave upload error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
