"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    role: "",
    location: "",
    bio: "",
    skills: "",
    walletAddress: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setProfile({
            name: snap.data().name || "",
            email: snap.data().email || user.email || "",
            role: snap.data().role || "",
            location: snap.data().location || "",
            bio: snap.data().bio || "",
            skills: snap.data().skills || "",
            walletAddress: snap.data().walletAddress || "",
          });
        } else {
          setProfile((prev) => ({
            ...prev,
            email: user.email || "",
          }));
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
    setProfile({
      ...profile,
      [e.target.name]: e.target.value,
    });
  };

  const handleSave = async () => {
    if (!user) return;

    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          ...profile,
          email: user.email,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      setIsEditing(false);
      alert("Profile saved successfully!");
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Failed to save profile.");
    }
  };

  if (loading) {
    return <p className="text-black/60">Loading profile...</p>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white border border-black/10 rounded-3xl shadow-sm p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-black">Profile</h1>
            <p className="text-black/60 mt-1">
              Manage your personal and professional details
            </p>
          </div>

          <button
            onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
            className="px-5 py-2.5 rounded-xl bg-black text-white text-sm font-medium hover:bg-black/80 transition"
          >
            {isEditing ? "Save Changes" : "Edit Profile"}
          </button>
        </div>

        <div className="flex items-center gap-5 mb-8">
          <div className="w-20 h-20 rounded-full bg-black text-white flex items-center justify-center text-3xl font-semibold">
            {profile.name ? profile.name[0].toUpperCase() : "U"}
          </div>

          <div>
            <h2 className="text-xl font-semibold text-black">
              {profile.name || "Your Name"}
            </h2>
            <p className="text-black/60">{profile.email}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <ProfileField
            label="Full Name"
            name="name"
            value={profile.name}
            isEditing={isEditing}
            onChange={handleChange}
          />

          <ProfileField
            label="Email"
            name="email"
            value={profile.email}
            isEditing={false}
            onChange={handleChange}
          />

          <ProfileField
            label="Role"
            name="role"
            value={profile.role}
            isEditing={isEditing}
            onChange={handleChange}
          />

          <ProfileField
            label="Location"
            name="location"
            value={profile.location}
            isEditing={isEditing}
            onChange={handleChange}
          />

          <ProfileField
            label="Skills"
            name="skills"
            value={profile.skills}
            isEditing={isEditing}
            onChange={handleChange}
          />

          <ProfileField
            label="Wallet Address"
            name="walletAddress"
            value={profile.walletAddress}
            isEditing={isEditing}
            onChange={handleChange}
          />
        </div>

        <div className="mt-5">
          <label className="block text-sm font-medium text-black/70 mb-2">
            Bio
          </label>

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
            <p className="min-h-25 rounded-2xl bg-black/5 px-4 py-3 text-black/80">
              {profile.bio || "No bio added yet."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileField({ label, name, value, isEditing, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-black/70 mb-2">
        {label}
      </label>

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