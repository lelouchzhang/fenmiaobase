import { AppSidebar } from "@/components/app-sidebar";
import { TopNav } from "@/components/top-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { retrieveMyOrganizationsFromApi } from "@/features/organization/helpers.server";
import { retrieveAccessTokenFromCookie } from "@/lib/server-utils";

async function getCurrentUser() {
  const token = await retrieveAccessTokenFromCookie();

  const payload = JSON.parse(
    Buffer.from(token.split(".")[1], "base64").toString(),
  );

  return { email: payload.email as string, name: null };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [organizations, user] = await Promise.all([
    retrieveMyOrganizationsFromApi(),
    getCurrentUser(),
  ]);

  return (
    <SidebarProvider>
      <AppSidebar organizations={organizations} user={user} />
      <SidebarInset>
        <TopNav />
        <TooltipProvider>
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </TooltipProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
