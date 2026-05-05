"use client";

export default function ToggleRow({ title, description, enabled, onClick }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-black/5 px-4 py-4">
      <div>
        <h3 className="font-medium text-black">{title}</h3>
        <p className="text-sm text-black/60">{description}</p>
      </div>

      <button
        type="button"
        onClick={onClick}
        className={`relative h-7 w-12 rounded-full transition ${
          enabled ? "bg-black" : "bg-black/20"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
            enabled ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}