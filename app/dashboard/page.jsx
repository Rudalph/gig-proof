"use client";

import Sidebar from "../components/Sidebar";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";


import AddProjects from "../components/AddProjects";
import Profile from "../components/Profile";
import Settings from "../components/settings/Settings";
import OpenJobs from "../components/OpenJobs";


export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [activePage, setActivePage] = useState("Dashboard");

  useEffect(() => {
    if (!user) {
      router.replace("/auth");
    }
  }, [user, router]);

  if (!user) return null;

  return (
    <div>
      <Sidebar activePage={activePage} setActivePage={setActivePage} />

      <main className="ml-20 p-8 md:ml-72">
        {activePage === "Dashboard" && <h1>Dashboard Page</h1>}
        {activePage === "Hire Talent" && <AddProjects />}
        {activePage === "Open Jobs" && <OpenJobs />}
        {activePage === "Calendar" && <h1>Calendar Page</h1>}
        {activePage === "Settings" && <Settings />}
        {activePage === "Profile" && <Profile />}
      </main>
    </div>
  );
}