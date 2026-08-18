"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";
import { DEMO_SESSION_COOKIE } from "@/lib/demo/data";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signupSchema = credentialsSchema.extend({
  name: z.string().min(1),
});

export type AuthActionState = { error?: string; message?: string } | null;

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter a valid email and a password of at least 6 characters." };
  }

  if (!isSupabaseConfigured) {
    // Preview mode: any valid credentials sign you into the demo shell.
    const cookieStore = await cookies();
    cookieStore.set(DEMO_SESSION_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    const next = formData.get("next");
    redirect(typeof next === "string" && next.startsWith("/") ? next : "/dashboard");
  }

  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Supabase is not configured." };

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: error.message === "Invalid login credentials" ? "Incorrect email or password." : error.message };
  }

  const next = formData.get("next");
  redirect(typeof next === "string" && next.startsWith("/") ? next : "/dashboard");
}

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter your name, a valid email, and a password of at least 6 characters." };
  }

  if (!isSupabaseConfigured) {
    const cookieStore = await cookies();
    cookieStore.set(DEMO_SESSION_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    redirect("/dashboard");
  }

  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Supabase is not configured." };

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name } },
  });

  if (error) return { error: error.message };

  // If email confirmation is required, auto-confirm via service role
  if (!data.session && data.user && !data.user.confirmed_at) {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const serviceClient = createServiceClient();
    if (serviceClient) {
      await serviceClient.auth.admin.updateUserById(data.user.id, {
        email_confirm: true,
      });
    }
    // Now sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (signInError) {
      return { message: "Account created. You can now sign in." };
    }
    redirect("/dashboard");
  }

  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createServerSupabase();
  if (supabase) await supabase.auth.signOut();
  redirect("/login");
}
