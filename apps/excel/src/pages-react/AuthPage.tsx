import { LoaderCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthPage(props: {
  email: string;
  password: string;
  loggingIn: boolean;
  canLogout: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onLogin: () => Promise<void> | void;
  onLogout: () => Promise<void> | void;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-xs flex flex-col gap-6">

        {/* Brand */}
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center mb-1">
            <span className="text-primary-foreground font-bold text-lg">P</span>
          </div>
          <h1 className="text-base font-semibold text-foreground">Pactolus</h1>
          <p className="text-xs text-muted-foreground">Sign in to your account</p>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-foreground">Email</label>
            <Input
              value={props.email}
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              onChange={(e) => props.onEmailChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && props.onLogin()}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-foreground">Password</label>
            <Input
              value={props.password}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              onChange={(e) => props.onPasswordChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && props.onLogin()}
            />
          </div>

          <Button
            className="w-full mt-1"
            onClick={props.onLogin}
            disabled={props.loggingIn || !props.email.trim() || !props.password.trim()}
          >
            {props.loggingIn ? (
              <>
                <LoaderCircle className="size-3.5 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </div>

        {/* Logout — only visible when a session exists */}
        {props.canLogout && (
          <button
            type="button"
            onClick={props.onLogout}
            className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
          >
            <LogOut className="size-3" />
            Sign out of current session
          </button>
        )}

      </div>
    </div>
  );
}
