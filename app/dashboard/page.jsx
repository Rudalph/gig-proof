"use client";

import Sidebar from "../components/Sidebar";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

import AddProjects from "../components/AddProjects";
import Profile from "../components/Profile";
import Settings from "../components/settings/Settings";
import OpenJobs from "../components/OpenJobs";
import DashboardHome from "../components/DashboardHome";
import WorkHistory from "../components/WorkHistory";
import Notifications from "../components/Notifications";

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [activePage, setActivePage] = useState("Dashboard");
  const [checking, setChecking] = useState(true);
  const [jobPrefill, setJobPrefill] = useState(null);

  useEffect(() => {
    if (!user) {
      router.replace("/auth");
      return;
    }

    const checkOnboarding = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists() || !snap.data().onboardingComplete) {
          router.replace("/onboarding");
          return;
        }
      } catch (err) {
        console.error("Onboarding check error:", err);
      } finally {
        setChecking(false);
      }
    };

    checkOnboarding();
  }, [user, router]);

  if (!user || checking) return null;

  return (
    <div>
      <Sidebar activePage={activePage} setActivePage={setActivePage} />

      <main className="ml-20 p-8 md:ml-72">
        {activePage === "Dashboard" && <DashboardHome setActivePage={setActivePage} />}
        {activePage === "Hire Talent" && <AddProjects prefill={jobPrefill} onPrefillConsumed={() => setJobPrefill(null)} />}
        {activePage === "Open Jobs" && <OpenJobs />}
        {activePage === "Work History" && <WorkHistory setActivePage={setActivePage} setJobPrefill={setJobPrefill} />}
        {activePage === "Notifications" && <Notifications />}
        {activePage === "Settings" && <Settings />}
        {activePage === "Profile" && <Profile />}
      </main>
    </div>
  );
}
