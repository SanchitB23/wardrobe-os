/**
 * AI Runtime v2 (RFC-014) — prompt registry + experiments.
 *
 * Binds each prompt builder id to one or more explicit versions and (optionally)
 * an active experiment (control vs candidate, deterministically bucketed). Pure —
 * no I/O; selecting a version is a function of (builderId, experiment, bucketKey).
 */

import type { BuiltPrompt, PromptContext } from "@/ai/types";
import { inCandidateArm, versionId } from "@/runtime/ai/PromptVersion";
import type { PromptExperiment, PromptVersionEntry } from "@/runtime/ai/types";

export interface SelectedPrompt {
  builderId: string;
  version: string;
  /** Canonical id `builder@version`, recorded on results + metrics. */
  versionId: string;
  build(context: PromptContext): BuiltPrompt;
}

export class PromptRegistry {
  /** builderId → (version → entry) */
  private readonly entries = new Map<string, Map<string, PromptVersionEntry>>();
  /** builderId → default version */
  private readonly defaults = new Map<string, string>();
  /** builderId → experiment */
  private readonly experiments = new Map<string, PromptExperiment>();

  /** Register a version. The first registered version becomes the default. */
  register(entry: PromptVersionEntry): this {
    let versions = this.entries.get(entry.builderId);
    if (!versions) {
      versions = new Map();
      this.entries.set(entry.builderId, versions);
      this.defaults.set(entry.builderId, entry.version);
    }
    versions.set(entry.version, entry);
    return this;
  }

  /** Set the default (control) version for a builder. */
  setDefault(builderId: string, version: string): this {
    this.defaults.set(builderId, version);
    return this;
  }

  /** Activate an experiment for a builder. */
  setExperiment(experiment: PromptExperiment): this {
    this.experiments.set(experiment.builderId, experiment);
    return this;
  }

  clearExperiment(builderId: string): this {
    this.experiments.delete(builderId);
    return this;
  }

  /**
   * Select the version for a builder — the experiment's candidate when the
   * bucket key falls in the candidate arm, else the control/default. Deterministic.
   */
  select(builderId: string, bucketKey?: string): SelectedPrompt {
    const versions = this.entries.get(builderId);
    if (!versions || versions.size === 0) {
      throw new Error(`No prompt versions registered for builder "${builderId}".`);
    }

    const experiment = this.experiments.get(builderId);
    let version = this.defaults.get(builderId)!;
    if (experiment && bucketKey && versions.has(experiment.candidate)) {
      version = inCandidateArm(bucketKey, experiment.candidateShare)
        ? experiment.candidate
        : experiment.control;
    }

    const entry = versions.get(version) ?? versions.get(this.defaults.get(builderId)!)!;
    return {
      builderId,
      version: entry.version,
      versionId: versionId(builderId, entry.version),
      build: entry.build,
    };
  }
}
