"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { doc, setDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "../context/AuthContext";

import UserProjects from "./UserAddedProjects";

const DESCRIPTION_WORD_LIMIT = 100;
const REQUIREMENTS_WORD_LIMIT = 150;
const TAGS_LIMIT = 5;

function countWords(text) {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function parseTags(value) {
  return value.split(",").map((t) => t.trim()).filter(Boolean);
}

export default function AddProjects() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const descWords = countWords(description);
  const reqWords = countWords(requirements);
  const tagCount = parseTags(tagsInput).length;

  const isOverLimit =
    descWords > DESCRIPTION_WORD_LIMIT ||
    reqWords > REQUIREMENTS_WORD_LIMIT ||
    tagCount > TAGS_LIMIT;

  const handleClose = () => {
    setOpen(false);
    setDescription("");
    setRequirements("");
    setTagsInput("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      alert("Please login first");
      return;
    }

    if (isOverLimit) return;

    setLoading(true);

    const formData = new FormData(e.target);

    const projectData = {
      title: formData.get("title"),
      description,
      budget: formData.get("budget"),
      currency: formData.get("currency"),
      deadline: formData.get("deadline"),
      category: formData.get("category"),
      experienceLevel: formData.get("experienceLevel"),
      tags: parseTags(tagsInput),
      requirements,
      status: "open",
      createdAt: serverTimestamp(),
      ownerId: user.uid,
      ownerEmail: user.email,
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
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 text-black">
      <h1 className="text-2xl font-semibold">Add Projects</h1>
      <UserProjects />
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:scale-105"
      >
        <Plus size={20} />
        Add Project
      </button>

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
                <label className="mb-1 block text-sm font-medium">Project Title</label>
                <input
                  name="title"
                  required
                  placeholder="E.g. Build a React portfolio website"
                  className="w-full rounded-xl border border-black/20 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm font-medium">Description</label>
                  <span className={`text-xs ${descWords > DESCRIPTION_WORD_LIMIT ? "text-red-500 font-semibold" : "text-black/40"}`}>
                    {descWords} / {DESCRIPTION_WORD_LIMIT} words
                  </span>
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

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Budget</label>
                  <input
                    name="budget"
                    type="number"
                    placeholder="500"
                    className="w-full rounded-xl border border-black/20 px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Currency</label>
                  <select
                    name="currency"
                    className="w-full rounded-xl border border-black/20 px-4 py-3 outline-none focus:border-black"
                  >
                    <option>USDC</option>
                    <option>SOL</option>
                    <option>USD</option>
                    <option>EUR</option>
                    <option>INR</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Deadline</label>
                  <input
                    name="deadline"
                    type="date"
                    className="w-full rounded-xl border border-black/20 px-4 py-3 outline-none focus:border-black"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Category</label>
                  <select
                    name="category"
                    className="w-full rounded-xl border border-black/20 px-4 py-3 outline-none focus:border-black"
                  >
                    <option>Web Development</option>
                    <option>Mobile App</option>
                    <option>UI/UX Design</option>
                    <option>Writing</option>
                    <option>Marketing</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Experience Level</label>
                  <select
                    name="experienceLevel"
                    className="w-full rounded-xl border border-black/20 px-4 py-3 outline-none focus:border-black"
                  >
                    <option>Beginner</option>
                    <option>Intermediate</option>
                    <option>Expert</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm font-medium">Tags</label>
                  <span className={`text-xs ${tagCount > TAGS_LIMIT ? "text-red-500 font-semibold" : "text-black/40"}`}>
                    {tagCount} / {TAGS_LIMIT} tags
                  </span>
                </div>
                <input
                  name="tags"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="React, Firebase, Tailwind"
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
                  disabled={loading || isOverLimit}
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
