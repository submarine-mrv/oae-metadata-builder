import { createFileRoute } from "@tanstack/react-router";
import SupabaseDemoPage from "@/pages/supabase-demo/SupabaseDemoPage";

export const Route = createFileRoute("/supabase-demo")({
	component: RouteComponent,
});

function RouteComponent() {
	return <SupabaseDemoPage />;
}
