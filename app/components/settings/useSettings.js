"use client";

import { useEffect, useState } from "react";
import {
  signOut,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { db, auth } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";

const defaultSettings = {
  projectUpdates: true,
  paymentAlerts: true,
  messageAlerts: true,
  publicProfile: true,
  showWalletAddress: false,
};

export default function useSettings() {
  const { user } = useAuth();
  const router = useRouter();

  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const ref = doc(db, "userSettings", user.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setSettings({
            ...defaultSettings,
            ...snap.data(),
          });
        } else {
          await setDoc(ref, {
            ...defaultSettings,
            email: user.email,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
        alert("Failed to load settings.");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user]);

  const handleToggle = (key) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    if (!user) {
      alert("You must be logged in to save settings.");
      return;
    }

    try {
      setSaving(true);

      await setDoc(
        doc(db, "userSettings", user.uid),
        {
          ...settings,
          email: user.email,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      alert("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/auth");
    } catch (error) {
      console.error("Logout error:", error);
      alert("Failed to logout.");
    }
  };

  const handleCancelDelete = () => {
    setShowDelete(false);
    setConfirmText("");
    setPassword("");
  };

  const deleteUserProjects = async (uid) => {
    const projectsRef = collection(db, "users", uid, "projectsAdded");
    const snapshot = await getDocs(projectsRef);

    if (snapshot.empty) return;

    const batch = writeBatch(db);

    snapshot.forEach((projectDoc) => {
      batch.delete(projectDoc.ref);
    });

    await batch.commit();
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    if (confirmText !== "DELETE") {
      alert("Type DELETE to confirm.");
      return;
    }

    if (!password) {
      alert("Enter your password.");
      return;
    }

    try {
      setDeleting(true);

      const credential = EmailAuthProvider.credential(user.email, password);

      await reauthenticateWithCredential(user, credential);

      // Delete user's project subcollection first
      await deleteUserProjects(user.uid);

      // Delete main Firestore documents
      await deleteDoc(doc(db, "users", user.uid));
      await deleteDoc(doc(db, "userSettings", user.uid));

      // Delete Firebase Authentication account
      await deleteUser(user);

      router.replace("/auth");
    } catch (error) {
      console.error("Delete error:", error);

      if (error.code === "auth/wrong-password") {
        alert("Wrong password.");
      } else if (error.code === "auth/invalid-credential") {
        alert("Invalid password.");
      } else if (error.code === "auth/requires-recent-login") {
        alert("Please login again and try deleting your account.");
      } else {
        alert("Failed to delete account.");
      }
    } finally {
      setDeleting(false);
    }
  };

  return {
    user,
    settings,
    loading,
    saving,
    showDelete,
    confirmText,
    password,
    deleting,
    setShowDelete,
    setConfirmText,
    setPassword,
    handleToggle,
    handleSave,
    handleLogout,
    handleCancelDelete,
    handleDeleteAccount,
  };
}