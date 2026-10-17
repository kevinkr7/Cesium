import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Eye, EyeOff, ArrowUpRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { HeroConstellation } from "@/components/HeroConstellation";
import { setDemo } from "@/lib/store";
import {
  signInUser,
  signUpUser,
  resetPasswordForEmail,
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
  const [mode, setMode] = useState<"login" | "register">("login");
  const [f, setF] = useState({ name: "", email: "", password: "", confirm: "", remember: true });
  const [errors, setErrors] = useState<Errs>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => {
    setF((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "", general: "" }));
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
    <section className="grid min-h-[100svh] md:grid-cols-[58fr_42fr]">
      <div className="relative hidden overflow-hidden border-r border-border md:block">
        <motion.div
          className="absolute inset-0 p-10 pt-32"
          animate={{ rotate: mode === "login" ? 0 : -6, scale: mode === "login" ? 1 : 1.08 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <HeroConstellation />
        </motion.div>
        <div className="absolute bottom-10 left-10 right-10">
          <p className="label-mono text-signal">CS / 055 — Access</p>
          <p className="display mt-4 text-[clamp(48px,6vw,96px)]">
            Different atoms.
            <br />
            <span className="text-outline">Unexpected bonds.</span>
          </p>
        </div>
      </div>

      <div className="gutter flex flex-col justify-center py-32 md:px-[5vw]">
        <AnimatePresence mode="wait">
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
              {mode === "login" ? "Your people are still here." : "There's more to you than a bio."}
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
                {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowUpRight size={18} />}
              </button>
            </form>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <button
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
        </AnimatePresence>
      </div>
    </section>
  );
}
