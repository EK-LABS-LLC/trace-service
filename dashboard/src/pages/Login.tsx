import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { authClient } from "../lib/auth-client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  if (!authLoading && isAuthenticated) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password");
      return;
    }

    if (isSignUp && !name.trim()) {
      setError("Please enter your name");
      return;
    }

    if (isSignUp && !projectName.trim()) {
      setError("Please enter your project name");
      return;
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        const response = await fetch("/dashboard/api/signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
            password,
            name: name.trim(),
            projectName: projectName.trim(),
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          let message = "Sign up failed";
          try {
            const data = JSON.parse(text);
            message = data.error || data.message || message;
          } catch {
            if (text) message = text;
          }
          setError(message);
          return;
        }

        const { error: signInError } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (signInError) {
          setError(signInError.message || "Sign in after sign up failed");
          return;
        }
      } else {
        const { error: signInError } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (signInError) {
          setError(signInError.message || "Invalid email or password");
          return;
        }
      }
      navigate("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Authentication failed. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-neutral-950 text-neutral-100 min-h-screen antialiased flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <span className="text-xl font-bold tracking-tight text-white">
            Pulse
          </span>
        </div>

        {/* Login Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="text-center mb-6">
            <h1 className="text-lg font-medium mb-1">
              {isSignUp ? "Create an account" : "Sign in to Pulse"}
            </h1>
            <p className="text-sm text-neutral-500">
              {isSignUp
                ? "Enter your details to get started"
                : "Enter your credentials to continue"}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Name (sign-up only) */}
              {isSignUp && (
                <div>
                  <label className="block text-sm text-neutral-400 mb-1.5">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3 py-2 bg-neutral-850 border border-neutral-700 rounded-lg text-sm focus:border-accent focus:outline-none transition-colors disabled:opacity-50"
                    placeholder="John Doe"
                  />
                </div>
              )}

              {/* Project Name (sign-up only) */}
              {isSignUp && (
                <div>
                  <label className="block text-sm text-neutral-400 mb-1.5">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3 py-2 bg-neutral-850 border border-neutral-700 rounded-lg text-sm focus:border-accent focus:outline-none transition-colors disabled:opacity-50"
                    placeholder="My First Project"
                  />
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm text-neutral-400 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3 py-2 bg-neutral-850 border border-neutral-700 rounded-lg text-sm focus:border-accent focus:outline-none transition-colors disabled:opacity-50"
                  placeholder="you@example.com"
                  autoFocus
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm text-neutral-400 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3 py-2 bg-neutral-850 border border-neutral-700 rounded-lg text-sm focus:border-accent focus:outline-none transition-colors disabled:opacity-50"
                  placeholder="••••••••"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg text-sm font-medium text-white bg-accent hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading
                  ? isSignUp
                    ? "Creating account..."
                    : "Signing in..."
                  : isSignUp
                    ? "Create account"
                    : "Sign in"}
              </button>
            </div>
          </form>

          {/* Toggle sign-in / sign-up */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError("");
                setProjectName("");
              }}
              className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              {isSignUp
                ? "Already have an account? Sign in"
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-neutral-600 mt-6">
          Pulse - LLM Observability
        </p>
      </div>
    </div>
  );
}
