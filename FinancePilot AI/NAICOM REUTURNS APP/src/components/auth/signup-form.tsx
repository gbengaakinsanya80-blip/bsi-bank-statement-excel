"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { signUpAction, type AuthActionState } from "@/lib/auth/actions";

const initialState: AuthActionState = null;

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state && "error" in state && state.error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}
      {state && "message" in state && state.message && (
        <div className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
          {state.message}
        </div>
      )}
      <Field label="Full name">
        <Input name="name" autoComplete="name" placeholder="Ada Obi" required />
      </Field>
      <Field label="Email">
        <Input type="email" name="email" autoComplete="email" placeholder="you@worldmark.com" required />
      </Field>
      <Field label="Password">
        <Input type="password" name="password" autoComplete="new-password" placeholder="At least 6 characters" required />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Create account
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
