import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useState, useEffect } from "react";
import { Eye, EyeOff, ArrowUpRight, Loader2, Mail, RotateCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { HeroConstellation } from "@/components/HeroConstellation";
import { setDemo, useDemo } from "@/lib/store";
import { getSupabase } from "@/lib/supabase/client";
import {
  signInUser,
  signUpUser,
  signInWithGoogle,
  resetPasswordForEmail,
  resendConfirmationEmail,
  registerSchema,
  loginSchema,
} from "@/services/auth";
import { fetchProfile } from "@/services/profiles";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Cesium" },
      { name: "description", content: "Sign in or create a Cesium account." },
      { property: "og:title", content: "Sign in — Cesium" },
      { property: "og:description", content: "Your people are still here." },
    ],
  }),
  component: Auth,
});

type Errs = {
  name?: string | undefined;
  email?: string | undefined;
  password?: string | undefined;
  confirm?: string | undefined;
  general?: string | undefined;
};
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  valid,
  disabled,
  toggle,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | undefined;
  valid?: boolean;
  disabled?: boolean;
  toggle?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="field" data-invalid={!!error} data-valid={!error && valid}>
      <input
        id={id}
        type={toggle ? (show ? "text" : "password") : type}
        placeholder=" "
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        autoComplete={toggle ? "current-password" : type === "email" ? "email" : "name"}
      />
      <label htmlFor={id}>{label}</label>
      <span className="line" />
      {toggle && (
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute bottom-2 right-0 p-1 text-muted-foreground hover:text-foreground"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      )}
      <AnimatePresence>
        {error && (
          <motion.p
            id={`${id}-err`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="label-mono mt-2 text-destructive"
          >
            ↳ {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function Auth() {
  const nav = useNavigate();
  const { session, onboarded } = useDemo();
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [f, setF] = useState({ name: "", email: "", password: "", confirm: "", remember: true });
  const [errors, setErrors] = useState<Errs>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Automatic redirect if session is detected (e.g. following OAuth redirect)
  useEffect(() => {
    if (session?.id) {
      nav({ to: onboarded ? "/discover" : "/onboarding" });
    }
  }, [session?.id, onboarded, nav]);

  // Listen for email confirmation link click in another tab/window
  useEffect(() => {
    if (!awaitingConfirmation) return;
    const sb = getSupabase();
    if (!sb) return;

    const { data: authListener } = sb.auth.onAuthStateChange((event, currentSession) => {
      if (
        (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED") &&
        currentSession?.user
      ) {
        toast.success("Email confirmed! Welcome to Cesium.");
        setDemo({
          session: {
            id: currentSession.user.id,
            name:
              (currentSession.user.user_metadata?.["display_name"] as string) ||
              confirmedEmail.split("@")[0] ||
              "Explorer",
            email: currentSession.user.email || confirmedEmail,
            demo: false,
          },
          onboarded: false,
        });
        nav({ to: "/onboarding" });
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [awaitingConfirmation, confirmedEmail, nav]);

  const set = (k: keyof typeof f) => (v: string) => {
    setF((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "", general: "" }));
  };

  const handleResend = async () => {
    if (!confirmedEmail) return;
    setResending(true);
    const res = await resendConfirmationEmail(confirmedEmail);
    setResending(false);
    if (res.success) {
      toast.success("Verification email resent. Check your inbox or spam folder.");
    } else {
      toast.error(res.error || "Failed to resend verification email.");
    }
  };

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setErrors({});
    const res = await signInWithGoogle();
    setBusy(false);

    if (res.error) {
      setErrors({ general: res.error });
      toast.error(res.error);
      return;
    }

    if (res.user) {
      setDone(true);
      setDemo({
        session: {
          id: res.user.id,
          name: res.user.displayName,
          email: res.user.email,
          demo: false,
        },
        onboarded: false,
      });
      toast.success("Signed in with Google!");
      setTimeout(() => nav({ to: "/onboarding" }), 600);
    } else if (res.url) {
      window.location.href = res.url;
    }
  };

  const handleForgotPassword = async () => {
    if (!emailOk(f.email)) {
      setErrors((e) => ({ ...e, email: "Enter your email address first" }));
      return;
    }
    setBusy(true);
    const res = await resetPasswordForEmail(f.email);
    setBusy(false);
    if (res.success) {
      toast.success(res.message);
    } else {
      toast.error(res.message);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (mode === "register") {
      const parsed = registerSchema.safeParse(f);
      if (!parsed.success) {
        const fieldErrors: Errs = {};
        parsed.error.errors.forEach((err) => {
          const path = err.path[0] as keyof Errs;
          if (path && !fieldErrors[path]) fieldErrors[path] = err.message;
        });
        setErrors(fieldErrors);
        return;
      }

      setBusy(true);
      const res = await signUpUser({ name: f.name.trim(), email: f.email, password: f.password });
      setBusy(false);

      if (res.error) {
        setErrors({
          general: res.error,
          email: res.error.includes("already registered") ? "Account already exists" : undefined,
        });
        toast.error(res.error);
        return;
      }

      if (res.needsConfirmation) {
        setAwaitingConfirmation(true);
        setConfirmedEmail(f.email);
        toast.info("Verification email sent! Please check your inbox.");
        return;
      }

      setDone(true);
      setDemo({
        session: {
          id: res.user?.id,
          name: res.user?.displayName || f.name.trim(),
          email: res.user?.email || f.email,
          demo: false,
        },
      });
      toast.success("Account created successfully!");
      setTimeout(() => nav({ to: "/onboarding" }), 650);
    } else {
      const parsed = loginSchema.safeParse(f);
      if (!parsed.success) {
        const fieldErrors: Errs = {};
        parsed.error.errors.forEach((err) => {
          const path = err.path[0] as keyof Errs;
          if (path && !fieldErrors[path]) fieldErrors[path] = err.message;
        });
        setErrors(fieldErrors);
        return;
      }

      setBusy(true);
      const res = await signInUser({ email: f.email, password: f.password });
      setBusy(false);

      if (res.error) {
        setErrors({ password: "Invalid email or password", general: res.error });
        toast.error(res.error);
        return;
      }

      setDone(true);
      let isOnboarded = false;
      if (res.user?.id) {
        const profile = await fetchProfile(res.user.id);
        if (profile) {
          isOnboarded = profile.onboarding_completed;
        }
      }
      setDemo({
        session: {
          id: res.user?.id,
          name: res.user?.displayName || f.email.split("@")[0] || "Friend",
          email: res.user?.email || f.email,
          demo: false,
        },
        onboarded: isOnboarded,
      });
      toast.success("Welcome back to Cesium!");
      setTimeout(() => nav({ to: isOnboarded ? "/discover" : "/onboarding" }), 650);
    }
  };

  return (
    <section data-hydrated={hydrated} className="grid min-h-[100svh] md:grid-cols-[58fr_42fr]">
      <div className="relative hidden overflow-hidden border-r border-border md:block">
        <motion.div
          className="absolute inset-0 p-10 pt-32"
          animate={{ rotate: mode === "login" ? 0 : -6, scale: mode === "login" ? 1 : 1.08 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <HeroConstellation />
        </motion.div>
        {/* Banner over constellation network above its previous location */}
        <div className="pointer-events-none absolute left-10 right-10 top-16 z-10">
          <p className="label-mono text-signal">CS / 055 — Access</p>
          <p className="display mt-4 text-[clamp(44px,5.5vw,88px)] leading-[0.95]">
            Different atoms.
            <br />
            <span className="text-outline">Unexpected bonds.</span>
          </p>
        </div>
      </div>

      <div className="gutter flex flex-col justify-center py-32 md:px-[5vw]">
        <AnimatePresence mode="wait">
          {awaitingConfirmation ? (
            <motion.div
              key="awaiting-confirmation"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              <div className="relative inline-flex items-center justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-signal/50 bg-signal/10 text-signal shadow-[0_0_20px_rgba(185,255,56,0.25)]">
                  <Mail size={28} />
                </div>
                <span className="absolute -right-1 -top-1 flex h-4 w-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-75" />
                  <span className="relative inline-flex h-4 w-4 rounded-full bg-signal" />
                </span>
              </div>

              <div>
                <p className="label-mono text-signal">02 // Verification Pending</p>
                <h1 className="display mt-3 text-4xl md:text-5xl">Check your inbox.</h1>
                <p className="mt-3 text-muted-foreground">
                  We've dispatched a confirmation link to:
                </p>
                <div className="mt-3 inline-block rounded-lg border border-signal/40 bg-signal/10 px-4 py-2 font-mono text-sm font-semibold text-signal">
                  {confirmedEmail}
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-border/80 bg-surface/40 p-4 text-xs text-muted-foreground">
                <p>
                  Click the link inside the email to verify your address and activate your Cesium
                  orbit.
                </p>
                <p className="text-[11px] text-muted-foreground/80">
                  This window will automatically detect your confirmation once accepted.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="btn-signal flex w-full items-center justify-center gap-2 py-2.5 text-xs font-semibold"
                >
                  <RotateCw size={14} className={resending ? "animate-spin" : ""} />
                  <span>{resending ? "Resending link…" : "Resend confirmation email"}</span>
                </button>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAwaitingConfirmation(false);
                      setMode("login");
                    }}
                    className="label-mono text-xs text-muted-foreground transition-colors hover:text-signal"
                  >
                    Already confirmed? Sign in →
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAwaitingConfirmation(false);
                      setMode("register");
                    }}
                    className="label-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Change email
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: done ? 0.3 : 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="label-mono text-muted-foreground">
                {mode === "login" ? "01 / Sign in" : "02 / Register"}
              </p>
              <h1 className="display mt-4 text-5xl md:text-6xl">
                {mode === "login" ? "Welcome back." : "Come as you are."}
              </h1>
              <p className="mt-3 text-muted-foreground">
                {mode === "login"
                  ? "Your people are still here."
                  : "There's more to you than a bio."}
              </p>

              {errors.general && (
                <p className="label-mono mt-4 border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                  ↳ {errors.general}
                </p>
              )}

              <form onSubmit={submit} noValidate className="mt-10 space-y-6">
                {mode === "register" && (
                  <Field
                    id="name"
                    label="Display name"
                    value={f.name}
                    onChange={set("name")}
                    error={errors.name}
                    valid={!!f.name.trim()}
                    disabled={busy}
                  />
                )}
                <Field
                  id="email"
                  label="Email address"
                  type="email"
                  value={f.email}
                  onChange={set("email")}
                  error={errors.email}
                  valid={emailOk(f.email)}
                  disabled={busy}
                />
                <Field
                  id="password"
                  label="Password"
                  value={f.password}
                  onChange={set("password")}
                  error={errors.password}
                  valid={f.password.length >= 8}
                  disabled={busy}
                  toggle
                />
                {mode === "register" && (
                  <Field
                    id="confirm"
                    label="Confirm password"
                    value={f.confirm}
                    onChange={set("confirm")}
                    error={errors.confirm}
                    valid={!!f.confirm && f.confirm === f.password}
                    disabled={busy}
                    toggle
                  />
                )}
                {mode === "login" && (
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={f.remember}
                        onChange={(e) => setF((s) => ({ ...s, remember: e.target.checked }))}
                        className="accent-signal"
                      />{" "}
                      Remember me
                    </label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={busy || done}
                  className="btn-signal w-full justify-between"
                >
                  <span>
                    {done
                      ? "Connected"
                      : busy
                        ? "Establishing connection…"
                        : mode === "login"
                          ? "Sign in"
                          : "Create account"}
                  </span>
                  {busy ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <ArrowUpRight size={18} />
                  )}
                </button>

                <div className="relative my-6 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/60" />
                  </div>
                  <span className="relative bg-background px-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Or continue with
                  </span>
                </div>

                <button
                  type="button"
                  id="google-signin-btn"
                  onClick={handleGoogleSignIn}
                  disabled={busy || done}
                  className="flex w-full items-center justify-center gap-3 rounded-lg border border-border/80 bg-surface/50 py-3 text-xs font-medium uppercase tracking-wider text-foreground transition-all hover:border-signal/50 hover:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal disabled:opacity-50"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </form>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                <button
                  type="button"
                  id="toggle-auth-mode"
                  onClick={() => {
                    setMode(mode === "login" ? "register" : "login");
                    setErrors({});
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {mode === "login" ? "New here? " : "Already orbiting? "}
                  <span className="text-signal">
                    {mode === "login" ? "Create an account" : "Sign in"}
                  </span>
                </button>
              </div>
              <p className="label-mono mt-10 border-t border-border pt-4 text-muted-foreground">
                Encrypted credentials · Persistent session via Supabase Auth
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
