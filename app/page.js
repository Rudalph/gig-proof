import Hero from "./components/Hero";
import Navbar from "./components/Navbar";
import Link from "next/link";
import { ShieldCheck, Zap, Award, Coins, Users, Briefcase } from "lucide-react";

const STEPS = [
  {
    number: "01",
    title: "Post a Job",
    body: "Describe what you need, set your budget in USDC, and publish. Takes two minutes.",
  },
  {
    number: "02",
    title: "Get AI-Matched",
    body: "Our semantic matching engine surfaces the best-fit student freelancers based on skills, reputation, and experience.",
  },
  {
    number: "03",
    title: "Pay Securely",
    body: "USDC is locked in a Solana escrow smart contract. Released to the freelancer only when you approve the work.",
  },
];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Solana Escrow",
    body: "Funds are held in a program-derived escrow account on Solana. Neither party can touch them until the job is done and approved.",
  },
  {
    icon: Zap,
    title: "AI Matching",
    body: "Semantic embeddings match job descriptions to freelancer profiles — not just keywords, but meaning. Top 5 matches in under 2 seconds.",
  },
  {
    icon: Award,
    title: "On-chain Reputation",
    body: "Every completed gig is minted as a compressed NFT to the freelancer's wallet. A verifiable, permanent, tamper-proof work history.",
  },
  {
    icon: Coins,
    title: "Zero Freelancer Fees",
    body: "Freelancers keep 100% of what they earn. A small 5% platform fee is charged to clients only, covering infrastructure and matching.",
  },
];

const FOR_WHO = [
  {
    icon: Briefcase,
    label: "For Clients",
    heading: "Hire with confidence.",
    points: [
      "Pay only when work is approved — escrow protects you",
      "AI finds the right person fast, not just anyone available",
      "Freelancer reputation is on-chain, not self-reported",
      "Dispute resolution built into the smart contract",
    ],
    cta: "Post a Job",
  },
  {
    icon: Users,
    label: "For Freelancers",
    heading: "Build a career you own.",
    points: [
      "Get paid in USDC — no bank, no delays, no borders",
      "Every gig adds to your on-chain portfolio automatically",
      "AI matches you to relevant jobs without cold pitching",
      "Keep 100% of your earnings, always",
    ],
    cta: "Start Freelancing",
  },
];

export default function Home() {
  return (
    <div>
      <Navbar />
      <main>
        <Hero />

        {/* How it Works */}
        <section id="how-it-works" className="bg-white py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-widest text-black/40 mb-3">
              The process
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-black mb-16">
              How GigProof works
            </h2>
            <div className="grid gap-8 sm:grid-cols-3">
              {STEPS.map((step) => (
                <div key={step.number} className="group">
                  <p className="text-5xl font-bold text-black/8 mb-4 group-hover:text-black/15 transition">
                    {step.number}
                  </p>
                  <h3 className="text-lg font-semibold text-black mb-2">{step.title}</h3>
                  <p className="text-sm text-black/55 leading-relaxed">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="bg-black py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-3">
              Built different
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-16">
              Why GigProof
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-white/10 p-6 hover:border-white/25 transition-all duration-200 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-4 group-hover:bg-white/15 transition">
                    <f.icon size={18} className="text-white" />
                  </div>
                  <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* For who */}
        <section id="for-who" className="bg-white py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-widest text-black/40 mb-3">
              Who it&apos;s for
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-black mb-16">
              Built for both sides
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {FOR_WHO.map((w) => (
                <div
                  key={w.label}
                  className="rounded-2xl border border-black/10 p-8 hover:shadow-md hover:border-black/20 transition-all duration-200"
                >
                  <span className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-black/60 mb-5">
                    <w.icon size={12} />
                    {w.label}
                  </span>
                  <h3 className="text-xl font-bold text-black mb-4">{w.heading}</h3>
                  <ul className="space-y-2.5 mb-8">
                    {w.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2.5 text-sm text-black/60">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-black/30 shrink-0" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/auth"
                    className="inline-block rounded-xl bg-black text-white px-5 py-2.5 text-sm font-semibold hover:bg-black/80 transition"
                  >
                    {w.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-black py-24 px-6 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4">
              Ready to get started?
            </h2>
            <p className="text-white/50 mb-10 text-lg">
              Join GigProof — the trustless marketplace built for student freelancers.
            </p>
            <Link
              href="/auth"
              className="inline-block rounded-2xl bg-white text-black px-8 py-4 text-base font-bold hover:bg-white/90 transition"
            >
              Create your account
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-black border-t border-white/10 px-6 py-8">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/30">
            <span className="font-semibold text-white/60">GigProof</span>
            <span>Work it. Prove it. Own it.</span>
            <Link href="/auth" className="hover:text-white/60 transition">
              Sign In
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
