"use client"

import React from "react";
import Sidebar from "../components/Sidebar"
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function Dashboard () {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.replace("/auth");
    }
  }, [user, router]);

  if (!user) {
    return null;
  }
    return (
        <div>
            <Sidebar />
            Dashboard
        </div>
    )
}