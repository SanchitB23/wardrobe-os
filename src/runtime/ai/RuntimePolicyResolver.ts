/**
 * RuntimePolicyResolver (RFC-014B) — the single place that turns a *capability*
 * into a complete routing decision: which providers (ordered), which model per
 * provider, and which are currently available. It composes CapabilityPolicy
 * (provider), ModelPolicy (model), ProviderPreferenceResolver (order), and the
 * RuntimeBudgetMonitor (availability).
 *
 * The resolver DECIDES; the `ProviderRouter` EXECUTES. This keeps all runtime
 * decision-making in one testable place and off the hot path in `AIRuntime`. It
 * never changes provider implementations or touches deterministic engines.
 */

import type { AIProviderId } from "@/ai/types";
import { resolveCapabilityPolicy, mechanicalForCapability } from "@/runtime/ai/CapabilityPolicy";
import { resolveModel } from "@/runtime/ai/ModelPolicy";
import {
  resolveProviderPreference,
  activeProvider,
  type ProviderPreference,
} from "@/runtime/ai/ProviderPreferenceResolver";
import type { RuntimeBudgetMonitor } from "@/runtime/ai/RuntimeBudgetMonitor";
import type {
  AICapability,
  AIRuntimePolicies,
  MechanicalCapability,
  ProviderPolicy,
} from "@/runtime/ai/types";

type Env = Record<string, string | undefined>;

/** A fully resolved routing decision for one capability call. */
export interface ResolvedRoute {
  capability: AICapability;
  mechanical: MechanicalCapability;
  policy: ProviderPolicy;
  /** Ordered providers with availability + the model each would use. */
  providers: (ProviderPreference & { model: string | undefined })[];
  /** Per-provider model resolver (passed to the router). */
  resolveModel: (provider: AIProviderId) => string | undefined;
  /** Availability predicate (passed to the router). */
  isAvailable: (provider: AIProviderId) => boolean;
}

/** Dashboard-shaped view of a capability's routing. */
export interface RouteDescription {
  capability: AICapability;
  provider: AIProviderId;
  model: string;
  fallback: AIProviderId | null;
  fallbackModel: string | null;
  activeProvider: AIProviderId | null;
}

const MODEL_DEFAULT_LABEL = "(provider default)";

export class RuntimePolicyResolver {
  constructor(
    private readonly policies: AIRuntimePolicies,
    private readonly budgetMonitor: RuntimeBudgetMonitor,
    private readonly env: Env,
  ) {}

  policyFor(capability: AICapability): ProviderPolicy {
    return resolveCapabilityPolicy(capability, this.policies);
  }

  modelFor(capability: AICapability, provider: AIProviderId): string | undefined {
    return resolveModel(capability, provider, this.env);
  }

  isProviderAvailable(provider: AIProviderId): boolean {
    return this.budgetMonitor.isProviderAvailable(provider);
  }

  /** Resolve the full routing decision for a capability (budget checked once). */
  resolve(capability: AICapability): ResolvedRoute {
    const policy = this.policyFor(capability);
    const mechanical = mechanicalForCapability(capability);

    // Snapshot budget availability once per resolution (not per router link).
    const status = this.budgetMonitor.status();
    const isAvailable = (provider: AIProviderId) =>
      provider === "openai" ? status.available : true;
    const resolveModelFn = (provider: AIProviderId) => this.modelFor(capability, provider);

    const providers = resolveProviderPreference(policy, { isAvailable }).map((p) => ({
      ...p,
      model: resolveModelFn(p.id),
    }));

    return { capability, mechanical, policy, providers, resolveModel: resolveModelFn, isAvailable };
  }

  /** Dashboard view: capability → provider + model (+ fallback + active provider). */
  describe(capability: AICapability): RouteDescription {
    const policy = this.policyFor(capability);
    const isAvailable = (provider: AIProviderId) => this.isProviderAvailable(provider);
    return {
      capability,
      provider: policy.primary,
      model: this.modelFor(capability, policy.primary) ?? MODEL_DEFAULT_LABEL,
      fallback: policy.fallback ?? null,
      fallbackModel: policy.fallback
        ? (this.modelFor(capability, policy.fallback) ?? MODEL_DEFAULT_LABEL)
        : null,
      activeProvider: activeProvider(policy, { isAvailable }),
    };
  }
}
