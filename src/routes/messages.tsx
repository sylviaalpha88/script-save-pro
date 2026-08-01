import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { MessagesPanel } from "@/components/MessagesPanel";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/messages")({
  component: MessagesPage,
  head: () => ({
    meta: [
      { title: "Messages · LEMSA LPMS" },
      { name: "description", content: "Send SMS updates to registered wholesale buyers from your pharmacy." },
      { property: "og:title", content: "Messages · LEMSA LPMS" },
      { property: "og:description", content: "Send SMS updates to registered wholesale buyers from your pharmacy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function MessagesPage() {
  const { profile, loading } = useAuth();
  const denied = !loading && profile && (profile.is_director || profile.role === "buyer");
  return (
    <AppShell title="Messages" subtitle="Send SMS to registered wholesale buyers">
      {denied ? (
        <p className="text-destructive font-semibold">You don't have permission to access this page.</p>
      ) : (
        <MessagesPanel />
      )}
    </AppShell>
  );
}
