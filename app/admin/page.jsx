"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  collection, collectionGroup, onSnapshot, query, orderBy, getDocs,
  addDoc, updateDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "../context/AuthContext";
import {
  Users, Briefcase, CheckCircle, Bell, LayoutDashboard,
  Search, ChevronRight, ArrowLeft, X, ExternalLink, Scale, AlertTriangle,
  Send, CheckCircle2, MessageSquare,
} from "lucide-react";

const ADMIN_EMAIL = "admin@gmail.com";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDate(val) {
  if (!val) return "—";
  let d;
  if (val?.toDate) d = val.toDate();
  else if (val?.seconds) d = new Date(val.seconds * 1000);
  else d = new Date(val);
  if (isNaN(d)) return String(val);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtAmt(n, cur) {
  if (n == null) return "—";
  return `${cur ? cur + " " : ""}${Number(n).toLocaleString()}`;
}

function statusPill(status) {
  const map = {
    open: "bg-green-100 text-green-800",
    "in-progress": "bg-blue-100 text-blue-800",
    completed: "bg-purple-100 text-purple-800",
    cancelled: "bg-red-100 text-red-800",
    draft: "bg-gray-100 text-gray-600",
  };
  const cls = map[status?.toLowerCase()] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${cls}`}>
      {status ?? "unknown"}
    </span>
  );
}

function Pill({ label, color = "bg-gray-100 text-gray-700" }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>{label}</span>;
}

function Card({ title, value, sub, icon: Icon, color = "bg-black" }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm flex items-center gap-4">
      <div className={`${color} rounded-xl p-3 text-white`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-2xl font-bold text-black">{value ?? "—"}</p>
        <p className="text-sm font-semibold text-black/70">{title}</p>
        {sub && <p className="text-xs text-black/40 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search…"}
        className="w-full rounded-xl border border-black/10 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-black/30"
      />
    </div>
  );
}

function Table({ cols, rows, onRow }) {
  if (!rows.length)
    return <p className="text-center text-sm text-black/40 py-10">No records found.</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-black/8">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-black/5 text-left">
            {cols.map((c) => (
              <th key={c.key} className="px-4 py-3 font-semibold text-black/60 whitespace-nowrap">
                {c.label}
              </th>
            ))}
            {onRow && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row._id ?? i}
              onClick={onRow ? () => onRow(row) : undefined}
              className={`border-t border-black/5 transition-colors ${onRow ? "cursor-pointer hover:bg-black/3" : ""}`}
            >
              {cols.map((c) => (
                <td key={c.key} className="px-4 py-3 whitespace-nowrap">
                  {c.render ? c.render(row) : (row[c.key] ?? "—")}
                </td>
              ))}
              {onRow && (
                <td className="px-4 py-3 text-right">
                  <ChevronRight size={15} className="text-black/30" />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── section: Overview ───────────────────────────────────────────────────────

function OverviewSection({ users, projects, gigs, notifs }) {
  const totalUSDC = gigs.reduce((s, g) => s + (Number(g.budget ?? g.amount) || 0), 0);
  const tsOf = (u) => {
    if (u.createdAt?.seconds) return u.createdAt.seconds;
    if (u.createdAt?.toDate) return u.createdAt.toDate().getTime() / 1000;
    if (u.createdAt) return new Date(u.createdAt).getTime() / 1000;
    return 0;
  };
  const recent5Users = [...users].sort((a, b) => tsOf(b) - tsOf(a)).slice(0, 5);
  const recent5Projects = [...projects]
    .sort((a, b) => {
      const ta = a.createdAt?.seconds ?? 0;
      const tb = b.createdAt?.seconds ?? 0;
      return tb - ta;
    })
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-black">Overview</h2>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card title="Total Users" value={users.length} icon={Users} color="bg-black" />
        <Card title="Total Projects" value={projects.length} icon={Briefcase} color="bg-black" />
        <Card title="Completed Gigs" value={gigs.length} icon={CheckCircle} color="bg-black" />
        <Card title="USDC Volume" value={`${totalUSDC.toFixed(2)} USDC`} icon={LayoutDashboard} color="bg-black" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="font-bold text-black mb-4">Recent Sign-ups</h3>
          {recent5Users.length === 0 ? (
            <p className="text-sm text-black/40">No users yet.</p>
          ) : (
            <ul className="space-y-3">
              {recent5Users.map((u) => (
                <li key={u._id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-black">{u.displayName ?? u.name ?? u.email ?? u._id}</p>
                    <p className="text-xs text-black/40">{u.email}</p>
                  </div>
                  <p className="text-xs text-black/40">{fmtDate(u.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="font-bold text-black mb-4">Recent Projects</h3>
          {recent5Projects.length === 0 ? (
            <p className="text-sm text-black/40">No projects yet.</p>
          ) : (
            <ul className="space-y-3">
              {recent5Projects.map((p) => (
                <li key={p._id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-black truncate">{p.title ?? "Untitled"}</p>
                    <p className="text-xs text-black/40">{p.category ?? "—"}</p>
                  </div>
                  <div className="shrink-0">{statusPill(p.status)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── section: Users ──────────────────────────────────────────────────────────

function UserDetailModal({ user: u, projects, gigs, onClose }) {
  const userProjects = projects.filter(
    (p) => p.ownerId === u._id || p.approvedFreelancerUid === u._id
  );
  const userGigs = gigs.filter(
    (g) => g.freelancerUid === u._id || g.clientUid === u._id
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-6">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl mt-8 mb-8">
        <div className="sticky top-0 flex items-center justify-between rounded-t-2xl bg-white border-b border-black/8 px-6 py-4 z-10">
          <h3 className="font-bold text-black text-lg">{u.displayName ?? u.email}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-black/8 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Profile */}
          <section>
            <h4 className="text-xs font-bold uppercase tracking-widest text-black/40 mb-3">Profile</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["UID", u._id],
                ["Email", u.email],
                ["Role", u.primaryRole],
                ["Joined", fmtDate(u.createdAt)],
                ["Wallet", u.walletAddress],
                ["Skills", u.skills],
                ["Professions", (u.professions || []).join(", ")],
                ["Experience", u.experienceLevel],
                ["Location", u.location],
                ["Currency", u.currency],
              ]
                .filter(([, v]) => v)
                .map(([label, val]) => (
                  <div key={label} className="rounded-xl bg-black/4 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-black/40">{label}</p>
                    <p className="text-black font-medium break-all">{String(val)}</p>
                  </div>
                ))}
            </div>
          </section>

          {/* Projects */}
          <section>
            <h4 className="text-xs font-bold uppercase tracking-widest text-black/40 mb-3">
              Projects ({userProjects.length})
            </h4>
            {userProjects.length === 0 ? (
              <p className="text-sm text-black/40">None.</p>
            ) : (
              <ul className="space-y-2">
                {userProjects.map((p) => (
                  <li key={p._id} className="flex items-center justify-between rounded-xl bg-black/4 px-4 py-2">
                    <div>
                      <p className="text-sm font-semibold text-black">{p.title ?? "Untitled"}</p>
                      <p className="text-xs text-black/40">{fmtDate(p.createdAt)}</p>
                    </div>
                    {statusPill(p.status)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Gigs */}
          <section>
            <h4 className="text-xs font-bold uppercase tracking-widest text-black/40 mb-3">
              Completed Gigs ({userGigs.length})
            </h4>
            {userGigs.length === 0 ? (
              <p className="text-sm text-black/40">None.</p>
            ) : (
              <ul className="space-y-2">
                {userGigs.map((g, i) => (
                  <li key={g._id ?? i} className="flex items-center justify-between rounded-xl bg-black/4 px-4 py-2">
                    <div>
                      <p className="text-sm font-semibold text-black">{g.projectTitle ?? g.title ?? "Untitled"}</p>
                      <p className="text-xs text-black/40">{fmtDate(g.completedAt ?? g.createdAt)}</p>
                    </div>
                    <p className="text-sm font-bold text-black">{fmtAmt(g.budget ?? g.amount, g.currency ?? "USDC")}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function UsersSection({ users, projects, gigs }) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    const lq = q.toLowerCase();
    return users.filter(
      (u) =>
        !lq ||
        (u.displayName ?? "").toLowerCase().includes(lq) ||
        (u.email ?? "").toLowerCase().includes(lq) ||
        (u.primaryRole ?? "").toLowerCase().includes(lq) ||
        (u._id ?? "").toLowerCase().includes(lq)
    );
  }, [users, q]);

  const cols = [
    { key: "displayName", label: "Name", render: (u) => <span className="font-semibold">{u.displayName ?? "—"}</span> },
    { key: "email", label: "Email" },
    { key: "primaryRole", label: "Role" },
    {
      key: "walletAddress",
      label: "Wallet",
      render: (u) =>
        u.walletAddress ? (
          <span className="font-mono text-xs">
            {u.walletAddress.slice(0, 6)}…{u.walletAddress.slice(-4)}
          </span>
        ) : (
          "—"
        ),
    },
    { key: "createdAt", label: "Joined", render: (u) => fmtDate(u.createdAt) },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-black">Users ({users.length})</h2>
      <SearchBar value={q} onChange={setQ} placeholder="Search by name, email, or role…" />
      <Table cols={cols} rows={filtered} onRow={setSelected} />
      {selected && (
        <UserDetailModal
          user={selected}
          projects={projects}
          gigs={gigs}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// ─── section: Projects ───────────────────────────────────────────────────────

function ProjectDetailModal({ project: p, users, onClose }) {
  const client = users.find((u) => u._id === p.ownerId);
  const freelancer = users.find((u) => u._id === p.approvedFreelancerUid);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-6">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl mt-8 mb-8">
        <div className="sticky top-0 flex items-center justify-between rounded-t-2xl bg-white border-b border-black/8 px-6 py-4 z-10">
          <h3 className="font-bold text-black text-lg truncate pr-8">{p.title ?? "Untitled Project"}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-black/8 transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Status", p.status],
              ["Category", p.category],
              ["Budget", p.budget ? `${p.budget} ${p.currency ?? ""}` : null],
              ["Deadline", p.deadline],
              ["Created", fmtDate(p.createdAt)],
              ["Client", client?.displayName ?? p.ownerId],
              ["Freelancer", freelancer?.displayName ?? p.approvedFreelancerUid],
              ["Escrow Created", p.escrowCreated ? "Yes" : "No"],
              ["Project ID", p._id],
            ]
              .filter(([, v]) => v != null && v !== "")
              .map(([label, val]) => (
                <div key={label} className="rounded-xl bg-black/4 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-black/40">{label}</p>
                  <p className="text-black font-medium break-all">{String(val)}</p>
                </div>
              ))}
          </div>

          {p.description && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-black/40 mb-2">Description</p>
              <p className="text-sm text-black/70 whitespace-pre-wrap">{p.description}</p>
            </div>
          )}

          {p.milestones?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-black/40 mb-3">
                Milestones ({p.milestones.length})
              </p>
              <ul className="space-y-2">
                {p.milestones.map((m, i) => (
                  <li key={i} className="flex items-center justify-between rounded-xl bg-black/4 px-4 py-2">
                    <div>
                      <p className="text-sm font-semibold text-black">{m.title ?? `Milestone ${i + 1}`}</p>
                      <p className="text-xs text-black/40">{m.percentage ?? m.percent ?? "—"}%</p>
                    </div>
                    {statusPill(m.status)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {p.tags?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-black/40 mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {p.tags.map((t, i) => (
                  <Pill key={i} label={t} color="bg-black/8 text-black/70" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectsSection({ projects, users }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const statuses = useMemo(() => {
    const s = new Set(projects.map((p) => p.status).filter(Boolean));
    return ["all", ...Array.from(s)];
  }, [projects]);

  const filtered = useMemo(() => {
    const lq = q.toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!lq) return true;
      return (
        (p.title ?? "").toLowerCase().includes(lq) ||
        (p.category ?? "").toLowerCase().includes(lq) ||
        (p.ownerId ?? "").toLowerCase().includes(lq) ||
        (p._id ?? "").toLowerCase().includes(lq)
      );
    });
  }, [projects, q, statusFilter]);

  const getClientName = (p) => {
    const u = users.find((u) => u._id === p.ownerId);
    return u?.displayName ?? u?.name ?? u?.email ?? p.ownerId?.slice(0, 8) ?? "—";
  };

  const cols = [
    { key: "title", label: "Title", render: (p) => <span className="font-semibold">{p.title ?? "Untitled"}</span> },
    { key: "category", label: "Category" },
    { key: "ownerId", label: "Client", render: (p) => getClientName(p) },
    { key: "budget", label: "Budget", render: (p) => p.budget ? `${p.budget} ${p.currency ?? ""}` : "—" },
    { key: "status", label: "Status", render: (p) => statusPill(p.status) },
    { key: "createdAt", label: "Created", render: (p) => fmtDate(p.createdAt) },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-black">Projects ({projects.length})</h2>
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-48">
          <SearchBar value={q} onChange={setQ} placeholder="Search by title, category, or client…" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                statusFilter === s ? "bg-black text-white" : "bg-black/8 text-black/60 hover:bg-black/15"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <Table cols={cols} rows={filtered} onRow={setSelected} />
      {selected && (
        <ProjectDetailModal
          project={selected}
          users={users}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// ─── section: Completed Gigs ─────────────────────────────────────────────────

function GigsSection({ gigs, users }) {
  const [q, setQ] = useState("");

  const getUserName = (id) => {
    if (!id) return "—";
    const u = users.find((u) => u._id === id);
    return u?.displayName ?? u?.name ?? u?.email ?? id.slice(0, 8);
  };

  const filtered = useMemo(() => {
    const lq = q.toLowerCase();
    if (!lq) return gigs;
    return gigs.filter(
      (g) =>
        (g.projectTitle ?? "").toLowerCase().includes(lq) ||
        (g.freelancerUid ?? "").toLowerCase().includes(lq) ||
        getUserName(g.freelancerUid).toLowerCase().includes(lq)
    );
  }, [gigs, q, users]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const ta = (a.completedAt ?? a.createdAt)?.seconds ?? 0;
        const tb = (b.completedAt ?? b.createdAt)?.seconds ?? 0;
        return tb - ta;
      }),
    [filtered]
  );

  const totalUSDC = sorted.reduce((s, g) => s + (Number(g.budget ?? g.amount) || 0), 0);

  const cols = [
    {
      key: "projectTitle",
      label: "Project",
      render: (g) => <span className="font-semibold">{g.projectTitle ?? "Untitled"}</span>,
    },
    { key: "freelancerUid", label: "Freelancer", render: (g) => getUserName(g.freelancerUid) },
    { key: "clientUid", label: "Client", render: (g) => getUserName(g.clientUid) },
    {
      key: "budget",
      label: "Amount",
      render: (g) => (
        <span className="font-bold">{fmtAmt(g.budget ?? g.amount, g.currency ?? "USDC")}</span>
      ),
    },
    {
      key: "paymentTx",
      label: "Solscan",
      render: (g) =>
        g.paymentTx ? (
          <a
            href={`https://solscan.io/tx/${g.paymentTx}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-blue-600 hover:underline text-xs"
          >
            View <ExternalLink size={11} />
          </a>
        ) : (
          "—"
        ),
    },
    { key: "completedAt", label: "Completed", render: (g) => fmtDate(g.completedAt ?? g.createdAt) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-black">Completed Gigs ({gigs.length})</h2>
        <div className="rounded-xl bg-black text-white px-4 py-1.5 text-sm font-bold">
          Total: {totalUSDC.toFixed(2)} USDC
        </div>
      </div>
      <SearchBar value={q} onChange={setQ} placeholder="Search by project or freelancer…" />
      <Table cols={cols} rows={sorted} />
    </div>
  );
}

