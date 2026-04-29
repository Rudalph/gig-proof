import Hero from "./components/Hero";
import Navbar from "./components/Navbar";

export default function Home() {
  return (
    <div>
      <Navbar />
      <main className="pt-16">
       <Hero />
      </main>
    </div>
  );
}
