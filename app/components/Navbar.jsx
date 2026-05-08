"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const textClass = scrolled ? "text-black" : "text-white";
  const hoverClass = scrolled ? "hover:text-black/50" : "hover:text-white/60";

  return (
    <nav className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
      scrolled ? "bg-white/95 backdrop-blur-sm shadow-sm" : "bg-transparent"
    }`}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className={`text-xl font-bold tracking-tight ${textClass}`}>
          GigProof
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#how-it-works" className={`text-sm font-medium transition ${textClass} ${hoverClass}`}>
            How it Works
          </a>
          <a href="#features" className={`text-sm font-medium transition ${textClass} ${hoverClass}`}>
            Features
          </a>
          <a href="#for-who" className={`text-sm font-medium transition ${textClass} ${hoverClass}`}>
            Who is it for?
          </a>
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/auth"
            className={`text-sm font-medium transition ${textClass} ${hoverClass}`}
          >
            Sign In
          </Link>
          <Link
            href="/auth"
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              scrolled
                ? "bg-black text-white hover:bg-black/80"
                : "bg-white text-black hover:bg-white/90"
            }`}
          >
            Get Started
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className={`md:hidden transition ${textClass}`}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-black/10 px-6 py-5 flex flex-col gap-4">
          <a
            href="#how-it-works"
            className="text-sm font-medium text-black"
            onClick={() => setMenuOpen(false)}
          >
            How it Works
          </a>
          <a
            href="#features"
            className="text-sm font-medium text-black"
            onClick={() => setMenuOpen(false)}
          >
            Features
          </a>
          <a
            href="#for-who"
            className="text-sm font-medium text-black"
            onClick={() => setMenuOpen(false)}
          >
            Who is it for?
          </a>
          <hr className="border-black/10" />
          <Link href="/auth" className="text-sm font-medium text-black">
            Sign In
          </Link>
          <Link
            href="/auth"
            className="rounded-xl bg-black text-white px-4 py-2.5 text-sm font-semibold text-center"
          >
            Get Started
          </Link>
        </div>
      )}
    </nav>
  );
}