// ─── section: Notifications ──────────────────────────────────────────────────

function NotifsSection({ notifs, users }) {
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const types = useMemo(() => {
    const s = new Set(notifs.map((n) => n.type).filter(Boolean));
    return ["all", ...Array.from(s)];
  }, [notifs]);

  const getUserName = (id) => {
    if (!id) return "—";
    const u = users.find((u) => u._id === id);
    return u?.displayName ?? u?.name ?? u?.email ?? id.slice(0, 8);
  };

  const filtered = useMemo(() => {
    const lq = q.toLowerCase();
    return notifs.filter((n) => {
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      if (!lq) return true;
      return (
        (n.message ?? n.body ?? n.text ?? "").toLowerCase().includes(lq) ||
        (n.type ?? "").toLowerCase().includes(lq) ||
        getUserName(n.toUid).toLowerCase().includes(lq) ||
        getUserName(n.fromUid).toLowerCase().includes(lq)
      );
    });
  }, [notifs, q, typeFilter, users]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const ta = a.createdAt?.seconds ?? a.timestamp?.seconds ?? 0;
        const tb = b.createdAt?.seconds ?? b.timestamp?.seconds ?? 0;
        return tb - ta;
      }),
    [filtered]
  );

  const cols = [
    {
      key: "type",
      label: "Type",
      render: (n) => <Pill label={n.type ?? "—"} color="bg-black/8 text-black/70" />,
    },
    {
      key: "message",
      label: "Message",
      render: (n) => (
        <span className="max-w-xs block truncate">{n.message ?? n.body ?? n.text ?? "—"}</span>
      ),
    },
    { key: "toUid", label: "To", render: (n) => getUserName(n.toUid) },
    { key: "fromUid", label: "From", render: (n) => getUserName(n.fromUid) },
    {
      key: "createdAt",
      label: "Time",
      render: (n) => fmtDate(n.createdAt ?? n.timestamp),
    },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-black">Notifications ({notifs.length})</h2>
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-48">
          <SearchBar value={q} onChange={setQ} placeholder="Search by message, type, or user…" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                typeFilter === t ? "bg-black text-white" : "bg-black/8 text-black/60 hover:bg-black/15"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <Table cols={cols} rows={sorted} />
    </div>
  );
}

