"use client";

import { auth } from "@/app/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useToast } from "../context/ToastContext";

export default function LogoutButton() {
  const router = useRouter();
  const toast = useToast();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/auth");
    } catch (error) {
      console.error(error);
      toast(error.message, "error");
    }
  };

  return (
    <button onClick={handleLogout} className="">
      Logout
    </button>
  );
}
