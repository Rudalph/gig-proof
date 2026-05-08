"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "./AuthContext";

const CurrencyContext = createContext(null);

const CACHE_KEY = "gp_fx_rates";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export const DISPLAY_CURRENCIES = [
  { code: "EUR", label: "Euro (€)", symbol: "€" },
  { code: "USD", label: "US Dollar ($)", symbol: "$" },
  { code: "GBP", label: "British Pound (£)", symbol: "£" },
  { code: "INR", label: "Indian Rupee (₹)", symbol: "₹" },
  { code: "JPY", label: "Japanese Yen (¥)", symbol: "¥" },
  { code: "CAD", label: "Canadian Dollar (CA$)", symbol: "CA$" },
  { code: "AUD", label: "Australian Dollar (A$)", symbol: "A$" },
  { code: "SGD", label: "Singapore Dollar (S$)", symbol: "S$" },
  { code: "CHF", label: "Swiss Franc (CHF)", symbol: "CHF " },
  { code: "BRL", label: "Brazilian Real (R$)", symbol: "R$" },
  { code: "MXN", label: "Mexican Peso (MX$)", symbol: "MX$" },
  { code: "KRW", label: "Korean Won (₩)", symbol: "₩" },
];

const SYMBOLS = Object.fromEntries(
  DISPLAY_CURRENCIES.map(({ code, symbol }) => [code, symbol])
);

const CRYPTO = new Set(["USDC", "SOL"]);

// Approximate fallback rates (EUR base) used instantly on first render.
// Real rates from the API replace these silently in the background.
const FALLBACK_RATES = {
  EUR: 1, USD: 1.08, GBP: 0.85, INR: 95.5, JPY: 163,
  CAD: 1.47, AUD: 1.65, SGD: 1.46, CHF: 0.94,
  BRL: 5.85, MXN: 18.2, KRW: 1450,
};

async function fetchRates() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { rates, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL) {
        console.log("[CurrencyContext] Rates loaded from cache:", rates);
        return rates;
      }
    }
    const res = await fetch("/api/rates");
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rates: data, timestamp: Date.now() }));
    console.log("[CurrencyContext] Live rates loaded from API:", data);
    return data;
  } catch {
    return null;
  }
}

function computeFormatBudget(amount, fromCurrency, defaultCurrency, rates) {
  if (!amount) return "Not specified";
  const num = parseFloat(amount);
  if (isNaN(num) || num === 0) return "Not specified";

  const currency = fromCurrency || "USD";
  const sym = SYMBOLS[currency] || "";
  const original = `${sym}${num.toLocaleString()} ${currency}`.trim();

  if (currency === defaultCurrency || CRYPTO.has(currency)) return original;

  const rateFrom = currency === "EUR" ? 1 : rates[currency];
  const rateTo = defaultCurrency === "EUR" ? 1 : rates[defaultCurrency];
  if (!rateFrom || !rateTo) return original;

  const converted = (num / rateFrom) * rateTo;
  const defSym = SYMBOLS[defaultCurrency] || defaultCurrency + " ";
  const convertedStr = converted < 1
    ? converted.toFixed(2)
    : Math.round(converted).toLocaleString();

  return `${original} (${defSym}${convertedStr})`;
}

export function CurrencyProvider({ children }) {
  const { user } = useAuth();
  const [defaultCurrency, setDefaultCurrency] = useState("EUR");
  const [rates, setRates] = useState(FALLBACK_RATES);
  const [currencySaving, setCurrencySaving] = useState(false);

  useEffect(() => {
    fetchRates().then((r) => { if (r) setRates(r); });
  }, []);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "userSettings", user.uid)).then((snap) => {
      if (snap.exists() && snap.data().defaultCurrency) {
        setDefaultCurrency(snap.data().defaultCurrency);
      }
    });
  }, [user]);

  const updateDefaultCurrency = async (currency) => {
    setDefaultCurrency(currency);
    if (!user) return;
    setCurrencySaving(true);
    try {
      await setDoc(
        doc(db, "userSettings", user.uid),
        { defaultCurrency: currency, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error("Failed to save default currency:", err);
    } finally {
      setCurrencySaving(false);
    }
  };

  return (
    <CurrencyContext.Provider value={{ defaultCurrency, updateDefaultCurrency, rates, currencySaving }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}

export { computeFormatBudget as formatBudget };
