import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpen,
  Film,
  Gauge,
  KeyRound,
  ListVideo,
  ScrollText,
  Sparkles,
  LayoutDashboard,
  LogOut,
  Settings2,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { BRAND } from "@/lib/brand";
import { Toaster } from "@/components/ui/sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const NAV = [
  { to: "/admin", label: "Vue d'ensemble", icon: LayoutDashboard },
  { to: "/admin/utilisateurs", label: "Utilisateurs", icon: Users },
  { to: "/admin/scenes", label: "Scènes par utilisateur", icon: ListVideo },
  { to: "/admin/videos", label: "Vidéos", icon: Video },
  { to: "/admin/storyboards", label: "Storyboards", icon: BookOpen },
  { to: "/admin/couts", label: "Usage & coûts", icon: Gauge },
  { to: "/admin/analyses", label: "Analyses IA", icon: Sparkles },
] as const;
const SYSTEM = [
  { to: "/admin/cles-api", label: "Clés API", icon: KeyRound },
  { to: "/admin/parametres", label: "Paramètres", icon: Settings2 },
  { to: "/admin/journal", label: "Journal d'audit", icon: ScrollText },
] as const;
const ALL = [...NAV, ...SYSTEM];

export function AdminShell() {
  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset className="min-w-0">
        <AdminHeader />
        <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}

function AdminSidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { setOpenMobile } = useSidebar();
  const close = () => setOpenMobile(false);

  const renderItems = (items: readonly (typeof ALL)[number][]) =>
    items.map((item) => (
      <SidebarMenuItem key={item.to}>
        <SidebarMenuButton
          asChild
          isActive={pathname === item.to}
          tooltip={item.label}
          className="h-10 rounded-md data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
        >
          <Link to={item.to} onClick={close}>
            <item.icon />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="Administration">
              <Link to="/admin" onClick={close}>
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                  <ShieldCheck className="size-4" />
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block font-display text-lg">{BRAND}</span>
                  <span className="block font-mono text-[9px] uppercase text-sidebar-foreground/50">
                    Console admin
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent className="px-1">
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[9px] uppercase">Plateforme</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(NAV)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[9px] uppercase">Système</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(SYSTEM)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Retour au studio">
              <Link to="/studio" onClick={close}>
                <ArrowLeft />
                <span>Retour au studio</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Site public">
              <Link to="/" onClick={close}>
                <Film />
                <span>Site public</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator className="mx-0" />
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="truncate px-2 py-1 text-[10px] text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
              {user?.email}
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Déconnexion"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/", replace: true });
              }}
            >
              <LogOut />
              <span>Déconnexion</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function AdminHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = ALL.find((i) => i.to === pathname) ?? ALL[0];
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <SidebarTrigger className="size-9 rounded-md border border-border bg-paper" />
        <div className="h-7 w-px bg-border" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] uppercase text-muted-foreground">Administration</p>
          <h1 className="truncate font-display text-lg leading-tight sm:text-xl">{current?.label}</h1>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase text-foreground sm:flex">
          <ShieldCheck className="size-3" /> Admin
        </span>
      </div>
    </header>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="font-mono text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
