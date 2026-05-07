"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useCurrency, DISPLAY_CURRENCIES } from "../context/CurrencyContext";
import { PROFESSIONS, COUNTRIES } from "../lib/professions";
import { Search, X, Check } from "lucide-react";

const EXPERIENCE_OPTIONS = ["Beginner", "Intermediate", "Expert"];
const AVAILABILITY_OPTIONS = ["Full-time", "Part-time", "Project-based"];
const WORK_TYPE_OPTIONS = ["Individual", "Company / Agency"];
const PRIMARY_ROLE_OPTIONS = ["Freelancer", "Client / Hiring", "Both"];

function toEur(amount, currency, rates) {
  const num = parseFloat(amount);
  if (!amount || isNaN(num) || num === 0) return null;
  if (currency === "EUR") return null; // already EUR, no need to show conversion
  const rate = rates[currency];
  if (!rate) return null;
  return (num / rate).toFixed(2);
}

export default function Profile() {
  const { user } = useAuth();
  const { rates } = useCurrency();

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showProfessionPicker, setShowProfessionPicker] = useState(false);
  const [professionSearch, setProfessionSearch] = useState("");

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    role: "",
    city: "",
    country: "",
    bio: "",
    skills: "",
    walletAddress: "",
    primaryRole: "",
    professions: [],
    experienceLevel: "",
    availability: "",
    workType: "",
    hourlyRate: "",
    hourlyRateCurrency: "EUR",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const d = snap.data();
          setProfile({
            name: d.name || "",
            email: d.email || user.email || "",
            role: d.role || "",
            city: d.city || "",
            country: d.country || "",
            bio: d.bio || "",
            skills: d.skills || "",
            walletAddress: d.walletAddress || "",
            primaryRole: d.primaryRole || "",
            professions: d.professions || [],
            experienceLevel: d.experienceLevel || "",
            availability: d.availability || "",
            workType: d.workType || "",
            hourlyRate: d.hourlyRate || "",
            hourlyRateCurrency: d.hourlyRateCurrency || "EUR",
          });
        } else {
          setProfile((prev) => ({ ...prev, email: user.email || "" }));
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const toggleProfession = (p) => {
    setProfile((prev) => ({
      ...prev,
      professions: prev.professions.includes(p)
        ? prev.professions.filter((x) => x !== p)
        : [...prev.professions, p],
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { ...profile, email: user.email, updatedAt: new Date() },
        { merge: true }
      );
      setIsEditing(false);
      setShowProfessionPicker(false);
      setProfessionSearch("");
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Failed to save profile.");
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setShowProfessionPicker(false);
    setProfessionSearch("");
  };

  const filteredProfessions = PROFESSIONS.filter((p) =>
    p.toLowerCase().includes(professionSearch.toLowerCase())
  );

  const eurEquivalent = toEur(profile.hourlyRate, profile.hourlyRateCurrency, rates);
  const hourlyRateSymbol = DISPLAY_CURRENCIES.find((c) => c.code === profile.hourlyRateCurrency)?.symbol || "";

  const locationDisplay = [profile.city, profile.country].filter(Boolean).join(", ") || "Not added";

  if (loading) return <p className="text-black/60">Loading profile...</p>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Basic info card */}
      <div className="bg-white border border-black/10 rounded-3xl shadow-sm p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-black">Profile</h1>
            <p className="text-black/60 mt-1">Manage your personal and professional details</p>
          </div>
          <div className="flex gap-2">
            {isEditing && (
              <button
                onClick={handleCancelEdit}
                className="px-5 py-2.5 rounded-xl border border-black/10 text-sm font-medium hover:border-black transition"
              >
                Cancel
              </button>
            )}
            <button
              onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
              className="px-5 py-2.5 rounded-xl bg-black text-white text-sm font-medium hover:bg-black/80 transition"
            >
              {isEditing ? "Save Changes" : "Edit Profile"}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-5 mb-8">
          <div className="w-20 h-20 rounded-full bg-black text-white flex items-center justify-center text-3xl font-semibold shrink-0">
            {profile.name ? profile.name[0].toUpperCase() : "U"}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-black">{profile.name || "Your Name"}</h2>
            <p className="text-black/60">{profile.email}</p>
            {locationDisplay !== "Not added" && (
              <p className="text-sm text-black/40 mt-0.5">{locationDisplay}</p>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <ProfileField label="Full Name" name="name" value={profile.name} isEditing={isEditing} onChange={handleChange} />
          <ProfileField label="Email" name="email" value={profile.email} isEditing={false} onChange={handleChange} />
          <ProfileField label="Role / Title" name="role" value={profile.role} isEditing={isEditing} onChange={handleChange} />

          {/* Location — city + country */}
          <div>
            <label className="block text-sm font-medium text-black/70 mb-2">Location</label>
            {isEditing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  name="city"
                  value={profile.city}
                  onChange={handleChange}
                  placeholder="City"
                  className="w-full rounded-2xl border border-black/10 px-4 py-3 outline-none focus:border-black text-sm"
                />
                <select
                  name="country"
                  value={profile.country}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-black/10 px-4 py-3 outline-none focus:border-black text-sm bg-white"
                >
                  <option value="">Select country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="rounded-2xl bg-black/5 px-4 py-3 text-black/80 min-h-12">
                {locationDisplay}
              </p>
            )}
          </div>

          <ProfileField label="Skills" name="skills" value={profile.skills} isEditing={isEditing} onChange={handleChange} />
          <ProfileField label="Wallet Address" name="walletAddress" value={profile.walletAddress} isEditing={isEditing} onChange={handleChange} />
        </div>

        <div className="mt-5">
          <label className="block text-sm font-medium text-black/70 mb-2">Bio</label>
          {isEditing ? (
            <textarea
              name="bio"
              value={profile.bio}
              onChange={handleChange}
              rows="4"
              placeholder="Tell us about yourself"
              className="w-full rounded-2xl border border-black/10 px-4 py-3 outline-none focus:border-black resize-none"
            />
          ) : (
            <p className="min-h-[5rem] rounded-2xl bg-black/5 px-4 py-3 text-black/80">
              {profile.bio || "No bio added yet."}
            </p>
          )}
        </div>
      </div>

      {/* Professional profile card */}
      <div className="bg-white border border-black/10 rounded-3xl shadow-sm p-8">
        <h2 className="text-xl font-semibold text-black mb-6">Professional Profile</h2>

        <div className="space-y-6">

          {/* Primary Role */}
          <div>
            <label className="block text-sm font-medium text-black/70 mb-2">I am primarily a</label>
            {isEditing ? (
              <div className="flex flex-wrap gap-2">
                {PRIMARY_ROLE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, primaryRole: opt }))}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      profile.primaryRole === opt
                        ? "border-black bg-black text-white"
                        : "border-black/10 hover:border-black/30"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-black/5 px-4 py-3 text-black/80">
                {profile.primaryRole || "Not set"}
              </p>
            )}
          </div>

          {/* Professions */}
          <div>
            <label className="block text-sm font-medium text-black/70 mb-2">Professions</label>

            {profile.professions.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {profile.professions.map((p) => (
                  <span
                    key={p}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                      isEditing ? "bg-black text-white" : "bg-black/5 text-black"
                    }`}
                  >
                    {p}
                    {isEditing && (
                      <button onClick={() => toggleProfession(p)} className="opacity-70 hover:opacity-100">
                        <X size={11} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}

            {isEditing && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowProfessionPicker((v) => !v)}
                  className="text-sm font-medium underline underline-offset-2 hover:text-black/60 transition"
                >
                  {showProfessionPicker
                    ? "Hide list"
                    : profile.professions.length > 0
                    ? "Edit professions"
                    : "Add professions"}
                </button>

                {showProfessionPicker && (
                  <div className="mt-3">
                    <div className="relative mb-2">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
                      <input
                        type="text"
                        value={professionSearch}
                        onChange={(e) => setProfessionSearch(e.target.value)}
                        placeholder="Search professions..."
                        className="w-full rounded-xl border border-black/20 py-2 pl-8 pr-4 text-sm outline-none focus:border-black"
                      />
                    </div>
                    <div className="max-h-52 overflow-y-auto rounded-2xl border border-black/10 divide-y divide-black/5">
                      {filteredProfessions.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => toggleProfession(p)}
                          className={`flex w-full items-center justify-between px-4 py-2.5 text-sm transition hover:bg-black/5 ${
                            profile.professions.includes(p) ? "font-medium bg-black/[0.03]" : ""
                          }`}
                        >
                          {p}
                          {profile.professions.includes(p) && (
                            <Check size={14} className="shrink-0 text-black" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isEditing && profile.professions.length === 0 && (
              <p className="rounded-2xl bg-black/5 px-4 py-3 text-black/80">Not set</p>
            )}
          </div>

          {/* Experience Level */}
          <div>
            <label className="block text-sm font-medium text-black/70 mb-2">Experience Level</label>
            {isEditing ? (
              <div className="flex flex-wrap gap-2">
                {EXPERIENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, experienceLevel: opt }))}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      profile.experienceLevel === opt
                        ? "border-black bg-black text-white"
                        : "border-black/10 hover:border-black/30"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-black/5 px-4 py-3 text-black/80">
                {profile.experienceLevel || "Not set"}
              </p>
            )}
          </div>

          {/* Availability */}
          <div>
            <label className="block text-sm font-medium text-black/70 mb-2">Availability</label>
            {isEditing ? (
              <div className="flex flex-wrap gap-2">
                {AVAILABILITY_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, availability: opt }))}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      profile.availability === opt
                        ? "border-black bg-black text-white"
                        : "border-black/10 hover:border-black/30"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-black/5 px-4 py-3 text-black/80">
                {profile.availability || "Not set"}
              </p>
            )}
          </div>

          {/* Work Arrangement */}
          <div>
            <label className="block text-sm font-medium text-black/70 mb-2">Work Arrangement</label>
            {isEditing ? (
              <div className="flex flex-wrap gap-2">
                {WORK_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, workType: opt }))}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      profile.workType === opt
                        ? "border-black bg-black text-white"
                        : "border-black/10 hover:border-black/30"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-black/5 px-4 py-3 text-black/80">
                {profile.workType || "Not set"}
              </p>
            )}
          </div>

          {/* Hourly Rate with currency + EUR conversion */}
          <div>
            <label className="block text-sm font-medium text-black/70 mb-2">Hourly Rate</label>
            {isEditing ? (
              <div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    name="hourlyRate"
                    value={profile.hourlyRate}
                    onChange={handleChange}
                    placeholder="e.g. 50"
                    className="flex-1 rounded-2xl border border-black/10 px-4 py-3 outline-none focus:border-black"
                  />
                  <select
                    name="hourlyRateCurrency"
                    value={profile.hourlyRateCurrency}
                    onChange={handleChange}
                    className="rounded-2xl border border-black/10 px-3 py-3 outline-none focus:border-black bg-white text-sm min-w-[90px]"
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
            ) : (
              <p className="rounded-2xl bg-black/5 px-4 py-3 text-black/80">
                {profile.hourlyRate ? (
                  <>
                    {hourlyRateSymbol}{profile.hourlyRate} {profile.hourlyRateCurrency}/hr
                    {eurEquivalent && (
                      <span className="text-black/50"> (€{eurEquivalent})</span>
                    )}
                  </>
                ) : (
                  "Not set"
                )}
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

function ProfileField({ label, name, value, isEditing, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-black/70 mb-2">{label}</label>
      {isEditing ? (
        <input
          type="text"
          name={name}
          value={value}
          onChange={onChange}
          placeholder={`Enter ${label.toLowerCase()}`}
          className="w-full rounded-2xl border border-black/10 px-4 py-3 outline-none focus:border-black"
        />
      ) : (
        <p className="rounded-2xl bg-black/5 px-4 py-3 text-black/80 min-h-12">
          {value || "Not added"}
        </p>
      )}
    </div>
  );
}
