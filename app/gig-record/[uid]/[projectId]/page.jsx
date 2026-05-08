"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import {
  ShieldCheck,
  CheckCircle2,
  Wallet,
  CalendarDays,
  Tag,
  ExternalLink,
  Briefcase,
  User,
  Hash,
  Globe,
} from "lucide-react";

function truncate(str, len = 16) {
  if (!str) return "—";
  if (str.length <= len * 2 + 3) return str;
  return `${str.slice(0, len)}…${str.slice(-len)}`;
}

function Field({ label, value, mono = false }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-black/35">{label}</p>
      <p className={`text-sm text-black break-all ${mono ? "font-mono" : "font-medium"}`}>{value}</p>
    </div>
  );
}

function TxLink({ label, tx, icon: Icon }) {
  if (!tx) return null;
  return (
    <a
      href={`https://solscan.io/tx/${tx}?cluster=devnet`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 rounded-xl border border-black/8 bg-black/2 px-4 py-3 hover:border-black/20 hover:bg-black/5 transition group"
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black/8">
          <Icon size={13} className="text-black/60" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-black">{label}</p>
          <p className="text-[11px] font-mono text-black/40 truncate">{truncate(tx, 12)}</p>
        </div>
      </div>
      <ExternalLink size={13} className="shrink-0 text-black/30 group-hover:text-black/60 transition" />
    </a>
  );
}

export default function GigRecordPage() {
  const { uid, projectId } = useParams();
  const [gig, setGig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!uid || !projectId) return;
    getDoc(doc(db, "users", uid, "completedGigs", projectId))
      .then((snap) => {
        if (!snap.exists()) { setNotFound(true); return; }
        setGig({ id: snap.id, ...snap.data() });
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [uid, projectId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="space-y-3 w-full max-w-xl px-6">
          {[80, 120, 60, 100].map((h, i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-black/5" style={{ height: h }} />
          ))}
        </div>
      </div>
    );
  }

  if (notFound || !gig) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4 px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black/5">
          <Briefcase size={28} className="text-black/30" />
        </div>
        <p className="text-lg font-semibold text-black">Record not found</p>
        <p className="text-sm text-black/45 text-center">
          This gig record may not exist or has not been verified on-chain yet.
        </p>
      </div>
    );
  }

  const completedDate = gig.completedAt
    ? new Date(gig.completedAt).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-[#f7f7f7] px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-5">

        {/* Verification banner */}
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div>
            <p className="font-semibold text-emerald-800">Work Verified on Blockchain</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              This gig record is permanently stored on Arweave and the payment is confirmed on Solana devnet.
            </p>
          </div>
        </div>

        {/* Title card */}
        <div className="rounded-2xl border border-black/8 bg-white px-6 py-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-black/35 mb-1">Completed Project</p>
              <h1 className="text-xl font-bold text-black leading-tight">{gig.projectTitle}</h1>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-2xl font-bold text-black">{gig.budget}</p>
              <p className="text-xs font-semibold text-black/40 mt-0.5">{gig.currency}</p>
            </div>
          </div>

          {completedDate && (
            <div className="mt-4 flex items-center gap-1.5 text-xs text-black/40">
              <CalendarDays size={12} />
              Completed on {completedDate}
            </div>
          )}

          {gig.description && (
            <div className="mt-4 pt-4 border-t border-black/6">
              <p className="text-xs font-semibold uppercase tracking-wide text-black/35 mb-1.5">Description</p>
              <p className="text-sm leading-relaxed text-black/65">{gig.description}</p>
            </div>
          )}

          {gig.tags?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-black/6">
              <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-black/35">
                <Tag size={11} /> Skills &amp; Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {gig.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-black/10 bg-black/4 px-3 py-1 text-xs text-black/70">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Parties */}
        <div className="rounded-2xl border border-black/8 bg-white px-6 py-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/35">Parties</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/5">
                <User size={14} className="text-black/50" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-black/40 mb-0.5">Client Wallet</p>
                <p className="text-xs font-mono text-black break-all">{gig.clientWallet || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/5">
                <Briefcase size={14} className="text-black/50" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-black/40 mb-0.5">Freelancer Wallet</p>
                <p className="text-xs font-mono text-black break-all">{gig.freelancerWallet || "—"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* On-chain proof */}
        <div className="rounded-2xl border border-black/8 bg-white px-6 py-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/35">On-Chain Proof</p>
          <TxLink label="Escrow Transaction" tx={gig.escrowTx} icon={Wallet} />
          <TxLink label="Payment Transaction" tx={gig.paymentTx} icon={CheckCircle2} />

          {gig.arweaveTx && (
            <a
              href={gig.arweaveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-xl border border-black/8 bg-black/2 px-4 py-3 hover:border-black/20 hover:bg-black/5 transition group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black/8">
                  <Globe size={13} className="text-black/60" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-black">Permanent Record · Arweave</p>
                  <p className="text-[11px] font-mono text-black/40 truncate">{truncate(gig.arweaveTx, 12)}</p>
                </div>
              </div>
              <ExternalLink size={13} className="shrink-0 text-black/30 group-hover:text-black/60 transition" />
            </a>
          )}
        </div>

        {/* Metadata */}
        <div className="rounded-2xl border border-black/8 bg-white px-6 py-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/35">Record Metadata</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Platform" value={gig.platform} />
            <Field label="Project ID" value={gig.projectId} mono />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Currency" value={gig.currency} />
            <Field label="Record Type" value={gig.type?.replace(/_/g, " ")} />
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-black/30 pb-4">
          GigProof · Decentralised gig verification · Powered by Solana &amp; Arweave
        </p>
      </div>
    </div>
  );
}
