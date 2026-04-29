import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../app/context/AuthContext";

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
        {children}
        </AuthProvider>
      </body>
    </html>
  );
}