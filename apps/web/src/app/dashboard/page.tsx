import { retrieveMyOrganizationsFromApi } from "@/features/organization/helpers.server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const orgs = await retrieveMyOrganizationsFromApi();

  console.log("orgs:", orgs);

  if (orgs.length === 1) {
    redirect(`/organizations/${orgs[0].slug}/projects`);
  }

  redirect("/organizations");
}
