import type { Metadata } from "next";
import { Shield, Sparkles } from "lucide-react";
import { SignupForm } from "@/components/auth/signup-form";
import { isSupabaseConfigured } from "@/lib/config";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  const preview = !isSupabaseConfigured;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold">Create account</h1>
          <p className="text-sm text-muted-foreground">
            First account automatically becomes SUPER_ADMIN
          </p>
        </div>
        {preview && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              <strong className="font-semibold text-foreground">Preview mode.</strong> No account
              is created — this is a visual demo with sample data.
            </span>
          </div>
        )}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <SignupForm />
        </div>
      </div>
    </div>
  );
}
