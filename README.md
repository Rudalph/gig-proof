# GigProof 🔗

> **A Solana-powered decentralized freelancing marketplace** — where payments are trustless, reputation is yours, and disputes are resolved transparently.

🌐 **Live Demo:** [https://gig-proof.vercel.app/](https://gig-proof.vercel.app/)

---

## 🚨 The Problem

Current freelancing platforms are broken for freelancers:

| Pain Point | Reality |
|---|---|
| **Payment Trust & Delays** | 85% of freelancers experience late payments; 21% are paid late or not paid more than half the time *(Remote Contractor Management Report 2026)* |
| **No Ownership of Reputation** | Your reviews, ratings, and work history are owned by the platform — not you |
| **Centralized Platform Control** | Accounts can be banned arbitrarily, taking your entire reputation with them |
| **Poor Dispute Resolution** | Opaque, platform-controlled processes with little recourse for freelancers |

---

## ✅ The Solution

GigProof is a decentralized freelancing marketplace built on **Solana**, addressing each of these problems head-on:

### 💰 Milestone-Based Escrow Payments
Clients fund projects upfront through smart contract escrow. Payments are released in negotiated milestones based on verified work progress — no more chasing invoices.

### 🏆 Portable Blockchain Reputation
Freelancers own their work history and reviews **on-chain**. Your reputation lives in your wallet, not on a platform's servers. Take it anywhere.

### 🔓 Decentralized & Freelancer-First
Built on Solana for near-zero transaction costs (~$0.00025 per transaction vs. 10–20% fees on Fiverr/Upwork). Permissionless by design — no one can ban your wallet.

### 🤖 Transparent AI-Assisted Dispute Resolution
AI-powered matching connects the right clients with the right freelancers, and AI-assisted dispute resolution ensures fair, transparent outcomes — not black-box platform decisions.

---

## 📊 Market Opportunity

| Metric | Value |
|---|---|
| **TAM** (Global freelance platform market) | $21.97B by 2031 |
| **SAM** (Blockchain/Web3 freelance economy) | $2B – $4B |
| **SOM** (Obtainable market for GigProof) | $20M – $50M |
| **Market CAGR** | 16.32% |

The global freelance platform market is estimated at **$8.9B in 2026** and growing rapidly, driven by Gen Z's increasing participation in the gig economy.

---

## ⚡ Why Solana?

| Platform | Fee |
|---|---|
| Fiverr | 20% |
| Upwork | 10% |
| Payment Gateways | 3–5% |
| **GigProof (Solana)** | **~$0.00025 per tx** |

Solana's high throughput and near-zero costs make it the ideal chain for global freelance payments.

---

## 🆚 GigProof vs. The Competition

| Feature | GigProof | Fiverr / Upwork | Other Web3 (LaborX, Braintrust) |
|---|---|---|---|
| **Reputation ownership** | You own it, in your wallet | Platform owns your rep | Wallet-based, but fragmented |
| **Account security** | Permissionless wallet | Account can be banned | Permissionless, but high gas barrier |
| **Fees** | 5% → trustless escrow | 15–20% centralised | 1–10% + High ETH gas costs |
| **Matching** | Open, on-chain AI scoring | Opaque matching algorithm | Manual job boards (no AI) |
| **Portability** | Portable across any app | Rep locked to platform | Siloed to specific platform token |

---

## 🛠️ Tech Stack

- **Blockchain:** Solana (smart contract escrow, on-chain reputation)
- **Frontend:** Next.js / React
- **AI:** AI-powered freelancer–client matching & dispute resolution
- **Deployment:** Vercel

---

## 🚀 Features

- [x] Solana wallet integration
- [x] Smart contract escrow with milestone-based releases
- [x] On-chain freelancer reputation & work history
- [x] AI-powered job matching
- [x] Transparent dispute resolution
- [x] Low-fee global payments

---

## 👥 The Team

All four co-founders are MSc Computing students at **Dublin City University, Ireland**, with strong industry and research backgrounds.

| Name | Role | Background |
|---|---|---|
| **Khushboo Kumari** | Co-Founder | 4 years at Accenture; built scalable AI and data pipelines. MSc AI. |
| **Achal Nanjundamurthy** | Co-Founder | Backend systems engineer; built scalable SaaS and payment integrations. MSc Data Analytics. |
| **Shruti Patil** | Co-Founder | Full-stack web developer; specializes in AI workflows and secure APIs. MSc AI. |
| **Rudalph Gonsalves** | Co-Founder | Full-stack AI engineer; blockchain expert and national hackathon winner. MSc AI. |

---

## 🏁 Getting Started

```bash
# Clone the repository
git clone https://github.com/your-org/gig-proof.git
cd gig-proof

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your Solana RPC endpoint and other config

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## 📁 Project Structure

```
gig-proof/
├── app/              # Next.js app directory
├── components/       # Reusable UI components
├── contracts/        # Solana smart contracts (Anchor)
├── lib/              # Utility functions & blockchain helpers
├── public/           # Static assets
└── styles/           # Global styles
```

---

## 📜 License

MIT © 2026 GigProof Team

---

> *Built with ❤️ at Hackathon 2026— Dublin City University*