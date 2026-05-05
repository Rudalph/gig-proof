"use client";

import useSettings from "./useSettings";
import SettingsSection from "./SettingsSection";
import ToggleRow from "./ToggleRow";
import DeleteAccountModal from "./DeleteAccountModal";

export default function Settings() {
  const {
    user,
    settings,
    loading,
    saving,
    showDelete,
    confirmText,
    password,
    deleting,
    setShowDelete,
    setConfirmText,
    setPassword,
    handleToggle,
    handleSave,
    handleLogout,
    handleCancelDelete,
    handleDeleteAccount,
  } = useSettings();

  if (loading) {
    return <p className="text-black/60">Loading settings...</p>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-black">Settings</h1>
        <p className="text-black/60 mt-1">
          Manage your account, notifications, and privacy preferences.
        </p>
      </div>

      <div className="space-y-6">
        <SettingsSection title="Account">
          <div className="flex items-center justify-between rounded-2xl bg-black/5 px-4 py-3">
            <span className="text-sm text-black/60">Email</span>
            <span className="text-sm font-medium text-black">
              {user?.email || "Not available"}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="mt-4 px-5 py-2.5 rounded-xl bg-black text-white text-sm font-medium hover:bg-black/80 transition"
          >
            Logout
          </button>
        </SettingsSection>

        <SettingsSection title="Notifications">
          <div className="space-y-4">
            <ToggleRow
              title="Project Updates"
              description="Receive alerts about project activity."
              enabled={settings.projectUpdates}
              onClick={() => handleToggle("projectUpdates")}
            />

            <ToggleRow
              title="Payment Alerts"
              description="Receive notifications about USDC escrow and payments."
              enabled={settings.paymentAlerts}
              onClick={() => handleToggle("paymentAlerts")}
            />

            <ToggleRow
              title="Message Alerts"
              description="Receive notifications for new messages."
              enabled={settings.messageAlerts}
              onClick={() => handleToggle("messageAlerts")}
            />
          </div>
        </SettingsSection>

        <SettingsSection title="Privacy">
          <div className="space-y-4">
            <ToggleRow
              title="Public Profile"
              description="Allow other users to view your profile."
              enabled={settings.publicProfile}
              onClick={() => handleToggle("publicProfile")}
            />

            <ToggleRow
              title="Show Wallet Address"
              description="Display your wallet address on your public profile."
              enabled={settings.showWalletAddress}
              onClick={() => handleToggle("showWalletAddress")}
            />
          </div>
        </SettingsSection>

        <section className="bg-white border border-red-200 rounded-3xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-red-600 mb-2">
            Danger Zone
          </h2>

          <p className="text-sm text-black/60 mb-4">
            This will permanently delete your account and saved data.
          </p>

          <button
            onClick={() => setShowDelete(true)}
            className="px-5 py-2.5 rounded-xl bg-red-100 text-red-500 text-sm font-medium"
          >
            Delete Account
          </button>
        </section>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-black text-white text-sm font-medium hover:bg-black/80 transition disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {showDelete && (
        <DeleteAccountModal
          confirmText={confirmText}
          setConfirmText={setConfirmText}
          password={password}
          setPassword={setPassword}
          deleting={deleting}
          onCancel={handleCancelDelete}
          onConfirm={handleDeleteAccount}
        />
      )}
    </div>
  );
}