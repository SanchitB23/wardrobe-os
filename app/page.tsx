import { AlertCircleIcon, ShirtIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { createClient } from "@/lib/supabase/server";

const SEED_COUNTS = [
  { table: "styles", count: 13 },
  { table: "materials", count: 12 },
  { table: "tags", count: 15 },
  { table: "features", count: 12 },
  { table: "seasons", count: 6 },
  { table: "color_families", count: 9 },
  { table: "storage_types", count: 5 },
  { table: "wardrobe_items", count: 0 },
] as const;

export default async function Home() {
  const supabase = await createClient();
  const { data: styles, error } = await supabase
    .from("styles")
    .select("name")
    .order("name");

  const connected = !error;
  const rlsBlocking = connected && (styles?.length ?? 0) === 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">Wardrobe OS</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Connected to Supabase
        </h1>
        <p className="text-muted-foreground">
          This page was wired using the Supabase MCP plugin — project discovery,
          schema inspection, type generation, and env configuration in one flow.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Live connection</CardTitle>
          <CardDescription>
            Project <span className="font-mono">Wardrobe</span> · 28 tables ·
            Postgres 17
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant={connected ? "default" : "destructive"}>
              {connected ? "Client configured" : "Connection error"}
            </Badge>
            {rlsBlocking && (
              <Badge variant="secondary">
                RLS blocking reads (no policies)
              </Badge>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Connection error</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}

          {rlsBlocking && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>RLS blocking reads</AlertTitle>
              <AlertDescription>
                The security advisor found RLS enabled on all 28 tables but zero
                policies. Queries succeed at the network layer but return no
                rows. Add SELECT policies before building UI features.
              </AlertDescription>
            </Alert>
          )}

          {styles && styles.length > 0 && (
            <ul className="grid gap-1 text-sm">
              {styles.map((style) => (
                <li key={style.name}>{style.name}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seed data (via MCP SQL)</CardTitle>
          <CardDescription>
            Lookup tables already populated in your remote database
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {SEED_COUNTS.filter(({ table }) => table !== "wardrobe_items").map(
              ({ table, count }) => (
                <div key={table} className="rounded-lg border px-3 py-2">
                  <dt className="text-muted-foreground">{table}</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {count}
                  </dd>
                </div>
              ),
            )}
          </dl>

          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ShirtIcon />
              </EmptyMedia>
              <EmptyTitle>No wardrobe items yet</EmptyTitle>
              <EmptyDescription>
                Lookup tables are seeded, but the catalog is empty. Once RLS
                policies allow reads, you can start adding pieces here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    </div>
  );
}
