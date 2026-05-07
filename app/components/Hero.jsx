import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden">

      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://itmunch.com/wp-content/uploads/2024/07/Freelancing-1200x675.jpg')",
        }}
      />

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen items-center">
        <div className="container mx-auto px-6 lg:px-12">
          <div className="max-w-3xl">

            <div className="badge badge-outline text-white border-white/30 mt-6 lg:mt-0 mb-6">
              Blockchain-Powered Gig Marketplace
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-tight text-white">
              Work it.
              <br />
              Prove it.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">
                Own it.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base sm:text-lg text-white/75 leading-relaxed">
              A decentralised marketplace for student freelancers — with Solana escrow payments,
              AI-powered matching, and on-chain reputation you actually own.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link
                href="/auth"
                className="btn bg-white text-black border-none px-8 hover:bg-white/90"
              >
                Get Started
              </Link>
              <Link
                href="/auth"
                className="btn btn-outline border-white/50 text-white hover:bg-white hover:text-black hover:border-white px-8"
              >
                Browse Jobs
              </Link>
            </div>

            <div className="mt-12 grid grid-cols-3 gap-6 max-w-md">
              <div>
                <h3 className="text-2xl font-bold text-white">100%</h3>
                <p className="text-sm text-white/60 mt-0.5">Secure Escrow</p>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">0%</h3>
                <p className="text-sm text-white/60 mt-0.5">Freelancer Fees</p>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Web3</h3>
                <p className="text-sm text-white/60 mt-0.5">Native Payments</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
