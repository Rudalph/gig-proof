// import Link from "next/link";

// export default function Hero() {
//   return (
//     <section className="relative min-h-screen overflow-hidden">
//       {/* Background Image */}
//       <div
//         className="absolute inset-0 bg-cover bg-center opacity-80"
//         style={{
//           backgroundImage:
//             "url('https://itmunch.com/wp-content/uploads/2024/07/Freelancing-1200x675.jpg')",
//         }}
//       />

//       {/* Dark Gradient Overlay */}
//       <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-orange-100/20" />

//       {/* Decorative Blobs */}
//       <div className="absolute top-20 left-10 h-40 w-40 rounded-full bg-orange-400/20 blur-3xl" />
//       <div className="absolute bottom-20 right-10 h-52 w-52 rounded-full bg-red-500/20 blur-3xl" />

//       {/* Content */}
//       <div className="relative z-10 flex min-h-screen items-center">
//         <div className="container mx-auto px-6 lg:px-12">
//           <div className="max-w-3xl">
//             <div className="badge badge-lg bg-orange-100 text-orange-700 border-orange-200 mb-6">
//               Blockchain Powered Marketplace
//             </div>

//             <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-tight text-gray-950">
//               Hire Talent.
//               <br />
//               Work Securely.
//               <br />
//               <span className="text-transparent bg-clip-text bg-white from-orange-600 to-red-600">
//                 Get Paid with Trust.
//               </span>
//             </h1>

//             {/* <p className="mt-6 max-w-2xl text-base sm:text-lg text-gray-600 leading-relaxed">
//               A decentralized freelancing marketplace where clients and
//               freelancers connect, collaborate, and complete projects with
//               secure blockchain-based payments and transparent agreements.
//             </p> */}

//             <div className="mt-8 flex flex-col sm:flex-row gap-4">
//               <Link
//                 href="/auth"
//                 className="btn bg-black text-white border-none px-8"
//               >
//                 Get Started
//               </Link>

//               <Link
//                 href="/marketplace"
//                 className="btn btn-outline border-black text-black hover:bg-black hover:border-black hover:text-white px-8"
//               >
//                 Explore Marketplace
//               </Link>
//             </div>

//             <div className="mt-10 grid grid-cols-3 gap-4 max-w-xl">
//               <div>
//                 <h3 className="text-2xl font-bold text-gray-950">100%</h3>
//                 <p className="text-sm text-gray-500">Secure Escrow</p>
//               </div>

//               <div>
//                 <h3 className="text-2xl font-bold text-gray-950">24/7</h3>
//                 <p className="text-sm text-gray-500">Global Access</p>
//               </div>

//               <div>
//                 <h3 className="text-2xl font-bold text-gray-950">Web3</h3>
//                 <p className="text-sm text-gray-500">Smart Payments</p>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </section>
//   );
// }

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

      {/* Dark Overlay (for readability) */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Subtle Light Gradient (left focus for text) */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />

      {/* Decorative Blobs (very subtle) */}
      <div className="absolute top-20 left-10 h-40 w-40 rounded-full bg-white/5 blur-3xl" />
      <div className="absolute bottom-20 right-10 h-52 w-52 rounded-full bg-white/5 blur-3xl" />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen items-center">
        <div className="container mx-auto px-6 lg:px-12">
          <div className="max-w-3xl">

            {/* Badge */}
            <div className="badge badge-outline text-white border-white/30 lg:mt-0 mt-6 mb-6">
              Blockchain Powered Marketplace
            </div>

            {/* Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-tight text-white">
              Hire Talent.
              <br />
              Work Securely.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300">
                Get Paid with Trust.
              </span>
            </h1>

            {/* Description */}
            <p className="mt-6 max-w-2xl text-base sm:text-lg text-white/80 leading-relaxed">
              A decentralized freelancing marketplace where clients and
              freelancers connect, collaborate, and complete projects with
              secure blockchain-based payments and transparent agreements.
            </p>

            {/* Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link
                href="/auth"
                className="btn bg-white text-black border-none px-8 hover:bg-gray-200"
              >
                Get Started
              </Link>

              <Link
                href="/marketplace"
                className="btn btn-outline border-white text-white hover:bg-white hover:text-black px-8"
              >
                Explore Marketplace
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-10 grid grid-cols-3 gap-6 max-w-xl">
              <div>
                <h3 className="text-2xl font-bold text-white">100%</h3>
                <p className="text-sm text-white/70">Secure Escrow</p>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-white">24/7</h3>
                <p className="text-sm text-white/70">Global Access</p>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-white">Web3</h3>
                <p className="text-sm text-white/70">Smart Payments</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}