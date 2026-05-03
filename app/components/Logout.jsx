"use client";

import { auth } from "@/app/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      alert("Logged out successfully!");
      router.push("/auth");
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  return (
    <button onClick={handleLogout} className="">
      Logout
    </button>
  );
}