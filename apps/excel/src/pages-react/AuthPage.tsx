import { LoaderCircle } from "lucide-react";
import { StepLayout } from "@/components/shell/step-layout";
import { StatusBanner } from "@/components/shell/status-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function AuthPage(props: {
  apiUrl: string;
  email: string;
  password: string;
  authSummary: string;
  status: { kind: "ok" | "error"; message: string } | null;
  loggingIn: boolean;
  canLogout: boolean;
  onApiUrlChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onLogin: () => Promise<void> | void;
  onLogout: () => Promise<void> | void;
  onTestConnection: () => Promise<void> | void;
}) {
  return (
    <StepLayout
      stepLabel="Step 1 of 3"
      title="Pactolus Assistant"
      subtitle="Sign in first. Then select snapshot and run."
    >
      <StatusBanner status={props.status} />
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-600">API URL</label>
            <Input value={props.apiUrl} onChange={(e) => props.onApiUrlChange(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Email</label>
            <Input
              value={props.email}
              type="email"
              onChange={(e) => props.onEmailChange(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Password</label>
            <Input
              value={props.password}
              type="password"
              onChange={(e) => props.onPasswordChange(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={props.onLogin}
              disabled={props.loggingIn}
            >
              {props.loggingIn ? (
                <span className="flex items-center gap-2">
                  <LoaderCircle className="size-4 animate-spin" />
                  Logging in...
                </span>
              ) : (
                "Login"
              )}
            </Button>
            <Button variant="outline" onClick={props.onTestConnection} disabled={props.loggingIn}>
              Test connection
            </Button>
            <Button variant="secondary" onClick={props.onLogout} disabled={!props.canLogout}>
              Logout
            </Button>
          </div>
          <p className="text-xs text-slate-600">{props.authSummary}</p>
        </CardContent>
      </Card>
    </StepLayout>
  );
}
