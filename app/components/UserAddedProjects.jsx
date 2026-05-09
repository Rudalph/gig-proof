"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "../context/AuthContext";
import { X, Pencil, Trash2, Search, ChevronDown, ChevronUp } from "lucide-react";
import { useCurrency, formatBudget } from "../context/CurrencyContext";
import { PROFESSIONS } from "../lib/professions";

const DESCRIPTION_WORD_LIMIT = 100;
const REQUIREMENTS_WORD_LIMIT = 150;
const TAGS_LIMIT = 5;

function countWords(text) {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function parseTags(value) {
  return [...new Set(value.split(",").map((t) => t.trim()).filter(Boolean))];
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

function formatTime(timeStr) {
  if (!timeStr) return "";
  const [hourStr, minStr] = timeStr.split(":");
  let h = parseInt(hourStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${minStr} ${ampm}`;
}

function generateCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function scoreProject(project, q) {
  if (!q.trim()) return 1;
  const query = q.toLowerCase();
  let score = 0;
  if (project.title?.toLowerCase().includes(query)) score += 3;
  if ((project.tags || []).some((t) => t.toLowerCase().includes(query))) score += 2;
  if (project.category?.toLowerCase().includes(query)) score += 1;
  if (project.description?.toLowerCase().includes(query)) score += 0.5;
  return score;
}

function toggleSet(setter, value) {
  setter((prev) => {
    const next = new Set(prev);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  });
}

function FilterGroup({ label, options, selected, onToggle, onClear }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="shrink-0 text-xs font-medium text-black/50">{label}</label>
      <button
        onClick={onClear}
        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
          selected.size === 0 ? "bg-black text-white" : "bg-black/5 text-black hover:bg-black/10"
        }`}
      >
        All
      </button>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onToggle(opt)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            selected.has(opt) ? "bg-black text-white" : "bg-black/5 text-black hover:bg-black/10"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

const EXPERIENCE_LEVELS = ["Any", "Beginner", "Intermediate", "Expert"];
const CURRENCIES = ["USDC", "SOL", "ETH", "BTC", "USD", "EUR", "GBP", "INR", "AUD", "CAD", "JPY", "SGD", "AED", "CHF", "BRL", "NGN"];

export default function UserAddedProjects() {
  const { user } = useAuth();
  const { defaultCurrency, rates } = useCurrency();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [selectedTags, setSelectedTags] = useState(new Set());
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  const allCategories = [...new Set(projects.map((p) => p.category).filter(Boolean))];
  const allTags = [...new Set(projects.flatMap((p) => p.tags || []))];

  const advancedActiveCount = selectedCategories.size + selectedTags.size;

  const filtered = projects
    .map((p) => ({ ...p, _score: scoreProject(p, searchQuery) }))
    .filter((p) => {
      if (searchQuery.trim() && p._score === 0) return false;
      if (selectedCategories.size > 0 && !selectedCategories.has(p.category)) return false;
      if (selectedTags.size > 0 && !(p.tags || []).some((t) => selectedTags.has(t))) return false;
      return true;
    })
    .sort((a, b) => b._score - a._score);

  const openEdit = () => {
    setEditData({
      description: selectedProject.description || "",
      budget: selectedProject.budget || "",
      currency: selectedProject.currency || "USDC",
      startDate: selectedProject.startDate || "",
      endDate: selectedProject.endDate || selectedProject.deadline || "",
      startTime: selectedProject.startTime || "",
      endTime: selectedProject.endTime || "",
      category: selectedProject.category || PROFESSIONS[0],
      experienceLevel: selectedProject.experienceLevel || EXPERIENCE_LEVELS[0],
      tags: (selectedProject.tags || []).join(", "),
      requirements: selectedProject.requirements || "",
      freelancerCount: selectedProject.freelancerCount || 1,
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

    if (editData.startDate && editData.endDate && editData.endDate < editData.startDate) {
      errors.endDate = "End date must be on or after start date";
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
      const isSameDay = !!(editData.startDate && editData.endDate && editData.startDate === editData.endDate);
      const durationDays =
        editData.startDate && editData.endDate && !isSameDay && new Date(editData.endDate) > new Date(editData.startDate)
          ? Math.ceil((new Date(editData.endDate) - new Date(editData.startDate)) / 86400000)
          : 0;

      const updatedFields = {
        description: editData.description,
        budget: editData.budget,
        currency: editData.currency,
        startDate: editData.startDate || null,
        endDate: editData.endDate || null,
        startTime: editData.startTime || null,
        endTime: editData.endTime || null,
        isSameDay,
        durationDays,
        deadline: editData.endDate || null,
        category: editData.category,
        experienceLevel: editData.experienceLevel,
        tags: parseTags(editData.tags),
        requirements: editData.requirements,
        freelancerCount: Math.min(99, Math.max(1, parseInt(editData.freelancerCount, 10) || 1)),
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "users", user.uid, "projectsAdded", selectedProject.id), updatedFields);
      await updateDoc(doc(db, "projects", selectedProject.id), updatedFields);

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
      await deleteDoc(doc(db, "projects", selectedProject.id));
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
      <h2 className="mb-4 text-xl font-semibold text-black">Your Projects</h2>

      {/* Search */}
      {projects.length > 0 && (
        <div className="relative mb-4">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your projects..."
            className="w-full rounded-xl border border-black/20 bg-white text-black py-3 pl-10 pr-10 text-sm outline-none focus:border-black"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-black/30 hover:text-black"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Filters toggle */}
      {projects.length > 0 && (
        <div className="mb-5">
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-black/60 hover:text-black transition mb-3"
          >
            {showAdvanced ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            Filters
            {advancedActiveCount > 0 && (
              <span className="ml-1 rounded-full bg-black text-white text-xs px-2 py-0.5">
                {advancedActiveCount}
              </span>
            )}
          </button>

          {showAdvanced && (
            <div className="space-y-3 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
              <FilterGroup
                label="Category"
                options={allCategories}
                selected={selectedCategories}
                onToggle={(v) => toggleSet(setSelectedCategories, v)}
                onClear={() => setSelectedCategories(new Set())}
              />
              {allTags.length > 0 && (
                <FilterGroup
                  label="Tags"
                  options={allTags}
                  selected={selectedTags}
                  onToggle={(v) => toggleSet(setSelectedTags, v)}
                  onClear={() => setSelectedTags(new Set())}
                />
              )}
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-black/10 p-6 text-center text-black/60">
          {projects.length === 0 ? "No projects added yet." : "No projects match your search or filters."}
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
                  <span key={tag} className="rounded-full border border-black/10 px-3 py-1 text-xs text-black">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="space-y-1 text-sm text-black/70">
                <p>
                  <span className="font-medium text-black">Budget:</span>{" "}
                  {formatBudget(project.budget, project.currency, defaultCurrency, rates)}
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
                      className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition bg-white text-black ${
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
                      className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition bg-white text-black ${
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

              {/* Budget / Currency / Duration */}
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-black/40">Budget</label>
                      <input
                        type="number"
                        value={editData.budget}
                        onChange={(e) => field("budget", e.target.value)}
                        className="w-full rounded-xl border border-black/20 bg-white text-black px-3 py-2 text-sm outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-black/40">Currency</label>
                      <select
                        value={editData.currency}
                        onChange={(e) => field("currency", e.target.value)}
                        className="w-full rounded-xl border border-black/20 bg-white text-black px-3 py-2 text-sm outline-none focus:border-black"
                      >
                        {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-black/40">Start date</label>
                      <input
                        type="date"
                        value={editData.startDate}
                        onChange={(e) => field("startDate", e.target.value)}
                        className="w-full rounded-xl border border-black/20 bg-white text-black px-3 py-2 text-sm outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-black/40">End date</label>
                      <input
                        type="date"
                        value={editData.endDate}
                        onChange={(e) => field("endDate", e.target.value)}
                        min={editData.startDate || undefined}
                        className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition bg-white text-black ${
                          editErrors.endDate ? "border-red-400 focus:border-red-500" : "border-black/20 focus:border-black"
                        }`}
                      />
                      {editErrors.endDate && <p className="mt-1 text-xs text-red-500">{editErrors.endDate}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-black/40">Start time <span className="text-black/25">(optional)</span></label>
                      <input
                        type="time"
                        value={editData.startTime}
                        onChange={(e) => field("startTime", e.target.value)}
                        className="w-full rounded-xl border border-black/20 bg-white text-black px-3 py-2 text-sm outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-black/40">End time <span className="text-black/25">(optional)</span></label>
                      <input
                        type="time"
                        value={editData.endTime}
                        onChange={(e) => field("endTime", e.target.value)}
                        className="w-full rounded-xl border border-black/20 bg-white text-black px-3 py-2 text-sm outline-none focus:border-black"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-black/40">Freelancers needed</label>
                    <div className="flex items-center gap-2 w-36">
                      <button
                        type="button"
                        onClick={() => field("freelancerCount", Math.max(1, (parseInt(editData.freelancerCount, 10) || 1) - 1))}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/20 text-lg font-medium transition hover:bg-black hover:text-white"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={editData.freelancerCount}
                        onChange={(e) => field("freelancerCount", Math.min(99, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                        className="w-full rounded-xl border border-black/20 bg-white text-black px-3 py-2 text-sm text-center outline-none focus:border-black"
                      />
                      <button
                        type="button"
                        onClick={() => field("freelancerCount", Math.min(99, (parseInt(editData.freelancerCount, 10) || 1) + 1))}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/20 text-lg font-medium transition hover:bg-black hover:text-white"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-black/5 px-4 py-3">
                    <p className="text-xs text-black/40">Budget</p>
                    <p className="mt-1 font-semibold">
                      {formatBudget(selectedProject.budget, selectedProject.currency, defaultCurrency, rates)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-black/5 px-4 py-3">
                    <p className="text-xs text-black/40">Duration</p>
                    <p className="mt-1 font-semibold">
                      {selectedProject.isSameDay
                        ? selectedProject.startTime && selectedProject.endTime
                          ? `${formatTime(selectedProject.startTime)} – ${formatTime(selectedProject.endTime)}`
                          : formatDate(selectedProject.startDate || selectedProject.deadline)
                        : selectedProject.durationDays > 0
                        ? `${selectedProject.durationDays} day${selectedProject.durationDays !== 1 ? "s" : ""}`
                        : formatDate(selectedProject.deadline)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-black/5 px-4 py-3">
                    <p className="text-xs text-black/40">Freelancers needed</p>
                    <p className="mt-1 font-semibold">
                      {selectedProject.approvedCount || 0} / {selectedProject.freelancerCount || 1} filled
                    </p>
                  </div>
                </div>
              )}

              {/* Category / Experience Level */}
              <div className="grid grid-cols-2 gap-4">
                <div className={isEditing ? "" : "rounded-2xl bg-black/5 px-4 py-3 text-black"}>
                  {isEditing ? (
                    <>
                      <label className="mb-1 block text-xs text-black/40">Category</label>
                      <select
                        value={editData.category}
                        onChange={(e) => field("category", e.target.value)}
                        className="w-full rounded-xl border border-black/20 bg-white text-black px-3 py-2 text-sm outline-none focus:border-black"
                      >
                        {PROFESSIONS.map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-black/40">Category</p>
                      <p className="mt-1 font-semibold">{selectedProject.category || "—"}</p>
                    </>
                  )}
                </div>

                <div className={isEditing ? "" : "rounded-2xl bg-black/5 px-4 py-3 text-black"}>
                  {isEditing ? (
                    <>
                      <label className="mb-1 block text-xs text-black/40">Experience Level</label>
                      <select
                        value={editData.experienceLevel}
                        onChange={(e) => field("experienceLevel", e.target.value)}
                        className="w-full rounded-xl border border-black/20 bg-white text-black px-3 py-2 text-sm outline-none focus:border-black"
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
                    <p className="mb-1.5 text-xs text-black/40">Separate with commas</p>
                    <input
                      value={editData.tags}
                      onChange={(e) => field("tags", e.target.value)}
                      placeholder="e.g. React, Firebase, Tailwind"
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
            className="w-full max-w-md rounded-2xl bg-white text-black p-6 shadow-2xl"
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
                  : "border-black/20 bg-white text-black focus:border-black"
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
