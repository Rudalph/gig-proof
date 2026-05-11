"use client";

import { useEffect, useState } from "react";
import {
  collection, query, where, onSnapshot,
  updateDoc, doc, addDoc, serverTimestamp, getDoc, increment, deleteDoc, arrayUnion,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { buildCreateEscrowTx } from "@/app/lib/escrow";
import {
  Bell, Check, X, Mail, Briefcase, CheckCircle2, XCircle, User, MapPin,
  Shield, AlertTriangle, ExternalLink, ChevronLeft, Trash2,
} from "lucide-react";

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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

function MilestoneSplitDisplay({ split, label }) {
  if (!split || split.length === 0) return null;
  return (
    <div className="rounded-xl border border-black/10 bg-black/[0.02] p-3 space-y-1.5">
      {label && <p className="text-xs font-semibold text-black/50 uppercase tracking-wide mb-2">{label}</p>}
      {split.map((m, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-[10px] font-semibold text-black/60">{i + 1}</span>
          <p className="flex-1 text-xs text-black/65 truncate">{m.description}</p>
          <span className="shrink-0 text-xs font-bold text-black">{m.percentage}%</span>
        </div>
      ))}
    </div>
  );
}

function NotificationCard({ notif, processing, profileLoading, walletConnected, onApprove, onDeclineOpen, onMarkRead, onViewProfile, onClientCounter, onFreelancerAccept, onFreelancerCounter, onRejectNegotiation, onApproveOriginal, onGoToActiveGigs }) {
  return (
    <div
      className={`rounded-2xl border p-5 transition ${
        !notif.read ? "border-black/20 bg-white" : "border-black/8 bg-black/[0.01]"
      }`}
    >
      {/* Card header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {!notif.read && <span className="h-2 w-2 rounded-full bg-black shrink-0" />}
            {notif.type === "contact_request" ? (
              <>
                <p className="text-sm font-semibold text-black">{notif.fromName || notif.fromEmail}</p>
                <p className="text-xs text-black/40">is interested in this job</p>
              </>
            ) : notif.type === "negotiation_counter" ? (
              <div className={`flex items-center gap-1.5 text-sm font-semibold ${notif.withdrawn ? "text-red-500" : "text-amber-600"}`}>
                {notif.withdrawn ? (
                  <><XCircle size={15} /> {notif.fromName || "Freelancer"} withdrew the application</>
                ) : (
                  <><AlertTriangle size={15} /> {notif.fromName || "Client"} countered the milestone split</>
                )}
              </div>
            ) : notif.type === "negotiation_split_agreed" ? (
              <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                <CheckCircle2 size={15} /> {notif.fromName || "Freelancer"} accepted the milestone split
              </div>
            ) : notif.type === "milestone_submitted" ? (
              <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-600">
                <AlertTriangle size={15} /> {notif.fromName || "Freelancer"} submitted a milestone
              </div>
            ) : notif.type === "milestone_approved" ? (
              <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                <CheckCircle2 size={15} /> Milestone approved by client
              </div>
            ) : notif.type === "milestone_funded" ? (
              <div className="flex items-center gap-1.5 text-sm font-semibold text-violet-600">
                <Shield size={15} /> Milestone {notif.milestoneIndex + 1} funded in escrow
              </div>
            ) : notif.type === "gig_cancelled" ? (
              <div className="flex items-center gap-1.5 text-sm font-semibold text-red-500">
                <AlertTriangle size={15} /> Gig cancelled by client
              </div>
            ) : notif.type === "admin_message" ? (
              <div className="flex items-center gap-1.5 text-sm font-semibold text-black">
                <Shield size={15} className="text-black" /> Admin
              </div>
            ) : (
              <div
                className={`flex items-center gap-1.5 text-sm font-semibold ${
                  notif.type === "request_approved" ? "text-emerald-600"
                  : notif.type === "payment_released" ? "text-violet-600"
                  : notif.type === "escrow_refunded" ? "text-red-500"
                  : "text-black/50"
                }`}
              >
                {notif.type === "request_approved" ? (
                  <><CheckCircle2 size={15} /> Request approved</>
                ) : notif.type === "payment_released" ? (
                  <><CheckCircle2 size={15} /> Payment received</>
                ) : notif.type === "escrow_refunded" ? (
                  <><AlertTriangle size={15} /> Escrow funds taken back</>
                ) : (
                  <><XCircle size={15} /> Not selected this time</>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="text-xs text-black/35">{timeAgo(notif.createdAt)}</span>
          {!notif.read && notif.type !== "contact_request" && (
            <button
              onClick={() => onMarkRead(notif.id)}
              className="rounded-lg bg-black px-3 py-1 text-xs font-medium text-white transition hover:bg-black/75"
            >
              Mark as read
            </button>
          )}
        </div>
      </div>

      {/* contact_request body */}
      {notif.type === "contact_request" && (
        <>
          {notif.message && (
            <p className="mb-3 rounded-xl bg-black/4 px-4 py-3 text-sm text-black/70 leading-relaxed">
              &ldquo;{notif.message}&rdquo;
            </p>
          )}

          {/* Negotiation status badge */}
          {notif.negotiationStatus === "countered_by_freelancer" && (
            <div className="mb-3 flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
              <AlertTriangle size={13} className="text-amber-600 shrink-0" />
              <span className="text-xs font-semibold text-amber-700">Freelancer proposed a different milestone split</span>
            </div>
          )}
          {notif.negotiationStatus === "countered_by_client" && (
            <div className="mb-3 flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
              <AlertTriangle size={13} className="text-amber-600 shrink-0" />
              <span className="text-xs font-semibold text-amber-700">You sent a counter-proposal — waiting for freelancer&apos;s response</span>
            </div>
          )}
          {notif.negotiationStatus === "split_agreed" && (
            <div className="mb-3 flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
              <span className="text-xs font-semibold text-emerald-700">Milestone split agreed — approve to hire</span>
            </div>
          )}
          {notif.negotiationStatus === "rejected" && (
            <div className="mb-3 flex items-center gap-1.5 rounded-xl bg-red-50 border border-red-100 px-3 py-2">
              <XCircle size={13} className="text-red-500 shrink-0" />
              <span className="text-xs font-semibold text-red-600">Negotiation withdrawn by freelancer</span>
            </div>
          )}

          {/* Show proposed milestone split */}
          {notif.currentMilestoneSplit?.length > 0 && notif.negotiationStatus !== "rejected" && (
            <div className="mb-3">
              <MilestoneSplitDisplay
                split={notif.currentMilestoneSplit}
                label={notif.negotiationStatus === "split_agreed" ? "Agreed split" : "Proposed split"}
              />
            </div>
          )}

          <div className="mb-4">
            <button
              onClick={() => onViewProfile(notif)}
              disabled={profileLoading}
              className="flex items-center gap-1.5 rounded-lg border border-black/15 px-3 py-1.5 text-xs font-medium text-black/70 transition hover:border-black hover:text-black disabled:opacity-50"
            >
              <User size={12} />
              View Profile
            </button>
          </div>

          {notif.status === "approved" && onGoToActiveGigs && (
            <div className="mb-3">
              <button
                onClick={onGoToActiveGigs}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black/80"
              >
                View in Active Gigs →
              </button>
            </div>
          )}
          {notif.status === "pending" && notif.negotiationStatus !== "rejected" ? (
            <div className="flex items-center gap-2 flex-wrap">
              {!walletConnected && (
                <div className="w-full flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 mb-1">
                  <AlertTriangle size={12} className="text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-700">Connect your Phantom wallet before approving to fund the escrow.</p>
                </div>
              )}
              <button
                onClick={() => onApprove(notif)}
                disabled={processing === notif.id}
                className="flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-medium text-white transition hover:bg-black/80 disabled:opacity-50"
              >
                <Check size={13} />
                Approve
              </button>
              {/* Show Counter button only if milestones active, split not yet agreed, and not already waiting on freelancer */}
              {notif.currentMilestoneSplit?.length > 0 && notif.negotiationStatus !== "split_agreed" && notif.negotiationStatus !== "countered_by_client" && (
                <button
                  onClick={() => onClientCounter(notif)}
                  disabled={processing === notif.id}
                  className="flex items-center gap-1.5 rounded-xl border border-black/20 px-4 py-2 text-xs font-medium text-black/60 transition hover:border-black hover:text-black disabled:opacity-50"
                >
                  Counter
                </button>
              )}
              <button
                onClick={() => onDeclineOpen(notif)}
                disabled={processing === notif.id}
                className="flex items-center gap-1.5 rounded-xl border border-black/15 px-4 py-2 text-xs font-medium text-black/60 transition hover:border-red-300 hover:text-red-500 disabled:opacity-50"
              >
                <X size={13} />
                Decline
              </button>
              {!notif.read && (
                <button
                  onClick={() => onMarkRead(notif.id)}
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
                  notif.status === "approved" ? "text-emerald-600"
                  : notif.negotiationStatus === "rejected" ? "text-red-500"
                  : "text-red-500"
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
                  onClick={() => onMarkRead(notif.id)}
                  className="rounded-lg bg-black px-3 py-1 text-xs font-medium text-white transition hover:bg-black/75"
                >
                  Mark as read
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* request_approved body */}
      {notif.type === "request_approved" && (
        <div className="mt-2 space-y-2">
          {notif.agreedMilestones?.length > 0 && (
            <MilestoneSplitDisplay split={notif.agreedMilestones} label="Agreed milestone split" />
          )}
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
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
          {onGoToActiveGigs && (
            <button
              onClick={onGoToActiveGigs}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black/80"
            >
              View in Active Gigs →
            </button>
          )}
          {notif.escrowTx && (
            <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3">
              <div className="flex items-start gap-2.5">
                <Shield size={14} className="text-violet-600 shrink-0 mt-0.5" />
                <div>
                  {notif.milestoneEscrows?.length > 0 ? (
                    <>
                      <p className="text-xs font-semibold text-violet-700 mb-1">
                        {notif.escrowBudget} USDC locked across {notif.milestoneEscrows.length} milestone escrows
                      </p>
                      <div className="space-y-0.5 mb-1.5">
                        {notif.milestoneEscrows.map((e, i) => (
                          <p key={i} className="text-xs text-violet-600">
                            Milestone {i + 1}: {((e.amountUsdc || 0) / 1_000_000).toFixed(2)} USDC
                          </p>
                        ))}
                      </div>
                      <p className="text-xs text-violet-500 leading-relaxed">
                        Each milestone has its own on-chain escrow. Funds release to your wallet as the client approves each one.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-violet-700 mb-1">
                        {notif.escrowBudget ? `${notif.escrowBudget} USDC` : "Payment"} locked in escrow
                      </p>
                      <p className="text-xs text-violet-600 leading-relaxed">
                        Your payment is secured in a Solana smart contract. Funds cannot be moved by anyone until the client releases them upon completion.
                      </p>
                    </>
                  )}
                  <a
                    href={`https://solscan.io/tx/${notif.escrowTx}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-violet-700 underline underline-offset-2"
                  >
                    Verify on Solscan →
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* request_declined body */}
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

      {/* payment_released body */}
      {notif.type === "payment_released" && (
        <div className="mt-2 space-y-2">
          <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3">
            <div className="flex items-start gap-2.5">
              <Shield size={14} className="text-violet-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-violet-700 mb-1">
                  {notif.budget} {notif.currency} paid by {notif.fromName}
                </p>
                <p className="text-xs text-violet-600 leading-relaxed">
                  The funds have been released from escrow and sent directly to your Solana wallet. Check your balance in Phantom.
                </p>
                {notif.paymentTx && (
                  <a
                    href={`https://solscan.io/tx/${notif.paymentTx}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-violet-700 underline underline-offset-2"
                  >
                    View payment transaction →
                  </a>
                )}
              </div>
            </div>
          </div>
          {notif.fromEmail && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
              <p className="text-xs text-emerald-700 font-medium mb-1.5">Contact your client:</p>
              <a
                href={`mailto:${notif.fromEmail}`}
                className="flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline"
              >
                <Mail size={14} />
                {notif.fromEmail}
              </a>
            </div>
          )}
        </div>
      )}

      {/* escrow_refunded body */}
      {notif.type === "escrow_refunded" && (
        <div className="mt-2 space-y-2">
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-600 mb-1">
                  {notif.budget && notif.currency ? `${notif.budget} ${notif.currency} — ` : ""}Escrow funds reclaimed by client
                </p>
                <p className="text-xs text-red-500 leading-relaxed">
                  The client has withdrawn the funds from the escrow contract back to their wallet. If you believe this is a mistake or have questions about the work you delivered, reach out to them directly.
                </p>
                {notif.refundTx && (
                  <a
                    href={`https://solscan.io/tx/${notif.refundTx}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-red-500 underline underline-offset-2"
                  >
                    <ExternalLink size={11} />
                    View refund transaction
                  </a>
                )}
              </div>
            </div>
          </div>
          {notif.fromEmail && (
            <a
              href={`mailto:${notif.fromEmail}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-black/20 px-4 py-2.5 text-sm font-medium text-black transition hover:bg-black hover:text-white"
            >
              <Mail size={15} />
              Mail the client
            </a>
          )}
        </div>
      )}

      {/* milestone_submitted body — shown to client */}
      {notif.type === "milestone_submitted" && (
        <div className="mt-2 space-y-2">
          <div className="rounded-xl bg-black/[0.04] px-4 py-3">
            <p className="text-xs font-medium text-black/40 mb-1">
              Milestone {notif.milestoneIndex + 1}{notif.milestoneName ? ` — ${notif.milestoneName}` : ""}
            </p>
            {notif.message && (
              <p className="text-sm text-black/70 leading-relaxed">&ldquo;{notif.message}&rdquo;</p>
            )}
          </div>
          {onGoToActiveGigs && (
            <button
              onClick={onGoToActiveGigs}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black/80"
            >
              Review & Approve in Active Gigs →
            </button>
          )}
        </div>
      )}

      {/* milestone_approved body — shown to freelancer (intermediate milestone) */}
      {notif.type === "milestone_approved" && (
        <div className="mt-2 space-y-2">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
            <p className="text-xs font-semibold text-emerald-700 mb-1">
              Milestone {notif.milestoneIndex + 1} approved{notif.milestonePercentage ? ` · ${notif.milestonePercentage}%` : ""}
            </p>
            <p className="text-xs text-emerald-600">
              {notif.milestoneName ? `"${notif.milestoneName}" has been approved` : "Your milestone has been approved"} and payment released.
            </p>
            {notif.paymentTx && (
              <a
                href={`https://solscan.io/tx/${notif.paymentTx}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 underline underline-offset-2"
              >
                <ExternalLink size={11} />
                View payment tx →
              </a>
            )}
          </div>
          {notif.nextEscrowTx && (
            <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3">
              <p className="text-xs font-semibold text-violet-700 mb-1">
                Milestone {(notif.nextMilestoneIndex ?? 0) + 1}{notif.nextMilestoneName ? ` — ${notif.nextMilestoneName}` : ""} now funded
              </p>
              <p className="text-xs text-violet-600 leading-relaxed">
                {notif.nextAmountUsdc ? `${(notif.nextAmountUsdc / 1_000_000).toFixed(2)} USDC` : "Funds"} locked in escrow for the next milestone. Complete it to unlock payment.
              </p>
              <a
                href={`https://solscan.io/tx/${notif.nextEscrowTx}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-violet-700 underline underline-offset-2"
              >
                <ExternalLink size={11} />
                View escrow tx →
              </a>
            </div>
          )}
          {onGoToActiveGigs && (
            <button
              onClick={onGoToActiveGigs}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black/80"
            >
              View in Active Gigs →
            </button>
          )}
        </div>
      )}

      {/* milestone_funded body — shown to freelancer when next milestone escrow is funded */}
      {notif.type === "milestone_funded" && (
        <div className="mt-2 space-y-2">
          <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3">
            <div className="flex items-start gap-2.5">
              <Shield size={14} className="text-violet-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-violet-700 mb-1">
                  Milestone {notif.milestoneIndex + 1}{notif.milestoneName ? ` — ${notif.milestoneName}` : ""} ·{" "}
                  {notif.amountUsdc ? `${(notif.amountUsdc / 1_000_000).toFixed(2)} USDC` : "Funds"} in escrow
                </p>
                <p className="text-xs text-violet-600 leading-relaxed">
                  The client has funded this milestone. Complete the work and submit it for approval.
                </p>
                {notif.escrowTx && (
                  <a
                    href={`https://solscan.io/tx/${notif.escrowTx}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-violet-700 underline underline-offset-2"
                  >
                    <ExternalLink size={11} />
                    View escrow transaction
                  </a>
                )}
              </div>
            </div>
          </div>
          {onGoToActiveGigs && (
            <button
              onClick={onGoToActiveGigs}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black/80"
            >
              View in Active Gigs →
            </button>
          )}
        </div>
      )}

      {/* gig_cancelled body — shown to freelancer */}
      {notif.type === "gig_cancelled" && (
        <div className="mt-2 space-y-2">
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-600 mb-1">
                  {notif.fromName || "The client"} has cancelled this gig
                </p>
                <p className="text-xs text-red-500 leading-relaxed">
                  The escrow funds have been refunded to their wallet. Any approved milestones already paid to you are not affected.
                </p>
                {notif.refundTx && (
                  <a
                    href={`https://solscan.io/tx/${notif.refundTx}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-red-500 underline underline-offset-2"
                  >
                    <ExternalLink size={11} />
                    View refund transaction
                  </a>
                )}
              </div>
            </div>
          </div>
          {notif.fromEmail && (
            <a
              href={`mailto:${notif.fromEmail}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-black/20 px-4 py-2.5 text-sm font-medium text-black transition hover:bg-black hover:text-white"
            >
              <Mail size={15} />
              Contact the client
            </a>
          )}
        </div>
      )}

      {/* admin_message body */}
      {notif.type === "admin_message" && (
        <div className="mt-2 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">
            Message from Admin
          </p>
          <div className="rounded-xl bg-black/[0.03] border border-black/10 px-4 py-3">
            <p className="text-sm text-black/80 leading-relaxed whitespace-pre-wrap">
              {notif.message}
            </p>
          </div>
          {notif.projectTitle && (
            <p className="text-xs text-black/40">
              Regarding: <span className="font-semibold text-black/60">{notif.projectTitle}</span>
            </p>
          )}
        </div>
      )}

      {/* negotiation_counter body — shown to the other party */}
      {notif.type === "negotiation_counter" && !notif.withdrawn && (
        <div className="mt-2 space-y-3">
          {notif.message && (
            <p className="rounded-xl bg-black/4 px-4 py-3 text-sm text-black/70 leading-relaxed">
              &ldquo;{notif.message}&rdquo;
            </p>
          )}
          {notif.proposedSplit?.length > 0 && (
            <MilestoneSplitDisplay split={notif.proposedSplit} label="Proposed split" />
          )}
          {notif.status !== "processed" ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => onFreelancerAccept(notif)}
                disabled={processing === notif.id}
                className="flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-medium text-white transition hover:bg-black/80 disabled:opacity-50"
              >
                <Check size={13} />
                Accept Split
              </button>
              <button
                onClick={() => onFreelancerCounter(notif)}
                disabled={processing === notif.id}
                className="flex items-center gap-1.5 rounded-xl border border-black/20 px-4 py-2 text-xs font-medium text-black/60 transition hover:border-black hover:text-black disabled:opacity-50"
              >
                Counter
              </button>
              <button
                onClick={() => onRejectNegotiation(notif, "freelancer")}
                disabled={processing === notif.id}
                className="flex items-center gap-1.5 rounded-xl border border-black/15 px-4 py-2 text-xs font-medium text-black/60 transition hover:border-red-300 hover:text-red-500 disabled:opacity-50"
              >
                <X size={13} />
                Withdraw
              </button>
            </div>
          ) : (
            <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium ${
              notif.processedAction === "accepted" ? "bg-emerald-50 border border-emerald-100 text-emerald-700"
              : notif.processedAction === "countered" ? "bg-amber-50 border border-amber-100 text-amber-700"
              : "bg-red-50 border border-red-100 text-red-600"
            }`}>
              {notif.processedAction === "accepted" && <><CheckCircle2 size={13} /> You accepted this milestone split.</>}
              {notif.processedAction === "countered" && <><AlertTriangle size={13} /> You sent a counter-proposal — waiting for the client.</>}
              {notif.processedAction === "withdrawn" && <><XCircle size={13} /> You withdrew your application.</>}
              {!notif.processedAction && <><Check size={13} /> You responded to this proposal.</>}
            </div>
          )}
        </div>
      )}

      {notif.type === "negotiation_counter" && notif.withdrawn && (
        <div className="mt-2">
          <p className="text-xs text-black/40">The freelancer has withdrawn their application.</p>
        </div>
      )}

      {/* negotiation_split_agreed body — shown to client */}
      {notif.type === "negotiation_split_agreed" && (
        <div className="mt-2 space-y-3">
          {notif.agreedSplit?.length > 0 && (
            <MilestoneSplitDisplay split={notif.agreedSplit} label="Agreed milestone split" />
          )}
          {notif.status !== "processed" ? (
            <>
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
                <p className="text-xs text-emerald-700 font-medium">
                  Freelancer accepted your proposed split. Click below to hire them and fund the escrow.
                </p>
              </div>
              <button
                onClick={() => onApproveOriginal(notif)}
                disabled={processing === notif.id}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-black/80 disabled:opacity-50"
              >
                <Check size={15} />
                {processing === notif.id ? "Opening Phantom…" : "Approve & Fund via Phantom"}
              </button>
            </>
          ) : (
            <p className="text-xs text-black/40">You have approved and funded this request.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Notifications({ setActivePage }) {
  const { user } = useAuth();
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [deleteWarning, setDeleteWarning] = useState(null);
  const [bulkProcessing, setBulkProcessing] = useState(null);
  const [processing, setProcessing] = useState(null);
  const [declineModal, setDeclineModal] = useState(null);
  const [declineReason, setDeclineReason] = useState("");
  const [viewProfile, setViewProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [escrowError, setEscrowError] = useState(null);
  const [projectDetails, setProjectDetails] = useState({});
  const [activeSection, setActiveSection] = useState("from_freelancers");
  const [counterModal, setCounterModal] = useState(null); // { notif, role: "client"|"freelancer" }
  const [counterMessage, setCounterMessage] = useState("");
  const [counterSplit, setCounterSplit] = useState([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "notifications"), where("toUid", "==", user.uid));
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

  // Fetch project metadata for all unique projectIds in notifications
  const projectIdsKey = [...new Set(
    notifications.map((n) => n.projectId).filter(Boolean)
  )].sort().join(",");

  useEffect(() => {
    if (!projectIdsKey) return;
    const ids = projectIdsKey.split(",");
    Promise.all(ids.map((id) => getDoc(doc(db, "projects", id)))).then((snaps) => {
      const details = {};
      snaps.forEach((snap) => { if (snap.exists()) details[snap.id] = snap.data(); });
      setProjectDetails((prev) => ({ ...prev, ...details }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectIdsKey]);

  // Group by projectId
  const HIDDEN_TYPES = ["admin_message", "dispute_reverted"];
  const projectGroups = notifications.filter((n) => !HIDDEN_TYPES.includes(n.type)).reduce((acc, notif) => {
    const pid = notif.projectId || "__no_project__";
    if (!acc[pid]) {
      acc[pid] = {
        projectId: pid,
        projectTitle: notif.projectTitle || "Untitled Project",
        notifications: [],
      };
    }
    acc[pid].notifications.push(notif);
    return acc;
  }, {});

  const projectList = Object.values(projectGroups).sort((a, b) => {
    const latestA = Math.max(...a.notifications.map((n) => n.createdAt?.toDate?.()?.getTime() || 0));
    const latestB = Math.max(...b.notifications.map((n) => n.createdAt?.toDate?.()?.getTime() || 0));
    return latestB - latestA;
  });

  const CLIENT_TYPES = ["request_approved", "request_declined", "payment_released", "escrow_refunded", "negotiation_counter", "negotiation_split_agreed", "milestone_approved", "milestone_funded", "gig_cancelled"];
  const FREELANCER_TYPES = ["contact_request", "milestone_submitted"];
  const fromFreelancersList = projectList.filter((g) =>
    g.notifications.some((n) => FREELANCER_TYPES.includes(n.type))
  );
  const fromClientsList = projectList.filter((g) =>
    g.notifications.some((n) => CLIENT_TYPES.includes(n.type))
  );
  const visibleList = activeSection === "from_freelancers" ? fromFreelancersList : fromClientsList;

  const unreadFromFreelancers = notifications.filter(
    (n) => FREELANCER_TYPES.includes(n.type) && !n.read
  ).length;
  const unreadFromClients = notifications.filter(
    (n) => CLIENT_TYPES.includes(n.type) && !n.read
  ).length;

  const markRead = async (notifId) => {
    try {
      await updateDoc(doc(db, "notifications", notifId), { read: true });
    } catch {}
  };

  const handleMarkAllRead = async (projectId) => {
    setBulkProcessing(projectId + "_read");
    try {
      const unread = projectId === "__all__"
        ? notifications.filter((n) => !n.read)
        : notifications.filter((n) => (n.projectId || "__no_project__") === projectId && !n.read);
      await Promise.all(unread.map((n) => updateDoc(doc(db, "notifications", n.id), { read: true })));
    } catch (e) {
      console.error("Mark all read error:", e);
    } finally {
      setBulkProcessing(null);
    }
  };

  const handleDeleteAll = async (projectId) => {
    setBulkProcessing(projectId + "_delete");
    try {
      const toDelete = projectId === "__all__"
        ? notifications
        : notifications.filter((n) => (n.projectId || "__no_project__") === projectId);
      await Promise.all(toDelete.map((n) => deleteDoc(doc(db, "notifications", n.id))));
      setSelectedProjectId(null);
      setDeleteWarning(null);
    } catch (e) {
      console.error("Delete all error:", e);
    } finally {
      setBulkProcessing(null);
    }
  };

  // Client sends a counter-proposal back to the freelancer
  const handleClientCounter = async (notif, message, split) => {
    setProcessing(notif.id);
    try {
      await updateDoc(doc(db, "notifications", notif.id), {
        negotiationStatus: "countered_by_client",
        currentMilestoneSplit: split,
        lastCounteredBy: "client",
        negotiationHistory: arrayUnion({
          by: "client",
          message,
          split,
          ts: new Date().toISOString(),
        }),
        read: true,
      });
      await addDoc(collection(db, "notifications"), {
        type: "negotiation_counter",
        toUid: notif.fromUid,
        fromUid: user.uid,
        fromEmail: user.email,
        fromName: user.displayName || user.email?.split("@")[0] || "Client",
        projectId: notif.projectId,
        projectTitle: notif.projectTitle,
        originalRequestId: notif.id,
        message,
        proposedSplit: split,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Client counter error:", e);
    } finally {
      setProcessing(null);
    }
  };

  // Freelancer accepts client's proposed split → notifies client, locks split_agreed
  const handleFreelancerAcceptSplit = async (notif) => {
    setProcessing(notif.id);
    try {
      // Mark the negotiation_counter notification as processed
      await updateDoc(doc(db, "notifications", notif.id), { read: true, status: "processed", processedAction: "accepted" });
      // Update the original contact_request
      if (notif.originalRequestId) {
        await updateDoc(doc(db, "notifications", notif.originalRequestId), {
          negotiationStatus: "split_agreed",
          currentMilestoneSplit: notif.proposedSplit,
        });
      }
      // Notify client
      await addDoc(collection(db, "notifications"), {
        type: "negotiation_split_agreed",
        toUid: notif.fromUid,
        fromUid: user.uid,
        fromEmail: user.email,
        fromName: user.displayName || user.email?.split("@")[0] || "Freelancer",
        projectId: notif.projectId,
        projectTitle: notif.projectTitle,
        originalRequestId: notif.originalRequestId,
        agreedSplit: notif.proposedSplit,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Accept split error:", e);
    } finally {
      setProcessing(null);
    }
  };

  // Freelancer sends a counter back to the client
  const handleFreelancerCounter = async (notif, message, split) => {
    setProcessing(notif.id);
    try {
      await updateDoc(doc(db, "notifications", notif.id), { read: true, status: "processed", processedAction: "countered" });
      if (notif.originalRequestId) {
        await updateDoc(doc(db, "notifications", notif.originalRequestId), {
          negotiationStatus: "countered_by_freelancer",
          currentMilestoneSplit: split,
          lastCounteredBy: "freelancer",
          negotiationHistory: arrayUnion({
            by: "freelancer",
            message,
            split,
            ts: new Date().toISOString(),
          }),
        });
      }
      // Notify client
      await addDoc(collection(db, "notifications"), {
        type: "negotiation_counter",
        toUid: notif.fromUid,
        fromUid: user.uid,
        fromEmail: user.email,
        fromName: user.displayName || user.email?.split("@")[0] || "Freelancer",
        projectId: notif.projectId,
        projectTitle: notif.projectTitle,
        originalRequestId: notif.originalRequestId,
        message,
        proposedSplit: split,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Freelancer counter error:", e);
    } finally {
      setProcessing(null);
    }
  };

  // Either side rejects the negotiation entirely (withdraws application)
  const handleRejectNegotiation = async (notif, role) => {
    setProcessing(notif.id);
    try {
      if (role === "freelancer") {
        // Freelancer withdraws — mark their counter notification processed, update original request
        await updateDoc(doc(db, "notifications", notif.id), { read: true, status: "processed", processedAction: "withdrawn" });
        if (notif.originalRequestId) {
          await updateDoc(doc(db, "notifications", notif.originalRequestId), {
            negotiationStatus: "rejected",
            status: "declined",
          });
        }
        // Notify client of withdrawal
        await addDoc(collection(db, "notifications"), {
          type: "negotiation_counter",
          toUid: notif.fromUid,
          fromUid: user.uid,
          fromEmail: user.email,
          fromName: user.displayName || user.email?.split("@")[0] || "Freelancer",
          projectId: notif.projectId,
          projectTitle: notif.projectTitle,
          originalRequestId: notif.originalRequestId,
          withdrawn: true,
          read: false,
          createdAt: serverTimestamp(),
        });
      }
    } catch (e) {
      console.error("Reject negotiation error:", e);
    } finally {
      setProcessing(null);
    }
  };

  const handleApprove = async (notif) => {
    setProcessing(notif.id);
    try {
      const [freelancerSnap, projectSnap] = await Promise.all([
        getDoc(doc(db, "users", notif.fromUid)),
        getDoc(doc(db, "projects", notif.projectId)),
      ]);
      const freelancerWallet = freelancerSnap.data()?.walletAddress || null;
      const projectData = projectSnap.data();
      const budget = projectData?.budget;
      const currency = projectData?.currency;

      // Determine agreed milestones (negotiated split takes priority over project milestones)
      const agreedMilestones = notif.currentMilestoneSplit?.length > 0
        ? notif.currentMilestoneSplit
        : projectData?.milestones?.length > 0
          ? projectData.milestones
          : null;
      const initialMilestoneStates = agreedMilestones
        ? agreedMilestones.map(() => ({ status: "pending" }))
        : [{ status: "pending" }];

      // For USDC projects, block approval if wallet conditions aren't met
      if (currency === "USDC" && budget) {
        if (!publicKey) {
          setEscrowError("Connect your Phantom wallet before approving — it's needed to fund the escrow. Look for the wallet button in the top-right corner.");
          return;
        }
        if (!freelancerWallet) {
          setEscrowError("This freelancer hasn't saved their Solana wallet address yet. Ask them to go to Profile, connect Phantom, and save their wallet address — then try approving again.");
          return;
        }
      }

      const willAttemptEscrow = !!(publicKey && freelancerWallet && budget && currency === "USDC");
      const hasMilestones = agreedMilestones && agreedMilestones.length > 0;

      const baseApproval = {
        status: "approved",
        approvedFreelancerUid: notif.fromUid,
        approvedFreelancerWallet: freelancerWallet,
        ...(!willAttemptEscrow ? { approvedCount: increment(1) } : {}),
      };
      await Promise.all([
        updateDoc(doc(db, "projects", notif.projectId), baseApproval),
        updateDoc(doc(db, "users", user.uid, "projectsAdded", notif.projectId), baseApproval),
      ]);

      // Update contact_request with initial milestone state
      await updateDoc(doc(db, "notifications", notif.id), {
        status: "approved",
        read: true,
        milestoneStates: initialMilestoneStates,
        ...(agreedMilestones ? { agreedMilestones } : {}),
        ...(freelancerWallet ? { freelancerWalletAddress: freelancerWallet } : {}),
      });

      let escrowTx = null;
      let milestoneEscrows = null;

      if (willAttemptEscrow) {
        const freelancerKey = new PublicKey(freelancerWallet);
        const totalAmountUsdc = Math.round(Number(budget) * 1_000_000);

        if (hasMilestones) {
          // Only fund milestone 0 at approval time — subsequent milestones funded as each is approved
          const msProjectId = `${notif.projectId}_m0`;
          const milestone0Amount = Math.round((agreedMilestones[0].percentage / 100) * totalAmountUsdc);
          let tx, bh, lvbh;
          try {
            ({ tx, blockhash: bh, lastValidBlockHeight: lvbh } = await buildCreateEscrowTx(connection, publicKey, freelancerKey, msProjectId, milestone0Amount));
          } catch (buildErr) {
            setEscrowError(buildErr.message || "Failed to build escrow transaction");
            return;
          }
          let sig;
          try {
            const signedTx = await signTransaction(tx);
            sig = await connection.sendRawTransaction(signedTx.serialize(), { skipPreflight: true });
            const confirm = await connection.confirmTransaction(
              { signature: sig, blockhash: bh, lastValidBlockHeight: lvbh }, "confirmed"
            );
            if (confirm.value.err) throw new Error(`Escrow creation failed on-chain: ${JSON.stringify(confirm.value.err)}`);
          } catch (signErr) {
            const msg = signErr.message || "";
            if (!msg.includes("rejected") && !msg.includes("User rejected")) {
              setEscrowError(msg || "Signing failed");
            }
            return;
          }
          milestoneEscrows = [{ projectId: msProjectId, tx: sig, amountUsdc: milestone0Amount, released: false }];
          escrowTx = sig;
          const escrowData = { escrowCreated: true, escrowTx: sig, approvedCount: increment(1) };
          await Promise.all([
            updateDoc(doc(db, "projects", notif.projectId), escrowData),
            updateDoc(doc(db, "users", user.uid, "projectsAdded", notif.projectId), escrowData),
          ]);
          await updateDoc(doc(db, "notifications", notif.id), {
            escrowFunded: true,
            escrowBudget: budget,
            escrowTx: sig,
            milestoneEscrows,
          });
        } else {
          // Single escrow for full payment
          const { tx, blockhash: bh2, lastValidBlockHeight: lvbh2 } = await buildCreateEscrowTx(connection, publicKey, freelancerKey, notif.projectId, totalAmountUsdc);
          let sig;
          try {
            const signedTx = await signTransaction(tx);
            sig = await connection.sendRawTransaction(signedTx.serialize(), { skipPreflight: true });
            const confirm = await connection.confirmTransaction(
              { signature: sig, blockhash: bh2, lastValidBlockHeight: lvbh2 }, "confirmed"
            );
            if (confirm.value.err) throw new Error(`Escrow creation failed on-chain: ${JSON.stringify(confirm.value.err)}`);
          } catch (sendErr) {
            const msg = sendErr.message || "";
            if (!msg.includes("rejected") && !msg.includes("User rejected")) {
              setEscrowError(msg || "Send failed");
            }
            return;
          }
          escrowTx = sig;
          const escrowData = { escrowCreated: true, escrowTx: sig, approvedCount: increment(1) };
          await Promise.all([
            updateDoc(doc(db, "projects", notif.projectId), escrowData),
            updateDoc(doc(db, "users", user.uid, "projectsAdded", notif.projectId), escrowData),
          ]);
          await updateDoc(doc(db, "notifications", notif.id), {
            escrowFunded: true,
            escrowBudget: budget,
            escrowTx: sig,
          });
        }
      }

      await addDoc(collection(db, "notifications"), {
        type: "request_approved",
        toUid: notif.fromUid,
        fromUid: user.uid,
        fromEmail: user.email,
        fromName: user.displayName || user.email?.split("@")[0] || "User",
        projectId: notif.projectId,
        projectTitle: notif.projectTitle,
        originalRequestId: notif.id,
        status: "approved",
        read: false,
        createdAt: serverTimestamp(),
        ...(agreedMilestones ? { agreedMilestones } : {}),
        ...(escrowTx ? { escrowTx, escrowBudget: budget } : {}),
        ...(milestoneEscrows ? { milestoneEscrows } : {}),
      });
    } catch (e) {
      console.error("Approve error:", e);
      setEscrowError(e?.message || "An unexpected error occurred. Please try again.");
    } finally {
      setProcessing(null);
    }
  };

  // Called from negotiation_split_agreed card — fetches original contact_request and runs approve
  const handleApproveFromSplitAgreed = async (splitAgreedNotif) => {
    if (!splitAgreedNotif.originalRequestId) return;
    try {
      const snap = await getDoc(doc(db, "notifications", splitAgreedNotif.originalRequestId));
      if (!snap.exists()) return;
      const originalNotif = { id: snap.id, ...snap.data() };
      await updateDoc(doc(db, "notifications", splitAgreedNotif.id), { read: true, status: "processed" });
      await handleApprove(originalNotif);
    } catch (e) {
      console.error("Approve from split agreed error:", e);
    }
  };

  const handleDecline = async (notif, reason = "") => {
    setProcessing(notif.id);
    try {
      await updateDoc(doc(db, "notifications", notif.id), { status: "declined", read: true });
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
    if (notif.senderProfile) {
      setViewProfile({ uid: notif.fromUid, name: notif.fromName, ...notif.senderProfile });
      return;
    }
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

  const selectedGroup = selectedProjectId ? projectGroups[selectedProjectId] : null;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-black/35 mb-1">Activity</p>
          <h1 className="text-2xl font-bold text-black">Notifications</h1>
        </div>
        {!selectedProjectId && notifications.length > 0 && (
          <div className="flex gap-2 shrink-0 mt-1">
            {notifications.some((n) => !n.read) && (
              <button
                onClick={() => handleMarkAllRead("__all__")}
                disabled={bulkProcessing === "__all___read"}
                className="flex items-center gap-1.5 rounded-xl border border-black/15 px-3 py-1.5 text-xs font-medium text-black/60 transition hover:border-black hover:text-black disabled:opacity-50"
              >
                <Check size={13} />
                Mark all read
              </button>
            )}
            <button
              onClick={() => setDeleteWarning("__all__")}
              disabled={!!bulkProcessing}
              className="flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 size={13} />
              Delete all
            </button>
          </div>
        )}
      </div>

      {/* Section tabs — only show on grid view */}
      {!selectedProjectId && (
        <div className="flex gap-1 rounded-2xl bg-black/5 p-1 w-fit">
          <button
            onClick={() => { setActiveSection("from_freelancers"); setSelectedProjectId(null); }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeSection === "from_freelancers" ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black"
            }`}
          >
            From Freelancers
            {unreadFromFreelancers > 0 && (
              <span className="rounded-full bg-black text-white text-xs px-1.5 py-0.5 leading-none">
                {unreadFromFreelancers}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveSection("from_clients"); setSelectedProjectId(null); }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeSection === "from_clients" ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black"
            }`}
          >
            From Clients
            {unreadFromClients > 0 && (
              <span className="rounded-full bg-black text-white text-xs px-1.5 py-0.5 leading-none">
                {unreadFromClients}
              </span>
            )}
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-black/5" />
          ))}
        </div>
      ) : !selectedProjectId ? (
        /* ── Project tile grid ── */
        visibleList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-black/5">
              <Bell size={24} className="text-black/25" />
            </div>
            <p className="font-semibold text-black/50">
              {activeSection === "from_freelancers" ? "No freelancer requests yet" : "No client responses yet"}
            </p>
            <p className="mt-1 text-sm text-black/35">
              {activeSection === "from_freelancers"
                ? "When someone is interested in your posted jobs, it will show here."
                : "Responses to jobs you've applied for will show here."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visibleList.map((group) => {
              const unreadCount = group.notifications.filter((n) => !n.read).length;
              const latest = group.notifications[0];
              const proj = projectDetails[group.projectId];
              const pendingRequests = group.notifications.filter(
                (n) => n.type === "contact_request" && n.status === "pending"
              ).length;
              const approvedCount = group.notifications.filter(
                (n) => n.type === "contact_request" && n.status === "approved"
              ).length;
              const declinedCount = group.notifications.filter(
                (n) => n.type === "contact_request" && n.status === "declined"
              ).length;
              const hasPayment = group.notifications.some((n) => n.type === "payment_released");
              const hasRefund = group.notifications.some((n) => n.type === "escrow_refunded");
              const hasApproval = group.notifications.some((n) => n.type === "request_approved");
              return (
                <div
                  key={group.projectId}
                  onClick={() => setSelectedProjectId(group.projectId)}
                  className="cursor-pointer rounded-2xl border border-black/12 bg-white p-5 transition hover:border-black/25 hover:shadow-sm select-none"
                >
                  {/* Top row: icon + unread badge + delete */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/5">
                      <Briefcase size={18} className="text-black/50" />
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-black text-white text-xs font-semibold px-2 py-0.5 min-w-[20px] text-center">
                          {unreadCount}
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteWarning(group.projectId); }}
                        title="Delete all notifications for this project"
                        className="cursor-pointer rounded-lg p-1.5 text-black/25 transition hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <p className="text-sm font-semibold text-black leading-snug mb-2">
                    {group.projectTitle}
                  </p>

                  {/* Project metadata from Firestore */}
                  {proj && (
                    <div className="mb-2 space-y-1">
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-black/50">
                        {proj.budget && proj.currency && (
                          <span className="font-semibold text-black/70">{proj.budget} {proj.currency}</span>
                        )}
                        {proj.category && <span>{proj.category}</span>}
                        {proj.experienceLevel && proj.experienceLevel !== "Any" && (
                          <span>{proj.experienceLevel}</span>
                        )}
                      </div>
                      {(proj.endDate || proj.startDate) && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-black/40">
                          {proj.startDate && <span>Start: {formatDate(proj.startDate)}</span>}
                          {proj.endDate && <span>Deadline: {formatDate(proj.endDate)}</span>}
                        </div>
                      )}
                      {proj.freelancerCount > 1 && (
                        <p className="text-xs text-black/40">
                          {proj.approvedCount || 0}/{proj.freelancerCount} spots filled
                        </p>
                      )}
                    </div>
                  )}

                  {/* Activity summary chips */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {pendingRequests > 0 && (
                      <span className="rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs px-2 py-0.5 font-medium">
                        {pendingRequests} pending
                      </span>
                    )}
                    {approvedCount > 0 && (
                      <span className="rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs px-2 py-0.5 font-medium">
                        {approvedCount} approved
                      </span>
                    )}
                    {declinedCount > 0 && (
                      <span className="rounded-full bg-black/5 border border-black/10 text-black/50 text-xs px-2 py-0.5">
                        {declinedCount} declined
                      </span>
                    )}
                    {hasPayment && (
                      <span className="rounded-full bg-violet-50 border border-violet-100 text-violet-700 text-xs px-2 py-0.5 font-medium">
                        Payment received
                      </span>
                    )}
                    {hasApproval && !hasPayment && (
                      <span className="rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs px-2 py-0.5 font-medium">
                        Request approved
                      </span>
                    )}
                    {hasRefund && (
                      <span className="rounded-full bg-red-50 border border-red-100 text-red-500 text-xs px-2 py-0.5 font-medium">
                        Funds refunded
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-black/35">
                    {group.notifications.length} notification{group.notifications.length !== 1 ? "s" : ""}
                    {latest?.createdAt && ` · ${timeAgo(latest.createdAt)}`}
                  </p>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ── Project detail view ── */
        <div className="space-y-4">
          <button
            onClick={() => setSelectedProjectId(null)}
            className="flex items-center gap-1.5 text-sm font-medium text-black/55 transition hover:text-black"
          >
            <ChevronLeft size={16} />
            All projects
          </button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-black">{selectedGroup?.projectTitle}</h2>
              <p className="text-xs text-black/40 mt-0.5">
                {selectedGroup?.notifications.length} notification{selectedGroup?.notifications.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              {selectedGroup?.notifications.some((n) => !n.read) && (
                <button
                  onClick={() => handleMarkAllRead(selectedProjectId)}
                  disabled={bulkProcessing === selectedProjectId + "_read"}
                  className="flex items-center gap-1.5 rounded-xl border border-black/15 px-3 py-1.5 text-xs font-medium text-black/60 transition hover:border-black hover:text-black disabled:opacity-50"
                >
                  <Check size={13} />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setDeleteWarning(selectedProjectId)}
                disabled={!!bulkProcessing}
                className="flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 size={13} />
                Delete all
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {selectedGroup?.notifications.map((notif) => (
              <NotificationCard
                key={notif.id}
                notif={notif}
                processing={processing}
                profileLoading={profileLoading}
                walletConnected={!!publicKey}
                onApprove={handleApprove}
                onDeclineOpen={(n) => { setDeclineModal(n); setDeclineReason(""); }}
                onMarkRead={markRead}
                onViewProfile={handleViewProfile}
                onClientCounter={(n) => {
                  setCounterModal({ notif: n, role: "client" });
                  setCounterMessage("");
                  setCounterSplit((n.currentMilestoneSplit || []).map((m) => ({ ...m })));
                }}
                onFreelancerAccept={handleFreelancerAcceptSplit}
                onFreelancerCounter={(n) => {
                  setCounterModal({ notif: n, role: "freelancer" });
                  setCounterMessage("");
                  setCounterSplit((n.proposedSplit || []).map((m) => ({ ...m })));
                }}
                onRejectNegotiation={handleRejectNegotiation}
                onApproveOriginal={handleApproveFromSplitAgreed}
                onGoToActiveGigs={
                  setActivePage &&
                  (notif.type === "request_approved" ||
                   notif.type === "milestone_funded" ||
                   notif.type === "milestone_approved" ||
                   notif.type === "milestone_submitted" ||
                   (notif.type === "contact_request" && notif.status === "approved"))
                    ? () => setActivePage("Active Gigs")
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Counter proposal modal */}
      {counterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setCounterModal(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white text-black shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-black/10 p-5">
              <div>
                <h2 className="text-lg font-semibold">Counter Proposal</h2>
                <p className="text-xs text-black/40 mt-0.5">{counterModal.notif.projectTitle}</p>
              </div>
              <button onClick={() => setCounterModal(null)} className="rounded-full p-2 transition hover:bg-black hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Editable split */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Your Proposed Split</label>
                  <span className={`text-xs font-semibold ${counterSplit.reduce((s, m) => s + Number(m.percentage), 0) === 100 ? "text-emerald-600" : "text-red-500"}`}>
                    {counterSplit.reduce((s, m) => s + Number(m.percentage), 0)}% / 100%
                  </span>
                </div>
                <div className="space-y-2">
                  {counterSplit.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2">
                      <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-[10px] font-semibold">{i + 1}</span>
                      <p className="flex-1 text-xs text-black/70 truncate">{m.description}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={m.percentage}
                          onChange={(e) => {
                            const raw = parseInt(e.target.value, 10);
                            const val = isNaN(raw) ? 0 : Math.min(100, Math.max(0, raw));
                            setCounterSplit((prev) => prev.map((r, idx) => idx === i ? { ...r, percentage: val } : r));
                          }}
                          className="w-14 rounded-lg border border-black/15 bg-white text-black px-2 py-1 text-xs text-center outline-none focus:border-black [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-xs text-black/40">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Message */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Message <span className="text-red-500">*</span></label>
                <textarea
                  rows="3"
                  value={counterMessage}
                  onChange={(e) => setCounterMessage(e.target.value)}
                  placeholder="Explain your reasoning for the proposed split..."
                  className="w-full rounded-xl border border-black/20 px-4 py-3 text-sm outline-none focus:border-black resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setCounterModal(null)} className="flex-1 rounded-xl border border-black/20 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5">Cancel</button>
                <button
                  onClick={async () => {
                    const { notif, role } = counterModal;
                    const split = counterSplit;
                    const msg = counterMessage.trim();
                    if (!msg || counterSplit.reduce((s, m) => s + Number(m.percentage), 0) !== 100) return;
                    setCounterModal(null);
                    if (role === "client") {
                      await handleClientCounter(notif, msg, split);
                    } else {
                      await handleFreelancerCounter(notif, msg, split);
                    }
                  }}
                  disabled={
                    !counterMessage.trim() ||
                    counterSplit.reduce((s, m) => s + Number(m.percentage), 0) !== 100 ||
                    processing === counterModal.notif.id
                  }
                  className="flex-1 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black/80 disabled:opacity-50"
                >
                  Send Counter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete all warning modal */}
      {deleteWarning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDeleteWarning(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 mb-4">
              <AlertTriangle size={22} className="text-red-500" />
            </div>
            <h3 className="font-semibold text-black mb-1">
              {deleteWarning === "__all__" ? "Delete all notifications?" : "Delete project notifications?"}
            </h3>
            <p className="text-sm text-black/55 leading-relaxed mb-2">
              {deleteWarning === "__all__"
                ? "This will permanently delete every notification across all your projects."
                : "This will permanently delete all notifications for this project."}
            </p>
            <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 mb-5">
              <p className="text-xs font-semibold text-red-600">
                This is an irreversible action — deleted notifications cannot be recovered.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteWarning(null)}
                className="flex-1 rounded-xl border border-black/20 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteAll(deleteWarning)}
                disabled={bulkProcessing === deleteWarning + "_delete"}
                className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {bulkProcessing === deleteWarning + "_delete" ? "Deleting…" : "Delete all"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Escrow error modal */}
      {escrowError !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-black mb-2">Transaction Failed</h3>
            <p className="text-sm text-black/60 leading-relaxed mb-2">
              There seems to be an error with the escrow transaction. Please try again after some time.
            </p>
            {escrowError && (
              <pre className="text-xs bg-black/5 rounded-lg p-3 overflow-auto max-h-40 text-black/50 whitespace-pre-wrap">
                {escrowError}
              </pre>
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

      {/* View profile modal */}
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
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-black/8">
                      <User size={24} className="text-black/40" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold leading-tight">{viewProfile.name || "—"}</p>
                      {viewProfile.role && <p className="text-sm text-black/50 mt-0.5">{viewProfile.role}</p>}
                      {(viewProfile.city || viewProfile.country) && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-black/40">
                          <MapPin size={11} />
                          {[viewProfile.city, viewProfile.country].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                  {viewProfile.bio && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-black/35 mb-1.5">Bio</p>
                      <p className="text-sm text-black/70 leading-relaxed">{viewProfile.bio}</p>
                    </div>
                  )}
                  {viewProfile.professions?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-black/35 mb-2">Professions</p>
                      <div className="flex flex-wrap gap-2">
                        {viewProfile.professions.map((p) => (
                          <span key={p} className="rounded-full bg-black/8 px-3 py-1 text-xs font-medium text-black/70">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {viewProfile.skills && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-black/35 mb-2">Skills</p>
                      <div className="flex flex-wrap gap-2">
                        {viewProfile.skills.split(",").map((s) => s.trim()).filter(Boolean).map((s) => (
                          <span key={s} className="rounded-full border border-black/10 px-3 py-1 text-xs text-black/60">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
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
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Decline modal */}
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
