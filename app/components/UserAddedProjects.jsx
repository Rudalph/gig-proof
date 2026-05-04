"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "../context/AuthContext";

export default function UserAddedProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    if (!user) return;

    const projectsRef = collection(db, "users", user.uid, "projectsAdded");

    const q = query(projectsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setProjects(projectList);
    });

    return () => unsubscribe();
  }, [user]);

  if (!user) return null;

  return (
    <div className="mt-8">
      <h2 className="mb-4 text-xl font-semibold">Your Projects</h2>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-black/10 p-6 text-center text-black/60">
          No projects added yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold">{project.title}</h3>
                <span className="rounded-full bg-black px-3 py-1 text-xs text-white">
                  {project.status}
                </span>
              </div>

              <p className="mb-4 line-clamp-3 text-sm text-black/60">
                {project.description}
              </p>

              <div className="mb-4 flex flex-wrap gap-2">
                {project.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-black/10 px-3 py-1 text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="space-y-1 text-sm text-black/70">
                <p>
                  <span className="font-medium text-black">Budget:</span>{" "}
                  {project.budget || "Not specified"}
                </p>
                <p>
                  <span className="font-medium text-black">Category:</span>{" "}
                  {project.category}
                </p>
                <p>
                  <span className="font-medium text-black">Deadline:</span>{" "}
                  {project.deadline || "Not specified"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}