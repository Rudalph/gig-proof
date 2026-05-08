"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { collection, onSnapshot, orderBy, query, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useCurrency, formatBudget } from "../context/CurrencyContext";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Wallet, Briefcase, Bookmark, Award, Shield, ChevronRight, Zap, X, User } from "lucide-react";

function computeSuggestionScore(job, userProfile) {
  if (!userProfile) return 0;
  let score = 0;
  const userProfessions = (userProfile.professions || []).map((p) => p.toLowerCase());
  const userSkills = (userProfile.skills || "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const jobTitle = (job.title || "").toLowerCase();
  const jobCategory = (job.category || "").toLowerCase();
  const jobDescription = (job.description || "").toLowerCase();
  const jobTags = (job.tags || []).map((t) => t.toLowerCase());

  for (const prof of userProfessions) {
    if (jobCategory && (jobCategory.includes(prof) || prof.includes(jobCategory))) score += 4;
    if (jobTitle.includes(prof)) score += 3;
    if (jobTags.some((t) => t.includes(prof) || prof.includes(t))) score += 3;
  }
  for (const skill of userSkills) {
    if (jobTags.some((t) => t.includes(skill) || skill.includes(t))) score += 2;
    if (jobTitle.includes(skill)) score += 1.5;
    if (jobDescription.includes(skill)) score += 0.5;
  }
  if (userProfile.experienceLevel && job.experienceLevel === userProfile.experienceLevel) score += 2;
  return score;
}

function formatDeadline(dateStr) {
  if (!dateStr) return "No deadline";
  const [year, month, day] = dateStr.split("-").map(Number);
  const suffix =
    day % 10 === 1 && day !== 11 ? "st" :
    day % 10 === 2 && day !== 12 ? "nd" :
    day % 10 === 3 && day !== 13 ? "rd" : "th";
  const monthName = new Date(year, month - 1, 1).toLocaleString("default", { month: "short" });
  return `${day}${suffix} ${monthName}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const ROLE_LABEL = {
  Freelancer: "Freelancer",
  Client: "Client / Employer",
  Hiring: "Hiring",
  Both: "Freelancer & Employer",
};

function StatCard({ icon, label, value, muted, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-black/10 p-5 transition-all duration-200 hover:shadow-md hover:border-black/20 ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-center gap-2 mb-3 text-black/40">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`text-3xl font-semibold ${muted ? "text-black/25" : "text-black"}`}>{value}</p>
    </div>
  );
}

function PlaceholderCard({ icon, title, body }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/15 p-5 transition-all duration-200 hover:border-black/25">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="font-semibold text-sm">{title}</h2>
        <span className="ml-auto rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium text-black/40">
          Coming soon
        </span>
      </div>
      <p className="text-sm text-black/40">{body}</p>
    </div>
  );
}

export default function DashboardHome({ setActivePage }) {
  const { user } = useAuth();
  const { defaultCurrency, rates } = useCurrency();
  const { connected, publicKey, connect, disconnect, connecting, select, wallet } = useWallet();
  const connectRequestedRef = useRef(false);
  const { connection } = useConnection();

  const [phantomInstalled, setPhantomInstalled] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [solBalance, setSolBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [selectedPostedJob, setSelectedPostedJob] = useState(null);
  const [usdcLoading, setUsdcLoading] = useState(false);
  const [usdcResult, setUsdcResult] = useState(null);

  useEffect(() => {
    const check = () => {
      setPhantomInstalled(
        !!(window?.phantom?.solana?.isPhantom || window?.solana?.isPhantom)
      );
    };
    check();
    window.addEventListener("load", check);
    return () => window.removeEventListener("load", check);
  }, []);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setUserProfile(d);
        setBookmarkCount((d.bookmarks || []).length);
      }
    });
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  useEffect(() => {
    if (!connected || !publicKey) { setSolBalance(null); return; }
    setBalanceLoading(true);
    connection.getBalance(publicKey)
      .then((b) => setSolBalance((b / LAMPORTS_PER_SOL).toFixed(4)))
      .catch(() => setSolBalance("—"))
      .finally(() => setBalanceLoading(false));
  }, [connected, publicKey, connection]);

  useEffect(() => {
    if (!connected || !publicKey || !user) return;
    updateDoc(doc(db, "users", user.uid), { walletAddress: publicKey.toBase58() }).catch(console.error);
  }, [connected, publicKey, user]);


  const myJobs = useMemo(() => jobs.filter((j) => j.ownerId === user?.uid), [jobs, user]);
  const jobsPosted = myJobs.length;

  const topJobs = useMemo(() => {
    if (!userProfile) return [];
    return jobs
      .filter((j) => j.ownerId !== user?.uid)
      .map((j) => ({ ...j, _score: computeSuggestionScore(j, userProfile) }))
      .filter((j) => j._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 5);
  }, [jobs, userProfile, user]);

  const hasProfile = userProfile && (
    (userProfile.professions?.length > 0) || userProfile.skills?.trim()
  );

  const shortKey = publicKey
    ? `${publicKey.toBase58().slice(0, 6)}...${publicKey.toBase58().slice(-4)}`
    : null;

  const initials = (userProfile?.name || user?.email || "?")
    .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  useEffect(() => {
    if (connectRequestedRef.current && wallet) {
      connectRequestedRef.current = false;
      connect().catch(console.error);
    }
  }, [wallet, connect]);

  const handleConnect = () => {
    setConfirmAction(null);
    if (wallet) {
      connect().catch(console.error);
    } else {
      connectRequestedRef.current = true;
      select("Phantom");
    }
  };

  const handleDisconnect = () => {
    setConfirmAction(null);
    disconnect();
  };

  const handleGetTestUsdc = async () => {
    if (!publicKey) return;
    setUsdcLoading(true);
    setUsdcResult(null);
    try {
      const res = await fetch("/api/usdc/airdrop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toString() }),
      });
      const data = await res.json();
      if (data.success) setUsdcResult({ sig: data.signature });
      else setUsdcResult({ error: data.error || "Failed" });
    } catch {
      setUsdcResult({ error: "Network error" });
    } finally {
      setUsdcLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Welcome card */}
      <div className="rounded-2xl bg-black text-white p-6">
        <div className="flex items-start gap-5">
          {/* Profile picture placeholder */}
          <div className="shrink-0 w-16 h-16 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center">
            <span className="text-xl font-semibold text-white/80">{initials}</span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-white/50 text-xs">{greeting()}</p>
            <h1 className="text-2xl font-semibold mt-0.5 truncate">
              {userProfile?.name || user?.email?.split("@")[0]}
            </h1>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/55">
              {userProfile?.role && <span>{userProfile.role}</span>}
              {userProfile?.role && (userProfile?.city || userProfile?.country) && (
                <span className="text-white/25">·</span>
              )}
              {(userProfile?.city || userProfile?.country) && (
                <span>{[userProfile.city, userProfile.country].filter(Boolean).join(", ")}</span>
              )}
              {userProfile?.experienceLevel && (
                <>
                  <span className="text-white/25">·</span>
                  <span>{userProfile.experienceLevel}</span>
                </>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {/* Primary role badge */}
              {userProfile?.primaryRole && (
                <span className="rounded-full bg-white text-black px-3 py-0.5 text-xs font-semibold">
                  {ROLE_LABEL[userProfile.primaryRole] || userProfile.primaryRole}
                </span>
              )}
              {/* Profession pills */}
              {userProfile?.professions?.slice(0, 3).map((p) => (
                <span
                  key={p}
                  className="rounded-full border border-white/20 px-2.5 py-0.5 text-xs text-white/65"
                >
                  {p}
                </span>
              ))}
              {userProfile?.professions?.length > 3 && (
                <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-xs text-white/40">
                  +{userProfile.professions.length - 3} more
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<Briefcase size={15} />}
          label="Jobs Posted"
          value={jobsPosted}
          onClick={jobsPosted > 0 ? () => setActivePage("Hire Talent") : undefined}
        />
        <StatCard
          icon={<Bookmark size={15} />}
          label="Bookmarks Saved"
          value={bookmarkCount}
          onClick={bookmarkCount > 0 ? () => setActivePage("Open Jobs") : undefined}
        />
        <StatCard icon={<Award size={15} />} label="Gigs Completed" value="—" muted />
      </div>

      {/* Posted jobs carousel */}
      {myJobs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Briefcase size={15} className="text-black/40" />
              Your Posted Jobs
            </h2>
            <button
              onClick={() => setActivePage("Hire Talent")}
              className="flex items-center gap-1 text-xs text-black/40 hover:text-black transition"
            >
              Manage all <ChevronRight size={13} />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
            {myJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => setSelectedPostedJob(job)}
                className="shrink-0 w-64 cursor-pointer rounded-2xl border border-black/10 p-4 hover:shadow-md hover:border-black/25 transition-all duration-200 group"
              >
                <p className="font-semibold text-sm truncate group-hover:text-black/80">{job.title}</p>
                <p className="text-xs text-black/45 mt-0.5 truncate">{job.category}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-black/60">
                    {formatBudget(job.budget, job.currency, defaultCurrency, rates)}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    job.status === "open"
                      ? "bg-black/5 text-black/50"
                      : "bg-black text-white"
                  }`}>
                    {job.status || "open"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-black/35">Due {formatDeadline(job.deadline)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wallet + Top Jobs */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Wallet card */}
        <div className="rounded-2xl border border-black/10 p-5 transition-all duration-200 hover:shadow-md hover:border-black/20">
          <div className="flex items-center gap-2 mb-4">
            <Wallet size={15} className="text-black/40" />
            <h2 className="font-semibold text-sm">Phantom Wallet</h2>
            {connected && (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-green-600">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Connected
              </span>
            )}
          </div>

          {confirmAction ? (
            <div className="rounded-xl border border-black/10 bg-black/[0.03] p-4">
              <p className="text-sm font-medium mb-1">
                {confirmAction === "connect" ? "Connect Phantom wallet?" : "Disconnect wallet?"}
              </p>
              <p className="text-xs text-black/45 mb-4">
                {confirmAction === "connect"
                  ? "Phantom will ask you to approve the connection."
                  : "Your wallet address will be removed from this session."}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={confirmAction === "connect" ? handleConnect : handleDisconnect}
                  className="flex-1 rounded-xl bg-black text-white py-2 text-sm font-medium hover:bg-black/80 transition"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 rounded-xl border border-black/15 py-2 text-sm font-medium hover:border-black transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : !phantomInstalled ? (
            <div>
              <p className="text-sm text-black/45 mb-4 leading-relaxed">
                Phantom wallet extension not detected. Install it to enable USDC payments and on-chain reputation.
              </p>
              <a
                href="https://phantom.app"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center rounded-xl bg-black text-white py-2.5 text-sm font-medium hover:bg-black/80 transition"
              >
                Install Phantom
              </a>
            </div>
          ) : connected ? (
            <div className="space-y-2">
              <div className="rounded-xl bg-black/[0.04] px-4 py-3">
                <p className="text-[10px] font-medium text-black/40 uppercase tracking-wide mb-0.5">Address</p>
                <p className="font-mono text-sm font-medium">{shortKey}</p>
              </div>
              <div className="rounded-xl bg-black/[0.04] px-4 py-3">
                <p className="text-[10px] font-medium text-black/40 uppercase tracking-wide mb-0.5">Balance</p>
                <p className="font-semibold">
                  {balanceLoading ? "Loading..." : `${solBalance} SOL`}
                </p>
              </div>
              <button
                onClick={() => setConfirmAction("disconnect")}
                className="w-full mt-2 rounded-xl border border-black/15 py-2.5 text-sm font-medium hover:border-black hover:bg-black/[0.03] transition"
              >
                Disconnect
              </button>
              <button
                onClick={handleGetTestUsdc}
                disabled={usdcLoading}
                className="w-full rounded-xl border border-violet-200 bg-violet-50 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-100 transition disabled:opacity-50"
              >
                {usdcLoading ? "Sending…" : "Get 500 Test USDC"}
              </button>
              {usdcResult?.sig && (
                <p className="text-xs text-emerald-600 text-center">
                  500 USDC sent! &nbsp;
                  <a href={`https://solscan.io/tx/${usdcResult.sig}?cluster=devnet`} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    View tx
                  </a>
                </p>
              )}
              {usdcResult?.error && (
                <p className="text-xs text-red-500 text-center">{usdcResult.error}</p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-sm text-black/45 mb-4 leading-relaxed">
                Connect your Phantom wallet to enable USDC payments and on-chain reputation minting.
              </p>
              <button
                onClick={() => setConfirmAction("connect")}
                disabled={connecting}
                className="w-full rounded-xl bg-black text-white py-2.5 text-sm font-medium hover:bg-black/80 transition disabled:opacity-50"
              >
                {connecting ? "Connecting..." : "Connect Wallet"}
              </button>
            </div>
          )}
        </div>

        {/* Suggested jobs */}
        <div className="lg:col-span-2 rounded-2xl border border-black/10 p-5 transition-all duration-200 hover:shadow-md hover:border-black/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-black/40" />
              <h2 className="font-semibold text-sm">Suggested Jobs</h2>
            </div>
            <button
              onClick={() => setActivePage("Open Jobs")}
              className="flex items-center gap-1 text-xs text-black/40 hover:text-black transition"
            >
              View all <ChevronRight size={13} />
            </button>
          </div>

          {!hasProfile ? (
            <div className="rounded-xl bg-black/[0.03] p-4 text-sm text-black/50">
              Complete your{" "}
              <button onClick={() => setActivePage("Profile")} className="underline text-black font-medium">
                Profile
              </button>{" "}
              to see personalised job suggestions here.
            </div>
          ) : topJobs.length === 0 ? (
            <div className="rounded-xl bg-black/[0.03] p-4 text-sm text-black/50">
              No matching jobs right now. Check back soon or{" "}
              <button onClick={() => setActivePage("Open Jobs")} className="underline text-black font-medium">
                browse all jobs
              </button>.
            </div>
          ) : (
            <div className="space-y-2">
              {topJobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => setActivePage("Open Jobs")}
                  className="cursor-pointer rounded-xl border border-black/10 px-4 py-3 hover:border-black/30 hover:bg-black/[0.02] transition-all duration-150 flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate group-hover:text-black">{job.title}</p>
                    <p className="text-xs text-black/40 mt-0.5 truncate">
                      {[job.category, job.experienceLevel, formatDeadline(job.deadline)]
                        .filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold whitespace-nowrap">
                    {formatBudget(job.budget, job.currency, defaultCurrency, rates)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Gigs + Reputation placeholders */}
      <div className="grid gap-4 md:grid-cols-2">
        <PlaceholderCard
          icon={<Shield size={15} className="text-black/35" />}
          title="Active Gigs"
          body="Once the Solana escrow system is live, your funded gigs will appear here with real-time status — funded, delivered, or in dispute."
        />
        <PlaceholderCard
          icon={<Award size={15} className="text-black/35" />}
          title="On-chain Reputation"
          body="Every completed gig will be minted as a compressed NFT to your Solana wallet — a permanent, verifiable proof of your work history."
        />
      </div>

      {/* Posted job detail modal */}
      {selectedPostedJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelectedPostedJob(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white text-black shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-black/10 p-5">
              <div>
                <h2 className="text-lg font-semibold">{selectedPostedJob.title}</h2>
                <p className="text-xs text-black/45 mt-0.5">{selectedPostedJob.category}</p>
              </div>
              <button
                onClick={() => setSelectedPostedJob(null)}
                className="rounded-full p-2 hover:bg-black hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-black/70 leading-relaxed">{selectedPostedJob.description}</p>

              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Budget", formatBudget(selectedPostedJob.budget, selectedPostedJob.currency, defaultCurrency, rates)],
                  ["Deadline", formatDeadline(selectedPostedJob.deadline)],
                  ["Level", selectedPostedJob.experienceLevel || "Any"],
                  ["Status", selectedPostedJob.status || "open"],
                ].map(([label, val]) => (
                  <div key={label} className="rounded-xl bg-black/[0.04] px-4 py-3">
                    <p className="text-[10px] text-black/40 font-medium uppercase tracking-wide">{label}</p>
                    <p className="font-semibold text-sm mt-0.5 capitalize">{val}</p>
                  </div>
                ))}
              </div>

              {selectedPostedJob.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedPostedJob.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-black/10 px-3 py-1 text-xs">{tag}</span>
                  ))}
                </div>
              )}

              <button
                onClick={() => { setSelectedPostedJob(null); setActivePage("Hire Talent"); }}
                className="w-full rounded-xl bg-black text-white py-2.5 text-sm font-medium hover:bg-black/80 transition"
              >
                Manage in Hire Talent
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
