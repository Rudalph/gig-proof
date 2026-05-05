"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "../context/AuthContext";
import { X, Pencil, Trash2 } from "lucide-react";

const DESCRIPTION_WORD_LIMIT = 100;
const REQUIREMENTS_WORD_LIMIT = 150;
const TAGS_LIMIT = 5;

function countWords(text) {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function parseTags(value) {
  return value.split(",").map((t) => t.trim()).filter(Boolean);
}

function formatDate(dateStr) {
  if (!dateStr) return "Not specified";
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = day;
  const suffix =
    d % 10 === 1 && d !== 11 ? "st" :
    d % 10 === 2 && d !== 12 ? "nd" :
    d % 10 === 3 && d !== 13 ? "rd" : "th";
  const monthName = new Date(year, month - 1, 1).toLocaleString("default", { month: "long" });
  return `${d}${suffix} ${monthName}, ${year}`;
}

function generateCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

const CATEGORIES = ["Web Development", "Mobile App", "UI/UX Design", "Writing", "Marketing", "Other"];
const EXPERIENCE_LEVELS = ["Beginner", "Intermediate", "Expert"];
const CURRENCIES = ["USDC", "SOL", "USD", "EUR", "INR"];

export default function UserAddedProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);

  const [filterCategory, setFilterCategory] = useState("All");
  const [filterTag, setFilterTag] = useState("All");

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;

    const projectsRef = collection(db, "users", user.uid, "projectsAdded");
    const q = query(projectsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setProjects(projectList);

      setSelectedProject((prev) => {
        if (!prev) return null;
        return projectList.find((p) => p.id === prev.id) || null;
      });
    });

    return () => unsubscribe();
  }, [user]);

  if (!user) return null;

  const allCategories = ["All", ...new Set(projects.map((p) => p.category).filter(Boolean))];
  const allTags = ["All", ...new Set(projects.flatMap((p) => p.tags || []))];

  const filtered = projects.filter((p) => {
    const categoryMatch = filterCategory === "All" || p.category === filterCategory;
    const tagMatch = filterTag === "All" || (p.tags || []).includes(filterTag);
    return categoryMatch && tagMatch;
  });

  const openEdit = () => {
    setEditData({
      description: selectedProject.description || "",
      budget: selectedProject.budget || "",
      currency: selectedProject.currency || "USDC",
      deadline: selectedProject.deadline || "",
      category: selectedProject.category || CATEGORIES[0],
      experienceLevel: selectedProject.experienceLevel || EXPERIENCE_LEVELS[0],
      tags: (selectedProject.tags || []).join(", "),
      requirements: selectedProject.requirements || "",
    });
    setEditErrors({});
    setIsEditing(true);
  };

  const openDeleteModal = () => {
    setDeleteCode(generateCode());
    setDeleteInput("");
    setShowDeleteModal(true);
  };

  const closeModal = () => {
    setSelectedProject(null);
    setIsEditing(false);
    setEditData({});
    setEditErrors({});
    setShowDeleteModal(false);
    setDeleteInput("");
  };

  const validate = () => {
    const errors = {};

    const descWords = countWords(editData.description);
    if (descWords > DESCRIPTION_WORD_LIMIT) {
      errors.description = `${descWords - DESCRIPTION_WORD_LIMIT} word${descWords - DESCRIPTION_WORD_LIMIT > 1 ? "s" : ""} over the ${DESCRIPTION_WORD_LIMIT}-word limit`;
    }

    const reqWords = countWords(editData.requirements);
    if (reqWords > REQUIREMENTS_WORD_LIMIT) {
      errors.requirements = `${reqWords - REQUIREMENTS_WORD_LIMIT} word${reqWords - REQUIREMENTS_WORD_LIMIT > 1 ? "s" : ""} over the ${REQUIREMENTS_WORD_LIMIT}-word limit`;
    }

    const tagCount = parseTags(editData.tags).length;
    if (tagCount > TAGS_LIMIT) {
      errors.tags = `Maximum ${TAGS_LIMIT} tags allowed`;
    }

    if (editData.deadline && selectedProject.deadline) {
      if (editData.deadline < selectedProject.deadline) {
        errors.deadline = "Deadline can only be extended, not moved earlier";
      }
    }

    return errors;
  };

  const handleSave = async () => {
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const ref = doc(db, "users", user.uid, "projectsAdded", selectedProject.id);
      await updateDoc(ref, {
        description: editData.description,
        budget: editData.budget,
        currency: editData.currency,
        deadline: editData.deadline,
        category: editData.category,
        experienceLevel: editData.experienceLevel,
        tags: parseTags(editData.tags),
        requirements: editData.requirements,
        updatedAt: serverTimestamp(),
      });
      setIsEditing(false);
      setEditErrors({});
    } catch (error) {
      console.error("Error updating project:", error);
      setEditErrors({ general: "Failed to save. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteInput !== deleteCode) return;

    setDeleting(true);
    try {
      await deleteDoc(doc(db, "users", user.uid, "projectsAdded", selectedProject.id));
      closeModal();
    } catch (error) {
      console.error("Error deleting project:", error);
    } finally {
      setDeleting(false);
    }
  };

  const field = (key, value) =>
    setEditData((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="mt-8">
      <h2 className="mb-4 text-xl font-semibold">Your Projects</h2>

      {projects.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-black/50">Category</label>
            <div className="flex flex-wrap gap-1">
              {allCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    filterCategory === cat ? "bg-black text-white" : "bg-black/5 text-black hover:bg-black/10"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {allTags.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-black/50">Tag</label>
              <div className="flex flex-wrap gap-1">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setFilterTag(tag)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      filterTag === tag ? "bg-black text-white" : "bg-black/5 text-black hover:bg-black/10"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-black/10 p-6 text-center text-black/60">
          {projects.length === 0 ? "No projects added yet." : "No projects match the selected filters."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => (
            <div
              key={project.id}
              onClick={() => { setSelectedProject(project); setIsEditing(false); }}
              className="cursor-pointer rounded-2xl border border-black/10 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-black/30"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold">{project.title}</h3>
                <span className="rounded-full bg-black px-3 py-1 text-xs text-white shrink-0">
                  {project.status}
                </span>
              </div>

              <p className="mb-4 line-clamp-3 text-sm text-black/60">{project.description}</p>

              <div className="mb-4 flex flex-wrap gap-2">
                {project.tags?.map((tag) => (
                  <span key={tag} className="rounded-full border border-black/10 px-3 py-1 text-xs">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="space-y-1 text-sm text-black/70">
                <p>
                  <span className="font-medium text-black">Budget:</span>{" "}
                  {project.budget ? `${project.budget} ${project.currency || ""}` : "Not specified"}
                </p>
                <p>
                  <span className="font-medium text-black">Category:</span> {project.category}
                </p>
                <p>
                  <span className="font-medium text-black">Deadline:</span> {formatDate(project.deadline)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedProject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white text-black shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-black/10 p-5">
              <div>
                <h2 className="text-xl font-semibold">{selectedProject.title}</h2>
                <p className="text-xs text-black/40 mt-0.5">Title cannot be changed</p>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing && (
                  <>
                    <div className="relative group">
                      <button
                        onClick={openEdit}
                        className="rounded-full p-2 transition hover:bg-black hover:text-white"
                      >
                        <Pencil size={18} />
                      </button>
                      <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-black px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition pointer-events-none">
                        Edit
                      </span>
                    </div>

                    <div className="relative group">
                      <button
                        onClick={openDeleteModal}
                        className="rounded-full p-2 transition hover:bg-red-500 hover:text-white text-black/60"
                      >
                        <Trash2 size={18} />
                      </button>
                      <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-red-500 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition pointer-events-none">
                        Delete
                      </span>
                    </div>
                  </>
                )}
                <button
                  onClick={closeModal}
                  className="rounded-full p-2 transition hover:bg-black hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-5 p-6">
              {editErrors.general && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-500">{editErrors.general}</p>
              )}

              {/* Description */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-black/40">Description</h3>
                  {isEditing && (
                    <span className={`text-xs ${countWords(editData.description) > DESCRIPTION_WORD_LIMIT ? "text-red-500 font-semibold" : "text-black/40"}`}>
                      {countWords(editData.description)} / {DESCRIPTION_WORD_LIMIT} words
                    </span>
                  )}
                </div>
                {isEditing ? (
                  <>
                    <textarea
                      rows="4"
                      value={editData.description}
                      onChange={(e) => field("description", e.target.value)}
                      className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition ${
                        editErrors.description ? "border-red-400 focus:border-red-500" : "border-black/20 focus:border-black"
                      }`}
                    />
                    {editErrors.description && <p className="mt-1 text-xs text-red-500">{editErrors.description}</p>}
                  </>
                ) : (
                  <p className="text-sm leading-relaxed text-black/80">{selectedProject.description}</p>
                )}
              </div>

              {/* Requirements */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-black/40">Requirements</h3>
                  {isEditing && (
                    <span className={`text-xs ${countWords(editData.requirements) > REQUIREMENTS_WORD_LIMIT ? "text-red-500 font-semibold" : "text-black/40"}`}>
                      {countWords(editData.requirements)} / {REQUIREMENTS_WORD_LIMIT} words
                    </span>
                  )}
                </div>
                {isEditing ? (
                  <>
                    <textarea
                      rows="3"
                      value={editData.requirements}
                      onChange={(e) => field("requirements", e.target.value)}
                      className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition ${
                        editErrors.requirements ? "border-red-400 focus:border-red-500" : "border-black/20 focus:border-black"
                      }`}
                    />
                    {editErrors.requirements && <p className="mt-1 text-xs text-red-500">{editErrors.requirements}</p>}
                  </>
                ) : (
                  selectedProject.requirements ? (
                    <p className="text-sm leading-relaxed text-black/80">{selectedProject.requirements}</p>
                  ) : (
                    <p className="text-sm text-black/40">Not specified</p>
                  )
                )}
              </div>

              {/* Budget / Currency / Deadline */}
              {isEditing ? (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="mb-1 block text-xs text-black/40">Budget</label>
                    <input
                      type="number"
                      value={editData.budget}
                      onChange={(e) => field("budget", e.target.value)}
                      className="w-full rounded-xl border border-black/20 px-3 py-2 text-sm outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-black/40">Currency</label>
                    <select
                      value={editData.currency}
                      onChange={(e) => field("currency", e.target.value)}
                      className="w-full rounded-xl border border-black/20 px-3 py-2 text-sm outline-none focus:border-black"
                    >
                      {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-black/40">
                      Deadline <span className="text-black/30">(can only extend)</span>
                    </label>
                    <input
                      type="date"
                      value={editData.deadline}
                      onChange={(e) => field("deadline", e.target.value)}
                      className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                        editErrors.deadline ? "border-red-400 focus:border-red-500" : "border-black/20 focus:border-black"
                      }`}
                    />
                    {editErrors.deadline && <p className="mt-1 text-xs text-red-500">{editErrors.deadline}</p>}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-black/5 px-4 py-3">
                    <p className="text-xs text-black/40">Budget</p>
                    <p className="mt-1 font-semibold">
                      {selectedProject.budget ? `${selectedProject.budget} ${selectedProject.currency || ""}` : "Not specified"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-black/5 px-4 py-3">
                    <p className="text-xs text-black/40">Deadline</p>
                    <p className="mt-1 font-semibold">{formatDate(selectedProject.deadline)}</p>
                  </div>
                </div>
              )}

              {/* Category / Experience Level */}
              <div className="grid grid-cols-2 gap-4">
                <div className={isEditing ? "" : "rounded-2xl bg-black/5 px-4 py-3"}>
                  {isEditing ? (
                    <>
                      <label className="mb-1 block text-xs text-black/40">Category</label>
                      <select
                        value={editData.category}
                        onChange={(e) => field("category", e.target.value)}
                        className="w-full rounded-xl border border-black/20 px-3 py-2 text-sm outline-none focus:border-black"
                      >
                        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-black/40">Category</p>
                      <p className="mt-1 font-semibold">{selectedProject.category || "—"}</p>
                    </>
                  )}
                </div>

                <div className={isEditing ? "" : "rounded-2xl bg-black/5 px-4 py-3"}>
                  {isEditing ? (
                    <>
                      <label className="mb-1 block text-xs text-black/40">Experience Level</label>
                      <select
                        value={editData.experienceLevel}
                        onChange={(e) => field("experienceLevel", e.target.value)}
                        className="w-full rounded-xl border border-black/20 px-3 py-2 text-sm outline-none focus:border-black"
                      >
                        {EXPERIENCE_LEVELS.map((l) => <option key={l}>{l}</option>)}
                      </select>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-black/40">Experience</p>
                      <p className="mt-1 font-semibold">{selectedProject.experienceLevel || "Any"}</p>
                    </>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-black/40">Tags</h3>
                  {isEditing && (
                    <span className={`text-xs ${parseTags(editData.tags).length > TAGS_LIMIT ? "text-red-500 font-semibold" : "text-black/40"}`}>
                      {parseTags(editData.tags).length} / {TAGS_LIMIT} tags
                    </span>
                  )}
                </div>
                {isEditing ? (
                  <>
                    <input
                      value={editData.tags}
                      onChange={(e) => field("tags", e.target.value)}
                      placeholder="React, Firebase, Tailwind"
                      className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition ${
                        editErrors.tags ? "border-red-400 focus:border-red-500" : "border-black/20 focus:border-black"
                      }`}
                    />
                    {editErrors.tags && <p className="mt-1 text-xs text-red-500">{editErrors.tags}</p>}
                    {parseTags(editData.tags).length > 0 && parseTags(editData.tags).length <= TAGS_LIMIT && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {parseTags(editData.tags).map((tag) => (
                          <span key={tag} className="rounded-full bg-black/5 px-3 py-1 text-xs">{tag}</span>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  selectedProject.tags?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedProject.tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-black/10 px-3 py-1 text-xs">{tag}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-black/40">No tags</p>
                  )
                )}
              </div>

              {/* Edit action buttons */}
              {isEditing && (
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => { setIsEditing(false); setEditErrors({}); }}
                    className="rounded-xl border border-black px-5 py-2.5 text-sm font-medium transition hover:bg-black hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-xl bg-black px-5 py-2.5 text-sm text-white disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={() => { setShowDeleteModal(false); setDeleteInput(""); }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <h2 className="text-xl font-semibold text-black">Delete Project</h2>
            </div>

            <p className="mb-2 text-sm text-black/60">
              You are about to permanently delete{" "}
              <span className="font-semibold text-black">"{selectedProject?.title}"</span>.
              This cannot be undone.
            </p>

            <p className="mb-4 text-sm text-black/60">
              To confirm, type the code below exactly as shown:
            </p>

            <div className="mb-4 flex items-center justify-center rounded-xl bg-red-50 py-3">
              <span className="font-mono text-2xl font-bold tracking-[0.3em] text-red-500">
                {deleteCode}
              </span>
            </div>

            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value.toUpperCase())}
              placeholder="Type the code here"
              maxLength={5}
              className={`w-full rounded-xl border px-4 py-3 text-center font-mono text-lg tracking-widest outline-none transition mb-4 ${
                deleteInput && deleteInput !== deleteCode
                  ? "border-red-300 bg-red-50 focus:border-red-400"
                  : deleteInput === deleteCode
                  ? "border-green-400 bg-green-50"
                  : "border-black/20 focus:border-black"
              }`}
            />

            {deleteInput && deleteInput !== deleteCode && (
              <p className="mb-3 text-center text-xs text-red-500">Code doesn't match</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteInput(""); }}
                className="flex-1 rounded-xl border border-black/20 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteInput !== deleteCode || deleting}
                className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-40"
              >
                {deleting ? "Deleting..." : "Delete Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
