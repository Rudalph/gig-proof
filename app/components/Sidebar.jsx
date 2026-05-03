"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  CalendarDays,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
  X,
  User,
} from "lucide-react";

import LogoutButton from "./Logout";

// Change this import path to match your project structure
// Example: import { useAuth } from "@/app/context/AuthContext";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { label: "Dashboard", href: "#", icon: LayoutDashboard },
  { label: "Projects", href: "#", icon: FolderKanban },
  { label: "Calendar", href: "#", icon: CalendarDays },
  { label: "Settings", href: "#", icon: Settings },
  { label: "Help", href: "#", icon: HelpCircle },
];

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const { user } = useAuth();

  const userName =
  user?.displayName ||
  user?.email?.split("@")[0] ||
  "User";

    const userEmail = user?.email || "No email available";
    const userPhoto = user?.photoURL;

  const handleLogout = async () => {
    try {
      if (logout) {
        await logout();
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

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
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black">
              <LayoutDashboard size={22} />
            </div>
            {isOpen && <span className="text-lg font-semibold">Gig Proof</span>}
          </div>

          <button
            type="button"
            onClick={() => setIsOpen((value) => !value)}
            className="hidden rounded-lg p-2 text-white/70 transition hover:bg-white hover:text-black md:inline-flex"
            aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="rounded-lg p-2 text-white/70 transition hover:bg-white hover:text-black md:hidden"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-2 px-3 py-5">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <a
                key={item.label}
                href={item.href}
                className={`group flex items-center rounded-xl px-3 py-3 text-sm font-medium text-white/80 transition hover:bg-white hover:text-black
                ${isOpen ? "justify-start gap-3" : "justify-center"}`}
              >
                <Icon size={22} className="shrink-0" />
                {isOpen && <span>{item.label}</span>}
              </a>
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

          <button
            type="button"
            onClick={handleLogout}
            className={`flex w-full items-center rounded-xl px-3 py-3 text-sm font-medium text-white/80 transition hover:bg-white hover:text-black
            ${isOpen ? "justify-start gap-3" : "justify-center"}`}
          >
            <LogOut size={22} className="shrink-0" />
            {isOpen && <span><LogoutButton /></span>}
          </button>
        </div>
      </aside>
    </>
  );
}
