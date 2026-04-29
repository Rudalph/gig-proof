"use client";

import { useState } from "react";
import { auth } from "@/app/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function SigninPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleSignin = async (e) => {
    e.preventDefault();

    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert("Signin successful!");

      const adminEmails = [
        "admin@gmail.com"
      ];
      if (adminEmails.includes(email)) {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  return (
    <div className="flex items-center justify-center">
      <form onSubmit={handleSignin} className="w-full max-w-md p-6 space-y-4 bg-base-200 rounded-xl shadow">
        <h1 className="text-2xl font-bold">Sign In</h1>

        <input
          type="email"
          placeholder="Email"
          className="input input-bordered w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="input input-bordered w-full"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" className="btn btn-neutral w-full">
          Sign In
        </button>
      </form>
    </div>
  );
}