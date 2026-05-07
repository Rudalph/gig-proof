"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useCurrency, DISPLAY_CURRENCIES } from "../context/CurrencyContext";
import { Search, X, Check } from "lucide-react";
import { PROFESSIONS, COUNTRIES } from "../lib/professions";

const STEPS = ["Role", "Professions", "Experience", "Details"];

const EXPERIENCE_OPTIONS = [
  { label: "Beginner", sub: "0–2 years", value: "Beginner" },
  { label: "Intermediate", sub: "2–5 years", value: "Intermediate" },
  { label: "Expert", sub: "5+ years", value: "Expert" },
];

const AVAILABILITY_OPTIONS = ["Full-time", "Part-time", "Project-based"];
const WORK_TYPE_OPTIONS = ["Individual", "Company / Agency"];

function toEur(amount, currency, rates) {
  const num = parseFloat(amount);
  if (!amount || isNaN(num) || num === 0) return null;
  if (currency === "EUR") return null;
  const rate = rates[currency];
  if (!rate) return null;
  return (num / rate).toFixed(2);
}

export default function Onboarding() {
  const { user } = useAuth();
  const { rates } = useCurrency();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 0
  const [primaryRole, setPrimaryRole] = useState("");

  // Step 1
  const [professions, setProfessions] = useState([]);
  const [professionSearch, setProfessionSearch] = useState("");

  // Step 2
  const [experienceLevel, setExperienceLevel] = useState("");
  const [skills, setSkills] = useState("");

  // Step 3
  const [role, setRole] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [availability, setAvailability] = useState("");
  const [workType, setWorkType] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [hourlyRateCurrency, setHourlyRateCurrency] = useState("EUR");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (!user) router.replace("/auth");
  }, [user, router]);

  const filteredProfessions = PROFESSIONS.filter((p) =>
    p.toLowerCase().includes(professionSearch.toLowerCase())
  );

  const toggleProfession = (p) => {
    setProfessions((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const canProceed = () => {
    if (step === 0) return !!primaryRole;
    if (step === 1) return professions.length > 0;
    if (step === 2) return !!experienceLevel;
    return true;
  };

  const handleComplete = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          primaryRole,
          professions,
          experienceLevel,
          skills,
          role,
          city,
          country,
          availability,
          workType,
          hourlyRate,
          hourlyRateCurrency,
          bio,
          onboardingComplete: true,
          email: user.email,
          name: user.displayName || user.email?.split("@")[0] || "User",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      router.replace("/dashboard");
    } catch (err) {
      console.error("Onboarding save error:", err);
    } finally {
      setSaving(false);
    }
  };

  const eurEquivalent = toEur(hourlyRate, hourlyRateCurrency, rates);
  const hourlyRateSymbol = DISPLAY_CURRENCIES.find((c) => c.code === hourlyRateCurrency)?.symbol || "";

  if (!user) return null;

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition ${
                      i < step
                        ? "bg-black text-white"
                        : i === step
                        ? "bg-black text-white ring-4 ring-black/10"
                        : "bg-black/10 text-black/30"
                    }`}
                  >
                    {i < step ? <Check size={15} /> : i + 1}
                  </div>
                  <span className={`text-xs hidden sm:block ${i === step ? "text-black font-medium" : "text-black/30"}`}>
                    {s}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px w-16 sm:w-28 mx-2 mb-4 transition ${i < step ? "bg-black" : "bg-black/10"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-black/10 rounded-3xl shadow-sm p-8">

          {/* Step 0 — Primary Role */}
          {step === 0 && (
            <div>
              <h1 className="text-2xl font-semibold mb-1">Welcome to Gig Proof</h1>
              <p className="text-black/50 text-sm mb-6">
                Let's set up your profile. What best describes you?
              </p>
              <div className="space-y-3">
                {[
                  { value: "Freelancer", desc: "I'm looking for freelance work and projects" },
                  { value: "Client / Hiring", desc: "I post projects and hire talent" },
                  { value: "Both", desc: "I do both — I work and I hire" },
                ].map(({ value, desc }) => (
                  <button
                    key={value}
                    onClick={() => setPrimaryRole(value)}
                    className={`w-full rounded-2xl border px-5 py-4 text-left transition ${
                      primaryRole === value
                        ? "border-black bg-black text-white"
                        : "border-black/10 hover:border-black/30"
                    }`}
                  >
                    <p className="font-semibold text-sm">{value}</p>
                    <p className={`text-xs mt-0.5 ${primaryRole === value ? "text-white/60" : "text-black/40"}`}>
                      {desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1 — Professions */}
          {step === 1 && (
            <div>
              <h1 className="text-2xl font-semibold mb-1">Your Professions</h1>
              <p className="text-black/50 text-sm mb-4">
                Select all that apply — this helps match you with relevant jobs.
              </p>

              {professions.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {professions.map((p) => (
                    <span
                      key={p}
                      className="flex items-center gap-1.5 rounded-full bg-black text-white px-3 py-1 text-xs font-medium"
                    >
                      {p}
                      <button
                        onClick={() => toggleProfession(p)}
                        className="opacity-70 hover:opacity-100"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="relative mb-3">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/30" />
                <input
                  type="text"
                  value={professionSearch}
                  onChange={(e) => setProfessionSearch(e.target.value)}
                  placeholder="Search professions..."
                  className="w-full rounded-xl border border-black/20 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-black"
                />
              </div>

              <div className="max-h-64 overflow-y-auto rounded-2xl border border-black/10 divide-y divide-black/5">
                {filteredProfessions.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-black/40">No matches found</p>
                ) : (
                  filteredProfessions.map((p) => (
                    <button
                      key={p}
                      onClick={() => toggleProfession(p)}
                      className={`flex w-full items-center justify-between px-4 py-3 text-sm transition hover:bg-black/5 ${
                        professions.includes(p) ? "font-medium bg-black/[0.03]" : ""
                      }`}
                    >
                      {p}
                      {professions.includes(p) && <Check size={15} className="shrink-0 text-black" />}
                    </button>
                  ))
                )}
              </div>

              <p className="mt-2 text-xs text-black/40">
                {professions.length} selected
              </p>
            </div>
          )}

          {/* Step 2 — Experience + Skills */}
          {step === 2 && (
            <div>
              <h1 className="text-2xl font-semibold mb-1">Your Experience</h1>
              <p className="text-black/50 text-sm mb-6">
                How long have you been working in your field?
              </p>

              <div className="grid grid-cols-3 gap-3 mb-7">
                {EXPERIENCE_OPTIONS.map(({ label, sub, value }) => (
                  <button
                    key={value}
                    onClick={() => setExperienceLevel(value)}
                    className={`rounded-2xl border px-4 py-5 text-center transition ${
                      experienceLevel === value
                        ? "border-black bg-black text-white"
                        : "border-black/10 hover:border-black/30"
                    }`}
                  >
                    <p className="font-semibold text-sm">{label}</p>
                    <p className={`text-xs mt-1 ${experienceLevel === value ? "text-white/60" : "text-black/40"}`}>
                      {sub}
                    </p>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Skills{" "}
                  <span className="text-black/40 font-normal">— comma separated</span>
                </label>
                <input
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="React, Figma, Python, Solidity..."
                  className="w-full rounded-xl border border-black/20 px-4 py-3 text-sm outline-none focus:border-black"
                />
              </div>
            </div>
          )}

          {/* Step 3 — Final Details */}
          {step === 3 && (
            <div>
              <h1 className="text-2xl font-semibold mb-1">Final Details</h1>
              <p className="text-black/50 text-sm mb-6">
                Almost done. Fill what you can — you can update this later in Profile.
              </p>

              <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">

                {/* Role / Title */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Role / Title{" "}
                    <span className="text-black/40 font-normal">— optional</span>
                  </label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Senior Frontend Developer, Freelance Photographer"
                    className="w-full rounded-xl border border-black/20 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Location{" "}
                    <span className="text-black/40 font-normal">— optional</span>
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                      className="w-full rounded-xl border border-black/20 px-4 py-3 text-sm outline-none focus:border-black"
                    />
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full rounded-xl border border-black/20 px-4 py-3 text-sm outline-none focus:border-black bg-white"
                    >
                      <option value="">Select country</option>
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Availability */}
                <div>
                  <label className="block text-sm font-medium mb-2">Availability</label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABILITY_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setAvailability(opt)}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                          availability === opt
                            ? "border-black bg-black text-white"
                            : "border-black/10 hover:border-black/30"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Work Arrangement */}
                <div>
                  <label className="block text-sm font-medium mb-2">Work Arrangement</label>
                  <div className="flex flex-wrap gap-2">
                    {WORK_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setWorkType(opt)}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                          workType === opt
                            ? "border-black bg-black text-white"
                            : "border-black/10 hover:border-black/30"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hourly Rate with currency + EUR conversion */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Hourly Rate{" "}
                    <span className="text-black/40 font-normal">— optional</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                      placeholder="e.g. 50"
                      className="flex-1 rounded-xl border border-black/20 px-4 py-3 text-sm outline-none focus:border-black"
                    />
                    <select
                      value={hourlyRateCurrency}
                      onChange={(e) => setHourlyRateCurrency(e.target.value)}
                      className="rounded-xl border border-black/20 px-3 py-3 text-sm outline-none focus:border-black bg-white min-w-[90px]"
                    >
                      {DISPLAY_CURRENCIES.map(({ code, symbol }) => (
                        <option key={code} value={code}>{symbol} {code}</option>
                      ))}
                    </select>
                  </div>
                  {eurEquivalent && (
                    <p className="mt-2 text-sm text-black/50">
                      ≈ <span className="font-medium text-black">€{eurEquivalent}</span> / hr
                    </p>
                  )}
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Bio{" "}
                    <span className="text-black/40 font-normal">— optional</span>
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    placeholder="Tell us a bit about yourself..."
                    className="w-full rounded-xl border border-black/20 px-4 py-3 text-sm outline-none focus:border-black resize-none"
                  />
                </div>

              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className="rounded-xl border border-black/10 px-5 py-2.5 text-sm font-medium transition hover:border-black disabled:invisible"
            >
              Back
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed()}
                className="rounded-xl bg-black px-6 py-2.5 text-sm font-medium text-white transition hover:bg-black/80 disabled:opacity-30"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={saving}
                className="rounded-xl bg-black px-6 py-2.5 text-sm font-medium text-white transition hover:bg-black/80 disabled:opacity-40"
              >
                {saving ? "Saving..." : "Complete Setup"}
              </button>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-black/30">
          You can update all of this later in your Profile settings.
        </p>
      </div>
    </div>
  );
}
