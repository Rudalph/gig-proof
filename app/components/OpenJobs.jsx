"use client";

import { useEffect, useState } from "react";
import {
  collection, onSnapshot, orderBy, query,
  doc, updateDoc, arrayUnion, arrayRemove, getDoc, getDocs,
  addDoc, serverTimestamp, where, increment,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useCurrency, formatBudget } from "../context/CurrencyContext";
import { X, Search, Bookmark, BookmarkCheck, ChevronDown, ChevronUp, Send, Mail, CheckCircle2 } from "lucide-react";

const MESSAGE_WORD_LIMIT = 100;

function countWords(text) {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function formatDate(dateStr) {
  if (!dateStr) return "Not specified";
  const [year, month, day] = dateStr.split("-").map(Number);
  const suffix =
    day % 10 === 1 && day !== 11 ? "st" :
    day % 10 === 2 && day !== 12 ? "nd" :
    day % 10 === 3 && day !== 13 ? "rd" : "th";
  const monthName = new Date(year, month - 1, 1).toLocaleString("default", { month: "long" });
  return `${day}${suffix} ${monthName}, ${year}`;
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  const [hourStr, minStr] = timeStr.split(":");
  let h = parseInt(hourStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${minStr} ${ampm}`;
}

function toBudgetEur(budget, currency, rates) {
  const num = parseFloat(budget);
  if (!budget || isNaN(num)) return 0;
  if (!currency || currency === "EUR") return num;
  if (currency === "USDC" || currency === "SOL") return num;
  const rate = rates[currency];
  return rate ? num / rate : num;
}

function computeSearchScore(job, q) {
  if (!q.trim()) return 1;
  const query = q.toLowerCase();
  let score = 0;
  if (job.title?.toLowerCase().includes(query)) score += 3;
  if ((job.tags || []).some((t) => t.toLowerCase().includes(query))) score += 2;
  if (job.category?.toLowerCase().includes(query)) score += 1;
  if (job.description?.toLowerCase().includes(query)) score += 0.5;
  return score;
}

function computeSuggestionScore(job, userProfile) {
  if (!userProfile) return 0;
  let score = 0;

  const userProfessions = (userProfile.professions || []).map((p) => p.toLowerCase());
  const userSkills = (userProfile.skills || "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const jobTitle = (job.title || "").toLowerCase();
  const jobCategory = (job.category || "").toLowerCase();
  const jobDescription = (job.description || "").toLowerCase();
  const jobTags = (job.tags || []).map((t) => t.toLowerCase());

  for (const prof of userProfessions) {
    if (jobCategory && (jobCategory.includes(prof) || prof.includes(jobCategory))) score += 4;
    if (jobTitle.includes(prof)) score += 3;
    if (jobTags.some((t) => t.includes(prof) || prof.includes(t))) score += 3;
  }

  for (const skill of userSkills) {
    if (jobTags.some((t) => t.includes(skill) || skill.includes(t))) score += 2;
    if (jobTitle.includes(skill)) score += 1.5;
    if (jobDescription.includes(skill)) score += 0.5;
  }

  if (userProfile.experienceLevel && job.experienceLevel === userProfile.experienceLevel) score += 2;

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

const SORT_OPTIONS = [
  { value: "suggested", label: "Suggested for you" },
  { value: "budget_asc", label: "Budget (low → high)" },
  { value: "budget_desc", label: "Budget (high → low)" },
  { value: "end_date_asc", label: "End date (nearest)" },
  { value: "end_date_desc", label: "End date (farthest)" },
  { value: "duration_asc", label: "Duration (shortest)" },
  { value: "duration_desc", label: "Duration (longest)" },
];

export default function OpenJobs() {
  const { user } = useAuth();
  const { defaultCurrency, rates } = useCurrency();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [bookmarking, setBookmarking] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("suggested");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [selectedTags, setSelectedTags] = useState(new Set());
  const [selectedLevels, setSelectedLevels] = useState(new Set());
  const [showOwnJobs, setShowOwnJobs] = useState(true);
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);
  const [contactedJobs, setContactedJobs] = useState(new Set());
  const [declinedJobs, setDeclinedJobs] = useState(new Map());
  const [approvedJobs, setApprovedJobs] = useState(new Map());
  const [, setTick] = useState(0);
  const [contactModalJob, setContactModalJob] = useState(null);
  const [contactMessage, setContactMessage] = useState("");
  const [contactSending, setContactSending] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setJobs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Open Jobs error:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchUserData = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const d = snap.data();
        setBookmarks(d.bookmarks || []);
        setContactedJobs(new Set(d.contactedJobs || []));

        const declinesSnap = await getDocs(query(
          collection(db, "notifications"),
          where("toUid", "==", user.uid),
          where("type", "==", "request_declined")
        ));
        const declineMap = new Map();
        declinesSnap.forEach((d) => {
          const nd = d.data();
          const declinedAt = nd.createdAt?.toDate?.() || new Date(0);
          declineMap.set(nd.projectId, declinedAt);
        });
        setDeclinedJobs(declineMap);

        setUserProfile({
          professions: d.professions || [],
          skills: d.skills || "",
          experienceLevel: d.experienceLevel || "",
          bio: d.bio || "",
          availability: d.availability || "",
          workType: d.workType || "",
          primaryRole: d.primaryRole || "",
          role: d.role || "",
          city: d.city || "",
          country: d.country || "",
        });
      }
    };
    fetchUserData();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("toUid", "==", user.uid),
      where("type", "==", "request_approved")
    );
    return onSnapshot(q, (snap) => {
      const m = new Map();
      snap.forEach((d) => { const nd = d.data(); m.set(nd.projectId, nd.fromEmail); });
      setApprovedJobs(m);
    });
  }, [user]);

  useEffect(() => {
    if (declinedJobs.size === 0) return;
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, [declinedJobs.size]);

  const isBookmarked = (jobId) => bookmarks.includes(jobId);

  const handleViewJob = (job) => {
    setSelectedJob(job);
    if (job.ownerId !== user?.uid) {
      updateDoc(doc(db, "projects", job.id), { viewCount: increment(1) }).catch(() => {});
    }
  };

  const handleBookmark = async (job) => {
    if (!user) return;
    setBookmarking(true);
    const userRef = doc(db, "users", user.uid);
    const wasBookmarked = isBookmarked(job.id);
    try {
      if (wasBookmarked) {
        await updateDoc(userRef, { bookmarks: arrayRemove(job.id) });
        setBookmarks((prev) => prev.filter((id) => id !== job.id));
      } else {
        await updateDoc(userRef, { bookmarks: arrayUnion(job.id) });
        setBookmarks((prev) => [...prev, job.id]);
      }
      if (job.ownerId !== user.uid) {
        updateDoc(doc(db, "projects", job.id), {
          bookmarkCount: increment(wasBookmarked ? -1 : 1),
        }).catch(() => {});
      }
    } catch (error) {
      console.error("Bookmark error:", error);
    } finally {
      setBookmarking(false);
    }
  };

  const COOLDOWN_MS = 12 * 60 * 60 * 1000;

  const getCooldownRemaining = (projectId) => {
    const declinedAt = declinedJobs.get(projectId);
    if (!declinedAt) return null;
    const remaining = COOLDOWN_MS - (Date.now() - declinedAt.getTime());
    if (remaining <= 0) return null;
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const handleContactSubmit = async () => {
    if (!user || !contactModalJob || !contactMessage.trim()) return;
    setContactSending(true);
    try {
      await addDoc(collection(db, "notifications"), {
        type: "contact_request",
        toUid: contactModalJob.ownerId,
        fromUid: user.uid,
        fromEmail: user.email,
        fromName: user.displayName || user.email?.split("@")[0] || "User",
        projectId: contactModalJob.id,
        projectTitle: contactModalJob.title,
        message: contactMessage.trim(),
        status: "pending",
        read: false,
        createdAt: serverTimestamp(),
        senderProfile: {
          bio: userProfile?.bio || "",
          professions: userProfile?.professions || [],
          skills: userProfile?.skills || "",
          experienceLevel: userProfile?.experienceLevel || "",
          availability: userProfile?.availability || "",
          workType: userProfile?.workType || "",
          primaryRole: userProfile?.primaryRole || "",
          role: userProfile?.role || "",
          city: userProfile?.city || "",
          country: userProfile?.country || "",
        },
      });
      await updateDoc(doc(db, "users", user.uid), { contactedJobs: arrayUnion(contactModalJob.id) });
      setContactedJobs((prev) => new Set([...prev, contactModalJob.id]));
      setDeclinedJobs((prev) => { const next = new Map(prev); next.delete(contactModalJob.id); return next; });
      setContactModalJob(null);
      setContactMessage("");
    } catch (error) {
      console.error("Contact error:", error);
    } finally {
      setContactSending(false);
    }
  };

  const allCategories = [...new Set(jobs.map((j) => j.category).filter(Boolean))];
  const allTags = [...new Set(jobs.flatMap((j) => j.tags || []))];
  const allLevels = [...new Set(jobs.map((j) => j.experienceLevel).filter(Boolean))];

  const hasUserProfile = userProfile && (
    (userProfile.professions?.length > 0) || userProfile.skills?.trim()
  );

  const filtered = jobs
    .map((j) => ({
      ...j,
      _searchScore: computeSearchScore(j, searchQuery),
      _suggestionScore: computeSuggestionScore(j, userProfile),
    }))
    .filter((j) => {
      if (!showOwnJobs && j.ownerId === user?.uid) return false;
      if (showBookmarkedOnly && !isBookmarked(j.id)) return false;
      if (searchQuery.trim() && j._searchScore === 0) return false;
      if (selectedCategories.size > 0 && !selectedCategories.has(j.category)) return false;
      if (selectedTags.size > 0 && !(j.tags || []).some((t) => selectedTags.has(t))) return false;
      if (selectedLevels.size > 0 && !selectedLevels.has(j.experienceLevel)) return false;
      return true;
    })
    .sort((a, b) => {
      // If there's an active search query, always sort by search relevance first
      if (searchQuery.trim()) return b._searchScore - a._searchScore;

      switch (sortBy) {
        case "suggested":
          if (!hasUserProfile) return 0; // keep createdAt desc order
          return b._suggestionScore - a._suggestionScore;
        case "budget_asc":
          return toBudgetEur(a.budget, a.currency, rates) - toBudgetEur(b.budget, b.currency, rates);
        case "budget_desc":
          return toBudgetEur(b.budget, b.currency, rates) - toBudgetEur(a.budget, a.currency, rates);
        case "end_date_asc": {
          const ad = a.endDate || a.deadline || "";
          const bd = b.endDate || b.deadline || "";
          if (!ad) return 1;
          if (!bd) return -1;
          return ad.localeCompare(bd);
        }
        case "end_date_desc": {
          const ad = a.endDate || a.deadline || "";
          const bd = b.endDate || b.deadline || "";
          if (!ad) return 1;
          if (!bd) return -1;
          return bd.localeCompare(ad);
        }
        case "duration_asc": {
          const ad = a.durationDays ?? (a.isSameDay ? 0 : null);
          const bd = b.durationDays ?? (b.isSameDay ? 0 : null);
          if (ad === null) return 1;
          if (bd === null) return -1;
          return ad - bd;
        }
        case "duration_desc": {
          const ad = a.durationDays ?? (a.isSameDay ? 0 : null);
          const bd = b.durationDays ?? (b.isSameDay ? 0 : null);
          if (ad === null) return 1;
          if (bd === null) return -1;
          return bd - ad;
        }
        default:
          return 0;
      }
    });

  const advancedActiveCount =
    selectedCategories.size + selectedTags.size + selectedLevels.size;

  if (loading) return <p className="text-black/60">Loading open jobs...</p>;

  return (
    <div className="p-6 text-black">

      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-black">Open Jobs</h1>
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
            {showOwnJobs ? "Hide my posts" : "Show my posts"}
          </button>
        </div>
      </div>

      {/* Search + Sort row */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, tags, or category..."
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

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-xl border border-black/20 px-3 py-2 text-sm outline-none focus:border-black bg-white text-black min-w-[180px]"
        >
          {SORT_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Suggested for you — profile incomplete notice */}
      {sortBy === "suggested" && !hasUserProfile && !searchQuery && (
        <div className="mb-4 rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-3 text-sm text-black/50">
          Complete your <span className="font-medium text-black">Profile → Professional Profile</span> to get personalised job suggestions.
        </div>
      )}

      {/* Advanced Filters toggle */}
      {jobs.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-black/60 hover:text-black transition"
          >
            {showAdvanced ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            Advanced Filters
            {advancedActiveCount > 0 && (
              <span className="ml-1 rounded-full bg-black text-white text-xs px-2 py-0.5">
                {advancedActiveCount}
              </span>
            )}
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
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
        </div>
      )}

      {/* Job grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-black/10 p-6 text-center text-black/60">
          {jobs.length === 0 ? "No open jobs yet." : "No jobs match your search or filters."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((job) => {
            const isOwn = job.ownerId === user?.uid;
            const isSuggested = sortBy === "suggested" && hasUserProfile && job._suggestionScore > 0 && !searchQuery && !isOwn;
            return (
              <div
                key={job.id}
                onClick={() => handleViewJob(job)}
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

                {isSuggested && (
                  <span className="mb-2 inline-block rounded-full bg-black px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
                    Suggested
                  </span>
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
                    {formatBudget(job.budget, job.currency, defaultCurrency, rates)}
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
                    {formatBudget(selectedJob.budget, selectedJob.currency, defaultCurrency, rates)}
                  </p>
                </div>

                {selectedJob.isSameDay ? (
                  <>
                    <div className="rounded-2xl bg-black/5 px-4 py-3">
                      <p className="text-xs text-black/40">Date</p>
                      <p className="mt-1 font-semibold">{formatDate(selectedJob.startDate || selectedJob.deadline)}</p>
                    </div>
                    {selectedJob.startTime && selectedJob.endTime && (
                      <div className="rounded-2xl bg-black/5 px-4 py-3">
                        <p className="text-xs text-black/40">Time</p>
                        <p className="mt-1 font-semibold">{formatTime(selectedJob.startTime)} – {formatTime(selectedJob.endTime)}</p>
                      </div>
                    )}
                  </>
                ) : selectedJob.durationDays > 0 ? (
                  <>
                    <div className="rounded-2xl bg-black/5 px-4 py-3">
                      <p className="text-xs text-black/40">Start Date</p>
                      <p className="mt-1 font-semibold">{formatDate(selectedJob.startDate)}</p>
                    </div>
                    <div className="rounded-2xl bg-black/5 px-4 py-3">
                      <p className="text-xs text-black/40">End Date</p>
                      <p className="mt-1 font-semibold">{formatDate(selectedJob.endDate || selectedJob.deadline)}</p>
                    </div>
                    <div className="rounded-2xl bg-black/5 px-4 py-3">
                      <p className="text-xs text-black/40">Duration</p>
                      <p className="mt-1 font-semibold">
                        {selectedJob.durationDays} day{selectedJob.durationDays !== 1 ? "s" : ""}
                      </p>
                    </div>
                    {(selectedJob.startTime || selectedJob.endTime) && (
                      <div className="rounded-2xl bg-black/5 px-4 py-3">
                        <p className="text-xs text-black/40">Time</p>
                        <p className="mt-1 font-semibold">
                          {formatTime(selectedJob.startTime) || "—"} – {formatTime(selectedJob.endTime) || "—"}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-2xl bg-black/5 px-4 py-3">
                    <p className="text-xs text-black/40">Deadline</p>
                    <p className="mt-1 font-semibold">{formatDate(selectedJob.deadline)}</p>
                  </div>
                )}

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
                    {selectedJob.ownerId === user?.uid
                      ? "You"
                      : selectedJob.ownerName || selectedJob.ownerEmail?.split("@")[0] || "Unknown"}
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

              {selectedJob.ownerId !== user?.uid && (
                <div className="flex gap-3 pt-2 border-t border-black/10">
                  {(() => {
                    const publisherEmail = approvedJobs.get(selectedJob.id);
                    if (publisherEmail) {
                      return (
                        <div className="flex flex-1 flex-col gap-2">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                            <CheckCircle2 size={13} />
                            Request accepted — you can now contact the publisher
                          </div>
                          <a
                            href={`mailto:${publisherEmail}`}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-600"
                          >
                            <Mail size={16} />
                            Contact Publisher
                          </a>
                        </div>
                      );
                    }
                    const cooldown = getCooldownRemaining(selectedJob.id);
                    const isPending = contactedJobs.has(selectedJob.id) && !declinedJobs.has(selectedJob.id);
                    const isDisabled = isPending || !!cooldown;
                    const label = cooldown ? `Try again in ${cooldown}` : isPending ? "Request Sent" : "Contact Publisher";
                    return (
                      <button
                        onClick={() => { setContactModalJob(selectedJob); setContactMessage(""); }}
                        disabled={isDisabled}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-black/80 disabled:opacity-60 disabled:cursor-default"
                      >
                        <Send size={16} />
                        {label}
                      </button>
                    );
                  })()}
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

      {/* Contact form modal */}
      {contactModalJob && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setContactModalJob(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white text-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/10 p-5">
              <h2 className="text-lg font-semibold">Contact Publisher</h2>
              <button
                onClick={() => setContactModalJob(null)}
                className="rounded-full p-2 transition hover:bg-black hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-xl bg-black/4 px-4 py-3">
                <p className="text-xs text-black/40 mb-0.5">Regarding</p>
                <p className="text-sm font-semibold text-black">{contactModalJob.title}</p>
              </div>
              {(() => {
                const msgWords = countWords(contactMessage);
                const msgOver = msgWords > MESSAGE_WORD_LIMIT;
                return (
                  <div className="space-y-4">
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-sm font-medium text-black/70">
                          Your Message <span className="text-red-500">*</span>
                        </label>
                        <span className={`text-xs ${msgOver ? "text-red-500 font-semibold" : "text-black/40"}`}>
                          {msgWords} / {MESSAGE_WORD_LIMIT} words
                        </span>
                      </div>
                      <div className="mb-2 h-1 w-full rounded-full bg-black/8">
                        <div
                          className={`h-1 rounded-full transition-all duration-200 ${msgOver ? "bg-red-500" : "bg-black/40"}`}
                          style={{ width: `${Math.min((msgWords / MESSAGE_WORD_LIMIT) * 100, 100)}%` }}
                        />
                      </div>
                      <textarea
                        rows="4"
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        placeholder="Introduce yourself and explain why you're a good fit..."
                        className={`w-full rounded-xl border bg-white text-black px-4 py-3 text-sm outline-none resize-none transition ${
                          msgOver ? "border-red-400 focus:border-red-500" : "border-black/20 focus:border-black"
                        }`}
                      />
                      {msgOver && (
                        <p className="mt-1 text-xs text-red-500">
                          {msgWords - MESSAGE_WORD_LIMIT} word{msgWords - MESSAGE_WORD_LIMIT > 1 ? "s" : ""} over the limit
                        </p>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setContactModalJob(null)}
                        className="flex-1 rounded-xl border border-black/20 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleContactSubmit}
                        disabled={contactSending || !contactMessage.trim() || msgOver}
                        className="flex-1 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black/80 disabled:opacity-50"
                      >
                        {contactSending ? "Sending..." : "Send Request"}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
