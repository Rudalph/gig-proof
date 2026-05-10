"use client";

import { useEffect, useState } from "react";
import {
  collection, query, where, onSnapshot,
  updateDoc, doc, addDoc, serverTimestamp, setDoc, deleteDoc,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { buildReleasePaymentTx, buildRefundTx, buildCreateEscrowTx, buildCreateAndReleaseTx, getEscrowPDA } from "@/app/lib/escrow";
import { uploadGigRecord, arweaveUrl } from "@/app/lib/arweave";
import {
  CheckCircle2, Clock, Send, Shield, AlertTriangle, X, User, Zap, RotateCcw, Trash2,
} from "lucide-react";

function MilestoneRow({ index, milestone, state, isFunded, canSubmit, onSubmit, processing }) {
  const status = state?.status || "pending";
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-black/5 last:border-0">
      <span className={`shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
        status === "approved" ? "bg-emerald-100 text-emerald-700"
        : status === "submitted" ? "bg-amber-100 text-amber-700"
        : isFunded ? "bg-violet-100 text-violet-700"
        : "bg-black/8 text-black/50"
      }`}>
        {status === "approved" ? <CheckCircle2 size={13} /> : index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-black/80 truncate">{milestone.description}</p>
        {status === "submitted" && state?.message && (
          <p className="text-xs text-black/40 truncate mt-0.5">&ldquo;{state.message}&rdquo;</p>
        )}
      </div>
      <span className="shrink-0 text-xs font-semibold text-black/60">{milestone.percentage}%</span>
      {status === "approved" ? (
        <span className="shrink-0 text-xs font-medium text-emerald-600 flex items-center gap-1">
          <CheckCircle2 size={12} /> Paid
        </span>
      ) : status === "submitted" ? (
        <span className="shrink-0 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700">
          Awaiting approval
        </span>
      ) : canSubmit ? (
        <button
          onClick={() => onSubmit(index, milestone.description)}
          disabled={!!processing}
          className="shrink-0 flex items-center gap-1 rounded-xl bg-black px-3 py-1.5 text-xs font-medium text-white transition hover:bg-black/80 disabled:opacity-50"
        >
          <Send size={11} />
          Mark Done
        </button>
      ) : isFunded ? (
        <span className="shrink-0 rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-[10px] font-medium text-violet-600">
          In escrow
        </span>
      ) : (
        <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium text-black/35">
          Not yet funded
        </span>
      )}
    </div>
  );
}

function ClientMilestoneRow({ index, milestone, state, onApprove, processing }) {
  const status = state?.status || "pending";
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-black/5 last:border-0">
      <span className={`shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
        status === "approved" ? "bg-emerald-100 text-emerald-700"
        : status === "submitted" ? "bg-amber-100 text-amber-700"
        : "bg-black/8 text-black/50"
      }`}>
        {status === "approved" ? <CheckCircle2 size={13} /> : index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-black/80 truncate">{milestone.description}</p>
        {status === "submitted" && state?.message && (
          <p className="text-xs text-black/40 truncate mt-0.5">&ldquo;{state.message}&rdquo;</p>
        )}
      </div>
      <span className="shrink-0 text-xs font-semibold text-black/60">{milestone.percentage}%</span>
      {status === "approved" ? (
        <span className="shrink-0 text-xs font-medium text-emerald-600 flex items-center gap-1">
          <CheckCircle2 size={12} /> Released
        </span>
      ) : status === "submitted" ? (
        <button
          onClick={() => onApprove(index)}
          disabled={!!processing}
          className="shrink-0 flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          <CheckCircle2 size={11} />
          Approve
        </button>
      ) : (
        <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium text-black/35">
          Pending
        </span>
      )}
    </div>
  );
}

export default function ActiveGigs() {
  const { user } = useAuth();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const { connection } = useConnection();

  const [notifications, setNotifications] = useState([]);
  const [contactRequestMap, setContactRequestMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(null);

  // Milestone submit modal (freelancer)
  const [submitModal, setSubmitModal] = useState(null);
  const [submitMessage, setSubmitMessage] = useState("");
  const [processing, setProcessing] = useState(null);
  const [releaseError, setReleaseError] = useState(null);

  // Refund modal (client cancels gig)
  const [refundModal, setRefundModal] = useState(null);
  const [refundProcessing, setRefundProcessing] = useState(false);
  const [refundError, setRefundError] = useState(null);
  const [deletingGig, setDeletingGig] = useState(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "notifications"), where("toUid", "==", user.uid));
    return onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [user]);

  const freelancerGigs = notifications.filter(
    (n) => n.type === "request_approved" && n.originalRequestId
  );
  const clientGigs = notifications.filter(
    (n) => n.type === "contact_request" && n.status === "approved" && !n.gigCompleted
  );
  const visibleFreelancerGigs = freelancerGigs.filter(
    (gig) => !contactRequestMap[gig.originalRequestId]?.gigCompleted
  );

  // Auto-select tab only once data has loaded (not while notifications = [])
  useEffect(() => {
    if (loading || activeTab !== null) return;
    if (freelancerGigs.length > 0) setActiveTab("freelancer");
    else if (clientGigs.length > 0) setActiveTab("client");
    else setActiveTab("freelancer");
  }, [loading, freelancerGigs.length, clientGigs.length, activeTab]);

  // Subscribe to contact_request docs for freelancer gigs (for live milestoneStates)
  const requestIds = freelancerGigs
    .map((g) => g.originalRequestId)
    .filter(Boolean)
    .join(",");

  useEffect(() => {
    if (!requestIds) return;
    const ids = requestIds.split(",");
    const unsubs = ids.map((id) =>
      onSnapshot(doc(db, "notifications", id), (snap) => {
        if (snap.exists()) {
          setContactRequestMap((prev) => ({ ...prev, [id]: { id: snap.id, ...snap.data() } }));
        }
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [requestIds]);

  const handleMilestoneSubmit = async () => {
    if (!submitModal || !submitMessage.trim()) return;
    const { contactRequestId, milestoneIndex, milestoneName } = submitModal;
    setProcessing(`submit_${contactRequestId}_${milestoneIndex}`);
    try {
      const cr = contactRequestMap[contactRequestId];
      if (!cr) return;
      const newStates = (cr.milestoneStates || []).map((s, i) =>
        i === milestoneIndex
          ? { ...s, status: "submitted", message: submitMessage.trim(), submittedAt: new Date().toISOString() }
          : s
      );
      await updateDoc(doc(db, "notifications", contactRequestId), { milestoneStates: newStates });
      await addDoc(collection(db, "notifications"), {
        type: "milestone_submitted",
        toUid: cr.toUid,
        fromUid: user.uid,
        fromEmail: user.email,
        fromName: user.displayName || user.email?.split("@")[0] || "Freelancer",
        projectId: cr.projectId,
        projectTitle: cr.projectTitle,
        milestoneIndex,
        milestoneName,
        message: submitMessage.trim(),
        contactRequestId,
        read: false,
        createdAt: serverTimestamp(),
      });
      setSubmitModal(null);
      setSubmitMessage("");
    } catch (e) {
      console.error("Milestone submit error:", e);
    } finally {
      setProcessing(null);
    }
  };

  const handleMilestoneApprove = async (contactRequest, milestoneIndex) => {
    setProcessing(`approve_${contactRequest.id}_${milestoneIndex}`);
    setReleaseError(null);
    try {
      if (contactRequest.escrowFunded && !publicKey) {
        setReleaseError("Connect your Phantom wallet to release this payment from escrow.");
        setProcessing(null);
        return;
      }

      const milestones = contactRequest.agreedMilestones ||
        contactRequest.currentMilestoneSplit ||
        [{ description: "Project Completion", percentage: 100 }];

      const newStates = (contactRequest.milestoneStates || []).map((s, i) =>
        i === milestoneIndex
          ? { ...s, status: "approved", approvedAt: new Date().toISOString() }
          : s
      );
      const allApproved = newStates.every((s) => s.status === "approved");

      let paymentTx = null;
      let nextEscrowTx = null;
      let nextMsProjectId = null;
      let nextAmountUsdc = null;

      if (contactRequest.escrowFunded && publicKey) {
        const freelancerAddr = contactRequest.freelancerWalletAddress || contactRequest.approvedFreelancerWallet;
        if (freelancerAddr) {
          const freelancerKey = new PublicKey(freelancerAddr);
          const milestoneEscrows = contactRequest.milestoneEscrows;
          const totalUsdc = Math.round(Number(contactRequest.escrowBudget) * 1_000_000);

          // Determine which escrow to release
          let escrowProjectId;
          if (milestoneEscrows?.length > 0) {
            escrowProjectId = milestoneEscrows[milestoneIndex]?.projectId
              || `${contactRequest.projectId}_m${milestoneIndex}`;
          } else if (allApproved) {
            escrowProjectId = contactRequest.projectId;
          }

          if (escrowProjectId) {
            try {
              const nextIdx = milestoneIndex + 1;
              const hasNextMilestone = !allApproved && milestones[nextIdx];
              const nextAlreadyFunded = milestoneEscrows?.[nextIdx]?.tx;

              // Check on-chain: does the escrow to be released actually exist?
              const escrowPDAKey = getEscrowPDA(publicKey, escrowProjectId);
              const escrowInfo = await connection.getAccountInfo(escrowPDAKey);
              const escrowExistsOnChain = escrowInfo !== null && escrowInfo.data.length > 0;

              if (!escrowExistsOnChain) {
                // Escrow missing on-chain — create + release in one atomic transaction
                const msAmount = Math.round((milestones[milestoneIndex].percentage / 100) * totalUsdc);
                const { tx: crTx, blockhash: crBh, lastValidBlockHeight: crLvbh } =
                  await buildCreateAndReleaseTx(connection, publicKey, freelancerKey, escrowProjectId, msAmount);
                const signedCR = await signTransaction(crTx);
                const crSig = await connection.sendRawTransaction(signedCR.serialize(), { skipPreflight: true });
                const crConfirm = await connection.confirmTransaction(
                  { signature: crSig, blockhash: crBh, lastValidBlockHeight: crLvbh }, "confirmed"
                );
                if (crConfirm.value.err) throw new Error(`Release failed on-chain: ${JSON.stringify(crConfirm.value.err)}`);
                paymentTx = crSig;

                if (hasNextMilestone && !nextAlreadyFunded) {
                  nextMsProjectId = `${contactRequest.projectId}_m${nextIdx}`;
                  nextAmountUsdc = Math.round((milestones[nextIdx].percentage / 100) * totalUsdc);
                  try {
                    const { tx: nTx, blockhash: nBh, lastValidBlockHeight: nLvbh } =
                      await buildCreateEscrowTx(connection, publicKey, freelancerKey, nextMsProjectId, nextAmountUsdc);
                    const signedN = await signTransaction(nTx);
                    const nSig = await connection.sendRawTransaction(signedN.serialize(), { skipPreflight: true });
                    const nConfirm = await connection.confirmTransaction(
                      { signature: nSig, blockhash: nBh, lastValidBlockHeight: nLvbh }, "confirmed"
                    );
                    if (!nConfirm.value.err) nextEscrowTx = nSig;
                  } catch { /* next escrow funding failed — non-fatal, can retry */ }
                }
              } else if (hasNextMilestone && !nextAlreadyFunded) {
                // Release current + fund next, sign together
                const { tx: releaseTx, blockhash: rBh, lastValidBlockHeight: rLvbh } =
                  await buildReleasePaymentTx(connection, publicKey, freelancerKey, escrowProjectId);
                nextMsProjectId = `${contactRequest.projectId}_m${nextIdx}`;
                nextAmountUsdc = Math.round((milestones[nextIdx].percentage / 100) * totalUsdc);
                const { tx: createNextTx, blockhash: cBh, lastValidBlockHeight: cLvbh } =
                  await buildCreateEscrowTx(connection, publicKey, freelancerKey, nextMsProjectId, nextAmountUsdc);

                const [signedRelease, signedCreate] = await signAllTransactions([releaseTx, createNextTx]);

                const releaseSig = await connection.sendRawTransaction(signedRelease.serialize(), { skipPreflight: true });
                const releaseConfirm = await connection.confirmTransaction(
                  { signature: releaseSig, blockhash: rBh, lastValidBlockHeight: rLvbh }, "confirmed"
                );
                if (releaseConfirm.value.err) throw new Error(`Release failed on-chain: ${JSON.stringify(releaseConfirm.value.err)}`);
                paymentTx = releaseSig;

                const createSig = await connection.sendRawTransaction(signedCreate.serialize(), { skipPreflight: true });
                const createConfirm = await connection.confirmTransaction(
                  { signature: createSig, blockhash: cBh, lastValidBlockHeight: cLvbh }, "confirmed"
                );
                if (!createConfirm.value.err) nextEscrowTx = createSig;
                else throw new Error(`Next milestone escrow funding failed: ${JSON.stringify(createConfirm.value.err)}`);
              } else {
                // Last milestone (or next already funded): just release
                const { tx, blockhash: rBh, lastValidBlockHeight: rLvbh } =
                  await buildReleasePaymentTx(connection, publicKey, freelancerKey, escrowProjectId);
                const signedTx = await signTransaction(tx);
                const sig = await connection.sendRawTransaction(signedTx.serialize(), { skipPreflight: true });
                const confirm = await connection.confirmTransaction(
                  { signature: sig, blockhash: rBh, lastValidBlockHeight: rLvbh }, "confirmed"
                );
                if (confirm.value.err) throw new Error(`Release failed on-chain: ${JSON.stringify(confirm.value.err)}`);
                paymentTx = sig;
              }
            } catch (releaseErr) {
              console.error("Escrow release error:", releaseErr);
              const msg = releaseErr?.message || String(releaseErr) || "";
              if (!msg.includes("rejected") && !msg.includes("User rejected")) {
                setReleaseError(msg || "Escrow release failed");
              }
              return;
            }
          }
        }
      }

      // Update milestone states
      await updateDoc(doc(db, "notifications", contactRequest.id), {
        milestoneStates: newStates,
        ...(allApproved ? { gigCompleted: true } : {}),
      });

      // Update milestoneEscrows array
      if (paymentTx && contactRequest.milestoneEscrows) {
        const updatedEscrows = (contactRequest.milestoneEscrows || []).map((e, i) =>
          i === milestoneIndex ? { ...e, released: true, releaseTx: paymentTx } : e
        );
        if (nextEscrowTx && nextMsProjectId) {
          updatedEscrows.push({ projectId: nextMsProjectId, tx: nextEscrowTx, amountUsdc: nextAmountUsdc, released: false });
        }
        await updateDoc(doc(db, "notifications", contactRequest.id), {
          milestoneEscrows: updatedEscrows,
          ...(allApproved ? { escrowReleased: true } : {}),
        });
      }

      // Arweave upload on full completion
      const milestone = milestones[milestoneIndex];
      const isFullPayment = allApproved && paymentTx;
      if (isFullPayment) {
        try {
          const freelancerWallet = contactRequest.freelancerWalletAddress || contactRequest.approvedFreelancerWallet || null;
          const clientWallet = publicKey?.toString() || null;
          const record = {
            projectId: contactRequest.projectId,
            projectTitle: contactRequest.projectTitle,
            clientUid: user.uid,
            freelancerUid: contactRequest.fromUid,
            clientWallet,
            freelancerWallet,
            budget: contactRequest.escrowBudget,
            currency: "USDC",
            description: contactRequest.description || "",
            tags: contactRequest.tags || [],
            milestones: milestones.map((m, i) => ({
              description: m.description,
              percentage: m.percentage,
              ...(newStates[i] || {}),
              releaseTx: contactRequest.milestoneEscrows?.[i]?.releaseTx || (i === milestoneIndex ? paymentTx : null),
            })),
            completedAt: new Date().toISOString(),
            paymentTx,
          };
          const arweaveTxId = await uploadGigRecord(record);
          const sharedFields = {
            projectId: contactRequest.projectId,
            projectTitle: contactRequest.projectTitle,
            budget: contactRequest.escrowBudget,
            currency: "USDC",
            platform: "GigProof",
            type: "completed_gig",
            description: contactRequest.description || "",
            tags: contactRequest.tags || [],
            clientWallet,
            freelancerWallet,
            completedAt: new Date().toISOString(),
            arweaveTx: arweaveTxId,
            arweaveUrl: arweaveUrl(arweaveTxId),
            paymentTx,
            milestones: record.milestones,
          };
          await setDoc(
            doc(db, "users", contactRequest.fromUid, "completedGigs", contactRequest.projectId),
            sharedFields
          );
          await setDoc(
            doc(db, "users", user.uid, "completedGigs", contactRequest.projectId),
            { ...sharedFields, role: "client" }
          );
        } catch (arweaveErr) {
          console.error("Arweave upload failed (non-fatal):", arweaveErr);
        }
      }

      // Notify freelancer
      await addDoc(collection(db, "notifications"), {
        type: isFullPayment ? "payment_released" : "milestone_approved",
        toUid: contactRequest.fromUid,
        fromUid: user.uid,
        fromEmail: user.email,
        fromName: user.displayName || user.email?.split("@")[0] || "Client",
        projectId: contactRequest.projectId,
        projectTitle: contactRequest.projectTitle,
        milestoneIndex,
        milestoneName: milestone?.description,
        milestonePercentage: milestone?.percentage,
        ...(isFullPayment ? {
          budget: contactRequest.escrowBudget,
          currency: "USDC",
          paymentTx,
        } : paymentTx ? {
          paymentTx,
          budget: contactRequest.milestoneEscrows?.[milestoneIndex]
            ? ((contactRequest.milestoneEscrows[milestoneIndex].amountUsdc || 0) / 1_000_000).toFixed(2)
            : null,
          currency: "USDC",
        } : {}),
        ...(nextEscrowTx ? {
          nextEscrowTx,
          nextMilestoneIndex: milestoneIndex + 1,
          nextAmountUsdc,
          nextMilestoneName: milestones[milestoneIndex + 1]?.description,
        } : {}),
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Milestone approve error:", e);
    } finally {
      setProcessing(null);
    }
  };

  const handleRefund = async (contactRequest) => {
    if (!publicKey) { setRefundError("Connect your Phantom wallet to refund."); return; }
    setRefundProcessing(true);
    setRefundError(null);
    try {
      const milestoneEscrows = contactRequest.milestoneEscrows;
      let sigs = [];

      if (milestoneEscrows && milestoneEscrows.length > 0) {
        // Per-milestone escrow: refund each unreleased one
        const unreleasedEscrows = milestoneEscrows.filter((e) => !e.released);
        if (unreleasedEscrows.length === 0) {
          setRefundError("All milestone payments have already been released.");
          setRefundProcessing(false);
          return;
        }
        const buildResults = await Promise.all(
          unreleasedEscrows.map((e) => buildRefundTx(connection, publicKey, e.projectId))
        );
        const refundTxs = buildResults.map((r) => r.tx);
        const signedTxs = await signAllTransactions(refundTxs);
        sigs = await Promise.all(
          signedTxs.map((st) =>
            connection.sendRawTransaction(st.serialize(), { skipPreflight: true })
          )
        );
        const updatedEscrows = milestoneEscrows.map((e) => {
          const idx = unreleasedEscrows.findIndex((u) => u.projectId === e.projectId);
          return idx >= 0 ? { ...e, released: true, refundTx: sigs[idx] } : e;
        });
        await updateDoc(doc(db, "notifications", contactRequest.id), {
          milestoneEscrows: updatedEscrows,
          escrowRefunded: true,
          status: "refunded",
        });
      } else if (contactRequest.escrowFunded) {
        // Single escrow fallback
        const { tx: refundTx } =
          await buildRefundTx(connection, publicKey, contactRequest.projectId);
        const signedTx = await signTransaction(refundTx);
        const sig = await connection.sendRawTransaction(signedTx.serialize(), { skipPreflight: true });
        sigs = [sig];
        await updateDoc(doc(db, "notifications", contactRequest.id), {
          escrowRefunded: true,
          status: "refunded",
          refundTx: sig,
        });
      } else {
        setRefundError("No funded escrow found for this gig.");
        setRefundProcessing(false);
        return;
      }

      await addDoc(collection(db, "notifications"), {
        type: "gig_cancelled",
        toUid: contactRequest.fromUid,
        fromUid: user.uid,
        fromEmail: user.email,
        fromName: user.displayName || user.email?.split("@")[0] || "Client",
        projectId: contactRequest.projectId,
        projectTitle: contactRequest.projectTitle,
        refundTx: sigs[0] || null,
        read: false,
        createdAt: serverTimestamp(),
      });

      setRefundModal(null);
    } catch (err) {
      const msg = err.message || "";
      if (!msg.includes("rejected") && !msg.includes("User rejected")) {
        setRefundError(msg || "Refund failed. Please try again.");
      }
    } finally {
      setRefundProcessing(false);
    }
  };

  const handleDeleteGig = async (gigId) => {
    setDeletingGig(gigId);
    try {
      await deleteDoc(doc(db, "notifications", gigId));
    } catch (e) {
      console.error("Delete gig error:", e);
    } finally {
      setDeletingGig(null);
    }
  };

  if (!user) return null;

  const showBothTabs = visibleFreelancerGigs.length > 0 && clientGigs.length > 0;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-black/35 mb-1">In Progress</p>
        <h1 className="text-2xl font-bold text-black">Active Gigs</h1>
      </div>

      {showBothTabs && (
        <div className="flex gap-1 rounded-2xl bg-black/5 p-1 w-fit">
          {[["freelancer", "As Freelancer"], ["client", "As Client"]].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setActiveTab(val)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                activeTab === val ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {loading || activeTab === null ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-black/5" />)}
        </div>
      ) : activeTab === "freelancer" ? (
        visibleFreelancerGigs.length === 0 ? (
          <EmptyState
            title="No active gigs as freelancer"
            body="When a client approves your request and funds the escrow, your active gigs will appear here."
          />
        ) : (
          <div className="space-y-4">
            {visibleFreelancerGigs.map((gig) => {
              const cr = contactRequestMap[gig.originalRequestId];
              const milestones = gig.agreedMilestones || (cr?.agreedMilestones) || (cr?.currentMilestoneSplit) || [{ description: "Project Completion", percentage: 100 }];
              const milestoneStates = cr?.milestoneStates || milestones.map(() => ({ status: "pending" }));
              const allDone = milestoneStates.every((s) => s.status === "approved");
              return (
                <div key={gig.id} className="rounded-2xl border border-black/12 bg-white p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-base text-black truncate">{gig.projectTitle}</p>
                      <p className="text-xs text-black/40 mt-0.5">Client: {gig.fromName || gig.fromEmail}</p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <button
                        onClick={() => handleDeleteGig(gig.id)}
                        disabled={deletingGig === gig.id}
                        className="p-1 rounded-lg text-black/25 hover:text-red-500 hover:bg-red-50 transition"
                        title="Remove from Active Gigs"
                      >
                        <Trash2 size={13} />
                      </button>
                      {gig.escrowBudget && (
                        <p className="text-sm font-bold text-black">{gig.escrowBudget} USDC</p>
                      )}
                      {allDone ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <CheckCircle2 size={12} /> Complete
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                          <Clock size={12} /> In Progress
                        </span>
                      )}
                    </div>
                  </div>

                  {cr?.milestoneEscrows?.length > 0 ? (
                    <div className="space-y-1.5">
                      {cr.milestoneEscrows.map((e, i) => (
                        <div key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                          e.released ? "bg-emerald-50 border border-emerald-100" : "bg-violet-50 border border-violet-100"
                        }`}>
                          <Shield size={13} className={e.released ? "text-emerald-600 shrink-0" : "text-violet-600 shrink-0"} />
                          <p className={`text-xs font-medium flex-1 ${e.released ? "text-emerald-700" : "text-violet-700"}`}>
                            Milestone {i + 1} · {((e.amountUsdc || 0) / 1_000_000).toFixed(2)} USDC
                            {e.released ? " · Released" : " · In escrow"}
                          </p>
                          <a
                            href={`https://solscan.io/tx/${e.releaseTx || e.tx}?cluster=devnet`}
                            target="_blank" rel="noreferrer"
                            className={`text-xs underline underline-offset-2 ${e.released ? "text-emerald-600" : "text-violet-600"}`}
                          >
                            Verify
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : gig.escrowTx ? (
                    <div className="flex items-center gap-2 rounded-xl bg-violet-50 border border-violet-100 px-3 py-2">
                      <Shield size={13} className="text-violet-600 shrink-0" />
                      <p className="text-xs text-violet-700 font-medium flex-1">Payment locked in escrow</p>
                      <a href={`https://solscan.io/tx/${gig.escrowTx}?cluster=devnet`} target="_blank" rel="noreferrer"
                         className="text-xs text-violet-600 underline underline-offset-2">Verify</a>
                    </div>
                  ) : null}

                  {(() => {
                    const msEscrows = cr?.milestoneEscrows || [];
                    // Active funded milestone: last escrow entry that hasn't been released
                    const activeFundedIdx = msEscrows.length > 0
                      ? msEscrows.reduce((last, e, i) => (!e.released ? i : last), -1)
                      : -1; // -1 = no escrow tracking, allow all
                    return (
                      <div className="rounded-xl border border-black/8 px-3 py-1">
                        {milestones.map((m, i) => {
                          const isFunded = msEscrows.length === 0 || msEscrows[i]?.tx !== undefined;
                          const canSubmit = !!(cr && milestoneStates[i]?.status === "pending" &&
                            (activeFundedIdx === -1 || activeFundedIdx === i));
                          return (
                            <MilestoneRow
                              key={i}
                              index={i}
                              milestone={m}
                              state={milestoneStates[i]}
                              isFunded={isFunded}
                              canSubmit={canSubmit}
                              onSubmit={(idx, name) => setSubmitModal({ contactRequestId: gig.originalRequestId, milestoneIndex: idx, milestoneName: name })}
                              processing={processing}
                            />
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )
      ) : (
        clientGigs.length === 0 ? (
          <EmptyState
            title="No active gigs as client"
            body="When you approve a freelancer and fund the escrow, their progress will show here."
          />
        ) : (
          <div className="space-y-4">
            {releaseError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-red-600">Escrow release failed</p>
                  <p className="text-xs text-red-500 mt-0.5">{releaseError}</p>
                </div>
                <button onClick={() => setReleaseError(null)} className="ml-auto shrink-0 text-red-400 hover:text-red-600">
                  <X size={14} />
                </button>
              </div>
            )}
            {clientGigs.map((gig) => {
              const milestones = gig.agreedMilestones || gig.currentMilestoneSplit || [{ description: "Project Completion", percentage: 100 }];
              const milestoneStates = gig.milestoneStates || milestones.map(() => ({ status: "pending" }));
              const approvedCount = milestoneStates.filter((s) => s.status === "approved").length;
              return (
                <div key={gig.id} className="rounded-2xl border border-black/12 bg-white p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-base text-black truncate">{gig.projectTitle}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <User size={11} className="text-black/35" />
                        <p className="text-xs text-black/40">{gig.fromName || gig.fromEmail}</p>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <button
                        onClick={() => handleDeleteGig(gig.id)}
                        disabled={deletingGig === gig.id}
                        className="p-1 rounded-lg text-black/25 hover:text-red-500 hover:bg-red-50 transition"
                        title="Remove from Active Gigs"
                      >
                        <Trash2 size={13} />
                      </button>
                      {gig.escrowBudget && (
                        <p className="text-sm font-bold text-black">{gig.escrowBudget} USDC</p>
                      )}
                      <p className="text-xs text-black/40">
                        {approvedCount}/{milestones.length} milestones done
                      </p>
                    </div>
                  </div>

                  <div className="w-full bg-black/5 rounded-full h-1.5">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${(approvedCount / milestones.length) * 100}%` }}
                    />
                  </div>

                  <div className="rounded-xl border border-black/8 px-3 py-1">
                    {milestones.map((m, i) => (
                      <ClientMilestoneRow
                        key={i}
                        index={i}
                        milestone={m}
                        state={milestoneStates[i]}
                        onApprove={(idx) => handleMilestoneApprove(gig, idx)}
                        processing={processing === `approve_${gig.id}_${i}` ? processing : null}
                      />
                    ))}
                  </div>

                  {!publicKey && gig.escrowFunded && milestoneStates.some((s) => s.status === "submitted") && (
                    <p className="text-xs text-amber-600 flex items-center gap-1.5">
                      <AlertTriangle size={12} />
                      Connect your Phantom wallet to release payments when approving milestones.
                    </p>
                  )}

                  {gig.escrowFunded && !gig.escrowRefunded && !gig.escrowReleased && (
                    <div className="pt-1 border-t border-black/6 flex justify-end">
                      <button
                        onClick={() => setRefundModal(gig)}
                        className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100"
                      >
                        <RotateCcw size={11} />
                        Cancel & Refund
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Refund confirmation modal */}
      {refundModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => { setRefundModal(null); setRefundError(null); }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-base">Cancel Gig & Refund</h2>
                <p className="text-xs text-black/40 mt-0.5 leading-snug">
                  {refundModal.projectTitle}
                </p>
              </div>
              <button
                onClick={() => { setRefundModal(null); setRefundError(null); }}
                className="rounded-full p-1.5 hover:bg-black hover:text-white transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-xs font-semibold text-amber-700">This will cancel the gig</p>
              <p className="text-xs text-amber-600 mt-1 leading-relaxed">
                All unreleased escrow funds will be returned to your wallet on-chain. The freelancer will be notified.
                Milestones already approved and paid cannot be refunded.
              </p>
            </div>

            {refundError && (
              <p className="text-xs text-red-600 flex items-center gap-1.5">
                <AlertTriangle size={12} />
                {refundError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setRefundModal(null); setRefundError(null); }}
                className="flex-1 rounded-xl border border-black/15 py-2.5 text-sm font-medium text-black/60 hover:text-black transition"
              >
                Keep Gig
              </button>
              <button
                onClick={() => handleRefund(refundModal)}
                disabled={refundProcessing}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 text-white py-2.5 text-sm font-medium transition hover:bg-red-700 disabled:opacity-50"
              >
                <RotateCcw size={14} />
                {refundProcessing ? "Processing…" : "Confirm Refund"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Milestone submit modal */}
      {submitModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => { setSubmitModal(null); setSubmitMessage(""); }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-base">Submit Milestone</h2>
                <p className="text-xs text-black/40 mt-0.5">
                  Milestone {submitModal.milestoneIndex + 1}: {submitModal.milestoneName}
                </p>
              </div>
              <button
                onClick={() => { setSubmitModal(null); setSubmitMessage(""); }}
                className="rounded-full p-1.5 hover:bg-black hover:text-white transition"
              >
                <X size={16} />
              </button>
            </div>
            <div>
              <label className="text-xs font-medium text-black/50 block mb-1.5">Message to client</label>
              <textarea
                className="w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-black/40"
                rows={3}
                placeholder="Briefly describe what you've completed…"
                value={submitMessage}
                onChange={(e) => setSubmitMessage(e.target.value)}
                maxLength={300}
              />
              <p className="text-right text-xs text-black/30 mt-1">{submitMessage.length}/300</p>
            </div>
            <button
              onClick={handleMilestoneSubmit}
              disabled={!submitMessage.trim() || !!processing}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-black text-white py-2.5 text-sm font-medium transition hover:bg-black/80 disabled:opacity-50"
            >
              <Send size={14} />
              {processing ? "Submitting…" : "Submit for Approval"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/15 p-12 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-black/5">
        <Zap size={24} className="text-black/25" />
      </div>
      <p className="font-semibold text-black/50">{title}</p>
      <p className="mt-1 text-sm text-black/35">{body}</p>
    </div>
  );
}
