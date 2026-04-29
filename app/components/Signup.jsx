"use client";

import { useState } from "react";
import { auth } from "../lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleSignup = async (e) => {
    e.preventDefault();

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert("Signup successful!");
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  return (
    <div className="flex items-center justify-center">
      <form onSubmit={handleSignup} className="w-full max-w-md p-6 space-y-4 bg-base-200 rounded-xl shadow">
        <h1 className="text-2xl font-bold">Sign Up</h1>

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
          Create Account
        </button>
      </form>
    </div>
  );
}