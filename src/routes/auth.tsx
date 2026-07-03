import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ensureDirector, resolveUsername } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useSiteBranding } from "@/lib/site-branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Pill } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const ensure = useServerFn(ensureDirector);
  const resolve = useServerFn(resolveUsername);
  const navigate = useNavigate();
  const { refresh, profile } = useAuth();
  const branding = useSiteBranding();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { ensure({}).catch(() => {}); }, [ensure]);
  useEffect(() => {
    if (!profile) return;
    if (profile.is_director) navigate({ to: "/director" });
    else if (profile.role === "admin") navigate({ to: "/admin" });
    else if (profile.role === "inventory") navigate({ to: "/inventory" });
    else if (profile.role === "accountant") navigate({ to: "/accountant" });
    else if ((profile.role as string) === "order_track") navigate({ to: "/order-track" });
    else if (profile.role === "buyer") navigate({ to: "/buyer" });
    else navigate({ to: "/pharmacy" });
  }, [profile, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { email } = await resolve({ data: { username } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await refresh();
      toast.success("Welcome to LEMSA");
    } catch (err) {
      toast.error((err as Error).message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/20 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
            <Pill className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">LEMSA Pharmacy</CardTitle>
          <p className="text-sm text-muted-foreground">Management System</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username or email</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
            <div className="text-center">
              <Link to="/" className="text-xs text-muted-foreground hover:underline">← Back to public site</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
