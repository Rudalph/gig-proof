"use client";

import { useState, useEffect } from "react";
import { Plus, X, Shuffle } from "lucide-react";

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

const RANDOM_TITLES = [
  "Build a responsive React portfolio website",
  "Design mobile app UI/UX mockups in Figma",
  "Set up CI/CD pipeline with GitHub Actions",
  "Write Python scripts for data analysis",
  "Create a Node.js REST API with authentication",
  "Build a Telegram bot for daily task reminders",
  "Design a landing page for a SaaS product",
  "Develop a browser extension for productivity",
  "Write technical documentation for an internal SDK",
  "Build a real-time analytics dashboard with charts",
  "Create animated social media graphics for a brand",
  "Set up a PostgreSQL schema with migrations",
  "Write unit and integration tests for a React app",
  "Build a video call feature using WebRTC",
  "Scrape and structure product data from e-commerce sites",
];

const RANDOM_DESCRIPTIONS = [
  "Looking for a skilled developer to build a clean responsive portfolio site. Must include an about section, project showcase, skills list, and contact form. Should be mobile-friendly and fast-loading with good SEO.",
  "Need an experienced designer to create high-fidelity mockups for a fitness tracking mobile app. Designs should follow Material Design guidelines and include both light and dark themes.",
  "Seeking a DevOps engineer to configure automated CI/CD pipelines for our Node.js microservices. Must cover testing, linting, Docker builds, and deployment to AWS with rollback support.",
  "Looking for a Python developer to process weekly CSV exports, run statistical summaries, and generate charts using matplotlib. Clean well-documented code is required along with a setup guide.",
  "Need a backend developer to build a REST API with JWT authentication, role-based access control, and auto-generated Swagger docs. Express.js and PostgreSQL stack preferred.",
  "Require a developer to build a Telegram bot that sends configurable daily reminders and integrates with Google Calendar API to sync events. Python preferred.",
  "Looking for someone to create a high-converting landing page with smooth animations, a pricing table, and a waitlist signup form connected to Mailchimp.",
];

const RANDOM_REQUIREMENTS = [
  "Strong experience with React and TypeScript. Familiarity with Tailwind CSS. Must share a GitHub link to previous work. English communication required.",
  "Proficiency in Figma with a solid portfolio of mobile UI work. Good understanding of accessibility standards. Deliver source files along with all exported assets.",
  "Hands-on experience with GitHub Actions and Docker. Familiarity with AWS EC2 or ECS. Must document all pipeline steps and provide a runbook for the team.",
  "Python 3.10+ experience. Solid knowledge of pandas, matplotlib, and numpy. Well-commented code and a README with full setup instructions required.",
  "Node.js and Express.js expertise. PostgreSQL experience with Sequelize or Prisma. Must write integration tests using Jest and provide a complete OpenAPI spec.",
  "Experience with the python-telegram-bot library. Google Calendar API integration knowledge is a plus. Deliver clean source code with inline documentation.",
  "Proficiency in HTML, CSS, and JavaScript. Experience with animation libraries such as GSAP or Framer Motion. All pages must be fully responsive across devices.",
];

const RANDOM_TAG_SETS = [
  ["React", "TypeScript", "Tailwind", "Next.js"],
  ["Figma", "UI/UX", "Mobile", "Design"],
  ["Python", "Pandas", "Data", "Automation"],
  ["Node.js", "REST API", "PostgreSQL", "Express"],
  ["DevOps", "Docker", "CI/CD", "AWS"],
  ["Flutter", "Dart", "Mobile", "Firebase"],
  ["JavaScript", "HTML", "CSS", "Animation"],
  ["Telegram", "Bot", "Python", "API"],
  ["React", "WebSockets", "Charts", "Dashboard"],
  ["Scraping", "Python", "BeautifulSoup", "Data"],
];

