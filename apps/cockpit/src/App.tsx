/**
 * The Cockpit: sign-in gating, then the navigation shell with one URL per screen (Step 4C IA,
 * docs/step-4c/PHASE-1-PROPOSAL.md §3). Rooms load lazily. Access control is RLS only; the role read
 * from profiles here just hides controls the database would refuse anyway.
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { AccessPending, Login, SetPassword } from "./auth/Auth";
import { FactoryProvider, MeProvider, ToastProvider, type Me } from "./lib/state";
import type { Role } from "./lib/model";
import { Shell } from "./shell/Shell";
import { Loading } from "./components/ui";

const Home = lazy(() => import("./pages/Home"));
const PlansTab = lazy(() => import("./pages/Decisions"));
const PlanPage = lazy(() => import("./pages/Decisions").then((m) => ({ default: m.PlanPage })));
const AccountsTab = lazy(() => import("./pages/Decisions").then((m) => ({ default: m.AccountsTab })));
const StagesTab = lazy(() => import("./pages/Decisions").then((m) => ({ default: m.StagesTab })));
const Projects = lazy(() => import("./pages/Work"));
const ProjectPage = lazy(() => import("./pages/Work").then((m) => ({ default: m.ProjectPage })));
const NewRequest = lazy(() => import("./pages/Work").then((m) => ({ default: m.NewRequest })));
const Activity = lazy(() => import("./pages/Activity"));
const FixRounds = lazy(() => import("./pages/Activity").then((m) => ({ default: m.FixRounds })));
const RunPage = lazy(() => import("./pages/Activity").then((m) => ({ default: m.RunPage })));
const Costs = lazy(() => import("./pages/Misc").then((m) => ({ default: m.Costs })));
const ComingSoon = lazy(() => import("./pages/Misc").then((m) => ({ default: m.ComingSoon })));
const More = lazy(() => import("./pages/Misc").then((m) => ({ default: m.More })));
const Settings = lazy(() => import("./pages/Misc").then((m) => ({ default: m.Settings })));
const NotFound = lazy(() => import("./pages/Misc").then((m) => ({ default: m.NotFound })));

interface Profile {
  role: Role | null;
  fullName: string | null;
}

/**
 * Has an owner/admin approved this account (migration 0010), and with which role? undefined = not known
 * yet; null = a clean "no row" answer, which shows the pending screen. A failed lookup falls through to the
 * shell with no role, which is safe because RLS, not this hook, is what withholds data.
 */
function useProfile(session: Session | null | undefined): Profile | null | undefined {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const userId = session?.user.id ?? null;
  useEffect(() => {
    setProfile(undefined);
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("id,role,full_name")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setProfile({ role: null, fullName: null });
        else setProfile(data ? { role: (data.role as Role) ?? null, fullName: (data.full_name as string | null) ?? null } : null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  return profile;
}

export function CockpitRoutes() {
  return (
    <Suspense fallback={<Loading rows={4} label="Loading the page" />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/decisions" element={<PlansTab />} />
        <Route path="/decisions/plans/:id" element={<PlanPage />} />
        <Route path="/decisions/accounts" element={<AccountsTab />} />
        <Route path="/decisions/stages" element={<StagesTab />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/new" element={<NewRequest />} />
        <Route path="/projects/:id" element={<ProjectPage />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/activity/fixes" element={<FixRounds />} />
        <Route path="/activity/:jobId" element={<RunPage />} />
        <Route path="/costs" element={<Costs />} />
        <Route path="/soon/:slug" element={<ComingSoon />} />
        <Route path="/more" element={<More />} />
        <Route path="/settings" element={<Settings />} />
        {/* Old room names (before Step 4C) still land somewhere sensible. */}
        <Route path="/pipeline" element={<Navigate to="/projects" replace />} />
        <Route path="/approvals" element={<Navigate to="/decisions" replace />} />
        <Route path="/actions" element={<Navigate to="/projects/new" replace />} />
        <Route path="/runs" element={<Navigate to="/activity/fixes" replace />} />
        <Route path="/models" element={<Navigate to="/costs" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export function SignedIn({ me }: { me: Me }) {
  return (
    <MeProvider value={me}>
      <ToastProvider>
        <FactoryProvider>
          <Shell>
            <CockpitRoutes />
          </Shell>
        </FactoryProvider>
      </ToastProvider>
    </MeProvider>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recovering, setRecovering] = useState(false);
  const profile = useProfile(session);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // A password-reset link signs the browser in and fires PASSWORD_RECOVERY: hold on the
      // "choose a new password" screen until it's saved, rather than dropping into the app.
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;
  if (session === null) return <Login />;
  if (recovering) return <SetPassword onDone={() => setRecovering(false)} />;
  if (profile === undefined) return null;
  if (profile === null) return <AccessPending email={session.user.email ?? ""} />;

  return <SignedIn me={{ userId: session.user.id, email: session.user.email ?? "", role: profile.role, fullName: profile.fullName }} />;
}
