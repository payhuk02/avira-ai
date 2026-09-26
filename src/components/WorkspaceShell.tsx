import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Clapperboard,
  Film,
  GitCompareArrows,
  Home,
  Library,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { checkAdmin } from "@/lib/admin.functions";
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

const NAVIGATION = [
  { to: "/studio", label: "Studio", description: "Créer un clip", icon: Clapperboard },
  { to: "/storyboard", label: "Storyboard", description: "Découper une idée", icon: BookOpen },
  { to: "/montage", label: "Montage", description: "Assembler un film", icon: Film },
  { to: "/bibliotheque", label: "Bibliothèque", description: "Retrouver les rendus", icon: Library },
  { to: "/comparaison", label: "Comparateur", description: "Duel A/B de rendus", icon: GitCompareArrows },
  { to: "/statistiques", label: "Statistiques", description: "Votre activité", icon: BarChart3 },
] as const;

const PAGE_META = {
  "/studio": { eyebrow: "Plateau 01", title: "Studio de création", action: "Nouveau clip" },
  "/storyboard": { eyebrow: "Salle d’écriture", title: "Storyboard IA", action: "Nouvelle histoire" },
  "/montage": { eyebrow: "Salle de montage", title: "Montage automatique", action: "Nouveau clip" },
  "/bibliotheque": { eyebrow: "Archives privées", title: "Bibliothèque", action: "Créer un clip" },
  "/comparaison": { eyebrow: "Salle de projection", title: "Comparateur A/B", action: "Nouveau clip" },
  "/statistiques": { eyebrow: "Tableau de bord", title: "Mes statistiques", action: "Nouveau clip" },
} as const;

export function WorkspaceShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname.startsWith("/admin")) return <Outlet />;
  return (
    <SidebarProvider>
      <WorkspaceSidebar />
      <SidebarInset className="min-w-0">
        <WorkspaceHeader />
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function WorkspaceSidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { setOpenMobile } = useSidebar();
  const closeMobile = () => setOpenMobile(false);
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "LU";
  const checkAdminFn = useServerFn(checkAdmin);
  const { data: adminInfo } = useQuery({ queryKey: ["is-admin", user?.id], queryFn: () => checkAdminFn(), enabled: !!user });

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="Avira ai">
              <Link to="/" onClick={closeMobile} className="group-data-[collapsible=icon]:justify-center">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                  <Film className="size-4" />
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block font-display text-lg">Avira ai</span>
                  <span className="block font-mono text-[9px] uppercase text-sidebar-foreground/50">
                    Atelier vidéo IA
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
          <SidebarGroupLabel className="font-mono text-[9px] uppercase">Création</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAVIGATION.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    size="lg"
                    isActive={pathname === item.to}
                    tooltip={item.label}
                    className="h-12 rounded-md data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
                  >
                    <Link to={item.to} onClick={closeMobile}>
                      <item.icon />
                      <span className="leading-tight">
                        <span className="block font-medium">{item.label}</span>
                        <span className="block text-[10px] opacity-55">{item.description}</span>
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[9px] uppercase">Raccourcis</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Shortcut to="/studio" label="Nouvelle vidéo" icon={Plus} onClick={closeMobile} />
              <Shortcut to="/storyboard" label="Nouveau storyboard" icon={Sparkles} onClick={closeMobile} />
              <Shortcut to="/bibliotheque" label="Rechercher" icon={Search} onClick={closeMobile} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <SidebarMenu>
          {adminInfo?.isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Administration">
                <Link to="/admin" onClick={closeMobile}>
                  <ShieldCheck />
                  <span>Administration</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Retour au site">
              <Link to="/" onClick={closeMobile}>
                <Home />
                <span>Retour au site</span>
                <ArrowUpRight className="ml-auto opacity-40" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator className="mx-0" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip={user?.email ?? "Mon compte"} className="h-12">
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-sidebar-accent font-mono text-[10px]">
                {initials}
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block text-[11px] font-medium">Compte créateur</span>
                <span className="block truncate text-[10px] opacity-50">{user?.email}</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Déconnexion"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/" });
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

function Shortcut({
  to,
  label,
  icon: Icon,
  onClick,
}: {
  to: "/studio" | "/storyboard" | "/bibliotheque";
  label: string;
  icon: typeof Plus;
  onClick: () => void;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={label}>
        <Link to={to} onClick={onClick}>
          <Icon />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function WorkspaceHeader() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const meta = PAGE_META[pathname as keyof typeof PAGE_META] ?? PAGE_META["/studio"];
  const actionTo = pathname === "/storyboard" ? "/storyboard" : "/studio";

  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <SidebarTrigger className="size-9 rounded-md border border-border bg-paper" />
        <div className="h-7 w-px bg-border" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] uppercase text-muted-foreground">{meta.eyebrow}</p>
          <h1 className="truncate font-display text-lg leading-tight sm:text-xl">{meta.title}</h1>
        </div>
        <Button asChild size="sm" className="rounded-md shadow-none">
          <Link to={actionTo}>
            <Plus />
            <span className="hidden sm:inline">{meta.action}</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}