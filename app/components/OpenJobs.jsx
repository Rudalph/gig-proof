"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, doc, updateDoc, arrayUnion, arrayRemove, getDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "../context/AuthContext";
import { X, Search, Bookmark, BookmarkCheck, Mail } from "lucide-react";

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

function scoreJob(job, q) {
  if (!q.trim()) return 1;
  const query = q.toLowerCase();
  let score = 0;
  if (job.title?.toLowerCase().includes(query)) score += 3;
  if ((job.tags || []).some((t) => t.toLowerCase().includes(query))) score += 2;
  if (job.category?.toLowerCase().includes(query)) score += 1;
  if (job.description?.toLowerCase().includes(query)) score += 0.5;
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

export default function OpenJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [bookmarking, setBookmarking] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [selectedTags, setSelectedTags] = useState(new Set());
  const [selectedLevels, setSelectedLevels] = useState(new Set());
  const [showOwnJobs, setShowOwnJobs] = useState(true);
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setJobs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (error) => {
        console.error("Open Jobs error:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchBookmarks = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) setBookmarks(snap.data().bookmarks || []);
    };
    fetchBookmarks();
  }, [user]);

  const isBookmarked = (jobId) => bookmarks.includes(jobId);

  const handleBookmark = async (job) => {
    if (!user) return;
    setBookmarking(true);
    const userRef = doc(db, "users", user.uid);
    try {
      if (isBookmarked(job.id)) {
        await updateDoc(userRef, { bookmarks: arrayRemove(job.id) });
        setBookmarks((prev) => prev.filter((id) => id !== job.id));
      } else {
        await updateDoc(userRef, { bookmarks: arrayUnion(job.id) });
        setBookmarks((prev) => [...prev, job.id]);
      }
    } catch (error) {
      console.error("Bookmark error:", error);
    } finally {
      setBookmarking(false);
    }
  };

  const allCategories = [...new Set(jobs.map((j) => j.category).filter(Boolean))];
  const allTags = [...new Set(jobs.flatMap((j) => j.tags || []))];
  const allLevels = [...new Set(jobs.map((j) => j.experienceLevel).filter(Boolean))];

  const filtered = jobs
    .map((j) => ({ ...j, _score: scoreJob(j, searchQuery) }))
    .filter((j) => {
      if (!showOwnJobs && j.ownerId === user?.uid) return false;
      if (showBookmarkedOnly && !isBookmarked(j.id)) return false;
      if (searchQuery.trim() && j._score === 0) return false;
      if (selectedCategories.size > 0 && !selectedCategories.has(j.category)) return false;
      if (selectedTags.size > 0 && !(j.tags || []).some((t) => selectedTags.has(t))) return false;
      if (selectedLevels.size > 0 && !selectedLevels.has(j.experienceLevel)) return false;
      return true;
    })
    .sort((a, b) => b._score - a._score);

  if (loading) return <p className="text-black/60">Loading open jobs...</p>;

  return (
    <div className="bg-white p-6 text-black">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Open Jobs</h1>
          <p className="text-sm text-black/50 mt-1">
            {filtered.length} job{filtered.length !== 1 ? "s" : ""} available
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowBookmarkedOnly((v) => !v)}
            className={`shrink-0 rounded-xl border px-4 py-2 text-xs font-medium transition ${
              showBookmarkedOnly
                ? "border-black bg-black text-white"
                : "border-black/20 bg-white text-black hover:border-black"
            }`}
          >
            {showBookmarkedOnly ? "All Jobs" : "Show Bookmarked"}
          </button>

          <button
            onClick={() => setShowOwnJobs((v) => !v)}
            className={`shrink-0 rounded-xl border px-4 py-2 text-xs font-medium transition ${
              !showOwnJobs
                ? "border-black bg-black text-white"
                : "border-black/20 bg-white text-black hover:border-black"
            }`}
          >
            {showOwnJobs ? "Hide my published jobs" : "Show my published jobs"}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by title, tags, or category..."
          className="w-full rounded-xl border border-black/20 py-3 pl-10 pr-10 text-sm outline-none focus:border-black"
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

      {/* Filters */}
      {jobs.length > 0 && (
        <div className="mb-6 space-y-3">
          <FilterGroup
            label="Category"
            options={allCategories}
            selected={selectedCategories}
            onToggle={(v) => toggleSet(setSelectedCategories, v)}
            onClear={() => setSelectedCategories(new Set())}
          />
          <FilterGroup
            label="Level"
            options={allLevels}
            selected={selectedLevels}
            onToggle={(v) => toggleSet(setSelectedLevels, v)}
            onClear={() => setSelectedLevels(new Set())}
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

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-black/10 p-6 text-center text-black/60">
          {jobs.length === 0 ? "No open jobs yet." : "No jobs match your search or filters."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((job) => {
            const isOwn = job.ownerId === user?.uid;
            return (
              <div
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className={`relative cursor-pointer rounded-2xl p-5 shadow-sm transition hover:shadow-md overflow-hidden ${
                  isOwn
                    ? "border-2 border-black/20 bg-gray-50 hover:border-black/40"
                    : "border border-black/10 bg-white hover:border-black/30"
                }`}
              >
                {isBookmarked(job.id) && (
                  <div className="absolute top-0 right-0">
                    <div className="w-0 h-0 border-l-[40px] border-l-transparent border-t-[40px] border-t-black" />
                    <BookmarkCheck size={13} className="absolute top-1 right-1 text-white" />
                  </div>
                )}

                <div className="mb-3">
                  <h3 className="text-lg font-semibold leading-snug">{job.title}</h3>
                  {isOwn && (
                    <span className="mt-1 inline-block rounded-full bg-black/10 px-2.5 py-1 text-xs font-medium text-black/60">
                      Your published project
                    </span>
                  )}
                </div>
                <p className="mb-4 line-clamp-3 text-sm text-black/60">{job.description}</p>
                <div className="mb-4 flex flex-wrap gap-2">
                  {job.tags?.map((tag) => (
                    <span key={tag} className="rounded-full border border-black/10 px-3 py-1 text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="space-y-1 text-sm text-black/70">
                  <p>
                    <span className="font-medium text-black">Budget:</span>{" "}
                    {job.budget ? `${job.budget} ${job.currency || ""}` : "Not specified"}
                  </p>
                  <p><span className="font-medium text-black">Category:</span> {job.category}</p>
                  <p><span className="font-medium text-black">Level:</span> {job.experienceLevel}</p>
                  <p><span className="font-medium text-black">Deadline:</span> {formatDate(job.deadline)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selectedJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelectedJob(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white text-black shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-black/10 p-5">
              <div>
                <h2 className="text-xl font-semibold">{selectedJob.title}</h2>
                {selectedJob.ownerId === user?.uid && (
                  <span className="mt-1.5 inline-block rounded-full bg-black/10 px-3 py-1 text-xs font-medium text-black/60">
                    Your published project
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="rounded-full p-2 transition hover:bg-black hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/40">Description</h3>
                <p className="text-sm leading-relaxed text-black/80">{selectedJob.description}</p>
              </div>

              {selectedJob.requirements && (
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/40">Requirements</h3>
                  <p className="text-sm leading-relaxed text-black/80">{selectedJob.requirements}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-black/5 px-4 py-3">
                  <p className="text-xs text-black/40">Budget</p>
                  <p className="mt-1 font-semibold">
                    {selectedJob.budget ? `${selectedJob.budget} ${selectedJob.currency || ""}` : "Not specified"}
                  </p>
                </div>
                <div className="rounded-2xl bg-black/5 px-4 py-3">
                  <p className="text-xs text-black/40">Deadline</p>
                  <p className="mt-1 font-semibold">{formatDate(selectedJob.deadline)}</p>
                </div>
                <div className="rounded-2xl bg-black/5 px-4 py-3">
                  <p className="text-xs text-black/40">Experience</p>
                  <p className="mt-1 font-semibold">{selectedJob.experienceLevel || "Any"}</p>
                </div>
                <div className="rounded-2xl bg-black/5 px-4 py-3">
                  <p className="text-xs text-black/40">Category</p>
                  <p className="mt-1 font-semibold">{selectedJob.category || "—"}</p>
                </div>
                <div className="rounded-2xl bg-black/5 px-4 py-3">
                  <p className="text-xs text-black/40">Posted by</p>
                  <p className="mt-1 font-semibold truncate">
                    {selectedJob.ownerId === user?.uid ? "You" : selectedJob.ownerEmail || "Unknown"}
                  </p>
                </div>
              </div>

              {selectedJob.tags?.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/40">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedJob.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-black/10 px-3 py-1 text-xs">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons — only for other users' jobs */}
              {selectedJob.ownerId !== user?.uid && (
                <div className="flex gap-3 pt-2 border-t border-black/10">
                  <a
                    href={`mailto:${selectedJob.ownerEmail}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-black/80"
                  >
                    <Mail size={16} />
                    Contact Publisher
                  </a>

                  <button
                    onClick={() => handleBookmark(selectedJob)}
                    disabled={bookmarking}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium transition disabled:opacity-50 ${
                      isBookmarked(selectedJob.id)
                        ? "border-black bg-black text-white"
                        : "border-black/20 text-black hover:border-black"
                    }`}
                  >
                    {isBookmarked(selectedJob.id) ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                    {isBookmarked(selectedJob.id) ? "Bookmarked" : "Bookmark Job"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
