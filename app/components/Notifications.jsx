"use client";

import { useEffect, useState } from "react";
import {
  collection, query, where, onSnapshot,
  updateDoc, doc, addDoc, serverTimestamp, getDoc,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { buildCreateEscrowTx } from "@/app/lib/escrow";
import {
  Bell, Check, X, Mail, Briefcase, CheckCircle2, XCircle, User, MapPin,
} from "lucide-react";

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

export default function Notifications() {
  const { user } = useAuth();
  const { publicKey, sendTransaction, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("inbox");
  const [processing, setProcessing] = useState(null);
  const [declineModal, setDeclineModal] = useState(null);
  const [declineReason, setDeclineReason] = useState("");
  const [viewProfile, setViewProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [escrowError, setEscrowError] = useState(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("toUid", "==", user.uid)
    );
    return onSnapshot(q, (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.createdAt?.toDate?.()?.getTime() || 0;
          const tb = b.createdAt?.toDate?.()?.getTime() || 0;
          return tb - ta;
        });
      setNotifications(data);
      setLoading(false);
    });
  }, [user]);

  const contactRequests = notifications.filter((n) => n.type === "contact_request");
  const myUpdates = notifications.filter((n) =>
    n.type === "request_approved" || n.type === "request_declined"
  );

  const unreadInbox = contactRequests.filter((n) => !n.read).length;
  const unreadUpdates = myUpdates.filter((n) => !n.read).length;

  const markRead = async (notifId) => {
    try {
      await updateDoc(doc(db, "notifications", notifId), { read: true });
    } catch {}
  };

  const handleApprove = async (notif) => {
    setProcessing(notif.id);
    try {
      let escrowTx = null;

      // Attempt to lock USDC in escrow if Phantom is connected
      if (publicKey) {
        const [freelancerSnap, projectSnap] = await Promise.all([
          getDoc(doc(db, "users", notif.fromUid)),
          getDoc(doc(db, "projects", notif.projectId)),
        ]);
        const freelancerWallet = freelancerSnap.data()?.walletAddress;
        const budget = projectSnap.data()?.budget;

        if (freelancerWallet && budget && projectSnap.data()?.currency === "USDC") {
          const freelancerKey = new PublicKey(freelancerWallet);
          const amountUsdc = Math.round(Number(budget) * 1_000_000);
          const tx = await buildCreateEscrowTx(connection, publicKey, freelancerKey, notif.projectId, amountUsdc);
          const sim = await connection.simulateTransaction(tx);
          if (sim.value.err) {
            const errJson = JSON.stringify(sim.value.err);
            // ProgramAccountNotFound = RPC propagation lag; let Phantom handle it
            if (!errJson.includes("ProgramAccountNotFound")) {
              const logs = sim.value.logs?.join("\n") || errJson;
              setEscrowError(logs);
              return;
            }
          }
          let sig;
          try {
            const signedTx = await signTransaction(tx);
            sig = await connection.sendRawTransaction(signedTx.serialize(), { skipPreflight: true });
          } catch (sendErr) {
            const msg = sendErr.message || "";
            if (!msg.includes("rejected") && !msg.includes("User rejected")) {
              setEscrowError(msg || "Send failed");
            }
            return;
          }
          await connection.confirmTransaction(sig, "confirmed");
          escrowTx = sig;

          const escrowData = { escrowCreated: true, escrowTx: sig, approvedFreelancerWallet: freelancerWallet, approvedFreelancerUid: notif.fromUid };
          await Promise.all([
            updateDoc(doc(db, "projects", notif.projectId), escrowData),
            updateDoc(doc(db, "users", user.uid, "projectsAdded", notif.projectId), escrowData),
          ]);
        }
      }

      await updateDoc(doc(db, "notifications", notif.id), { status: "approved", read: true });
      await addDoc(collection(db, "notifications"), {
        type: "request_approved",
        toUid: notif.fromUid,
        fromUid: user.uid,
        fromEmail: user.email,
        fromName: user.displayName || user.email?.split("@")[0] || "User",
        projectId: notif.projectId,
        projectTitle: notif.projectTitle,
        status: "approved",
        read: false,
        createdAt: serverTimestamp(),
        ...(escrowTx ? { escrowTx } : {}),
      });
    } catch (e) {
      console.error("Approve error:", e);
    } finally {
      setProcessing(null);
    }
  };

  const handleDecline = async (notif, reason = "") => {
    setProcessing(notif.id);
    try {
      await updateDoc(doc(db, "notifications", notif.id), {
        status: "declined",
        read: true,
      });
      const payload = {
        type: "request_declined",
        toUid: notif.fromUid,
        fromUid: user.uid,
        fromEmail: user.email,
        fromName: user.displayName || user.email?.split("@")[0] || "User",
        projectId: notif.projectId,
        projectTitle: notif.projectTitle,
        status: "declined",
        read: false,
        createdAt: serverTimestamp(),
      };
      if (reason.trim()) payload.declineReason = reason.trim();
      await addDoc(collection(db, "notifications"), payload);
    } catch (e) {
      console.error("Decline error:", e);
    } finally {
      setProcessing(null);
    }
  };


  const handleViewProfile = async (notif) => {
    // Use profile snapshot embedded at send-time (no extra Firestore read needed)
    if (notif.senderProfile) {
      setViewProfile({
        uid: notif.fromUid,
        name: notif.fromName,
        ...notif.senderProfile,
      });
      return;
    }
    // Fallback for older notifications without embedded profile
    setProfileLoading(true);
    try {
      const snap = await getDoc(doc(db, "users", notif.fromUid));
      if (snap.exists()) {
        setViewProfile({ uid: notif.fromUid, ...snap.data() });
      } else {
        setViewProfile({ uid: notif.fromUid, name: notif.fromName, _noData: true });
      }
    } catch {
      setViewProfile({ uid: notif.fromUid, name: notif.fromName, _noData: true });
    }
    setProfileLoading(false);
  };

  if (!user) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-black/35 mb-1">Activity</p>
        <h1 className="text-2xl font-bold text-black">Notifications</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl bg-black/5 p-1 w-fit">
        <button
          onClick={() => setActiveTab("inbox")}
          className={`rounded-xl px-5 py-2 text-sm font-medium transition ${
            activeTab === "inbox" ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black"
          }`}
        >
          Inbox
          {unreadInbox > 0 && (
            <span className="ml-2 rounded-full bg-black text-white text-xs px-1.5 py-0.5">
              {unreadInbox}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("updates")}
          className={`rounded-xl px-5 py-2 text-sm font-medium transition ${
            activeTab === "updates" ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black"
          }`}
        >
          My Requests
          {unreadUpdates > 0 && (
            <span className="ml-2 rounded-full bg-black text-white text-xs px-1.5 py-0.5">
              {unreadUpdates}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-black/5" />
          ))}
        </div>
      ) : activeTab === "inbox" ? (
        <div className="space-y-3">
          {contactRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/15 p-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-black/5">
                <Bell size={24} className="text-black/25" />
              </div>
              <p className="font-semibold text-black/50">No contact requests yet</p>
              <p className="mt-1 text-sm text-black/35">
                When someone is interested in your job, you&apos;ll see it here.
              </p>
            </div>
          ) : (
            contactRequests.map((notif) => (
              <div
                key={notif.id}
                className={`rounded-2xl border p-5 transition ${
                  !notif.read ? "border-black/20 bg-white" : "border-black/8 bg-black/[0.01]"
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {!notif.read && (
                        <span className="h-2 w-2 rounded-full bg-black shrink-0" />
                      )}
                      <p className="text-sm font-semibold text-black">
                        {notif.fromName || notif.fromEmail}
                      </p>
                      <p className="text-xs text-black/40">is interested in your job</p>
                    </div>
                    <p className="text-xs text-black/50 flex items-center gap-1">
                      <Briefcase size={11} />
                      {notif.projectTitle}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-black/35">{timeAgo(notif.createdAt)}</span>
                </div>

                {notif.message && (
                  <p className="mb-3 rounded-xl bg-black/4 px-4 py-3 text-sm text-black/70 leading-relaxed">
                    &ldquo;{notif.message}&rdquo;
                  </p>
                )}

                <div className="mb-4">
                  <button
                    onClick={() => handleViewProfile(notif)}
                    disabled={profileLoading}
                    className="flex items-center gap-1.5 rounded-lg border border-black/15 px-3 py-1.5 text-xs font-medium text-black/70 transition hover:border-black hover:text-black disabled:opacity-50"
                  >
                    <User size={12} />
                    View Profile
                  </button>
                </div>

                {notif.status === "pending" ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleApprove(notif)}
                      disabled={processing === notif.id}
                      className="flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-medium text-white transition hover:bg-black/80 disabled:opacity-50"
                    >
                      <Check size={13} />
                      Approve
                    </button>
                    <button
                      onClick={() => { setDeclineModal(notif); setDeclineReason(""); }}
                      disabled={processing === notif.id}
                      className="flex items-center gap-1.5 rounded-xl border border-black/15 px-4 py-2 text-xs font-medium text-black/60 transition hover:border-red-300 hover:text-red-500 disabled:opacity-50"
                    >
                      <X size={13} />
                      Decline
                    </button>
                    {!notif.read && (
                      <button
                        onClick={() => markRead(notif.id)}
                        className="ml-auto rounded-lg bg-black px-3 py-1 text-xs font-medium text-white transition hover:bg-black/75"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={`flex items-center gap-1.5 text-xs font-medium ${
                        notif.status === "approved" ? "text-emerald-600" : "text-red-500"
                      }`}
                    >
                      {notif.status === "approved" ? (
                        <><CheckCircle2 size={13} /> Approved</>
                      ) : (
                        <><XCircle size={13} /> Declined</>
                      )}
                    </div>
                    {!notif.read && (
                      <button
                        onClick={() => markRead(notif.id)}
                        className="rounded-lg bg-black px-3 py-1 text-xs font-medium text-white transition hover:bg-black/75"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {myUpdates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/15 p-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-black/5">
                <Mail size={24} className="text-black/25" />
              </div>
              <p className="font-semibold text-black/50">No updates yet</p>
              <p className="mt-1 text-sm text-black/35">
                Responses to your contact requests will appear here.
              </p>
            </div>
          ) : (
            myUpdates.map((notif) => (
              <div
                key={notif.id}
                className={`rounded-2xl border p-5 transition ${
                  !notif.read ? "border-black/20 bg-white" : "border-black/8 bg-black/[0.01]"
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {!notif.read && (
                        <span className="h-2 w-2 rounded-full bg-black shrink-0" />
                      )}
                      <p className="text-xs text-black/50 flex items-center gap-1">
                        <Briefcase size={11} />
                        {notif.projectTitle}
                      </p>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 text-sm font-semibold ${
                        notif.type === "request_approved" ? "text-emerald-600" : "text-black/50"
                      }`}
                    >
                      {notif.type === "request_approved" ? (
                        <><CheckCircle2 size={15} /> Request approved</>
                      ) : (
                        <><XCircle size={15} /> Not selected this time</>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-xs text-black/35">{timeAgo(notif.createdAt)}</span>
                    {!notif.read && (
                      <button
                        onClick={() => markRead(notif.id)}
                        className="rounded-lg bg-black px-3 py-1 text-xs font-medium text-white transition hover:bg-black/75"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>

                {notif.type === "request_approved" && (
                  <div className="mt-2 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                    <p className="text-xs text-emerald-700 font-medium mb-1.5">
                      You can now contact the publisher directly:
                    </p>
                    <a
                      href={`mailto:${notif.fromEmail}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline"
                    >
                      <Mail size={14} />
                      {notif.fromEmail}
                    </a>
                  </div>
                )}

                {notif.type === "request_declined" && (
                  <div className="mt-2 space-y-2">
                    {notif.declineReason && (
                      <div className="rounded-xl bg-black/4 px-4 py-3">
                        <p className="text-xs text-black/40 mb-1">Reason given</p>
                        <p className="text-sm text-black/70 leading-relaxed">&ldquo;{notif.declineReason}&rdquo;</p>
                      </div>
                    )}
                    <p className="text-xs text-black/40 leading-relaxed">
                      The publisher wasn&apos;t able to move forward at this time — no worries, it&apos;s not a reflection of your skills.
                      You&apos;re welcome to send a new request after <span className="font-medium text-black/60">12 hours</span>, or explore other opportunities in Open Jobs.
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
      {escrowError !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-black mb-2">Transaction Failed</h3>
            <p className="text-sm text-black/60 leading-relaxed mb-2">
              There seems to be an error with the escrow transaction. Please try again after some time.
            </p>
            {escrowError && (
              <pre className="text-xs bg-black/5 rounded-lg p-3 overflow-auto max-h-40 text-black/50 whitespace-pre-wrap">{escrowError}</pre>
            )}
            <button
              onClick={() => setEscrowError(null)}
              className="mt-5 w-full rounded-xl bg-black py-2.5 text-sm font-medium text-white hover:bg-black/80 transition"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {viewProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setViewProfile(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white text-black shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/10 p-5">
              <h2 className="text-lg font-semibold">Freelancer Profile</h2>
              <button
                onClick={() => setViewProfile(null)}
                className="rounded-full p-2 transition hover:bg-black hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {viewProfile._noData ? (
                <div className="text-center py-6">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-black/8">
                    <User size={24} className="text-black/40" />
                  </div>
                  <p className="font-semibold">{viewProfile.name || "Unknown"}</p>
                  <p className="text-sm text-black/40 mt-1">Profile details not available</p>
                </div>
              ) : (<>
              {/* Name + role */}
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-black/8">
                  <User size={24} className="text-black/40" />
                </div>
                <div>
                  <p className="text-lg font-semibold leading-tight">{viewProfile.name || "—"}</p>
                  {viewProfile.role && (
                    <p className="text-sm text-black/50 mt-0.5">{viewProfile.role}</p>
                  )}
                  {(viewProfile.city || viewProfile.country) && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-black/40">
                      <MapPin size={11} />
                      {[viewProfile.city, viewProfile.country].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              </div>

              {/* Bio */}
              {viewProfile.bio && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-black/35 mb-1.5">Bio</p>
                  <p className="text-sm text-black/70 leading-relaxed">{viewProfile.bio}</p>
                </div>
              )}

              {/* Professions */}
              {viewProfile.professions?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-black/35 mb-2">Professions</p>
                  <div className="flex flex-wrap gap-2">
                    {viewProfile.professions.map((p) => (
                      <span key={p} className="rounded-full bg-black/8 px-3 py-1 text-xs font-medium text-black/70">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Skills */}
              {viewProfile.skills && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-black/35 mb-2">Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {viewProfile.skills.split(",").map((s) => s.trim()).filter(Boolean).map((s) => (
                      <span key={s} className="rounded-full border border-black/10 px-3 py-1 text-xs text-black/60">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Details row */}
              <div className="grid grid-cols-2 gap-3">
                {viewProfile.experienceLevel && (
                  <div className="rounded-xl bg-black/5 px-4 py-3">
                    <p className="text-xs text-black/40">Experience</p>
                    <p className="mt-1 text-sm font-semibold">{viewProfile.experienceLevel}</p>
                  </div>
                )}
                {viewProfile.availability && (
                  <div className="rounded-xl bg-black/5 px-4 py-3">
                    <p className="text-xs text-black/40">Availability</p>
                    <p className="mt-1 text-sm font-semibold">{viewProfile.availability}</p>
                  </div>
                )}
                {viewProfile.workType && (
                  <div className="rounded-xl bg-black/5 px-4 py-3">
                    <p className="text-xs text-black/40">Work Type</p>
                    <p className="mt-1 text-sm font-semibold">{viewProfile.workType}</p>
                  </div>
                )}
                {viewProfile.primaryRole && (
                  <div className="rounded-xl bg-black/5 px-4 py-3">
                    <p className="text-xs text-black/40">Primary Role</p>
                    <p className="mt-1 text-sm font-semibold">{viewProfile.primaryRole}</p>
                  </div>
                )}
              </div>
            </>)}
            </div>
          </div>
        </div>
      )}

      {declineModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => { setDeclineModal(null); setDeclineReason(""); }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white text-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold mb-1">Decline Request</h2>
                <p className="text-sm text-black/55">
                  Are you sure you want to decline{" "}
                  <span className="font-medium text-black">{declineModal.fromName || declineModal.fromEmail}</span>
                  &apos;s request for{" "}
                  <span className="font-medium text-black">{declineModal.projectTitle}</span>?
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-black/70 mb-1.5">
                  Reason{" "}
                  <span className="font-normal text-black/35">(optional — helps the applicant improve)</span>
                </label>
                <textarea
                  rows="3"
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="e.g. Looking for someone with more experience in..."
                  className="w-full rounded-xl border border-black/20 px-4 py-3 text-sm outline-none focus:border-black resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setDeclineModal(null); setDeclineReason(""); }}
                  className="flex-1 rounded-xl border border-black/20 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const notif = declineModal;
                    const reason = declineReason;
                    setDeclineModal(null);
                    setDeclineReason("");
                    await handleDecline(notif, reason);
                  }}
                  disabled={processing === declineModal?.id}
                  className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
                >
                  Yes, Decline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