function countWords(text) {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function parseTags(value) {
  return [...new Set(value.split(",").map((t) => t.trim()).filter(Boolean))];
}

function MilestoneModal({ open, initial, onSave, onClose }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (open) {
      setRows(
        initial && initial.length >= 2
          ? initial.map((r) => ({ ...r }))
          : [
              { description: "", percentage: "" },
              { description: "Final payment after review and verification", percentage: "" },
            ]
      );
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = rows.reduce((s, r) => s + (Number(r.percentage) || 0), 0);
  const isValid =
    rows.length >= 2 &&
    rows.every((r) => r.description.trim() && Number(r.percentage) > 0) &&
    total === 100;

  const update = (i, field, val) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));

  const addRow = () => {
    if (rows.length >= 4) return;
    setRows((prev) => [
      ...prev.slice(0, -1),
      { description: "", percentage: "" },
      prev[prev.length - 1],
    ]);
  };

  const removeRow = (i) => {
    if (rows.length <= 2 || i === rows.length - 1) return;
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  };

  if (!open) return null;

  const PLACEHOLDER_DESCS = ["Wireframes and design approved", "Core development complete", "Testing and QA done"];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white text-black shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-black/10 p-5">
          <div>
            <h2 className="text-lg font-semibold">Configure Milestones</h2>
            <p className="text-xs text-black/40 mt-0.5">Up to 4 milestones — percentages must total exactly 100%</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 transition hover:bg-black hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-5 space-y-3">
          {rows.map((row, i) => {
            const isLast = i === rows.length - 1;
            return (
              <div key={i} className={`rounded-xl border p-4 space-y-3 ${isLast ? "border-black/20 bg-black/[0.02]" : "border-black/10 bg-white"}`}>
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 shrink-0 rounded-full bg-black text-white text-xs flex items-center justify-center font-semibold">{i + 1}</span>
                  <p className="text-xs font-semibold text-black/50 uppercase tracking-wide">{isLast ? "Final Payment" : `Milestone ${i + 1}`}</p>
                  {!isLast && rows.length > 2 && (
                    <button type="button" onClick={() => removeRow(i)} className="ml-auto rounded-lg p-1 text-black/25 transition hover:bg-red-50 hover:text-red-500">
                      <X size={13} />
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder={isLast ? "e.g. Full review and final delivery approved" : PLACEHOLDER_DESCS[i] || "Describe this milestone"}
                  value={row.description}
                  onChange={(e) => update(i, "description", e.target.value)}
                  className="w-full rounded-xl border border-black/15 bg-white text-black px-3 py-2 text-sm outline-none focus:border-black"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="0"
                    value={row.percentage}
                    onChange={(e) => update(i, "percentage", e.target.value === "" ? "" : String(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 0))))}
                    className="w-20 rounded-xl border border-black/15 bg-white text-black px-3 py-2 text-sm text-center outline-none focus:border-black [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-sm text-black/50">% of total budget released</span>
                </div>
              </div>
            );
          })}

          {rows.length < 4 && (
            <button
              type="button"
              onClick={addRow}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-black/20 py-2.5 text-sm text-black/40 transition hover:border-black/40 hover:text-black/60"
            >
              <Plus size={14} />
              Add milestone
            </button>
          )}
        </div>

        <div className="border-t border-black/10 p-5">
          <div className={`mb-4 flex items-center justify-between rounded-xl px-4 py-3 ${
            total === 100 ? "bg-emerald-50 border border-emerald-100" : total > 100 ? "bg-red-50 border border-red-100" : "bg-black/5"
          }`}>
            <span className={`text-sm font-medium ${total === 100 ? "text-emerald-700" : total > 100 ? "text-red-600" : "text-black/60"}`}>Total</span>
            <span className={`text-base font-bold ${total === 100 ? "text-emerald-700" : total > 100 ? "text-red-600" : "text-black/70"}`}>
              {total}%
              {total === 100 && " ✓"}
              {total > 100 && " — exceeds 100%"}
              {total < 100 && total > 0 && ` — ${100 - total}% remaining`}
            </span>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-black/20 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5">Cancel</button>
            <button
              type="button"
              onClick={() => { onSave(rows.map((r) => ({ description: r.description.trim(), percentage: Number(r.percentage) }))); onClose(); }}
              disabled={!isValid}
              className="flex-1 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black/80 disabled:opacity-40"
            >
              Save Milestones
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AddProjects({ prefill, onPrefillConsumed }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("post");
  const { user } = useAuth();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("USDC");
  const [category, setCategory] = useState(PROFESSIONS[0]);
  const [experienceLevel, setExperienceLevel] = useState("Any");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [freelancerCount, setFreelancerCount] = useState(1);
  const [paymentType, setPaymentType] = useState("full");
  const [milestones, setMilestones] = useState([]);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const generateRandom = () => {
    setTitle(pick(RANDOM_TITLES));
    setDescription(pick(RANDOM_DESCRIPTIONS));
    setRequirements(pick(RANDOM_REQUIREMENTS));
    setBudget(String(Math.round((Math.random() * 1900 + 100) / 50) * 50));
    setCurrency(pick(["USDC", "USD", "EUR", "GBP", "INR"]));
    setFreelancerCount(pick([1, 1, 1, 2, 3]));
    setCategory(pick(PROFESSIONS));
    setExperienceLevel(pick(["Any", "Beginner", "Intermediate", "Expert"]));
    const tags = pick(RANDOM_TAG_SETS);
    setTagsInput(tags.slice(0, Math.floor(Math.random() * 2) + 2).join(", "));
    const todayDate = new Date();
    const startOff = Math.floor(Math.random() * 5) + 1;
    const endOff = Math.floor(Math.random() * 25) + 5;
    const s = new Date(todayDate); s.setDate(todayDate.getDate() + startOff);
    const e = new Date(s); e.setDate(s.getDate() + endOff);
    const fmt = (d) => d.toISOString().split("T")[0];
    setStartDate(fmt(s));
    setEndDate(fmt(e));
    setStartTime("");
    setEndTime("");
  };

  useEffect(() => {
    if (!prefill) return;
    setTitle(prefill.title || "");
    setDescription(prefill.description || "");
    setRequirements(prefill.requirements || "");
    setBudget(prefill.budget ? String(prefill.budget) : "");
    setCurrency(prefill.currency || "USDC");
    setCategory(prefill.category || PROFESSIONS[0]);
    setExperienceLevel(prefill.experienceLevel || "Any");
    setTagsInput((prefill.tags || []).join(", "));
    setFreelancerCount(prefill.freelancerCount || 1);
    // Leave dates blank — the original job dates are likely stale
    setStartDate("");
    setEndDate("");
    setStartTime("");
    setEndTime("");
    setOpen(true);
    if (onPrefillConsumed) onPrefillConsumed();
  }, [prefill]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setTitle("");
    setBudget("");
    setCurrency("USDC");
    setCategory(PROFESSIONS[0]);
    setExperienceLevel("Any");
    setDescription("");
    setRequirements("");
    setTagsInput("");
    setStartDate("");
    setEndDate("");
    setStartTime("");
    setEndTime("");
    setFreelancerCount(1);
    setPaymentType("full");
    setMilestones([]);
    setShowMilestoneModal(false);
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

    if (paymentType === "milestone") {
      if (milestones.length < 2) {
        toast("Please configure at least 2 milestones.", "error");
        return;
      }
      const total = milestones.reduce((s, m) => s + Number(m.percentage || 0), 0);
      if (total !== 100) {
        toast("Milestone percentages must total exactly 100%.", "error");
        return;
      }
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
      freelancerCount: Number(freelancerCount) || 1,
      paymentType,
      ...(paymentType === "milestone" ? { milestones } : {}),
      approvedCount: 0,
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

      <MilestoneModal
        open={showMilestoneModal}
        initial={milestones}
        onSave={(saved) => setMilestones(saved)}
        onClose={() => setShowMilestoneModal(false)}
      />

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white text-black shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 p-5">
              <h2 className="text-xl font-semibold">Add Freelance Project</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={generateRandom}
                  className="flex items-center gap-1.5 rounded-xl border border-black/20 px-3 py-2 text-sm font-medium text-black/60 transition hover:border-black hover:text-black"
                >
                  <Shuffle size={14} />
                  Generate Random
                </button>
                <button
                  onClick={handleClose}
                  className="rounded-full p-2 transition hover:bg-black hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="max-h-[80vh] space-y-4 overflow-y-auto p-5">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Project Title <span className="text-red-500">*</span>
                </label>
                <input
                  name="title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
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
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
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
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full rounded-xl border border-black/20 bg-white text-black px-4 py-3 outline-none focus:border-black"
                  >
                    <optgroup label="Crypto (Solana escrow)">
                      <option value="USDC">USDC</option>
                    </optgroup>
                    <optgroup label="Fiat (third-party payment)">
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="INR">INR</option>
                      <option value="JPY">JPY</option>
                      <option value="AED">AED</option>
                      <option value="AUD">AUD</option>
                      <option value="CAD">CAD</option>
                      <option value="SGD">SGD</option>
                      <option value="CHF">CHF</option>
                      <option value="BRL">BRL</option>
                      <option value="NGN">NGN</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  How many freelancers? <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={freelancerCount}
                  onChange={(e) => setFreelancerCount(Math.min(99, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                  className="w-32 rounded-xl border border-black/20 bg-white text-black px-4 py-3 outline-none focus:border-black"
                />
                <p className="mt-1 text-xs text-black/40">
                  {freelancerCount === 1 ? "1 freelancer needed" : `${freelancerCount} freelancers needed`}
                </p>
              </div>

              {/* Payment schedule */}
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Payment Schedule</label>
                    <p className="mt-0.5 text-xs text-black/40">
                      {paymentType === "full"
                        ? "100% paid upon completion"
                        : milestones.length > 0
                        ? `${milestones.length} milestone${milestones.length !== 1 ? "s" : ""} configured`
                        : "Milestone mode — configure below"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (paymentType === "full") {
                        setPaymentType("milestone");
                        setShowMilestoneModal(true);
                      } else {
                        setPaymentType("full");
                        setMilestones([]);
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                      paymentType === "milestone" ? "bg-black" : "bg-black/20"
                    }`}
                    title={paymentType === "full" ? "Switch to milestone payments" : "Switch to full payment"}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                      paymentType === "milestone" ? "translate-x-5" : "translate-x-0"
                    }`} />
                  </button>
                </div>
                {paymentType === "milestone" && milestones.length > 0 && (
                  <div className="mt-3 rounded-xl border border-black/10 bg-black/[0.02] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-black/55">Milestone breakdown</p>
                      <button type="button" onClick={() => setShowMilestoneModal(true)} className="text-xs text-black underline underline-offset-2">Edit</button>
                    </div>
                    <div className="space-y-1.5">
                      {milestones.map((m, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-[10px] font-semibold text-black/60">{i + 1}</span>
                          <p className="flex-1 text-xs text-black/60 truncate">{m.description}</p>
                          <span className="shrink-0 text-xs font-bold text-black">{m.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {paymentType === "milestone" && milestones.length === 0 && (
                  <button type="button" onClick={() => setShowMilestoneModal(true)} className="mt-2 text-xs text-black/50 underline underline-offset-2">
                    Configure milestones
                  </button>
                )}
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
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
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
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(e.target.value)}
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
