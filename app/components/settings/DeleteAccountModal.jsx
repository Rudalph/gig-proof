"use client";

export default function DeleteAccountModal({
  confirmText,
  setConfirmText,
  password,
  setPassword,
  deleting,
  onCancel,
  onConfirm,
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-red-600 mb-2">
          Delete Account
        </h2>

        <p className="text-sm text-black/60 mb-4">
          This action is permanent. Type <b>DELETE</b> and enter your password
          to confirm.
        </p>

        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="Type DELETE"
          className="w-full border border-black/10 rounded-xl px-4 py-2 mb-4 outline-none"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          className="w-full border border-black/10 rounded-xl px-4 py-2 mb-4 outline-none"
        />

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-black/10"
          >
            Cancel
          </button>

          <button
            disabled={confirmText !== "DELETE" || !password || deleting}
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-red-500 text-white disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Confirm Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}