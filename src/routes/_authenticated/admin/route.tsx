import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminShell";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.rpc("has_role", { _user_id: context.user.id, _role: "admin" });
    if (!data) throw redirect({ to: "/studio" });
  },
  head: () => ({
    meta: [
      { title: `Administration — ${BRAND}` },
      { name: "description", content: `Console d'administration de la plateforme ${BRAND}.` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminShell,
});
