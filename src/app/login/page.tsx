"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import "./login.css";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result: { error?: string } = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Unable to sign in.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="login-shell">
      <div className="card login-card">
        <span className="hero-kicker">Private access</span>
        <h1>Welcome back.</h1>
        <p>Enter your password to open your chat.</p>
        <form className="stack-form" onSubmit={handleSubmit}>
          <label htmlFor="app-password">Password</label>
          <input
            id="app-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoFocus
          />
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
          <button className="button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Checking..." : "Unlock chat"}
          </button>
        </form>
      </div>
    </section>
  );
}
