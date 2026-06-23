import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Pill } from "lucide-react";
import heroImg from "@/assets/pharmacy-hero.jpg";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { loading, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (profile) {
      if (profile.role === "admin") navigate({ to: "/admin" });
      else if (profile.role === "inventory") navigate({ to: "/inventory" });
      else navigate({ to: "/pharmacy" });
    }
  }, [loading, profile, navigate]);

  if (loading || profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">LEMSA Pharmacy Management System</h1>
          <p className="mt-3 text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Hero Image */}
      <img
        src={heroImg}
        alt="Pharmacist attending to a client at the pharmacy counter"
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Pill className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-white">LEMSA</div>
            <div className="text-[10px] uppercase tracking-wider text-white/70">Pharmacy MS</div>
          </div>
        </div>
        <Link to="/auth">
          <Button variant="outline" className="bg-white/10 text-white border-white/30 hover:bg-white/20 hover:text-white">
            Login
          </Button>
        </Link>
      </div>

      {/* Hero Text */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight drop-shadow-lg">
          LEMSA Pharmacy
        </h1>
        <p className="mt-4 text-lg sm:text-xl text-white/90 max-w-2xl drop-shadow-md">
          Comprehensive management system for inventory, sales, and pharmacy operations.
        </p>
        <div className="mt-8 flex gap-4">
          <Link to="/auth">
            <Button size="lg" className="px-8">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
