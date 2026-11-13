import { MemorySourceDefinition } from "dsh-mnemon/contracts";
import { Context } from "@deepseek-ai/cordis";
//#region src/source.d.ts
declare const SKILLS_SOURCE_TYPE_ID = "skills";
declare const SKILLS_SOURCE_ROLE = "procedural";
interface Config {
  /** Absolute directory holding `skills/`; the Host supplies its storage root. */
  dataDir?: string;
  /** DSH's home; defaults to `$DSH_HOME`, then `~/.dsh`. */
  dshHome?: string;
  /** The shared agents home; defaults to `$DSH_AGENTS_HOME`, then `~/.agents`. */
  agentsHome?: string;
  /** Opt in to updating original files of existing symlink/junction skills. */
  allowLinkedUpdates?: boolean;
}
declare function createSkillsMemorySource(config?: Config): MemorySourceDefinition;
declare const SKILLS_MEMORY_SOURCE: MemorySourceDefinition;
//#endregion
//#region src/index.d.ts
declare const name = "dsh-mnemon-source-skills";
declare const inject: string[];
declare const memoryPlugin: import("dsh-mnemon/extension-sdk").MemoryPluginDescriptor;
declare function apply(ctx: Context, config?: Config): void;
//#endregion
export { type Config, SKILLS_MEMORY_SOURCE, SKILLS_SOURCE_ROLE, SKILLS_SOURCE_TYPE_ID, apply, createSkillsMemorySource, inject, memoryPlugin, name };