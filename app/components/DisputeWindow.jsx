"use client";

import { useEffect, useState, useMemo } from "react";
import {
  collection, query, where, onSnapshot, addDoc, updateDoc, doc,
  serverTimestamp, getDocs, writeBatch,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "../context/AuthContext";
import {
  Scale, AlertTriangle, ChevronRight, X, CheckCircle2, Briefcase,
  ArrowLeft, Shield, Undo2, MessageSquare,
} from "lucide-react";

const ADMIN_EMAIL = "admin@gmail.com";

function wordCount(text) {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function timeAgo(ts) {
  if (!ts) return "";
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDate(val) {
  if (!val) return "—";
  let d;
  if (val?.toDate) d = val.toDate();
  else if (val?.seconds) d = new Date(val.seconds * 1000);
  else d = new Date(val);
  if (isNaN(d)) return String(val);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function DisputeStatusPill({ status }) {
  const map = {
    open: "bg-amber-100 text-amber-700",
    resolved: "bg-green-100 text-green-700",
    reverted: "bg-gray-100 text-gray-600",
    dismissed: "bg-red-100 text-red-600",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status ?? "open"}
    </span>
  );
}

function ProjectStatusPill({ status }) {
  const map = {
    open: "bg-green-100 text-green-800",
    "in-progress": "bg-blue-100 text-blue-800",
    completed: "bg-purple-100 text-purple-800",
    cancelled: "bg-red-100 text-red-800",
    draft: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${map[status?.toLowerCase()] ?? "bg-gray-100 text-gray-600"}`}>
      {status ?? "unknown"}
    </span>
  );
}

// ─── Dispute detail view ─────────────────────────────────────────────────────

function DisputeDetailView({ dispute, user, onBack }) {
  const [adminMessages, setAdminMessages] = useState([]);
  const [currentStatus, setCurrentStatus] = useState(dispute.status);

  // Revert flow
  const [showRevertForm, setShowRevertForm] = useState(false);
  const [revertReason, setRevertReason] = useState("");
  const [reverting, setReverting] = useState(false);

  const revertWords = revertReason.trim() === "" ? 0 : revertReason.trim().split(/\s+/).length;
  const canRevert = revertWords >= 5 && revertWords <= 300 && !reverting;

  // Listen for admin messages + mark them read on open
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("type", "==", "admin_message"),
      where("toUid", "==", user.uid),
      where("disputeId", "==", dispute.id)
    );
    return onSnapshot(q, async (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAdminMessages(msgs.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)));
      // Mark unread ones as read
      const unread = snap.docs.filter((d) => !d.data().read);
      if (unread.length > 0) {
        const batch = writeBatch(db);
        unread.forEach((d) => batch.update(d.ref, { read: true }));
        await batch.commit().catch(() => {});
      }
    });
  }, [user, dispute.id]);

  // Listen for live status updates on this dispute
  useEffect(() => {
    if (!dispute.id) return;
    return onSnapshot(doc(db, "disputes", dispute.id), (snap) => {
      if (snap.exists()) setCurrentStatus(snap.data().status);
    });
  }, [dispute.id]);

  const handleRevert = async () => {
    if (!canRevert) return;
    setReverting(true);
    try {
      await updateDoc(doc(db, "disputes", dispute.id), {
        status: "reverted",
        revertedAt: serverTimestamp(),
        revertedByUid: user.uid,
        revertReason: revertReason.trim(),
      });

      // Notify admin
      const adminSnap = await getDocs(
        query(collection(db, "users"), where("email", "==", ADMIN_EMAIL))
      );
      const adminUid = adminSnap.docs[0]?.id;
      if (adminUid) {
        await addDoc(collection(db, "notifications"), {
          type: "dispute_reverted",
          toUid: adminUid,
          fromUid: user.uid,
          fromName: user.displayName || user.email?.split("@")[0] || "User",
          fromEmail: user.email,
          disputeId: dispute.id,
          projectTitle: dispute.projectTitle,
          revertReason: revertReason.trim(),
          message: `${user.displayName || user.email} withdrew their dispute for "${dispute.projectTitle}": ${revertReason.trim()}`,
          read: false,
          createdAt: serverTimestamp(),
        });
      }
      setShowRevertForm(false);
      setRevertReason("");
    } catch (err) {
      console.error("Failed to revert dispute:", err);
    } finally {
      setReverting(false);
    }
  };

  const milestones = dispute.milestones ?? [];
  const isReverted = currentStatus === "reverted";
  const isResolved = currentStatus === "resolved";

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-semibold text-black/50 hover:text-black transition-colors"
      >
        <ArrowLeft size={15} /> Back to Disputes
      </button>

      {/* Header */}
      <div className="rounded-2xl bg-white border border-black/8 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-black/40 mb-1">Dispute Detail</p>
            <h2 className="text-lg font-bold text-black leading-snug">{dispute.projectTitle}</h2>
            <p className="text-xs text-black/40 mt-1">
              Filed {timeAgo(dispute.createdAt)} · as{" "}
              <span className="capitalize font-semibold">{dispute.submitterRole}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <DisputeStatusPill status={currentStatus} />
            {!isReverted && !isResolved && (
              <button
                onClick={() => setShowRevertForm((v) => !v)}
                className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 text-xs font-semibold transition-colors"
              >
                <Undo2 size={12} />
                {showRevertForm ? "Cancel" : "Withdraw Dispute"}
              </button>
            )}
          </div>
        </div>

        {isReverted && (
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-600 font-medium">
              You have withdrawn this dispute. The admin has been notified.
            </p>
            {dispute.revertReason && (
              <p className="text-xs text-gray-500 mt-1 italic">"{dispute.revertReason}"</p>
            )}
          </div>
        )}

        {isResolved && (
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3">
            <p className="text-xs text-green-700 font-medium flex items-center gap-1.5">
              <CheckCircle2 size={13} /> This dispute has been resolved by the admin.
            </p>
          </div>
        )}

        {/* Revert reason form */}
        {showRevertForm && !isReverted && (
          <div className="mt-4 space-y-3 rounded-xl border border-red-200 bg-red-50/50 p-4">
            <p className="text-xs font-bold text-red-600 uppercase tracking-wider">
              Why are you withdrawing this dispute?
            </p>
            <textarea
              value={revertReason}
              onChange={(e) => setRevertReason(e.target.value)}
              rows={4}
              placeholder="Explain your reason for withdrawing the dispute…"
              className="w-full rounded-xl border border-red-200 bg-white p-3 text-sm text-black outline-none focus:border-red-400 resize-none leading-relaxed"
            />
            <div className="flex items-center justify-between">
              <p className={`text-xs font-semibold ${
                revertWords === 0 ? "text-black/30" :
                revertWords < 5 ? "text-red-500" :
                "text-green-600"
              }`}>
                {revertWords} words{revertWords >= 5 ? " ✓" : " (min 5)"}
              </p>
              <button
                onClick={handleRevert}
                disabled={!canRevert}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                  canRevert
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-red-200 text-red-400 cursor-not-allowed"
                }`}
              >
                {reverting ? "Withdrawing…" : "Confirm Withdrawal"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dispute message */}
      <div className="rounded-2xl bg-white border border-black/8 p-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-black/40 mb-3">Your Dispute Message</h3>
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-4">
          <p className="text-sm text-black/80 leading-relaxed whitespace-pre-wrap">{dispute.message}</p>
        </div>
      </div>

      {/* Milestones */}
      {milestones.length > 0 && (
        <div className="rounded-2xl bg-white border border-black/8 p-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-black/40 mb-3">
            Milestones at Time of Dispute
          </h3>
          <ul className="space-y-2">
            {milestones.map((m, i) => (
              <li key={i} className="flex items-center justify-between rounded-xl bg-black/[0.03] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-black truncate">
                    {m.description ?? m.title ?? `Milestone ${i + 1}`}
                  </p>
                  <p className="text-xs text-black/40">{m.percentage ?? m.percent ?? "—"}% of budget</p>
                </div>
                <span className={`ml-3 shrink-0 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${
                  m.status === "approved" || m.status === "completed" ? "bg-green-100 text-green-700" :
                  m.status === "pending" ? "bg-blue-100 text-blue-700" :
                  m.status === "submitted" ? "bg-amber-100 text-amber-700" :
                  "bg-gray-100 text-gray-600"
                }`}>
                  {m.status ?? "not started"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Admin messages */}
      <div className="rounded-2xl bg-white border border-black/8 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={14} className="text-black/60" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-black/40">Messages from Admin</h3>
        </div>
        {adminMessages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/10 py-8 text-center">
            <MessageSquare size={22} className="mx-auto text-black/20 mb-2" />
            <p className="text-sm text-black/30">No admin messages yet.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {adminMessages.map((m) => (
              <li key={m.id} className="rounded-xl bg-black/[0.03] border border-black/8 px-4 py-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Shield size={12} className="text-black/60" />
                  <p className="text-xs font-bold text-black/60">GigProof Admin</p>
                  <p className="text-xs text-black/30 ml-auto">{timeAgo(m.createdAt)}</p>
                </div>
                <p className="text-sm text-black/80 leading-relaxed whitespace-pre-wrap">{m.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function DisputeWindow() {
  const { user } = useAuth();

  const [clientProjects, setClientProjects] = useState(null);
  const [freelancerProjects, setFreelancerProjects] = useState(null);
  const [myDisputes, setMyDisputes] = useState([]);
  const [viewingDispute, setViewingDispute] = useState(null);
  const [unreadDisputeIds, setUnreadDisputeIds] = useState(new Set());

  // Submit modal
  const [selectedProject, setSelectedProject] = useState(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db, "projects"), where("ownerId", "==", user.uid)),
      (snap) => setClientProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db, "projects"), where("approvedFreelancerUid", "==", user.uid)),
      (snap) => setFreelancerProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db, "disputes"), where("submittedByUid", "==", user.uid)),
      (snap) => setMyDisputes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(
        collection(db, "notifications"),
        where("type", "==", "admin_message"),
        where("toUid", "==", user.uid),
        where("read", "==", false)
      ),
      (snap) => {
        const ids = new Set(snap.docs.map((d) => d.data().disputeId).filter(Boolean));
        setUnreadDisputeIds(ids);
      }
    );
  }, [user]);

  const projects = useMemo(() => {
    if (clientProjects === null || freelancerProjects === null) return null;
    const map = new Map();
    clientProjects.forEach((p) => map.set(p.id, { ...p, myRole: "client" }));
    freelancerProjects.forEach((p) => {
      if (!map.has(p.id)) map.set(p.id, { ...p, myRole: "freelancer" });
    });
    return Array.from(map.values()).sort(
      (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
    );
  }, [clientProjects, freelancerProjects]);

  const loading = projects === null;

  const openDisputeProjectIds = useMemo(
    () => new Set(myDisputes.filter((d) => d.status === "open").map((d) => d.projectId)),
    [myDisputes]
  );

  const words = wordCount(message);
  const canSubmit = words >= 5 && words <= 300 && !submitting;

  const wordBarPct = Math.min(100, (words / 300) * 100);
  const wordBarColor =
    words === 0 ? "bg-black/10" :
    words < 5 ? "bg-red-400" :
    words <= 300 ? "bg-green-500" :
    "bg-red-500";
  const wordLabelColor =
    words === 0 ? "text-black/30" :
    words < 5 ? "text-red-500" :
    words <= 300 ? "text-green-600" :
    "text-red-500";

  const openModal = (project) => {
    setSelectedProject(project);
    setMessage("");
    setSubmitted(false);
  };

  const closeModal = () => {
    setSelectedProject(null);
    setMessage("");
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit || !selectedProject || !user) return;
    setSubmitting(true);
    try {
      const milestones = selectedProject.milestones ?? [];
      const transactions = [
        ...milestones.map((m) => m.releaseTx).filter(Boolean),
        selectedProject.paymentTx,
      ].filter(Boolean);

      await addDoc(collection(db, "disputes"), {
        projectId: selectedProject.id,
        projectTitle: selectedProject.title ?? "Untitled",
        projectBudget: selectedProject.budget ?? null,
        projectCurrency: selectedProject.currency ?? null,
        projectStatus: selectedProject.status ?? null,
        projectCategory: selectedProject.category ?? null,
        projectDescription: selectedProject.description ?? null,
        projectDeadline: selectedProject.deadline ?? null,
        milestones,
        transactions,
        clientUid: selectedProject.ownerId ?? null,
        freelancerUid: selectedProject.approvedFreelancerUid ?? null,
        submittedByUid: user.uid,
        submittedByName: user.displayName || user.email?.split("@")[0] || "User",
        submittedByEmail: user.email,
        submitterRole: selectedProject.myRole,
        message: message.trim(),
        status: "open",
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (err) {
      console.error("Failed to submit dispute:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // If viewing a specific dispute, show detail view
  if (viewingDispute) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl bg-black p-2.5 text-white">
            <Scale size={20} />
          </div>
          <h1 className="text-2xl font-bold text-black">Dispute Window</h1>
        </div>
        <DisputeDetailView
          dispute={viewingDispute}
          user={user}
          onBack={() => setViewingDispute(null)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="rounded-2xl bg-black p-2.5 text-white">
            <Scale size={20} />
          </div>
          <h1 className="text-2xl font-bold text-black">Dispute Window</h1>
        </div>
        <p className="text-sm text-black/50 ml-14">
          Select a project to file a dispute, or click a filed dispute to see its details and admin messages.
        </p>
      </div>

      {/* Filed disputes */}
      {myDisputes.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-black/40 mb-3">
            Your Disputes ({myDisputes.length})
          </h2>
          <div className="space-y-3">
            {[...myDisputes]
              .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
              .map((d) => (
                <button
                  key={d.id}
                  onClick={() => setViewingDispute(d)}
                  className="w-full flex items-center justify-between rounded-2xl border border-black/8 bg-white px-5 py-4 text-left hover:border-black/20 hover:shadow-sm transition-all"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-black truncate">{d.projectTitle}</p>
                    <p className="text-xs text-black/40 mt-0.5">
                      Filed {timeAgo(d.createdAt)} · as{" "}
                      <span className="capitalize">{d.submitterRole}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {unreadDisputeIds.has(d.id) && (
                      <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                    )}
                    <DisputeStatusPill status={d.status} />
                    <ChevronRight size={15} className="text-black/30" />
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Project tiles */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-black/40 mb-3">
        File a New Dispute
      </h2>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-black/30 animate-pulse">
          Loading projects…
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-black/8 bg-white py-16 text-center">
          <Briefcase size={32} className="text-black/20 mb-3" />
          <p className="font-semibold text-black/40">No projects found</p>
          <p className="text-xs text-black/30 mt-1">
            You have no projects as a client or freelancer yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => {
            const alreadyFiled = openDisputeProjectIds.has(project.id);
            return (
              <button
                key={project.id}
                onClick={() => !alreadyFiled && openModal(project)}
                disabled={alreadyFiled}
                className={`rounded-2xl border bg-white p-5 text-left transition-all ${
                  alreadyFiled
                    ? "border-black/8 opacity-60 cursor-not-allowed"
                    : "border-black/8 hover:border-black/25 hover:shadow-md cursor-pointer"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <p className="font-semibold text-black leading-snug line-clamp-2">
                    {project.title ?? "Untitled Project"}
                  </p>
                  {alreadyFiled ? (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      <AlertTriangle size={10} /> Filed
                    </span>
                  ) : (
                    <ChevronRight size={16} className="shrink-0 text-black/30 mt-0.5" />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ProjectStatusPill status={project.status} />
                  <span className="rounded-full bg-black/6 px-2.5 py-0.5 text-xs font-semibold capitalize text-black/60">
                    {project.myRole === "client" ? "You are the client" : "You are the freelancer"}
                  </span>
                  {project.budget && (
                    <span className="text-xs text-black/40">
                      {project.currency ?? ""} {project.budget}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Submit modal */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-black/8 px-6 py-5">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">
                  File a Dispute
                </p>
                <h3 className="font-bold text-black text-lg leading-snug truncate">
                  {selectedProject.title}
                </h3>
                <p className="text-xs text-black/40 mt-0.5">
                  Filing as the{" "}
                  <span className="font-semibold capitalize">{selectedProject.myRole}</span>
                </p>
              </div>
              <button
                onClick={closeModal}
                className="ml-4 shrink-0 rounded-full p-1.5 hover:bg-black/8 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {submitted ? (
              <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                <div className="rounded-full bg-green-100 p-4 mb-4">
                  <CheckCircle2 size={32} className="text-green-600" />
                </div>
                <p className="text-lg font-bold text-black mb-2">Dispute Submitted</p>
                <p className="text-sm text-black/50 max-w-xs">
                  Your dispute has been filed. Click it in "Your Disputes" to track status and see admin responses.
                </p>
                <button
                  onClick={closeModal}
                  className="mt-6 rounded-xl bg-black px-6 py-2.5 text-sm font-semibold text-white hover:bg-black/80 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-black/50 mb-2">
                    Describe your dispute in detail
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={9}
                    placeholder="Explain what happened, why you believe there is an issue, and what resolution you are seeking."
                    className="w-full rounded-xl border border-black/10 bg-black/[0.02] p-4 text-sm text-black outline-none focus:border-black/30 resize-none leading-relaxed"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-black/40">Min 5 words · Max 300 words</p>
                    <p className={`text-xs font-bold tabular-nums ${wordLabelColor}`}>
                      {words} / 300{words >= 5 && words <= 300 ? " ✓" : ""}
                    </p>
                  </div>
                </div>

                <div className="h-1.5 rounded-full bg-black/6 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-200 ${wordBarColor}`}
                    style={{ width: `${wordBarPct}%` }}
                  />
                </div>

                {words > 300 && (
                  <p className="text-xs text-red-500 font-medium -mt-1">
                    Please trim to 300 words or fewer.
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={closeModal}
                    className="flex-1 rounded-xl border border-black/10 py-2.5 text-sm font-semibold text-black/60 hover:bg-black/4 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                      canSubmit
                        ? "bg-black text-white hover:bg-black/80"
                        : "bg-black/10 text-black/30 cursor-not-allowed"
                    }`}
                  >
                    {submitting ? "Submitting…" : "Submit Dispute"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
