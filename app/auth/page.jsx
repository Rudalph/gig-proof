"use client";

import React, { useState } from "react";
import SigninPage from "../components/Signin";
import SignupPage from "../components/Signup";

export default function Auth() {
    const [isLogin, setIsLogin] = useState(true);

    return (
        <div className="min-h-screen bg-white flex items-center justify-center px-4">
          <div className="w-full max-w-4xl grid md:grid-cols-2 bg-white border border-black/10 rounded-3xl shadow-sm overflow-hidden">
            
            {/* Left Side */}
            <div className="hidden md:flex flex-col justify-center bg-black text-white p-10">
              <h1 className="text-3xl font-semibold mb-3">Welcome</h1>
              <p className="text-white/70 leading-relaxed">
                Solana Powered Gig Marketplace with On-Chain Work Identity and USDC Escrow
              </p>
            </div>
      
            {/* Right Side */}
            <div className="p-6 md:p-10 flex flex-col justify-center">
              <div className="mb-8 flex justify-center">
                <div className="inline-flex rounded-2xl border border-black/10 p-1 bg-black/5">
                  <button
                    onClick={() => setIsLogin(true)}
                    className={`px-5 py-2.5 rounded-xl text-sm font-medium transition ${
                      isLogin
                        ? "bg-black text-white"
                        : "text-black hover:bg-black/10"
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => setIsLogin(false)}
                    className={`px-5 py-2.5 rounded-xl text-sm font-medium transition ${
                      !isLogin
                        ? "bg-black text-white"
                        : "text-black hover:bg-black/10"
                    }`}
                  >
                    Sign Up
                  </button>
                </div>
              </div>
      
              <div className="w-full">
                {isLogin ? <SigninPage /> : <SignupPage />}
              </div>
            </div>
          </div>
        </div>
      );
}