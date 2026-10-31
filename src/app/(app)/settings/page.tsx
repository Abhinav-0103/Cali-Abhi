import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { DisclaimerFooter } from "@/components/disclaimer";
import { SignOutButton } from "@/components/sign-out-button";
import { InstallApp } from "@/components/pwa/install-app";
import { DeleteAccount } from "@/components/settings/delete-account";
import { UnitsSetting } from "@/components/settings/units-setting";
import { getProfile } from "@/lib/auth/session";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, profile } = await getProfile();
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ThemeToggle />
          <UnitsSetting initial={profile.unit_system as "metric" | "imperial"} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Install the app</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Add CaliCoach to your home screen for a full-screen app that works offline during workouts.
          </p>
          <InstallApp />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
          <SignOutButton />
          <Separator />
          <DeleteAccount />
        </CardContent>
      </Card>
      <DisclaimerFooter />
    </main>
  );
}
