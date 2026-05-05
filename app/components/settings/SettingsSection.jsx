"use client";

export default function SettingsSection({ title, children }) {
  return (
    <section className="bg-white border border-black/10 rounded-3xl shadow-sm p-6">
      <h2 className="text-xl font-semibold text-black mb-4">{title}</h2>
      {children}
    </section>
  );
}
