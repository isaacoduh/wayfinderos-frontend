import { AppShell } from "@/components/app-shell";
import { AccountPage } from "@/components/account-page";
export default function SettingsPage() {
  return (
    <AppShell>
      <AccountPage type="settings" />
    </AppShell>
  );
}
