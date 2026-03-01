import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Tamurfood</h1>
        <p className="text-muted-foreground">B2B bakery ordering platform</p>
        <Button>Get Started</Button>
      </div>
    </div>
  );
}