// ─── section: Disputes ───────────────────────────────────────────────────────

function DisputeDetailModal({ dispute: d, users, adminUser, onClose, onResolved }) {
  const filer = users.find((u) => u._id === d.submittedByUid);
  const client = users.find((u) => u._id === d.clientUid);
  const freelancer = users.find((u) => u._id === d.freelancerUid);
  const otherPartyUser =
    d.submitterRole === "client"
      ? freelancer ?? { displayName: "—", _id: d.freelancerUid }
      : client ?? { displayName: "—", _id: d.clientUid };

  // Message state
  const [recipient, setRecipient] = useState("submitter"); // "submitter" | "other"
  const [adminMsg, setAdminMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState(null); // name of last sent-to

  // Resolve state
  const [resolving, setResolving] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(d.status ?? "open");
  const resolved = currentStatus === "resolved";
  const reverted = currentStatus === "reverted";

  const recipientUid = recipient === "submitter" ? d.submittedByUid : otherPartyUser?._id;
  const recipientName =
    recipient === "submitter"
      ? (filer?.displayName ?? filer?.name ?? filer?.email ?? d.submittedByName)
      : (otherPartyUser?.displayName ?? otherPartyUser?.name ?? otherPartyUser?.email ?? "Other Party");

  const words = adminMsg.trim() === "" ? 0 : adminMsg.trim().split(/\s+/).length;
  const canSend = adminMsg.trim().length > 0 && !sending && recipientUid;

  const handleSendMessage = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await addDoc(collection(db, "notifications"), {
        type: "admin_message",
        toUid: recipientUid,
        fromUid: adminUser?.uid ?? "admin",
        fromName: "GigProof Admin",
        disputeId: d._id,
        projectTitle: d.projectTitle,
        message: adminMsg.trim(),
        read: false,
        createdAt: serverTimestamp(),
      });
      setSentTo(recipientName);
      setAdminMsg("");
    } catch (err) {
      console.error("Failed to send admin message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleResolve = async () => {
    if (resolving || resolved) return;
    setResolving(true);
    try {
      await updateDoc(doc(db, "disputes", d._id), { status: "resolved" });
      setCurrentStatus("resolved");
      onResolved?.(d._id);
    } catch (err) {
      console.error("Failed to resolve dispute:", err);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-6">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl mt-8 mb-8">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between rounded-t-2xl bg-white border-b border-black/8 px-6 py-4 z-10">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <AlertTriangle size={15} className="text-amber-500 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-widest text-black/40">Dispute</span>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  resolved
                    ? "bg-green-100 text-green-700"
                    : reverted
                    ? "bg-gray-100 text-gray-600"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {resolved ? "resolved" : reverted ? "reverted" : "open"}
              </span>
            </div>
            <h3 className="font-bold text-black truncate">{d.projectTitle ?? "Untitled Project"}</h3>
          </div>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            {!resolved && !reverted && (
              <button
                onClick={handleResolve}
                disabled={resolving}
                className="flex items-center gap-1.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1.5 text-xs font-bold transition-colors"
              >
                <CheckCircle2 size={13} />
                {resolving ? "Resolving…" : "Mark Resolved"}
              </button>
            )}
            <button onClick={onClose} className="rounded-full p-1.5 hover:bg-black/8 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Dispute message */}
          <section>
            <h4 className="text-xs font-bold uppercase tracking-widest text-black/40 mb-3">Dispute Message</h4>
            <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4">
              <p className="text-sm text-black/80 leading-relaxed whitespace-pre-wrap">{d.message}</p>
            </div>
            <p className="text-xs text-black/40 mt-2">
              Filed {fmtDate(d.createdAt)} · {d.submittedByName} ({d.submittedByEmail})
            </p>
          </section>

          {/* Withdrawal reason */}
          {reverted && d.revertReason && (
            <section>
              <h4 className="text-xs font-bold uppercase tracking-widest text-black/40 mb-3">Withdrawal Reason</h4>
              <div className="rounded-2xl bg-gray-50 border border-gray-200 px-5 py-4">
                <p className="text-sm text-black/70 leading-relaxed whitespace-pre-wrap italic">"{d.revertReason}"</p>
              </div>
              <p className="text-xs text-black/40 mt-2">
                Withdrawn by {d.submittedByName} on {fmtDate(d.revertedAt)}
              </p>
            </section>
          )}

          {/* Parties */}
          <section>
            <h4 className="text-xs font-bold uppercase tracking-widest text-black/40 mb-3">Parties Involved</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-black/4 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-black/40 mb-1">
                  Filed By ({d.submitterRole})
                </p>
                <p className="font-semibold text-black text-sm">{filer?.displayName ?? filer?.name ?? filer?.email ?? d.submittedByName}</p>
                <p className="text-xs text-black/40 break-all">{d.submittedByEmail}</p>
                <p className="text-[10px] text-black/30 font-mono mt-1">{d.submittedByUid}</p>
              </div>
              <div className="rounded-xl bg-black/4 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-black/40 mb-1">
                  Other Party ({d.submitterRole === "client" ? "freelancer" : "client"})
                </p>
                <p className="font-semibold text-black text-sm">
                  {otherPartyUser?.displayName ?? otherPartyUser?.name ?? otherPartyUser?.email ?? "—"}
                </p>
                <p className="text-xs text-black/40 break-all">{otherPartyUser?.email ?? "—"}</p>
                <p className="text-[10px] text-black/30 font-mono mt-1">
                  {d.submitterRole === "client" ? d.freelancerUid : d.clientUid}
                </p>
              </div>
            </div>
          </section>

          {/* Project details */}
          <section>
            <h4 className="text-xs font-bold uppercase tracking-widest text-black/40 mb-3">Project Details</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Project ID", d.projectId],
                ["Category", d.projectCategory],
                ["Budget", d.projectBudget ? `${d.projectBudget} ${d.projectCurrency ?? ""}` : null],
                ["Status", d.projectStatus],
                ["Deadline", d.projectDeadline],
              ]
                .filter(([, v]) => v)
                .map(([label, val]) => (
                  <div key={label} className="rounded-xl bg-black/4 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-black/40">{label}</p>
                    <p className="text-sm font-medium text-black break-all">{String(val)}</p>
                  </div>
                ))}
            </div>
            {d.projectDescription && (
              <div className="rounded-xl bg-black/4 px-4 py-3 mt-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-black/40 mb-1">Description</p>
                <p className="text-sm text-black/70 whitespace-pre-wrap">{d.projectDescription}</p>
              </div>
            )}
          </section>

          {/* Milestones */}
          {d.milestones?.length > 0 && (
            <section>
              <h4 className="text-xs font-bold uppercase tracking-widest text-black/40 mb-3">
                Milestones ({d.milestones.length})
              </h4>
              <ul className="space-y-2">
                {d.milestones.map((m, i) => (
                  <li key={i} className="flex items-center justify-between rounded-xl bg-black/4 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-black truncate">
                        {m.description ?? m.title ?? `Milestone ${i + 1}`}
                      </p>
                      <p className="text-xs text-black/40">{m.percentage ?? m.percent ?? "—"}% of budget</p>
                    </div>
                    <div className="ml-3 shrink-0 space-y-1 text-right">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                          m.status === "approved" || m.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : m.status === "pending"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {m.status ?? "—"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Transactions */}
          {d.transactions?.length > 0 && (
            <section>
              <h4 className="text-xs font-bold uppercase tracking-widest text-black/40 mb-3">
                Transactions ({d.transactions.length})
              </h4>
              <ul className="space-y-2">
                {d.transactions.map((tx, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-xl bg-black/4 px-4 py-2.5"
                  >
                    <p className="text-xs font-mono text-black/60 truncate flex-1 mr-3">{tx}</p>
                    <a
                      href={`https://solscan.io/tx/${tx}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 flex items-center gap-1 text-blue-600 hover:underline text-xs font-semibold"
                    >
                      Solscan <ExternalLink size={11} />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Admin message */}
          <section className="border-t border-black/8 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare size={15} className="text-black/50" />
              <h4 className="text-xs font-bold uppercase tracking-widest text-black/40">
                Message User
              </h4>
            </div>

            {/* Recipient toggle */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setRecipient("submitter")}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors border ${
                  recipient === "submitter"
                    ? "bg-black text-white border-black"
                    : "bg-white text-black/60 border-black/10 hover:border-black/25"
                }`}
              >
                {filer?.displayName ?? filer?.name ?? filer?.email ?? d.submittedByName}
                <span className="ml-1 opacity-60 capitalize">({d.submitterRole})</span>
              </button>
              <button
                onClick={() => setRecipient("other")}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors border ${
                  recipient === "other"
                    ? "bg-black text-white border-black"
                    : "bg-white text-black/60 border-black/10 hover:border-black/25"
                }`}
              >
                {otherPartyUser?.displayName ?? otherPartyUser?.name ?? otherPartyUser?.email ?? "Other Party"}
                <span className="ml-1 opacity-60 capitalize">
                  ({d.submitterRole === "client" ? "freelancer" : "client"})
                </span>
              </button>
            </div>

            {sentTo && (
              <div className="flex items-center gap-1.5 rounded-xl bg-green-50 border border-green-200 px-3 py-2 mb-3">
                <CheckCircle2 size={13} className="text-green-600 shrink-0" />
                <p className="text-xs text-green-700 font-medium">Message sent to {sentTo}</p>
              </div>
            )}

            <textarea
              value={adminMsg}
              onChange={(e) => setAdminMsg(e.target.value)}
              rows={4}
              placeholder={`Write a message to ${recipientName}… You can include links or any relevant information.`}
              className="w-full rounded-xl border border-black/10 bg-black/[0.02] p-4 text-sm text-black outline-none focus:border-black/30 resize-none leading-relaxed"
            />
            <div className="flex items-center justify-between mt-2 mb-3">
              <p className="text-xs text-black/40">Recommended: 50 – 200 words</p>
              <p className={`text-xs font-bold tabular-nums ${
                words === 0 ? "text-black/30" :
                words <= 200 ? "text-green-600" :
                "text-amber-500"
              }`}>
                {words} words
              </p>
            </div>

            <button
              onClick={handleSendMessage}
              disabled={!canSend}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                canSend
                  ? "bg-black text-white hover:bg-black/80"
                  : "bg-black/10 text-black/30 cursor-not-allowed"
              }`}
            >
              <Send size={14} />
              {sending ? "Sending…" : `Send to ${recipientName}`}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

function DisputesSection({ disputes, users, adminUser }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);

  const getUserName = (id) => {
    if (!id) return "—";
    const u = users.find((u) => u._id === id);
    return u?.displayName ?? u?.name ?? u?.email ?? id.slice(0, 8);
  };

  const filtered = useMemo(() => {
    const lq = q.toLowerCase();
    return disputes.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (!lq) return true;
      return (
        (d.projectTitle ?? "").toLowerCase().includes(lq) ||
        (d.submittedByName ?? "").toLowerCase().includes(lq) ||
        (d.submittedByEmail ?? "").toLowerCase().includes(lq) ||
        (d.submitterRole ?? "").toLowerCase().includes(lq)
      );
    });
  }, [disputes, q, statusFilter]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)),
    [filtered]
  );

  const openCount = disputes.filter((d) => d.status === "open").length;
  const resolvedCount = disputes.filter((d) => d.status === "resolved").length;
  const revertedCount = disputes.filter((d) => d.status === "reverted").length;

  const handleResolveRow = async (e, dispute) => {
    e.stopPropagation();
    if (dispute.status === "resolved" || resolvingId === dispute._id) return;
    setResolvingId(dispute._id);
    try {
      await updateDoc(doc(db, "disputes", dispute._id), { status: "resolved" });
    } catch (err) {
      console.error("Failed to resolve:", err);
    } finally {
      setResolvingId(null);
    }
  };

  const cols = [
    {
      key: "projectTitle",
      label: "Project",
      render: (d) => <span className="font-semibold">{d.projectTitle ?? "Untitled"}</span>,
    },
    {
      key: "submittedByName",
      label: "Filed By",
      render: (d) => (
        <div>
          <p className="font-medium">{d.submittedByName}</p>
          <p className="text-xs text-black/40">{d.submittedByEmail}</p>
        </div>
      ),
    },
    {
      key: "submitterRole",
      label: "Role",
      render: (d) => (
        <Pill
          label={d.submitterRole ?? "—"}
          color={d.submitterRole === "client" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}
        />
      ),
    },
    {
      key: "message",
      label: "Message",
      render: (d) => (
        <span className="max-w-[200px] block truncate text-black/60">{d.message ?? "—"}</span>
      ),
    },
    { key: "createdAt", label: "Filed", render: (d) => fmtDate(d.createdAt) },
    {
      key: "status",
      label: "Status",
      render: (d) => (
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
            d.status === "open"
              ? "bg-amber-100 text-amber-700"
              : d.status === "resolved"
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {d.status ?? "—"}
        </span>
      ),
    },
    {
      key: "_resolve",
      label: "",
      render: (d) =>
        d.status !== "resolved" ? (
          <button
            onClick={(e) => handleResolveRow(e, d)}
            disabled={resolvingId === d._id}
            className="flex items-center gap-1 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <CheckCircle2 size={11} />
            {resolvingId === d._id ? "…" : "Resolve"}
          </button>
        ) : (
          <span className="text-xs text-green-600 font-semibold">✓ Resolved</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-black">Disputes ({disputes.length})</h2>
        <div className="flex gap-2">
          <div className="rounded-xl bg-amber-100 text-amber-700 px-4 py-1.5 text-sm font-bold">
            {openCount} Open
          </div>
          <div className="rounded-xl bg-green-100 text-green-700 px-4 py-1.5 text-sm font-bold">
            {resolvedCount} Resolved
          </div>
          <div className="rounded-xl bg-gray-100 text-gray-600 px-4 py-1.5 text-sm font-bold">
            {revertedCount} Reverted
          </div>
        </div>
      </div>
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-48">
          <SearchBar value={q} onChange={setQ} placeholder="Search by project, user, or role…" />
        </div>
        <div className="flex gap-2">
          {["all", "open", "resolved", "reverted"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                statusFilter === s ? "bg-black text-white" : "bg-black/8 text-black/60 hover:bg-black/15"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <Table cols={cols} rows={sorted} onRow={setSelected} />
      {selected && (
        <DisputeDetailModal
          dispute={selected}
          users={users}
          adminUser={adminUser}
          onClose={() => setSelected(null)}
          onResolved={() => setSelected((prev) => prev ? { ...prev, status: "resolved" } : null)}
        />
      )}
    </div>
  );
}

// ─── nav items ───────────────────────────────────────────────────────────────

const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "projects", label: "Projects", icon: Briefcase },
  { id: "gigs", label: "Completed Gigs", icon: CheckCircle },
  { id: "notifs", label: "Notifications", icon: Bell },
  { id: "disputes", label: "Disputes", icon: Scale },
];

// ─── main page ───────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [activeSection, setActiveSection] = useState("overview");
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [gigs, setGigs] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Access guard
  useEffect(() => {
    if (user !== undefined && (!user || user.email !== ADMIN_EMAIL)) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  // Firestore listeners
  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) return;

    const unsubs = [];

    // Users
    unsubs.push(
      onSnapshot(collection(db, "users"), (snap) => {
        setUsers(snap.docs.map((d) => ({ _id: d.id, ...d.data() })));
      })
    );

    // Projects
    unsubs.push(
      onSnapshot(
        query(collection(db, "projects"), orderBy("createdAt", "desc")),
        (snap) => {
          setProjects(snap.docs.map((d) => ({ _id: d.id, ...d.data() })));
        }
      )
    );

    // Notifications
    unsubs.push(
      onSnapshot(collection(db, "notifications"), (snap) => {
        setNotifs(snap.docs.map((d) => ({ _id: d.id, ...d.data() })));
      })
    );

    // Disputes
    unsubs.push(
      onSnapshot(collection(db, "disputes"), (snap) => {
        setDisputes(snap.docs.map((d) => ({ _id: d.id, ...d.data() })));
      })
    );

    // Completed gigs — collectionGroup, deduplicated by projectId.
    // Each gig is stored under both the freelancer AND client user subcollection,
    // so we merge the two copies to get both UIDs, then keep one entry per project.
    getDocs(collectionGroup(db, "completedGigs"))
      .then((snap) => {
        const projectMap = new Map();
        snap.docs.forEach((d) => {
          const ownerUid = d.ref.parent.parent.id;
          const data = d.data();
          const key = data.projectId ?? d.id;
          if (!projectMap.has(key)) {
            const entry = { _id: key, ...data };
            if (data.role === "client") entry.clientUid = ownerUid;
            else entry.freelancerUid = ownerUid;
            projectMap.set(key, entry);
          } else {
            const existing = projectMap.get(key);
            if (data.role === "client") existing.clientUid = ownerUid;
            else existing.freelancerUid = ownerUid;
          }
        });
        setGigs(Array.from(projectMap.values()));
      })
      .catch(() => setGigs([]))
      .finally(() => setLoading(false));

    setLoading(false);

    return () => unsubs.forEach((u) => u());
  }, [user]);

  if (!user || user.email !== ADMIN_EMAIL) return null;

  return (
    <div className="min-h-screen bg-[#f7f7f7] flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-black text-white flex flex-col min-h-screen sticky top-0 h-screen">
        <div className="px-5 py-6 border-b border-white/10">
          <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-1">Admin Panel</p>
          <p className="text-lg font-bold">GigProof</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ id, label, icon: Icon }) => {
            const openDisputeCount = id === "disputes"
              ? disputes.filter((d) => d.status === "open").length
              : 0;
            return (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors text-left ${
                  activeSection === id
                    ? "bg-white text-black"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                <div className="relative shrink-0">
                  <Icon size={16} />
                  {openDisputeCount > 0 && activeSection !== "disputes" && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-white">
                      {openDisputeCount > 9 ? "9+" : openDisputeCount}
                    </span>
                  )}
                </div>
                {label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            <ArrowLeft size={15} />
            Back to App
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-black/40 text-sm animate-pulse">Loading data…</div>
            </div>
          ) : (
            <>
              {activeSection === "overview" && (
                <OverviewSection users={users} projects={projects} gigs={gigs} notifs={notifs} />
              )}
              {activeSection === "users" && (
                <UsersSection users={users} projects={projects} gigs={gigs} />
              )}
              {activeSection === "projects" && (
                <ProjectsSection projects={projects} users={users} />
              )}
              {activeSection === "gigs" && (
                <GigsSection gigs={gigs} users={users} />
              )}
              {activeSection === "notifs" && (
                <NotifsSection notifs={notifs} users={users} />
              )}
              {activeSection === "disputes" && (
                <DisputesSection disputes={disputes} users={users} adminUser={user} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
