"use client";

import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  UserRoundCheck,
  FolderKanban,
  Settings,
  CircleUserRound,
  LogOut,
  Menu,
  X,
  User,
  BriefcaseBusiness,
  Bell,
  Zap,
  Scale,
} from "lucide-react";

import LogoutButton from "./Logout";

import { useAuth } from "../context/AuthContext";
import { collection, query, orderBy, limit, onSnapshot, where } from "firebase/firestore";
import { db } from "../lib/firebase";

const navItems = [
  { label: "Dashboard", href: "#", icon: LayoutDashboard },
  { label: "Hire Talent", href: "#", icon: UserRoundCheck },
  { label: "Open Jobs", href: "#", icon: FolderKanban },
  { label: "Work History", href: "#", icon: BriefcaseBusiness },
  { label: "Active Gigs", href: "#", icon: Zap },
  { label: "Notifications", href: "#", icon: Bell },
  { label: "Dispute Window", href: "#", icon: Scale },
  { label: "Settings", href: "#", icon: Settings },
  { label: "Profile", href: "#", icon: CircleUserRound },
];

export default function Sidebar({ activePage, setActivePage }) {
  const [isOpen, setIsOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const { user } = useAuth();
  const [hasNewJobs, setHasNewJobs] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [openDisputes, setOpenDisputes] = useState(0);

  useEffect(() => {
    if (!user) return;
    const ADMIN_TYPES = ["admin_message", "dispute_reverted"];
    const q = query(collection(db, "notifications"), where("toUid", "==", user.uid), where("read", "==", false));
    return onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => d.data());
      setUnreadNotifs(docs.filter((d) => !ADMIN_TYPES.includes(d.type)).length);
      setOpenDisputes(docs.filter((d) => d.type === "admin_message").length);
    });
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"), limit(1));
    return onSnapshot(q, (snap) => {
      if (snap.empty) return;
      const latest = snap.docs[0].data().createdAt?.toDate?.();
      if (!latest) return;
      try {
        const lastSeen = localStorage.getItem("lastSeenOpenJobs");
        if (!lastSeen || new Date(lastSeen) < latest) setHasNewJobs(true);
      } catch {}
    });
  }, []);

  const userName =
  user?.displayName ||
  user?.email?.split("@")[0] ||
  "User";

    const userEmail = user?.email || "No email available";
    const userPhoto = user?.photoURL;


  return (
    <>
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-xl bg-black p-2 text-white shadow-lg md:hidden"
        aria-label="Open sidebar"
      >
        <Menu size={22} />
      </button>

      {isMobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-label="Close sidebar overlay"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-white/10 bg-black text-white transition-all duration-300 ease-in-out
        ${isOpen ? "w-72" : "w-20"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4 transition-all duration-300 ease-in-out">
  <div className="flex min-w-0 items-center gap-3 transition-all duration-300 ease-in-out">
    {isOpen && (
      <span className="whitespace-nowrap text-lg font-semibold opacity-100 transition-all duration-300 ease-in-out">
        Gig Proof
      </span>
    )}
  </div>

  <button
    type="button"
    onClick={() => setIsOpen((value) => !value)}
    className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/70 transition-all duration-300 ease-in-out hover:bg-white hover:text-black md:flex"
    aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
  >
    <span className="transition-transform duration-300 ease-in-out">
      {isOpen ? <X size={20} /> : <Menu size={20} />}
    </span>
  </button>

  <button
    type="button"
    onClick={() => setIsMobileOpen(false)}
    className="rounded-lg p-2 text-white/70 transition-all duration-300 ease-in-out hover:bg-white hover:text-black md:hidden"
    aria-label="Close sidebar"
  >
    <X size={20} />
  </button>
</div>

      <nav className="flex-1 space-y-2 px-3 py-5">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setActivePage(item.label);
                if (item.label === "Open Jobs") {
                  try { localStorage.setItem("lastSeenOpenJobs", new Date().toISOString()); } catch {}
                  setHasNewJobs(false);
                }
              }}
              className={`flex w-full items-center rounded-xl px-3 py-3 text-sm font-medium transition-all duration-300
              ${
                activePage === item.label
                  ? "bg-white text-black"
                  : "text-white/80 hover:bg-white hover:text-black"
              }
              ${isOpen ? "justify-start gap-3" : "justify-center"}`}
            >
              <div className="relative shrink-0">
                <Icon size={22} />
                {item.label === "Open Jobs" && hasNewJobs && activePage !== "Open Jobs" && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />
                )}
                {item.label === "Notifications" && unreadNotifs > 0 && activePage !== "Notifications" && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {unreadNotifs > 9 ? "9+" : unreadNotifs}
                  </span>
                )}
                {item.label === "Dispute Window" && openDisputes > 0 && activePage !== "Dispute Window" && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                    {openDisputes > 9 ? "9+" : openDisputes}
                  </span>
                )}
              </div>
              {isOpen && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

        <div className="border-t border-white/10 p-3">
          <div
            className={`mb-3 flex items-center rounded-xl bg-white/5 p-3 ${
              isOpen ? "gap-3" : "justify-center"
            }`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-black">
              {userPhoto ? (
                <img
                  src={userPhoto}
                  alt={userName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User size={21} />
              )}
            </div>

            {isOpen && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{userName}</p>
                <p className="truncate text-xs text-white/50">{userEmail}</p>
              </div>
            )}
          </div>

          <div
  className={`flex w-full items-center rounded-xl px-3 py-3 text-sm font-medium text-white/80 transition hover:bg-white hover:text-black
  ${isOpen ? "justify-start gap-3" : "justify-center"}`}
>
  <LogOut size={22} className="shrink-0" />
  {isOpen && <LogoutButton />}
</div>

        </div>
      </aside>
    </>
  );
}

