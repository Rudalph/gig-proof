"use client";

import { useEffect, useState } from "react";
import {
  collection, query, where, onSnapshot,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "../context/AuthContext";
import {
  BarChart3, Eye, Bookmark, MessageCircle, CheckCircle2, XCircle, Clock, Briefcase,
} from "lucide-react";

export default function JobAnalytics() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const projQ = query(
      collection(db, "projects"),
      where("ownerId", "==", user.uid)
    );
    let projReady = false;
    let nReady = false;
    const checkDone = () => { if (projReady && nReady) setLoading(false); };

    const unsubProj = onSnapshot(projQ, (snap) => {
      setProjects(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const ta = a.createdAt?.toDate?.()?.getTime() || 0;
            const tb = b.createdAt?.toDate?.()?.getTime() || 0;
            return tb - ta;
          })
      );
      projReady = true;
      checkDone();
    }, () => { projReady = true; checkDone(); });

    const nQ = query(
      collection(db, "notifications"),
      where("toUid", "==", user.uid),
      where("type", "==", "contact_request")
    );
    const unsubN = onSnapshot(nQ, (snap) => {
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      nReady = true;
      checkDone();
    }, () => { nReady = true; checkDone(); });

    return () => { unsubProj(); unsubN(); };
  }, [user]);

  const analyticsMap = {};
  for (const n of notifications) {
    if (!analyticsMap[n.projectId]) {
      analyticsMap[n.projectId] = { total: 0, pending: 0, approved: 0, declined: 0 };
    }
    analyticsMap[n.projectId].total++;
    const s = n.status || "pending";
    if (s in analyticsMap[n.projectId]) {
      analyticsMap[n.projectId][s]++;
    } else {
      analyticsMap[n.projectId].pending++;
    }
  }

  const totalViews = projects.reduce((acc, p) => acc + (p.viewCount || 0), 0);
  const totalBookmarks = projects.reduce((acc, p) => acc + (p.bookmarkCount || 0), 0);
  const totalContacts = notifications.length;
  const totalApproved = notifications.filter((n) => n.status === "approved").length;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-black/5" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { icon: <Eye size={15} className="text-blue-500" />, bg: "bg-blue-50", value: totalViews, label: "Total Views" },
          { icon: <Bookmark size={15} className="text-purple-500" />, bg: "bg-purple-50", value: totalBookmarks, label: "Bookmarked" },
          { icon: <MessageCircle size={15} className="text-amber-500" />, bg: "bg-amber-50", value: totalContacts, label: "Contacted" },
          { icon: <CheckCircle2 size={15} className="text-emerald-500" />, bg: "bg-emerald-50", value: totalApproved, label: "Accepted" },
        ].map(({ icon, bg, value, label }) => (
          <div key={label} className="rounded-2xl border border-black/8 bg-white p-4">
            <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-xl ${bg}`}>
              {icon}
            </div>
            <p className="text-2xl font-bold text-black">{value}</p>
            <p className="text-xs text-black/40 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-black/5">
            <BarChart3 size={24} className="text-black/25" />
          </div>
          <p className="font-semibold text-black/50">No jobs posted yet</p>
          <p className="mt-1 text-sm text-black/35">
            Post your first job to start seeing analytics here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => {
            const stats = analyticsMap[project.id] || { total: 0, pending: 0, approved: 0, declined: 0 };
            return (
              <div key={project.id} className="rounded-2xl border border-black/8 bg-white p-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-black truncate">{project.title}</h3>
                    {project.category && (
                      <p className="text-xs text-black/40 mt-0.5">{project.category}</p>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                    project.status === "open" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
                    project.status === "in-progress" ? "bg-amber-50 text-amber-600 border border-amber-200" :
                    project.status === "completed" ? "bg-blue-50 text-blue-600 border border-blue-200" :
                    "bg-black/5 text-black/50 border border-black/10"
                  }`}>
                    {project.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  <div className="rounded-xl bg-blue-50 px-3 py-2.5 text-center">
                    <p className="text-base font-bold text-blue-600">{project.viewCount || 0}</p>
                    <p className="text-xs text-blue-500/70 mt-0.5 flex items-center justify-center gap-1">
                      <Eye size={10} /> Views
                    </p>
                  </div>
                  <div className="rounded-xl bg-purple-50 px-3 py-2.5 text-center">
                    <p className="text-base font-bold text-purple-600">{project.bookmarkCount || 0}</p>
                    <p className="text-xs text-purple-500/70 mt-0.5 flex items-center justify-center gap-1">
                      <Bookmark size={10} /> Saved
                    </p>
                  </div>
                  <div className="rounded-xl bg-black/4 px-3 py-2.5 text-center">
                    <p className="text-base font-bold text-black">{stats.total}</p>
                    <p className="text-xs text-black/40 mt-0.5 flex items-center justify-center gap-1">
                      <MessageCircle size={10} /> Requests
                    </p>
                  </div>
                  <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-center">
                    <p className="text-base font-bold text-amber-600">{stats.pending}</p>
                    <p className="text-xs text-amber-500/70 mt-0.5 flex items-center justify-center gap-1">
                      <Clock size={10} /> Pending
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-center">
                    <p className="text-base font-bold text-emerald-600">{stats.approved}</p>
                    <p className="text-xs text-emerald-600/70 mt-0.5 flex items-center justify-center gap-1">
                      <CheckCircle2 size={10} /> Accepted
                    </p>
                  </div>
                  <div className="rounded-xl bg-red-50 px-3 py-2.5 text-center">
                    <p className="text-base font-bold text-red-500">{stats.declined}</p>
                    <p className="text-xs text-red-500/70 mt-0.5 flex items-center justify-center gap-1">
                      <XCircle size={10} /> Rejected
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
