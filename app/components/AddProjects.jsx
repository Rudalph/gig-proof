"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { doc, setDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "../context/AuthContext";

import UserProjects from "./UserAddedProjects";

export default function AddProjects() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
    
        if (!user) {
          alert("Please login first");
          return;
        }
    
        setLoading(true);
    
        const formData = new FormData(e.target);
    
        const projectData = {
          title: formData.get("title"),
          description: formData.get("description"),
          budget: formData.get("budget"),
          deadline: formData.get("deadline"),
          category: formData.get("category"),
          experienceLevel: formData.get("experienceLevel"),
          tags: formData
            .get("tags")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          requirements: formData.get("requirements"),
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
    
          await addDoc(
            collection(db, "users", user.uid, "projectsAdded"),
            projectData
          );
    
          console.log("Project added:", projectData);
    
          e.target.reset();
          setOpen(false);
        } catch (error) {
          console.error("Error adding project:", error);
          alert(error.message);
        } finally {
          setLoading(false);
        }
      };

  return (
    <div className=" bg-white p-6 text-black">
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
                onClick={() => setOpen(false)}
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
                <label className="mb-1 block text-sm font-medium">Description</label>
                <textarea
                  name="description"
                  required
                  rows="4"
                  placeholder="Describe the project..."
                  className="w-full rounded-xl border border-black/20 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
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
                <label className="mb-1 block text-sm font-medium">Tags</label>
                <input
                  name="tags"
                  placeholder="React, Firebase, Tailwind"
                  className="w-full rounded-xl border border-black/20 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Requirements</label>
                <textarea
                  name="requirements"
                  rows="3"
                  placeholder="Mention skills, tools, or deliverables required..."
                  className="w-full rounded-xl border border-black/20 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-black px-5 py-3 font-medium transition hover:bg-black hover:text-white"
                >
                  Cancel
                </button>

                <button disabled={loading} type="submit" className="rounded-xl bg-black px-5 py-3 text-white">
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