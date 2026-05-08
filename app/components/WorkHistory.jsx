"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  doc,
  setDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { uploadGigRecord, arweaveUrl } from "@/app/lib/arweave";
import { db } from "@/app/lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useCurrency, formatBudget } from "../context/CurrencyContext";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { buildCreateEscrowTx, buildReleasePaymentTx, buildRefundTx } from "@/app/lib/escrow";
import {
  Briefcase,
  Clock,
  CheckCircle2,
  CircleDot,
  XCircle,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Tag,
  Layers,
  Star,
  Wallet,
  TrendingUp,
} from "lucide-react";

function formatDate(dateStr) {
  if (!dateStr) return "Not specified";
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = day;
  const suffix =
    d % 10 === 1 && d !== 11
      ? "st"
      : d % 10 === 2 && d !== 12
      ? "nd"
      : d % 10 === 3 && d !== 13
      ? "rd"
      : "th";
  const monthName = new Date(year, month - 1, 1).toLocaleString("default", {
    month: "short",
  });
  return `${d}${suffix} ${monthName} ${year}`;
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  const [hourStr, minStr] = timeStr.split(":");
  let h = parseInt(hourStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${minStr} ${ampm}`;
}

function timeAgo(ts) {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_CONFIG = {
  open: {
    label: "Open",
    icon: CircleDot,
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  "in-progress": {
    label: "In Progress",
    icon: Clock,
    bg: "bg-amber-50",
    text: "text-amber-600",
    border: "border-amber-200",
    dot: "bg-amber-400",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    bg: "bg-blue-50",
    text: "text-blue-600",
    border: "border-blue-200",
    dot: "bg-blue-500",
  },
  closed: {
    label: "Closed",
    icon: XCircle,
    bg: "bg-black/5",
    text: "text-black/50",
    border: "border-black/10",
    dot: "bg-black/30",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    bg: "bg-red-50",
    text: "text-red-500",
    border: "border-red-200",
    dot: "bg-red-400",
  },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function ProjectRow({ project, defaultCurrency, rates, userId, userName, userEmail }) {
  const [expanded, setExpanded] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [escrowProcessing, setEscrowProcessing] = useState(false);
  const [escrowMsg, setEscrowMsg] = useState(null);
  const { publicKey, sendTransaction, signTransaction } = useWallet();
  const { connection } = useConnection();

  const handleRelease = async () => {
    if (!publicKey || !project.approvedFreelancerWallet) return;
    setEscrowProcessing(true);
    setEscrowMsg(null);
    try {
      const freelancerKey = new PublicKey(project.approvedFreelancerWallet);
      const tx = await buildReleasePaymentTx(connection, publicKey, freelancerKey, project.id);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      const completedData = { status: "completed", paymentReleasedTx: sig };
      await Promise.all([
        updateDoc(doc(db, "projects", project.id), completedData),
        updateDoc(doc(db, "users", userId, "projectsAdded", project.id), completedData),
      ]);

      // Upload permanent gig record to Arweave
      if (project.approvedFreelancerUid) {
        try {
          const record = {
            platform: "GigProof",
            type: "completed_gig",
            projectId: project.id,
            projectTitle: project.title,
            freelancerWallet: project.approvedFreelancerWallet,
            clientWallet: publicKey.toString(),
            budget: project.budget,
            currency: project.currency || "USDC",
            escrowTx: project.escrowTx || null,
            paymentTx: sig,
            completedAt: new Date().toISOString(),
            description: project.description || "",
            tags: project.tags || [],
          };
          const txId = await uploadGigRecord(record);
          const gigDoc = {
            ...record,
            arweaveTx: txId,
            arweaveUrl: arweaveUrl(txId),
            projectTitle: project.title,
          };
          await setDoc(
            doc(db, "users", project.approvedFreelancerUid, "completedGigs", project.id),
            gigDoc
          );
        } catch (arweaveErr) {
          console.warn("Arweave upload skipped:", arweaveErr.message);
        }
      }

      // Notify freelancer that payment has been sent
      if (project.approvedFreelancerUid) {
        try {
          await addDoc(collection(db, "notifications"), {
            type: "payment_released",
            toUid: project.approvedFreelancerUid,
            fromUid: userId,
            fromName: userName,
            fromEmail: userEmail,
            projectId: project.id,
            projectTitle: project.title,
            budget: project.budget,
            currency: project.currency || "USDC",
            paymentTx: sig,
            read: false,
            createdAt: serverTimestamp(),
          });
        } catch (notifErr) {
          console.warn("Payment notification failed:", notifErr.message);
        }
      }

      setEscrowMsg({ type: "success", text: "Payment released!", tx: sig });
    } catch (e) {
      setEscrowMsg({ type: "error", text: e.message || "Transaction failed" });
    } finally {
      setEscrowProcessing(false);
    }
  };

  const handleCreateEscrow = async () => {
    if (!publicKey || !project.approvedFreelancerWallet) return;
    setEscrowProcessing(true);
    setEscrowMsg(null);
    try {
      const freelancerKey = new PublicKey(project.approvedFreelancerWallet);
      const amountUsdc = Math.round(Number(project.budget) * 1_000_000);
      const tx = await buildCreateEscrowTx(connection, publicKey, freelancerKey, project.id, amountUsdc);
      const signedTx = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signedTx.serialize(), { skipPreflight: true });
      await connection.confirmTransaction(sig, "confirmed");
      const escrowData = { escrowCreated: true, escrowTx: sig };
      await Promise.all([
        updateDoc(doc(db, "projects", project.id), escrowData),
        updateDoc(doc(db, "users", userId, "projectsAdded", project.id), escrowData),
      ]);
      setEscrowMsg({ type: "success", text: "Escrow funded!", tx: sig });
    } catch (e) {
      setEscrowMsg({ type: "error", text: e.message || "Transaction failed" });
    } finally {
      setEscrowProcessing(false);
    }
  };

  const handleRefund = async () => {
    if (!publicKey) return;
    setEscrowProcessing(true);
    setEscrowMsg(null);
    try {
      const tx = await buildRefundTx(connection, publicKey, project.id);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      await Promise.all([
        updateDoc(doc(db, "projects", project.id), { status: "cancelled", refundTx: sig, escrowCreated: false }),
        updateDoc(doc(db, "users", userId, "projectsAdded", project.id), { status: "cancelled", refundTx: sig, escrowCreated: false }),
      ]);
      setEscrowMsg({ type: "success", text: "Refund complete!", tx: sig });
    } catch (e) {
      setEscrowMsg({ type: "error", text: e.message || "Transaction failed" });
    } finally {
      setEscrowProcessing(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!userId || project.status === newStatus) return;
    setStatusUpdating(true);
    try {
      const fields = { status: newStatus };
      await updateDoc(doc(db, "users", userId, "projectsAdded", project.id), fields);
      await updateDoc(doc(db, "projects", project.id), fields);
    } catch (e) {
      console.error("Status update error:", e);
    } finally {
      setStatusUpdating(false);
    }
  };

  return (
    <div className="rounded-2xl border border-black/8 bg-white transition-all duration-200 hover:border-black/15 hover:shadow-sm">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-4 p-5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="font-semibold text-black truncate">{project.title}</h3>
            <StatusBadge status={project.status} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-black/40">
            {project.category && (
              <span className="flex items-center gap-1">
                <Layers size={11} />
                {project.category}
              </span>
            )}
            {project.isSameDay && project.startDate ? (
              <span className="flex items-center gap-1">
                <CalendarDays size={11} />
                {formatDate(project.startDate)}
                {project.startTime && project.endTime
                  ? ` · ${formatTime(project.startTime)} – ${formatTime(project.endTime)}`
                  : ""}
              </span>
            ) : project.durationDays > 0 ? (
              <span className="flex items-center gap-1">
                <CalendarDays size={11} />
                {project.durationDays} day{project.durationDays !== 1 ? "s" : ""}
                {project.endDate ? ` · due ${formatDate(project.endDate)}` : ""}
              </span>
            ) : project.deadline ? (
              <span className="flex items-center gap-1">
                <CalendarDays size={11} />
                Due {formatDate(project.deadline)}
              </span>
            ) : null}
            {project.createdAt && (
              <span className="flex items-center gap-1">
                <Clock size={11} />
                Posted {timeAgo(project.createdAt)}
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-semibold text-black text-sm">
            {formatBudget(project.budget, project.currency, defaultCurrency, rates)}
          </p>
          <p className="text-xs text-black/35 mt-0.5">Budget</p>
        </div>

        <div className="shrink-0 text-black/30">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-black/8 px-5 pb-5 pt-4 space-y-4">
          {project.description && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/35">
                Description
              </p>
              <p className="text-sm leading-relaxed text-black/70">
                {project.description}
              </p>
            </div>
          )}

          {project.requirements && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/35">
                Requirements
              </p>
              <p className="text-sm leading-relaxed text-black/70">
                {project.requirements}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-black/4 px-4 py-3">
              <p className="text-xs text-black/40">Experience</p>
              <p className="mt-0.5 text-sm font-semibold text-black">
                {project.experienceLevel || "Any"}
              </p>
            </div>
            <div className="rounded-xl bg-black/4 px-4 py-3">
              <p className="text-xs text-black/40">Currency</p>
              <p className="mt-0.5 text-sm font-semibold text-black">{project.currency || "—"}</p>
            </div>
            <div className="rounded-xl bg-black/4 px-4 py-3">
              <p className="text-xs text-black/40">Status</p>
              <p className="mt-0.5 text-sm font-semibold capitalize text-black">{project.status}</p>
            </div>
          </div>

          {project.tags?.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-black/35">
                <Tag size={11} /> Tags
              </p>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-black/10 bg-black/4 px-3 py-1 text-xs text-black"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {project.currency === "USDC" && (project.approvedFreelancerUid || project.escrowCreated || ["approved", "in-progress", "completed"].includes(project.status)) && (
            <div className="rounded-xl border border-black/8 bg-black/2 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-black/35">Escrow</p>
              {project.escrowTx && (
                <a
                  href={`https://solscan.io/tx/${project.escrowTx}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-black/50 hover:text-black transition"
                >
                  <Wallet size={11} />
                  USDC locked · view on Solscan
                </a>
              )}
              {escrowMsg && !project.paymentReleasedTx && (
                <div className={`text-xs px-3 py-2 rounded-lg ${escrowMsg.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                  {escrowMsg.text}
                  {escrowMsg.tx && (
                    <a href={`https://solscan.io/tx/${escrowMsg.tx}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="ml-2 underline">
                      View tx
                    </a>
                  )}
                </div>
              )}
              {project.paymentReleasedTx ? (
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 size={13} />
                  Payment released ·{" "}
                  <a
                    href={`https://solscan.io/tx/${project.paymentReleasedTx}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View tx
                  </a>
                </div>
              ) : project.escrowCreated ? (
                <div className="flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRelease(); }}
                    disabled={escrowProcessing || !publicKey}
                    className="rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white hover:bg-black/80 disabled:opacity-40 transition"
                  >
                    {escrowProcessing ? "Processing…" : "Release Payment"}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRefund(); }}
                    disabled={escrowProcessing || !publicKey}
                    className="rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-40 transition"
                  >
                    Refund
                  </button>
                </div>
              ) : project.approvedFreelancerWallet ? (
                <div className="space-y-2">
                  <p className="text-xs text-amber-600">
                    Escrow not yet funded — lock the payment before releasing it to the freelancer.
                  </p>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCreateEscrow(); }}
                    disabled={escrowProcessing || !publicKey}
                    className="rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white hover:bg-black/80 disabled:opacity-40 transition"
                  >
                    {escrowProcessing ? "Processing…" : "Fund Escrow"}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-black/40">
                  Freelancer wallet not on file — they need to connect Phantom on their Profile page before you can fund escrow.
                </p>
              )}
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/35">Update Status</p>
            <div className="flex flex-wrap gap-2">
              {["open", "in-progress", "completed", "closed"].map((s) => (
                <button
                  key={s}
                  onClick={(e) => { e.stopPropagation(); handleStatusChange(s); }}
                  disabled={statusUpdating || project.status === s}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition capitalize ${
                    project.status === s
                      ? "bg-black text-white"
                      : "bg-black/5 text-black hover:bg-black/10"
                  } disabled:opacity-40`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkHistory() {
  const { user } = useAuth();
  const { defaultCurrency, rates } = useCurrency();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("client");
  const [completedGigs, setCompletedGigs] = useState([]);

  useEffect(() => {
    if (!user) return;

    const ref = collection(db, "users", user.uid, "projectsAdded");
    const q = query(ref, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const ref = collection(db, "users", user.uid, "completedGigs");
    return onSnapshot(ref, (snap) => {
      setCompletedGigs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [user]);

  if (!user) return null;

  const openCount = projects.filter((p) => p.status === "open").length;
  const completedCount = projects.filter((p) => p.status === "completed").length;
  const inProgressCount = projects.filter((p) => p.status === "in-progress").length;

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-black/35 mb-1">
          Activity
        </p>
        <h1 className="text-2xl font-bold text-black">Work History</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { icon: <Briefcase size={15} className="text-black/60" />, bg: "bg-black/5", value: projects.length, label: "Jobs Posted" },
          { icon: <CircleDot size={15} className="text-emerald-500" />, bg: "bg-emerald-50", value: openCount, label: "Open" },
          { icon: <CheckCircle2 size={15} className="text-blue-500" />, bg: "bg-blue-50", value: completedCount, label: "Completed" },
          { icon: <TrendingUp size={15} className="text-amber-500" />, bg: "bg-amber-50", value: inProgressCount, label: "In Progress" },
        ].map(({ icon, bg, value, label }) => (
          <div key={label} className="rounded-2xl border border-black/8 bg-white p-4">
            <div className="mb-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${bg}`}>
                {icon}
              </div>
            </div>
            <p className="text-2xl font-bold text-black">{value}</p>
            <p className="text-xs text-black/40 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl bg-black/5 p-1 w-fit">
        <button
          onClick={() => setActiveTab("client")}
          className={`rounded-xl px-5 py-2 text-sm font-medium transition ${
            activeTab === "client"
              ? "bg-white text-black shadow-sm"
              : "text-black/50 hover:text-black"
          }`}
        >
          As Client
        </button>
        <button
          onClick={() => setActiveTab("freelancer")}
          className={`rounded-xl px-5 py-2 text-sm font-medium transition ${
            activeTab === "freelancer"
              ? "bg-white text-black shadow-sm"
              : "text-black/50 hover:text-black"
          }`}
        >
          As Freelancer
        </button>
      </div>

      {/* Client tab */}
      {activeTab === "client" && (
        <div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-black/5" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/15 p-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-black/5">
                <Briefcase size={24} className="text-black/30" />
              </div>
              <p className="font-semibold text-black/60">No jobs posted yet</p>
              <p className="mt-1 text-sm text-black/35">
                Head to Hire Talent to post your first project.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  defaultCurrency={defaultCurrency}
                  rates={rates}
                  userId={user.uid}
                  userName={user.displayName || user.email?.split("@")[0] || "Client"}
                  userEmail={user.email}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Freelancer tab */}
      {activeTab === "freelancer" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-black/8 bg-white p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black">
                <Star size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-black">On-Chain Reputation</h3>
                <p className="mt-1 text-sm text-black/55 leading-relaxed">
                  Every gig you complete on GigProof will be minted as a compressed NFT (cNFT) to your
                  Solana wallet via Metaplex Bubblegum. Your work history lives on-chain — permanent,
                  verifiable, and owned by you.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-black/8 bg-white p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black/5">
                <Wallet size={20} className="text-black/60" />
              </div>
              <div>
                <h3 className="font-semibold text-black">Escrow Payments</h3>
                <p className="mt-1 text-sm text-black/55 leading-relaxed">
                  Client funds are locked in a Solana smart contract escrow when you accept a job.
                  Payment is released to your wallet the moment the client approves your work — no
                  delays, no disputes about payment.
                </p>
              </div>
            </div>
          </div>

          {completedGigs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/15 p-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-black/5">
                <Briefcase size={24} className="text-black/25" />
              </div>
              <p className="font-semibold text-black/50">No completed gigs yet</p>
              <p className="mt-1 text-sm text-black/35">Browse Open Jobs to find your first project.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {completedGigs.map((gig) => (
                <div key={gig.id} className="rounded-2xl border border-black/8 bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-black truncate">{gig.projectTitle}</h3>
                      <p className="mt-0.5 text-xs text-black/40">
                        {gig.budget} {gig.currency} · {gig.completedAt ? new Date(gig.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
                      Completed
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {gig.arweaveTx && (
                      <a
                        href={gig.arweaveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-black/4 px-3 py-1 text-xs text-black/60 hover:text-black transition"
                      >
                        <Star size={10} />
                        Permanent record · Arweave
                      </a>
                    )}
                    {gig.paymentTx && (
                      <a
                        href={`https://solscan.io/tx/${gig.paymentTx}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-black/4 px-3 py-1 text-xs text-black/60 hover:text-black transition"
                      >
                        <Wallet size={10} />
                        Payment tx · Solscan
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
