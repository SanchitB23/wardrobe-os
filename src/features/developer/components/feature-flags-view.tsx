/**
 * Feature Flags developer view — read-only env flag status.
 */

import { FlagIcon } from "lucide-react";

import { PageHeader } from "@/features/layout";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FeatureFlagStatus } from "@/shared/feature-flags";

export function FeatureFlagsView({ flags }: { flags: FeatureFlagStatus[] }) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Feature Flags"
        badge={<Badge variant="secondary">Dev</Badge>}
        description="Read-only view of observability / AI / weather env flags. Changing values requires a restart — this page does not mutate process.env."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FlagIcon className="size-4" /> Configured flags
          </CardTitle>
          <CardDescription>
            Secrets are masked. Defaults shown when unset.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3 font-medium">Key</th>
                  <th className="py-1 pr-3 font-medium">Kind</th>
                  <th className="py-1 pr-3 font-medium">Value</th>
                  <th className="py-1 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((f) => (
                  <tr key={f.key} className="border-t">
                    <td className="py-1 pr-3 font-mono text-xs">{f.key}</td>
                    <td className="py-1 pr-3">
                      <Badge variant="outline">{f.kind}</Badge>
                    </td>
                    <td className="py-1 pr-3 font-mono text-xs">
                      {f.displayValue}
                      {!f.configured ? (
                        <span className="ml-1 text-muted-foreground">(default)</span>
                      ) : null}
                    </td>
                    <td className="py-1 text-muted-foreground">{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
