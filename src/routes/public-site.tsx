import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { SitePanel } from "@/components/SitePanel";
import { useAuth } from "@/lib/auth-context";
import { canAccess } from "@/lib/access";

export const Route = createFileRoute("/public-site")({
  component: PublicSitePage,
  head: () => ({
    meta: [
      { title: "Public Site Editor · LEMSA PMS" },
      { name: "description", content: "Edit the words and photos shown on the public website: home, about us, services and contacts." },
      { property: "og:title", content: "Public Site Editor · LEMSA PMS" },
      { property: "og:description", content: "Edit the words and photos shown on the public website." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PublicSitePage() {
  const { profile, loading } = useAuth();
  const denied = !loading && profile && !canAccess(profile, "public_site");
  return (
    <AppShell title="Public Site" subtitle="Words and photos shown on the public website">
      {denied ? (
        <p className="text-destructive font-semibold">You don't have permission to access this page.</p>
      ) : (
        <SitePanel />
      )}
    </AppShell>
  );
}
