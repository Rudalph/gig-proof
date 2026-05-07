"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { doc, setDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { PROFESSIONS } from "../lib/professions";

import UserProjects from "./UserAddedProjects";
import JobAnalytics from "./JobAnalytics";

const DESCRIPTION_WORD_LIMIT = 100;
const REQUIREMENTS_WORD_LIMIT = 150;
const TAGS_LIMIT = 5;

function countWords(text) {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function parseTags(value) {
  return [...new Set(value.split(",").map((t) => t.trim()).filter(Boolean))];
}

export default function AddProjects() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("post");
  const { user } = useAuth();
  const toast = useToast();

  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const descWords = countWords(description);
  const reqWords = countWords(requirements);
  const tagCount = parseTags(tagsInput).length;

  const today = new Date().toISOString().split("T")[0];

  const invalidStartDate = !!(startDate && startDate < today);

  const isSameDay = !!(startDate && endDate && startDate === endDate);
  const isMultiDay = !!(startDate && endDate && !invalidStartDate && new Date(endDate) > new Date(startDate));

  const durationDays = isMultiDay
    ? Math.ceil((new Date(endDate) - new Date(startDate)) / 86400000)
    : null;

  const sameDayMins =
    isSameDay && startTime && endTime
      ? (() => {
          const [sh, sm] = startTime.split(":").map(Number);
          const [eh, em] = endTime.split(":").map(Number);
          return (eh * 60 + em) - (sh * 60 + sm);
        })()
      : null;

  const invalidSameDayTime = !!(isSameDay && startTime && endTime && sameDayMins <= 0);
  const invalidDuration = !!(startDate && endDate && !invalidStartDate && !isSameDay && !isMultiDay);

  const isOverLimit =
    descWords > DESCRIPTION_WORD_LIMIT ||
    reqWords > REQUIREMENTS_WORD_LIMIT ||
    tagCount > TAGS_LIMIT;

  const handleClose = () => {
    setOpen(false);
    setDescription("");
    setRequirements("");
    setTagsInput("");
    setStartDate("");
    setEndDate("");
    setStartTime("");
    setEndTime("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      toast("Please log in first.", "error");
      return;
    }

    if (isOverLimit) return;

    if (parseTags(tagsInput).length === 0) {
      toast("Please add at least one tag.", "error");
      return;
    }

    setLoading(true);

    const formData = new FormData(e.target);

    const projectData = {
      title: formData.get("title"),
      description,
      budget: formData.get("budget"),
      currency: formData.get("currency"),
      startDate,
      endDate,
      startTime: startTime || null,
      endTime: endTime || null,
      isSameDay: isSameDay || false,
      durationDays: durationDays || 0,
      deadline: endDate,
      category: formData.get("category"),
      experienceLevel: formData.get("experienceLevel"),
      tags: parseTags(tagsInput),
      requirements,
      status: "open",
      createdAt: serverTimestamp(),
      ownerId: user.uid,
      ownerEmail: user.email,
      ownerName: user.displayName || user.email?.split("@")[0] || "Unknown",
    };

    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          name: user.displayName || user.email?.split("@")[0] || "User",
          email: user.email,
          photoURL: user.photoURL || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Add to user's subcollection and get the auto-generated ID
      const subcollectionRef = await addDoc(
        collection(db, "users", user.uid, "projectsAdded"),
        projectData
      );

      // Mirror to top-level projects collection using the same ID
      await setDoc(doc(db, "projects", subcollectionRef.id), {
        ...projectData,
        subcollectionId: subcollectionRef.id,
      });

      e.target.reset();
      handleClose();
    } catch (error) {
      console.error("Error adding project:", error);
      toast(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6 text-black">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-black/35 mb-1">Freelancing</p>
        <h1 className="text-2xl font-bold text-black">Hire Talent</h1>
      </div>

      <div className="flex gap-1 rounded-2xl bg-black/5 p-1 w-fit">
        <button
          onClick={() => setActiveTab("post")}
          className={`rounded-xl px-5 py-2 text-sm font-medium transition ${
            activeTab === "post" ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black"
          }`}
        >
          Post a Job
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`rounded-xl px-5 py-2 text-sm font-medium transition ${
            activeTab === "analytics" ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black"
          }`}
        >
          Analytics
        </button>
      </div>

      {activeTab === "post" && <UserProjects />}
      {activeTab === "analytics" && <JobAnalytics />}

      {activeTab === "post" && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:scale-105"
        >
          <Plus size={20} />
          Add Project
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white text-black shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 p-5">
              <h2 className="text-xl font-semibold">Add Freelance Project</h2>
              <button
                onClick={handleClose}
                className="rounded-full p-2 transition hover:bg-black hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="max-h-[80vh] space-y-4 overflow-y-auto p-5">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Project Title <span className="text-red-500">*</span>
                </label>
                <input
                  name="title"
                  required
                  placeholder="E.g. Build a React portfolio website"
                  className="w-full rounded-xl border border-black/20 bg-white text-black px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm font-medium">Description</label>
                  <span className={`text-xs ${descWords > DESCRIPTION_WORD_LIMIT ? "text-red-500 font-semibold" : "text-black/40"}`}>
                    {descWords} / {DESCRIPTION_WORD_LIMIT} words
                  </span>
                </div>
                <div className="mb-2 h-1 w-full rounded-full bg-black/8">
                  <div
                    className={`h-1 rounded-full transition-all duration-200 ${descWords > DESCRIPTION_WORD_LIMIT ? "bg-red-500" : "bg-black/40"}`}
                    style={{ width: `${Math.min((descWords / DESCRIPTION_WORD_LIMIT) * 100, 100)}%` }}
                  />
                </div>
                <textarea
                  name="description"
                  required
                  rows="4"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the project..."
                  className={`w-full rounded-xl border px-4 py-3 outline-none transition ${
                    descWords > DESCRIPTION_WORD_LIMIT ? "border-red-400 focus:border-red-500" : "border-black/20 focus:border-black"
                  }`}
                />
                {descWords > DESCRIPTION_WORD_LIMIT && (
                  <p className="mt-1 text-xs text-red-500">
                    {descWords - DESCRIPTION_WORD_LIMIT} word{descWords - DESCRIPTION_WORD_LIMIT > 1 ? "s" : ""} over the limit
                  </p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Budget <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="budget"
                    type="number"
                    required
                    min="0"
                    placeholder="500"
                    className="w-full rounded-xl border border-black/20 bg-white text-black px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Currency <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="currency"
                    required
                    className="w-full rounded-xl border border-black/20 bg-white text-black px-4 py-3 outline-none focus:border-black"
                  >
                    <optgroup label="Crypto">
                      <option>USDC</option>
                      <option>SOL</option>
                      <option>ETH</option>
                      <option>BTC</option>
                    </optgroup>
                    <optgroup label="Fiat">
                      <option>USD</option>
                      <option>EUR</option>
                      <option>GBP</option>
                      <option>INR</option>
                      <option>AUD</option>
                      <option>CAD</option>
                      <option>JPY</option>
                      <option>SGD</option>
                      <option>AED</option>
                      <option>CHF</option>
                      <option>BRL</option>
                      <option>NGN</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Project Duration <span className="text-red-500">*</span>
                </label>
                {/* Date row */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs text-black/45">From date</p>
                    <input
                      type="date"
                      value={startDate}
                      min={today}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      className={`w-full rounded-xl border px-4 py-3 outline-none transition bg-white text-black ${
                        invalidStartDate ? "border-red-400 focus:border-red-500" : "border-black/20 focus:border-black"
                      }`}
                    />
                    {invalidStartDate && (
                      <p className="mt-1 text-xs text-red-500">Start date cannot be in the past</p>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-black/45">To date</p>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                      min={startDate || today}
                      className="w-full rounded-xl border border-black/20 bg-white text-black px-4 py-3 outline-none focus:border-black"
                    />
                  </div>
                </div>

                {/* Time row */}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs text-black/45">Start time</p>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full rounded-xl border border-black/20 bg-white text-black px-4 py-3 outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-black/45">End time</p>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className={`w-full rounded-xl border px-4 py-3 outline-none transition bg-white text-black ${
                        invalidSameDayTime ? "border-red-400 focus:border-red-500" : "border-black/20 focus:border-black"
                      }`}
                    />
                  </div>
                </div>

                {/* Summary */}
                {invalidSameDayTime && (
                  <p className="mt-2 text-xs text-red-500">End time must be after start time</p>
                )}
                {isSameDay && sameDayMins > 0 && (
                  <p className="mt-2 text-sm text-black/50">
                    <span className="font-semibold text-black">
                      {Math.floor(sameDayMins / 60) > 0 ? `${Math.floor(sameDayMins / 60)}h ` : ""}
                      {sameDayMins % 60 > 0 ? `${sameDayMins % 60}m` : ""}
                    </span>{" "}
                    total
                  </p>
                )}
                {isMultiDay && durationDays && (
                  <p className="mt-2 text-sm text-black/50">
                    <span className="font-semibold text-black">{durationDays}</span>{" "}
                    day{durationDays !== 1 ? "s" : ""} total
                  </p>
                )}
                {invalidDuration && (
                  <p className="mt-2 text-xs text-red-500">End date must be on or after start date</p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Category</label>
                  <select
                    name="category"
                    className="w-full rounded-xl border border-black/20 bg-white text-black px-4 py-3 outline-none focus:border-black"
                  >
                    {PROFESSIONS.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Experience Level</label>
                  <select
                    name="experienceLevel"
                    className="w-full rounded-xl border border-black/20 bg-white text-black px-4 py-3 outline-none focus:border-black"
                  >
                    <option>Any</option>
                    <option>Beginner</option>
                    <option>Intermediate</option>
                    <option>Expert</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">
                      Tags <span className="text-red-500">*</span>
                    </label>
                    <span className="ml-2 text-xs text-black/40">Separate with commas</span>
                  </div>
                  <span className={`text-xs ${tagCount > TAGS_LIMIT ? "text-red-500 font-semibold" : "text-black/40"}`}>
                    {tagCount} / {TAGS_LIMIT} tags
                  </span>
                </div>
                <input
                  name="tags"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g. React, Firebase, Tailwind"
                  className={`w-full rounded-xl border px-4 py-3 outline-none transition ${
                    tagCount > TAGS_LIMIT ? "border-red-400 focus:border-red-500" : "border-black/20 focus:border-black"
                  }`}
                />
                {tagCount > TAGS_LIMIT && (
                  <p className="mt-1 text-xs text-red-500">
                    Maximum {TAGS_LIMIT} tags allowed
                  </p>
                )}
                {parseTags(tagsInput).length > 0 && tagCount <= TAGS_LIMIT && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {parseTags(tagsInput).map((tag) => (
                      <span key={tag} className="rounded-full bg-black/5 px-3 py-1 text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm font-medium">Requirements</label>
                  <span className={`text-xs ${reqWords > REQUIREMENTS_WORD_LIMIT ? "text-red-500 font-semibold" : "text-black/40"}`}>
                    {reqWords} / {REQUIREMENTS_WORD_LIMIT} words
                  </span>
                </div>
                <div className="mb-2 h-1 w-full rounded-full bg-black/8">
                  <div
                    className={`h-1 rounded-full transition-all duration-200 ${reqWords > REQUIREMENTS_WORD_LIMIT ? "bg-red-500" : "bg-black/40"}`}
                    style={{ width: `${Math.min((reqWords / REQUIREMENTS_WORD_LIMIT) * 100, 100)}%` }}
                  />
                </div>
                <textarea
                  name="requirements"
                  rows="3"
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder="Mention skills, tools, or deliverables required..."
                  className={`w-full rounded-xl border px-4 py-3 outline-none transition ${
                    reqWords > REQUIREMENTS_WORD_LIMIT ? "border-red-400 focus:border-red-500" : "border-black/20 focus:border-black"
                  }`}
                />
                {reqWords > REQUIREMENTS_WORD_LIMIT && (
                  <p className="mt-1 text-xs text-red-500">
                    {reqWords - REQUIREMENTS_WORD_LIMIT} word{reqWords - REQUIREMENTS_WORD_LIMIT > 1 ? "s" : ""} over the limit
                  </p>
                )}
              </div>

              <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-xl border border-black px-5 py-3 font-medium transition hover:bg-black hover:text-white"
                >
                  Cancel
                </button>

                <button
                  disabled={loading || isOverLimit || !!invalidDuration || invalidStartDate || invalidSameDayTime}
                  type="submit"
                  className="rounded-xl bg-black px-5 py-3 text-white disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Submit Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
