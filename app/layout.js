import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../app/context/AuthContext";
import { CurrencyProvider } from "../app/context/CurrencyContext";
import SolanaProvider from "../app/context/SolanaProvider";
import { ToastProvider } from "../app/context/ToastContext";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata = {
  title: "Gig-Proof",
  description: "Work it. Prove it. Own it.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={spaceGrotesk.className}>
      <body className="min-h-screen flex flex-col">
        <AuthProvider>
          <SolanaProvider>
            <CurrencyProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </CurrencyProvider>
          </SolanaProvider>
        </AuthProvider>
      </body>
    </html>
  );
}