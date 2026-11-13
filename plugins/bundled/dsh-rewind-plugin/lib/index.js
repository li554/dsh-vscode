// src/index.ts
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import z from "@deepseek-ai/schemastery";

// src/locales.ts
var en = {
  "plan.skip": "  not restored: {path} ({reason})",
  "skipReason.oversized": "over the {limit} backup limit, so the recorded state predates untracked edits",
  "skipReason.parent": "the recorded parent directory no longer resolves to its captured location",
  "skipReason.unsafe": "not a regular file, or a symlink/hard link",
  "skipReason.missing": "no recorded state for this path",
  "error.invalidTarget": 'Cannot parse target "{raw}" (expected <index> or @<seq>)',
  "sep.list": ", ",
  "sep.clause": "; ",
  "failures.suffix": "; {count} file(s) failed to restore: {list}",
  "failures.item": "{path} ({message})",
  "inflight": "A rewind is already running for this session; please wait.",
  "stopFailed": "Could not stop the running agent; rewind cancelled. Please try again.",
  "cancelled": "Rewind cancelled.",
  "failed": "Rewind failed: {error}. The session is unchanged.",
  "restore.count": "restored {count} file(s)",
  "delete.count": "deleted {count} file(s)",
  "skip.count": "skipped {count} path(s)",
  "noRestorable": "; no restorable write-class changes after the target",
  "noCheckpoint": "no file checkpoint exists for the target message",
  "backupOff": "snapshot backups are off, so the restore may be incomplete",
  "storeUnsupported": "file restore unavailable: these snapshots use a newer store format (v{version}) than this plugin understands; nothing was changed. Update the plugin or clear this session's snapshots.",
  "success": "Withdrawn seq {targetSeq} and everything after it (conversation returned to earlier){restore}.",
  "noUserMessages": "This session has no rewindable user messages yet.",
  "command.description": "Rewind the conversation and/or files to a previous point",
  "command.undoDescription": "Alias of /rewind",
  "engine.description": "dsh-rewind internal command",
  "engine.rejected": "Internal command: use /rewind or /undo.",
  "engine.inputHint": "@<seq> chat|both",
  "cleanup.description": "Manage automatic cleanup of session snapshot backups",
  "cleanup.inputHint": "on | off | max-age <days> | run [--apply] [--current]",
  "cleanup.status": "Auto-cleanup: {state}. Max age: {days} day(s).",
  "cleanup.enabled": "enabled",
  "cleanup.disabled": "disabled",
  "cleanup.onOk": "Auto-cleanup enabled.",
  "cleanup.offOk": "Auto-cleanup disabled \u2014 all snapshots kept.",
  "cleanup.maxAgeOk": "Auto-cleanup max age set to {days} day(s).",
  "cleanup.cfgInvalid": 'Snapshot cleanup config invalid: {detail}. Nothing was executed; use "on|off|max-age" to reset the config.',
  "cleanup.saveFailed": "Could not save cleanup config: {detail}.",
  "cleanup.runDry": "Dry-run: would remove {deleted} session snapshot backup(s), freeing {freed} bytes. Re-run with --apply to delete.",
  "cleanup.runApply": "Removed {deleted} session snapshot backup(s), freeing {freed} bytes; {kept} kept, {remaining} bytes remain.",
  "cleanup.runFailed": "Cleanup failed: {detail}.",
  "cleanup.skipped": "({skipped} active session(s) skipped.)",
  "cleanup.clearDry": "Dry-run: would clear {entries} snapshot(s) of the current session, freeing {bytes} bytes. Re-run with --apply to delete.",
  "cleanup.clearApply": "Cleared {entries} snapshot(s) of the current session, freeing {bytes} bytes. This session now records snapshots fresh from its current state.",
  "cleanup.clearActive": "Could not clear session {sessionId}: the session is still running and could not be stopped. Try again once it is idle.",
  "cleanup.clearCancelled": "Clear cancelled.",
  "cleanup.clearFailed": "Could not clear session {sessionId}: {detail}.",
  "cleanup.usage": "Usage:\n  /snapshot-auto-cleanup                 show status\n  /snapshot-auto-cleanup on|off          enable/disable auto-cleanup\n  /snapshot-auto-cleanup max-age <days>  set the idle cutoff\n  /snapshot-auto-cleanup run [--apply]   dry-run, or execute with --apply\n  /snapshot-auto-cleanup run --current [--apply]   dry-run/clear this session's snapshots"
};
var zh = {
  "plan.skip": "  \u672A\u8FD8\u539F\uFF1A{path}\uFF08{reason}\uFF09",
  "skipReason.oversized": "\u5DF2\u8D85\u8FC7 {limit} \u7684\u5907\u4EFD\u4E0A\u9650\uFF0C\u8BB0\u5F55\u7684\u72B6\u6001\u65E9\u4E8E\u672A\u88AB\u8DDF\u8E2A\u7684\u4FEE\u6539",
  "skipReason.parent": "\u8BB0\u5F55\u7684\u7236\u76EE\u5F55\u5DF2\u4E0D\u5728\u6355\u83B7\u65F6\u7684\u4F4D\u7F6E",
  "skipReason.unsafe": "\u4E0D\u662F\u666E\u901A\u6587\u4EF6\uFF0C\u6216\u4E3A\u7B26\u53F7\u94FE\u63A5/\u786C\u94FE\u63A5",
  "skipReason.missing": "\u8BE5\u8DEF\u5F84\u6CA1\u6709\u8BB0\u5F55\u7684\u72B6\u6001",
  "error.invalidTarget": '\u65E0\u6CD5\u89E3\u6790\u76EE\u6807 "{raw}"\uFF08\u5E94\u4E3A <\u5E8F\u53F7> \u6216 @<seq>\uFF09',
  "sep.list": "\u3001",
  "sep.clause": "\uFF1B",
  "failures.suffix": "\uFF1B{count} \u4E2A\u6587\u4EF6\u8FD8\u539F\u5931\u8D25\uFF1A{list}",
  "failures.item": "{path}\uFF08{message}\uFF09",
  "inflight": "\u8BE5\u4F1A\u8BDD\u5DF2\u6709\u4E00\u4E2A\u56DE\u9000\u6B63\u5728\u6267\u884C\uFF0C\u8BF7\u7A0D\u5019\u3002",
  "stopFailed": "\u65E0\u6CD5\u505C\u6B62\u8FD0\u884C\u4E2D\u7684 agent\uFF0C\u56DE\u9000\u5DF2\u53D6\u6D88\u3002\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002",
  "cancelled": "\u56DE\u9000\u5DF2\u53D6\u6D88\u3002",
  "failed": "\u56DE\u9000\u5931\u8D25\uFF1A{error}\u3002\u4F1A\u8BDD\u672A\u6539\u53D8\u3002",
  "restore.count": "\u8FD8\u539F {count} \u4E2A\u6587\u4EF6",
  "delete.count": "\u5220\u9664 {count} \u4E2A\u6587\u4EF6",
  "skip.count": "\u8DF3\u8FC7 {count} \u4E2A\u8DEF\u5F84",
  "noRestorable": "\uFF1B\u76EE\u6807\u4E4B\u540E\u6CA1\u6709\u53EF\u8FD8\u539F\u7684\u5199\u7C7B\u53D8\u66F4",
  "noCheckpoint": "\u76EE\u6807\u6D88\u606F\u6CA1\u6709\u6587\u4EF6\u68C0\u67E5\u70B9",
  "backupOff": "\u5FEB\u7167\u5907\u4EFD\u5DF2\u5173\u95ED\uFF0C\u8FD8\u539F\u53EF\u80FD\u4E0D\u5145\u5206",
  "storeUnsupported": "\u6587\u4EF6\u8FD8\u539F\u4E0D\u53EF\u7528\uFF1A\u8FD9\u4E9B\u5FEB\u7167\u4F7F\u7528\u4E86\u6BD4\u672C\u63D2\u4EF6\u66F4\u65B0\u7684\u5B58\u50A8\u683C\u5F0F\uFF08v{version}\uFF09\uFF1B\u5DE5\u4F5C\u533A\u672A\u505A\u4EFB\u4F55\u6539\u52A8\u3002\u8BF7\u66F4\u65B0\u63D2\u4EF6\uFF0C\u6216\u6E05\u9664\u8BE5\u4F1A\u8BDD\u7684\u5FEB\u7167\u3002",
  "success": "\u5DF2\u64A4\u56DE seq {targetSeq} \u53CA\u4E4B\u540E\u5185\u5BB9\uFF08\u5BF9\u8BDD\u5DF2\u56DE\u5230\u6B64\u524D\uFF09{restore}\u3002",
  "noUserMessages": "\u5F53\u524D\u4F1A\u8BDD\u8FD8\u6CA1\u6709\u53EF\u56DE\u9000\u7684\u7528\u6237\u6D88\u606F\u3002",
  "command.description": "\u628A\u5BF9\u8BDD\u548C/\u6216\u6587\u4EF6\u56DE\u9000\u5230\u4E4B\u524D\u7684\u67D0\u6761\u6D88\u606F",
  "command.undoDescription": "/rewind \u7684\u522B\u540D",
  "engine.description": "dsh-rewind \u5185\u90E8\u547D\u4EE4",
  "engine.rejected": "\u5185\u90E8\u547D\u4EE4\uFF1A\u8BF7\u4F7F\u7528 /rewind \u6216 /undo\u3002",
  "engine.inputHint": "@<seq> chat|both",
  "cleanup.description": "\u7BA1\u7406\u4F1A\u8BDD\u5FEB\u7167\u5907\u4EFD\u7684\u81EA\u52A8\u6E05\u7406",
  "cleanup.inputHint": "on | off | max-age <\u5929\u6570> | run [--apply] [--current]",
  "cleanup.status": "\u81EA\u52A8\u6E05\u7406\uFF1A{state}\u3002\u6700\u5927\u4FDD\u7559\u5929\u6570\uFF1A{days} \u5929\u3002",
  "cleanup.enabled": "\u5DF2\u5F00\u542F",
  "cleanup.disabled": "\u5DF2\u5173\u95ED",
  "cleanup.onOk": "\u5DF2\u5F00\u542F\u81EA\u52A8\u6E05\u7406\u3002",
  "cleanup.offOk": "\u5DF2\u5173\u95ED\u81EA\u52A8\u6E05\u7406\u2014\u2014\u4FDD\u7559\u5168\u90E8\u5FEB\u7167\u3002",
  "cleanup.maxAgeOk": "\u5DF2\u5C06\u81EA\u52A8\u6E05\u7406\u7684\u6700\u5927\u4FDD\u7559\u5929\u6570\u8BBE\u4E3A {days} \u5929\u3002",
  "cleanup.cfgInvalid": "\u5FEB\u7167\u6E05\u7406\u914D\u7F6E\u65E0\u6548\uFF1A{detail}\u3002\u672A\u6267\u884C\u4EFB\u4F55\u64CD\u4F5C\uFF1B\u8BF7\u7528\u300Con|off|max-age\u300D\u91CD\u8BBE\u914D\u7F6E\u4EE5\u4FEE\u590D\u3002",
  "cleanup.saveFailed": "\u65E0\u6CD5\u4FDD\u5B58\u6E05\u7406\u914D\u7F6E\uFF1A{detail}\u3002",
  "cleanup.runDry": "\u9884\u6F14\uFF1A\u5C06\u5220\u9664 {deleted} \u4E2A\u4F1A\u8BDD\u7684\u5FEB\u7167\u5907\u4EFD\uFF0C\u91CA\u653E {freed} \u5B57\u8282\u3002\u52A0 --apply \u6B63\u5F0F\u5220\u9664\u3002",
  "cleanup.runApply": "\u5DF2\u5220\u9664 {deleted} \u4E2A\u4F1A\u8BDD\u7684\u5FEB\u7167\u5907\u4EFD\uFF0C\u91CA\u653E {freed} \u5B57\u8282\uFF1B\u4FDD\u7559 {kept} \u4E2A\uFF0C\u5269\u4F59 {remaining} \u5B57\u8282\u3002",
  "cleanup.runFailed": "\u6E05\u7406\u5931\u8D25\uFF1A{detail}\u3002",
  "cleanup.skipped": "\uFF08\u8DF3\u8FC7\u4E86 {skipped} \u4E2A\u6D3B\u52A8\u4F1A\u8BDD\u3002\uFF09",
  "cleanup.clearDry": "\u9884\u6F14\uFF1A\u5C06\u6E05\u9664\u5F53\u524D\u4F1A\u8BDD\u7684 {entries} \u4E2A\u5FEB\u7167\uFF0C\u91CA\u653E {bytes} \u5B57\u8282\u3002\u52A0 --apply \u6B63\u5F0F\u5220\u9664\u3002",
  "cleanup.clearApply": "\u5DF2\u6E05\u9664\u5F53\u524D\u4F1A\u8BDD\u7684 {entries} \u4E2A\u5FEB\u7167\uFF0C\u91CA\u653E {bytes} \u5B57\u8282\u3002\u8BE5\u4F1A\u8BDD\u5DF2\u91CD\u7F6E\u4E3A\u4ECE\u5F53\u524D\u72B6\u6001\u91CD\u65B0\u8BB0\u5F55\u5FEB\u7167\u3002",
  "cleanup.clearActive": "\u65E0\u6CD5\u6E05\u9664\u4F1A\u8BDD {sessionId}\uFF1A\u4F1A\u8BDD\u4ECD\u5728\u8FD0\u884C\u4E14\u672A\u80FD\u505C\u6B62\uFF0C\u8BF7\u5F85\u5176\u7A7A\u95F2\u540E\u91CD\u8BD5\u3002",
  "cleanup.clearCancelled": "\u6E05\u7A7A\u5DF2\u53D6\u6D88\u3002",
  "cleanup.clearFailed": "\u65E0\u6CD5\u6E05\u9664\u4F1A\u8BDD {sessionId}\uFF1A{detail}\u3002",
  "cleanup.usage": "\u7528\u6CD5\uFF1A\n  /snapshot-auto-cleanup                 \u67E5\u770B\u72B6\u6001\n  /snapshot-auto-cleanup on|off          \u5F00\u542F/\u5173\u95ED\u81EA\u52A8\u6E05\u7406\n  /snapshot-auto-cleanup max-age <\u5929\u6570>  \u8BBE\u7F6E\u5931\u6D3B\u9608\u503C\uFF08\u5929\uFF09\n  /snapshot-auto-cleanup run [--apply]   \u9884\u6F14\uFF0C\u6216\u52A0 --apply \u6267\u884C\n  /snapshot-auto-cleanup run --current [--apply]  \u9884\u6F14/\u6E05\u9664\u672C\u4F1A\u8BDD\u5FEB\u7167"
};
var ja = {
  "plan.skip": "  \u5FA9\u5143\u5BFE\u8C61\u5916\uFF1A{path}\uFF08{reason}\uFF09",
  "skipReason.oversized": "{limit} \u306E\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u4E0A\u9650\u3092\u8D85\u3048\u3066\u3044\u308B\u305F\u3081\u3001\u8A18\u9332\u3055\u308C\u305F\u72B6\u614B\u306F\u672A\u8FFD\u8DE1\u306E\u7DE8\u96C6\u3088\u308A\u524D\u306E\u3082\u306E\u3067\u3059",
  "skipReason.parent": "\u8A18\u9332\u3055\u308C\u305F\u89AA\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u304C\u30AD\u30E3\u30D7\u30C1\u30E3\u6642\u306E\u4F4D\u7F6E\u306B\u89E3\u6C7A\u3055\u308C\u306A\u304F\u306A\u308A\u307E\u3057\u305F",
  "skipReason.unsafe": "\u901A\u5E38\u306E\u30D5\u30A1\u30A4\u30EB\u3067\u306F\u306A\u3044\u304B\u3001\u30B7\u30F3\u30DC\u30EA\u30C3\u30AF\u30EA\u30F3\u30AF/\u30CF\u30FC\u30C9\u30EA\u30F3\u30AF\u3067\u3059",
  "skipReason.missing": "\u3053\u306E\u30D1\u30B9\u306B\u8A18\u9332\u3055\u308C\u305F\u72B6\u614B\u304C\u3042\u308A\u307E\u305B\u3093",
  "error.invalidTarget": '\u5BFE\u8C61 "{raw}" \u3092\u89E3\u6790\u3067\u304D\u307E\u305B\u3093\uFF08<index> \u307E\u305F\u306F @<seq> \u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\uFF09',
  "sep.list": "\u3001",
  "sep.clause": "\uFF1B",
  "failures.suffix": "\uFF1B{count} \u4EF6\u306E\u30D5\u30A1\u30A4\u30EB\u3092\u5FA9\u5143\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\uFF1A{list}",
  "failures.item": "{path}\uFF08{message}\uFF09",
  "inflight": "\u3053\u306E\u30BB\u30C3\u30B7\u30E7\u30F3\u3067\u306F\u65E2\u306B\u5DFB\u304D\u623B\u3057\u304C\u5B9F\u884C\u4E2D\u3067\u3059\u3002\u304A\u5F85\u3061\u304F\u3060\u3055\u3044\u3002",
  "stopFailed": "\u5B9F\u884C\u4E2D\u306E\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u3092\u505C\u6B62\u3067\u304D\u306A\u304B\u3063\u305F\u305F\u3081\u3001\u5DFB\u304D\u623B\u3057\u3092\u30AD\u30E3\u30F3\u30BB\u30EB\u3057\u307E\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002",
  "cancelled": "\u5DFB\u304D\u623B\u3057\u3092\u30AD\u30E3\u30F3\u30BB\u30EB\u3057\u307E\u3057\u305F\u3002",
  "failed": "\u5DFB\u304D\u623B\u3057\u306B\u5931\u6557\u3057\u307E\u3057\u305F\uFF1A{error}\u3002\u30BB\u30C3\u30B7\u30E7\u30F3\u306F\u5909\u66F4\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002",
  "restore.count": "{count} \u4EF6\u306E\u30D5\u30A1\u30A4\u30EB\u3092\u5FA9\u5143\u3057\u307E\u3057\u305F",
  "delete.count": "{count} \u4EF6\u306E\u30D5\u30A1\u30A4\u30EB\u3092\u524A\u9664\u3057\u307E\u3057\u305F",
  "skip.count": "{count} \u4EF6\u306E\u30D1\u30B9\u3092\u30B9\u30AD\u30C3\u30D7\u3057\u307E\u3057\u305F",
  "noRestorable": "\uFF1B\u5BFE\u8C61\u3088\u308A\u5F8C\u306B\u5FA9\u5143\u3067\u304D\u308B\u66F8\u8FBC\u307F\u7CFB\u306E\u5909\u66F4\u306F\u3042\u308A\u307E\u305B\u3093",
  "noCheckpoint": "\u5BFE\u8C61\u30E1\u30C3\u30BB\u30FC\u30B8\u306E\u30D5\u30A1\u30A4\u30EB\u30C1\u30A7\u30C3\u30AF\u30DD\u30A4\u30F3\u30C8\u304C\u3042\u308A\u307E\u305B\u3093",
  "backupOff": "\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u306E\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u304C\u7121\u52B9\u306A\u305F\u3081\u3001\u5FA9\u5143\u304C\u4E0D\u5B8C\u5168\u306B\u306A\u308B\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059",
  "storeUnsupported": "\u30D5\u30A1\u30A4\u30EB\u3092\u5FA9\u5143\u3067\u304D\u307E\u305B\u3093\uFF1A\u3053\u308C\u3089\u306E\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u306F\u3001\u3053\u306E\u30D7\u30E9\u30B0\u30A4\u30F3\u304C\u7406\u89E3\u3067\u304D\u308B\u5F62\u5F0F\u3088\u308A\u65B0\u3057\u3044\u4FDD\u5B58\u5F62\u5F0F\uFF08v{version}\uFF09\u3092\u4F7F\u3063\u3066\u3044\u307E\u3059\u3002\u4F55\u3082\u5909\u66F4\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002\u30D7\u30E9\u30B0\u30A4\u30F3\u3092\u66F4\u65B0\u3059\u308B\u304B\u3001\u3053\u306E\u30BB\u30C3\u30B7\u30E7\u30F3\u306E\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u3092\u6D88\u53BB\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
  "success": "seq {targetSeq} \u3068\u305D\u308C\u4EE5\u964D\u3092\u64A4\u56DE\u3057\u307E\u3057\u305F\uFF08\u4F1A\u8A71\u306F\u4EE5\u524D\u306E\u72B6\u614B\u306B\u623B\u308A\u307E\u3057\u305F\uFF09{restore}\u3002",
  "noUserMessages": "\u3053\u306E\u30BB\u30C3\u30B7\u30E7\u30F3\u306B\u306F\u307E\u3060\u5DFB\u304D\u623B\u3057\u3067\u304D\u308B\u30E6\u30FC\u30B6\u30FC\u30E1\u30C3\u30BB\u30FC\u30B8\u304C\u3042\u308A\u307E\u305B\u3093\u3002",
  "command.description": "\u4F1A\u8A71\u3084\u30D5\u30A1\u30A4\u30EB\u3092\u4EE5\u524D\u306E\u6642\u70B9\u307E\u3067\u5DFB\u304D\u623B\u3057\u307E\u3059",
  "command.undoDescription": "/rewind \u306E\u30A8\u30A4\u30EA\u30A2\u30B9",
  "engine.description": "dsh-rewind \u306E\u5185\u90E8\u30B3\u30DE\u30F3\u30C9",
  "engine.rejected": "\u5185\u90E8\u30B3\u30DE\u30F3\u30C9\u3067\u3059\u3002/rewind \u307E\u305F\u306F /undo \u3092\u4F7F\u3063\u3066\u304F\u3060\u3055\u3044\u3002",
  "engine.inputHint": "@<seq> chat|both",
  "cleanup.description": "\u30BB\u30C3\u30B7\u30E7\u30F3\u306E\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u306E\u81EA\u52D5\u30AF\u30EA\u30FC\u30F3\u30A2\u30C3\u30D7\u3092\u7BA1\u7406\u3057\u307E\u3059",
  "cleanup.inputHint": "on | off | max-age <\u65E5\u6570> | run [--apply] [--current]",
  "cleanup.status": "\u81EA\u52D5\u30AF\u30EA\u30FC\u30F3\u30A2\u30C3\u30D7\uFF1A{state}\u3002\u6700\u5927\u4FDD\u6301\u671F\u9593\uFF1A{days} \u65E5\u3002",
  "cleanup.enabled": "\u6709\u52B9",
  "cleanup.disabled": "\u7121\u52B9",
  "cleanup.onOk": "\u81EA\u52D5\u30AF\u30EA\u30FC\u30F3\u30A2\u30C3\u30D7\u3092\u6709\u52B9\u306B\u3057\u307E\u3057\u305F\u3002",
  "cleanup.offOk": "\u81EA\u52D5\u30AF\u30EA\u30FC\u30F3\u30A2\u30C3\u30D7\u3092\u7121\u52B9\u306B\u3057\u307E\u3057\u305F \u2014 \u3059\u3079\u3066\u306E\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u304C\u4FDD\u6301\u3055\u308C\u307E\u3059\u3002",
  "cleanup.maxAgeOk": "\u81EA\u52D5\u30AF\u30EA\u30FC\u30F3\u30A2\u30C3\u30D7\u306E\u6700\u5927\u4FDD\u6301\u671F\u9593\u3092 {days} \u65E5\u306B\u8A2D\u5B9A\u3057\u307E\u3057\u305F\u3002",
  "cleanup.cfgInvalid": '\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u306E\u30AF\u30EA\u30FC\u30F3\u30A2\u30C3\u30D7\u8A2D\u5B9A\u304C\u7121\u52B9\u3067\u3059\uFF1A{detail}\u3002\u4F55\u3082\u5B9F\u884C\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002"on|off|max-age" \u3067\u8A2D\u5B9A\u3092\u30EA\u30BB\u30C3\u30C8\u3057\u3066\u304F\u3060\u3055\u3044\u3002',
  "cleanup.saveFailed": "\u30AF\u30EA\u30FC\u30F3\u30A2\u30C3\u30D7\u8A2D\u5B9A\u3092\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\uFF1A{detail}\u3002",
  "cleanup.runDry": "\u30C9\u30E9\u30A4\u30E9\u30F3\uFF1A{deleted} \u4EF6\u306E\u30BB\u30C3\u30B7\u30E7\u30F3\u306E\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u3092\u524A\u9664\u3057\u3001{freed} \u30D0\u30A4\u30C8\u3092\u89E3\u653E\u3057\u307E\u3059\u3002\u5B9F\u969B\u306B\u524A\u9664\u3059\u308B\u306B\u306F --apply \u3092\u4ED8\u3051\u3066\u518D\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
  "cleanup.runApply": "{deleted} \u4EF6\u306E\u30BB\u30C3\u30B7\u30E7\u30F3\u306E\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u3092\u524A\u9664\u3057\u3001{freed} \u30D0\u30A4\u30C8\u3092\u89E3\u653E\u3057\u307E\u3057\u305F\u3002{kept} \u4EF6\u3092\u4FDD\u6301\u3057\u3001\u6B8B\u308A\u306F {remaining} \u30D0\u30A4\u30C8\u3067\u3059\u3002",
  "cleanup.runFailed": "\u30AF\u30EA\u30FC\u30F3\u30A2\u30C3\u30D7\u306B\u5931\u6557\u3057\u307E\u3057\u305F\uFF1A{detail}\u3002",
  "cleanup.skipped": "\uFF08\u30A2\u30AF\u30C6\u30A3\u30D6\u306A\u30BB\u30C3\u30B7\u30E7\u30F3 {skipped} \u4EF6\u3092\u30B9\u30AD\u30C3\u30D7\u3057\u307E\u3057\u305F\u3002\uFF09",
  "cleanup.clearDry": "\u30C9\u30E9\u30A4\u30E9\u30F3\uFF1A\u73FE\u5728\u306E\u30BB\u30C3\u30B7\u30E7\u30F3\u306E\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8 {entries} \u4EF6\u3092\u6D88\u53BB\u3057\u3001{bytes} \u30D0\u30A4\u30C8\u3092\u89E3\u653E\u3057\u307E\u3059\u3002\u5B9F\u969B\u306B\u524A\u9664\u3059\u308B\u306B\u306F --apply \u3092\u4ED8\u3051\u3066\u518D\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
  "cleanup.clearApply": "\u73FE\u5728\u306E\u30BB\u30C3\u30B7\u30E7\u30F3\u306E\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8 {entries} \u4EF6\u3092\u6D88\u53BB\u3057\u3001{bytes} \u30D0\u30A4\u30C8\u3092\u89E3\u653E\u3057\u307E\u3057\u305F\u3002\u3053\u306E\u30BB\u30C3\u30B7\u30E7\u30F3\u306F\u73FE\u5728\u306E\u72B6\u614B\u304B\u3089\u65B0\u3057\u304F\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u3092\u8A18\u9332\u3057\u307E\u3059\u3002",
  "cleanup.clearActive": "\u30BB\u30C3\u30B7\u30E7\u30F3 {sessionId} \u3092\u6D88\u53BB\u3067\u304D\u307E\u305B\u3093\uFF1A\u30BB\u30C3\u30B7\u30E7\u30F3\u306F\u307E\u3060\u5B9F\u884C\u4E2D\u3067\u3001\u505C\u6B62\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u30A2\u30A4\u30C9\u30EB\u72B6\u614B\u306B\u306A\u3063\u3066\u304B\u3089\u3082\u3046\u4E00\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002",
  "cleanup.clearCancelled": "\u6D88\u53BB\u3092\u30AD\u30E3\u30F3\u30BB\u30EB\u3057\u307E\u3057\u305F\u3002",
  "cleanup.clearFailed": "\u30BB\u30C3\u30B7\u30E7\u30F3 {sessionId} \u3092\u6D88\u53BB\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\uFF1A{detail}\u3002",
  "cleanup.usage": "\u4F7F\u3044\u65B9\uFF1A\n  /snapshot-auto-cleanup                 \u72B6\u614B\u3092\u8868\u793A\n  /snapshot-auto-cleanup on|off          \u81EA\u52D5\u30AF\u30EA\u30FC\u30F3\u30A2\u30C3\u30D7\u306E\u6709\u52B9/\u7121\u52B9\n  /snapshot-auto-cleanup max-age <\u65E5\u6570>  \u30A2\u30A4\u30C9\u30EB\u3057\u304D\u3044\u5024\u3092\u8A2D\u5B9A\n  /snapshot-auto-cleanup run [--apply]   \u30C9\u30E9\u30A4\u30E9\u30F3\u3001\u307E\u305F\u306F --apply \u3067\u5B9F\u884C\n  /snapshot-auto-cleanup run --current [--apply]   \u30C9\u30E9\u30A4\u30E9\u30F3\uFF0F\u73FE\u5728\u306E\u30BB\u30C3\u30B7\u30E7\u30F3\u306E\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u3092\u6D88\u53BB"
};
var es = {
  "plan.skip": "  no restaurado: {path} ({reason})",
  "skipReason.oversized": "supera el l\xEDmite de copias de seguridad de {limit}, por lo que el estado registrado es anterior a los cambios no rastreados",
  "skipReason.parent": "el directorio padre registrado ya no se resuelve en su ubicaci\xF3n de captura",
  "skipReason.unsafe": "no es un archivo normal, o es un enlace simb\xF3lico/duro",
  "skipReason.missing": "no hay estado registrado para esta ruta",
  "error.invalidTarget": 'No se puede interpretar el destino "{raw}" (se esperaba <index> o @<seq>)',
  "sep.list": ", ",
  "sep.clause": "; ",
  "failures.suffix": "; no se pudieron restaurar {count} archivo(s): {list}",
  "failures.item": "{path} ({message})",
  "inflight": "Ya hay un rebobinado en curso para esta sesi\xF3n; espere por favor.",
  "stopFailed": "No se pudo detener el agente en ejecuci\xF3n; rebobinado cancelado. Int\xE9ntelo de nuevo.",
  "cancelled": "Rebobinado cancelado.",
  "failed": "Error al rebobinar: {error}. La sesi\xF3n no ha cambiado.",
  "restore.count": "{count} archivo(s) restaurado(s)",
  "delete.count": "{count} archivo(s) eliminado(s)",
  "skip.count": "{count} ruta(s) omitida(s)",
  "noRestorable": "; no hay cambios de escritura restaurables despu\xE9s del destino",
  "noCheckpoint": "no existe un punto de control de archivos para el mensaje de destino",
  "backupOff": "las copias de seguridad de instant\xE1neas est\xE1n desactivadas, la restauraci\xF3n puede ser incompleta",
  "storeUnsupported": "restauraci\xF3n de archivos no disponible: estas instant\xE1neas usan un formato de almacenamiento m\xE1s reciente (v{version}) que este plugin no entiende; no se ha cambiado nada. Actualice el plugin o borre las instant\xE1neas de esta sesi\xF3n.",
  "success": "Retirado seq {targetSeq} y todo lo posterior (conversaci\xF3n devuelta a un punto anterior){restore}.",
  "noUserMessages": "Esta sesi\xF3n a\xFAn no tiene mensajes de usuario a los que rebobinar.",
  "command.description": "Rebobinar la conversaci\xF3n y/o los archivos a un punto anterior",
  "command.undoDescription": "Alias de /rewind",
  "engine.description": "Comando interno de dsh-rewind",
  "engine.rejected": "Comando interno: use /rewind o /undo.",
  "engine.inputHint": "@<seq> chat|both",
  "cleanup.description": "Gestionar la limpieza autom\xE1tica de las copias de seguridad de instant\xE1neas de sesi\xF3n",
  "cleanup.inputHint": "on | off | max-age <d\xEDas> | run [--apply] [--current]",
  "cleanup.status": "Limpieza autom\xE1tica: {state}. Antig\xFCedad m\xE1xima: {days} d\xEDa(s).",
  "cleanup.enabled": "activada",
  "cleanup.disabled": "desactivada",
  "cleanup.onOk": "Limpieza autom\xE1tica activada.",
  "cleanup.offOk": "Limpieza autom\xE1tica desactivada: se conservan todas las instant\xE1neas.",
  "cleanup.maxAgeOk": "Antig\xFCedad m\xE1xima de la limpieza autom\xE1tica: {days} d\xEDa(s).",
  "cleanup.cfgInvalid": 'Configuraci\xF3n de limpieza de instant\xE1neas no v\xE1lida: {detail}. No se ejecut\xF3 nada; use "on|off|max-age" para restablecer la configuraci\xF3n.',
  "cleanup.saveFailed": "No se pudo guardar la configuraci\xF3n de limpieza: {detail}.",
  "cleanup.runDry": "Simulaci\xF3n: se eliminar\xEDan {deleted} copia(s) de seguridad de instant\xE1neas de sesi\xF3n y se liberar\xEDan {freed} bytes. Vuelva a ejecutar con --apply para eliminar.",
  "cleanup.runApply": "Se eliminaron {deleted} copia(s) de seguridad de instant\xE1neas de sesi\xF3n y se liberaron {freed} bytes; {kept} conservada(s), quedan {remaining} bytes.",
  "cleanup.runFailed": "Error en la limpieza: {detail}.",
  "cleanup.skipped": "({skipped} sesi\xF3n(es) activa(s) omitida(s).)",
  "cleanup.clearDry": "Simulaci\xF3n: se borrar\xEDan {entries} instant\xE1nea(s) de la sesi\xF3n actual y se liberar\xEDan {bytes} bytes. Vuelva a ejecutar con --apply para eliminar.",
  "cleanup.clearApply": "Se borraron {entries} instant\xE1nea(s) de la sesi\xF3n actual y se liberaron {bytes} bytes. La sesi\xF3n ahora registra instant\xE1neas nuevas desde su estado actual.",
  "cleanup.clearActive": "No se pudo borrar la sesi\xF3n {sessionId}: sigue en ejecuci\xF3n y no se pudo detener. Int\xE9ntelo de nuevo cuando est\xE9 inactiva.",
  "cleanup.clearCancelled": "Borrado cancelado.",
  "cleanup.clearFailed": "No se pudo borrar la sesi\xF3n {sessionId}: {detail}.",
  "cleanup.usage": "Uso:\n  /snapshot-auto-cleanup                 mostrar estado\n  /snapshot-auto-cleanup on|off          activar/desactivar la limpieza autom\xE1tica\n  /snapshot-auto-cleanup max-age <d\xEDas>  definir el umbral de inactividad\n  /snapshot-auto-cleanup run [--apply]   simular, o ejecutar con --apply\n  /snapshot-auto-cleanup run --current [--apply]   simular/borrar las instant\xE1neas de esta sesi\xF3n"
};
var fr = {
  "plan.skip": "  non restaur\xE9 : {path} ({reason})",
  "skipReason.oversized": "d\xE9passe la limite de {limit} sauvegardes : l\u2019\xE9tat enregistr\xE9 pr\xE9c\xE8de les modifications non suivies",
  "skipReason.parent": "le r\xE9pertoire parent enregistr\xE9 ne correspond plus \xE0 son emplacement de capture",
  "skipReason.unsafe": "n\u2019est pas un fichier ordinaire, ou est un lien symbolique/physique",
  "skipReason.missing": "aucun \xE9tat enregistr\xE9 pour ce chemin",
  "error.invalidTarget": "Impossible d\u2019analyser la cible \xAB {raw} \xBB (attendu : <index> ou @<seq>)",
  "sep.list": ", ",
  "sep.clause": " ; ",
  "failures.suffix": " ; \xE9chec de la restauration de {count} fichier(s) : {list}",
  "failures.item": "{path} ({message})",
  "inflight": "Un rembobinage est d\xE9j\xE0 en cours pour cette session ; veuillez patienter.",
  "stopFailed": "Impossible d\u2019arr\xEAter l\u2019agent en cours ; rembobinage annul\xE9. Veuillez r\xE9essayer.",
  "cancelled": "Rembobinage annul\xE9.",
  "failed": "\xC9chec du rembobinage : {error}. La session est inchang\xE9e.",
  "restore.count": "{count} fichier(s) restaur\xE9(s)",
  "delete.count": "{count} fichier(s) supprim\xE9(s)",
  "skip.count": "{count} chemin(s) ignor\xE9(s)",
  "noRestorable": " ; aucune modification d\u2019\xE9criture restaurable apr\xE8s la cible",
  "noCheckpoint": "aucun point de contr\xF4le de fichiers n\u2019existe pour le message cible",
  "backupOff": "les sauvegardes d\u2019instantan\xE9s sont d\xE9sactiv\xE9es, la restauration peut \xEAtre incompl\xE8te",
  "storeUnsupported": "restauration de fichiers indisponible : ces instantan\xE9s utilisent un format de stockage plus r\xE9cent (v{version}) que celui compris par ce plugin ; rien n\u2019a \xE9t\xE9 modifi\xE9. Mettez \xE0 jour le plugin ou effacez les instantan\xE9s de cette session.",
  "success": "Retir\xE9 seq {targetSeq} et tout ce qui suit (conversation revenue \xE0 un point ant\xE9rieur){restore}.",
  "noUserMessages": "Cette session n\u2019a pas encore de messages utilisateur vers lesquels rembobiner.",
  "command.description": "Rembobiner la conversation et/ou les fichiers \xE0 un point ant\xE9rieur",
  "command.undoDescription": "Alias de /rewind",
  "engine.description": "Commande interne de dsh-rewind",
  "engine.rejected": "Commande interne : utilisez /rewind ou /undo.",
  "engine.inputHint": "@<seq> chat|both",
  "cleanup.description": "G\xE9rer le nettoyage automatique des sauvegardes d\u2019instantan\xE9s de session",
  "cleanup.inputHint": "on | off | max-age <jours> | run [--apply] [--current]",
  "cleanup.status": "Nettoyage automatique : {state}. Anciennet\xE9 max. : {days} jour(s).",
  "cleanup.enabled": "activ\xE9",
  "cleanup.disabled": "d\xE9sactiv\xE9",
  "cleanup.onOk": "Nettoyage automatique activ\xE9.",
  "cleanup.offOk": "Nettoyage automatique d\xE9sactiv\xE9 \u2014 tous les instantan\xE9s sont conserv\xE9s.",
  "cleanup.maxAgeOk": "Anciennet\xE9 maximale du nettoyage automatique : {days} jour(s).",
  "cleanup.cfgInvalid": "Configuration de nettoyage des instantan\xE9s non valide : {detail}. Rien n\u2019a \xE9t\xE9 ex\xE9cut\xE9 ; utilisez \xAB on|off|max-age \xBB pour r\xE9initialiser la configuration.",
  "cleanup.saveFailed": "Impossible d\u2019enregistrer la configuration de nettoyage : {detail}.",
  "cleanup.runDry": "Simulation : supprimerait {deleted} sauvegarde(s) d\u2019instantan\xE9s de session et lib\xE9rerait {freed} octets. Relancez avec --apply pour supprimer.",
  "cleanup.runApply": "Suppression de {deleted} sauvegarde(s) d\u2019instantan\xE9s de session, lib\xE9ration de {freed} octets ; {kept} conserv\xE9e(s), {remaining} octets restants.",
  "cleanup.runFailed": "\xC9chec du nettoyage : {detail}.",
  "cleanup.skipped": "({skipped} session(s) active(s) ignor\xE9e(s).)",
  "cleanup.clearDry": "Simulation : effacerait {entries} instantan\xE9(s) de la session courante et lib\xE9rerait {bytes} octets. Relancez avec --apply pour supprimer.",
  "cleanup.clearApply": "Suppression de {entries} instantan\xE9(s) de la session courante, lib\xE9ration de {bytes} octets. Cette session enregistre d\xE9sormais de nouveaux instantan\xE9s \xE0 partir de son \xE9tat actuel.",
  "cleanup.clearActive": "Impossible d\u2019effacer la session {sessionId} : elle est toujours en cours et n\u2019a pas pu \xEAtre arr\xEAt\xE9e. R\xE9essayez une fois qu\u2019elle est inactive.",
  "cleanup.clearCancelled": "Effacement annul\xE9.",
  "cleanup.clearFailed": "Impossible d\u2019effacer la session {sessionId} : {detail}.",
  "cleanup.usage": "Utilisation :\n  /snapshot-auto-cleanup                 afficher l\u2019\xE9tat\n  /snapshot-auto-cleanup on|off          activer/d\xE9sactiver le nettoyage automatique\n  /snapshot-auto-cleanup max-age <jours>  d\xE9finir le seuil d\u2019inactivit\xE9\n  /snapshot-auto-cleanup run [--apply]   simuler, ou ex\xE9cuter avec --apply\n  /snapshot-auto-cleanup run --current [--apply]   simuler/effacer les instantan\xE9s de cette session"
};
var de = {
  "plan.skip": "  nicht wiederhergestellt: {path} ({reason})",
  "skipReason.oversized": "\xFCber dem Sicherungslimit von {limit}, daher stammt der aufgezeichnete Stand von vor nicht erfassten \xC4nderungen",
  "skipReason.parent": "das aufgezeichnete Elternverzeichnis wird nicht mehr an seinem Erfassungsort aufgel\xF6st",
  "skipReason.unsafe": "keine regul\xE4re Datei oder ein Symlink/Hardlink",
  "skipReason.missing": "f\xFCr diesen Pfad ist kein Zustand aufgezeichnet",
  "error.invalidTarget": 'Ziel "{raw}" kann nicht verarbeitet werden (erwartet: <index> oder @<seq>)',
  "sep.list": ", ",
  "sep.clause": "; ",
  "failures.suffix": "; {count} Datei(en) konnten nicht wiederhergestellt werden: {list}",
  "failures.item": "{path} ({message})",
  "inflight": "F\xFCr diese Sitzung l\xE4uft bereits ein Zur\xFCckspulen; bitte warten.",
  "stopFailed": "Der laufende Agent konnte nicht gestoppt werden; Zur\xFCckspulen abgebrochen. Bitte erneut versuchen.",
  "cancelled": "Zur\xFCckspulen abgebrochen.",
  "failed": "Zur\xFCckspulen fehlgeschlagen: {error}. Die Sitzung ist unver\xE4ndert.",
  "restore.count": "{count} Datei(en) wiederhergestellt",
  "delete.count": "{count} Datei(en) gel\xF6scht",
  "skip.count": "{count} Pfad(e) \xFCbersprungen",
  "noRestorable": "; keine wiederherstellbaren Schreib\xE4nderungen nach dem Ziel",
  "noCheckpoint": "f\xFCr die Zielnachricht existiert kein Datei-Checkpoint",
  "backupOff": "Snapshot-Sicherungen sind deaktiviert, die Wiederherstellung kann unvollst\xE4ndig sein",
  "storeUnsupported": "Dateiwiederherstellung nicht verf\xFCgbar: Diese Snapshots nutzen ein neueres Speicherformat (v{version}), als dieses Plugin versteht; es wurde nichts ge\xE4ndert. Aktualisieren Sie das Plugin oder l\xF6schen Sie die Snapshots dieser Sitzung.",
  "success": "seq {targetSeq} und alles danach zur\xFCckgezogen (Unterhaltung auf einen fr\xFCheren Stand zur\xFCckgesetzt){restore}.",
  "noUserMessages": "Diese Sitzung hat noch keine Benutzernachrichten, zu denen zur\xFCckgespult werden kann.",
  "command.description": "Unterhaltung und/oder Dateien auf einen fr\xFCheren Stand zur\xFCckspulen",
  "command.undoDescription": "Alias von /rewind",
  "engine.description": "Interner Befehl von dsh-rewind",
  "engine.rejected": "Interner Befehl: Verwenden Sie /rewind oder /undo.",
  "engine.inputHint": "@<seq> chat|both",
  "cleanup.description": "Automatische Bereinigung der Snapshot-Sicherungen von Sitzungen verwalten",
  "cleanup.inputHint": "on | off | max-age <Tage> | run [--apply] [--current]",
  "cleanup.status": "Automatische Bereinigung: {state}. Max. Alter: {days} Tag(e).",
  "cleanup.enabled": "aktiviert",
  "cleanup.disabled": "deaktiviert",
  "cleanup.onOk": "Automatische Bereinigung aktiviert.",
  "cleanup.offOk": "Automatische Bereinigung deaktiviert \u2014 alle Snapshots bleiben erhalten.",
  "cleanup.maxAgeOk": "Maximales Alter der automatischen Bereinigung: {days} Tag(e).",
  "cleanup.cfgInvalid": 'Konfiguration der Snapshot-Bereinigung ung\xFCltig: {detail}. Es wurde nichts ausgef\xFChrt; setzen Sie die Konfiguration mit "on|off|max-age" zur\xFCck.',
  "cleanup.saveFailed": "Bereinigungskonfiguration konnte nicht gespeichert werden: {detail}.",
  "cleanup.runDry": "Testlauf: w\xFCrde {deleted} Snapshot-Sicherung(en) von Sitzungen entfernen und {freed} Bytes freigeben. Erneut mit --apply ausf\xFChren, um zu l\xF6schen.",
  "cleanup.runApply": "{deleted} Snapshot-Sicherung(en) von Sitzungen entfernt, {freed} Bytes freigegeben; {kept} behalten, {remaining} Bytes verbleiben.",
  "cleanup.runFailed": "Bereinigung fehlgeschlagen: {detail}.",
  "cleanup.skipped": "({skipped} aktive Sitzung(en) \xFCbersprungen.)",
  "cleanup.clearDry": "Testlauf: w\xFCrde {entries} Snapshot(s) der aktuellen Sitzung l\xF6schen und {bytes} Bytes freigeben. Erneut mit --apply ausf\xFChren, um zu l\xF6schen.",
  "cleanup.clearApply": "{entries} Snapshot(s) der aktuellen Sitzung gel\xF6scht, {bytes} Bytes freigegeben. Diese Sitzung zeichnet Snapshots jetzt neu ab ihrem aktuellen Stand auf.",
  "cleanup.clearActive": "Sitzung {sessionId} konnte nicht gel\xF6scht werden: sie l\xE4uft noch und konnte nicht gestoppt werden. Versuchen Sie es erneut, wenn sie inaktiv ist.",
  "cleanup.clearCancelled": "L\xF6schen abgebrochen.",
  "cleanup.clearFailed": "Sitzung {sessionId} konnte nicht gel\xF6scht werden: {detail}.",
  "cleanup.usage": "Aufruf:\n  /snapshot-auto-cleanup                 Status anzeigen\n  /snapshot-auto-cleanup on|off          automatische Bereinigung aktivieren/deaktivieren\n  /snapshot-auto-cleanup max-age <Tage>  Inaktivit\xE4tsschwelle festlegen\n  /snapshot-auto-cleanup run [--apply]   Testlauf oder mit --apply ausf\xFChren\n  /snapshot-auto-cleanup run --current [--apply]   Testlauf/Snapshots dieser Sitzung l\xF6schen"
};
var ru = {
  "plan.skip": "  \u043D\u0435 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E: {path} ({reason})",
  "skipReason.oversized": "\u043F\u0440\u0435\u0432\u044B\u0448\u0435\u043D \u043F\u0440\u0435\u0434\u0435\u043B \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u044B\u0445 \u043A\u043E\u043F\u0438\u0439 {limit}, \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u043D\u043E\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043F\u0440\u0435\u0434\u0448\u0435\u0441\u0442\u0432\u0443\u0435\u0442 \u043D\u0435\u043E\u0442\u0441\u043B\u0435\u0436\u0438\u0432\u0430\u0435\u043C\u044B\u043C \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F\u043C",
  "skipReason.parent": "\u0437\u0430\u043F\u0438\u0441\u0430\u043D\u043D\u044B\u0439 \u0440\u043E\u0434\u0438\u0442\u0435\u043B\u044C\u0441\u043A\u0438\u0439 \u043A\u0430\u0442\u0430\u043B\u043E\u0433 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043C\u0435\u0441\u0442\u0443 \u0437\u0430\u0445\u0432\u0430\u0442\u0430",
  "skipReason.unsafe": "\u043D\u0435 \u043E\u0431\u044B\u0447\u043D\u044B\u0439 \u0444\u0430\u0439\u043B \u0438\u043B\u0438 \u0441\u0438\u043C\u0432\u043E\u043B\u0438\u0447\u0435\u0441\u043A\u0430\u044F/\u0436\u0451\u0441\u0442\u043A\u0430\u044F \u0441\u0441\u044B\u043B\u043A\u0430",
  "skipReason.missing": "\u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u043F\u0443\u0442\u0438 \u043D\u0435\u0442 \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u043D\u043E\u0433\u043E \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F",
  "error.invalidTarget": '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0440\u0430\u0437\u043E\u0431\u0440\u0430\u0442\u044C \u0446\u0435\u043B\u044C "{raw}" (\u043E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F <index> \u0438\u043B\u0438 @<seq>)',
  "sep.list": ", ",
  "sep.clause": "; ",
  "failures.suffix": "; {count} \u0444\u0430\u0439\u043B(\u043E\u0432) \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C: {list}",
  "failures.item": "{path} ({message})",
  "inflight": "\u0414\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0441\u0435\u0430\u043D\u0441\u0430 \u0443\u0436\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u043E\u0442\u043A\u0430\u0442; \u043F\u043E\u0434\u043E\u0436\u0434\u0438\u0442\u0435.",
  "stopFailed": "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0440\u0430\u0431\u043E\u0442\u0430\u044E\u0449\u0438\u0439 \u0430\u0433\u0435\u043D\u0442; \u043E\u0442\u043A\u0430\u0442 \u043E\u0442\u043C\u0435\u043D\u0451\u043D. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u043F\u043E\u043F\u044B\u0442\u043A\u0443.",
  "cancelled": "\u041E\u0442\u043A\u0430\u0442 \u043E\u0442\u043C\u0435\u043D\u0451\u043D.",
  "failed": "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u043E\u0442\u043A\u0430\u0442: {error}. \u0421\u0435\u0430\u043D\u0441 \u043D\u0435 \u0438\u0437\u043C\u0435\u043D\u0451\u043D.",
  "restore.count": "\u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E \u0444\u0430\u0439\u043B\u043E\u0432: {count}",
  "delete.count": "\u0443\u0434\u0430\u043B\u0435\u043D\u043E \u0444\u0430\u0439\u043B\u043E\u0432: {count}",
  "skip.count": "\u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E \u043F\u0443\u0442\u0435\u0439: {count}",
  "noRestorable": "; \u043F\u043E\u0441\u043B\u0435 \u0446\u0435\u043B\u0438 \u043D\u0435\u0442 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u043C\u044B\u0445 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439 \u0437\u0430\u043F\u0438\u0441\u0438",
  "noCheckpoint": "\u0434\u043B\u044F \u0446\u0435\u043B\u0435\u0432\u043E\u0433\u043E \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u043D\u0435\u0442 \u0444\u0430\u0439\u043B\u043E\u0432\u043E\u0439 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u043E\u0439 \u0442\u043E\u0447\u043A\u0438",
  "backupOff": "\u0440\u0435\u0437\u0435\u0440\u0432\u043D\u044B\u0435 \u043A\u043E\u043F\u0438\u0438 \u0441\u043D\u0438\u043C\u043A\u043E\u0432 \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u044B, \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043D\u0435\u043F\u043E\u043B\u043D\u044B\u043C",
  "storeUnsupported": "\u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u0444\u0430\u0439\u043B\u043E\u0432 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E: \u044D\u0442\u0438 \u0441\u043D\u0438\u043C\u043A\u0438 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u044E\u0442 \u0431\u043E\u043B\u0435\u0435 \u043D\u043E\u0432\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0430 (v{version}), \u0447\u0435\u043C \u043F\u043E\u043D\u0438\u043C\u0430\u0435\u0442 \u044D\u0442\u043E\u0442 \u043F\u043B\u0430\u0433\u0438\u043D; \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u043E. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u043F\u043B\u0430\u0433\u0438\u043D \u0438\u043B\u0438 \u043E\u0447\u0438\u0441\u0442\u0438\u0442\u0435 \u0441\u043D\u0438\u043C\u043A\u0438 \u044D\u0442\u043E\u0433\u043E \u0441\u0435\u0430\u043D\u0441\u0430.",
  "success": "\u041E\u0442\u043E\u0437\u0432\u0430\u043D\u043E seq {targetSeq} \u0438 \u0432\u0441\u0451 \u043F\u043E\u0441\u043B\u0435 \u043D\u0435\u0433\u043E (\u0431\u0435\u0441\u0435\u0434\u0430 \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0435\u043D\u0430 \u043A \u0431\u043E\u043B\u0435\u0435 \u0440\u0430\u043D\u043D\u0435\u043C\u0443 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044E){restore}.",
  "noUserMessages": "\u0412 \u044D\u0442\u043E\u043C \u0441\u0435\u0430\u043D\u0441\u0435 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F \u0434\u043B\u044F \u043E\u0442\u043A\u0430\u0442\u0430.",
  "command.description": "\u041E\u0442\u043A\u0430\u0442\u0438\u0442\u044C \u0431\u0435\u0441\u0435\u0434\u0443 \u0438/\u0438\u043B\u0438 \u0444\u0430\u0439\u043B\u044B \u043A \u0431\u043E\u043B\u0435\u0435 \u0440\u0430\u043D\u043D\u0435\u043C\u0443 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044E",
  "command.undoDescription": "\u041F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C /rewind",
  "engine.description": "\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u044F\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0430 dsh-rewind",
  "engine.rejected": "\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u044F\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0430: \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 /rewind \u0438\u043B\u0438 /undo.",
  "engine.inputHint": "@<seq> chat|both",
  "cleanup.description": "\u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0439 \u043E\u0447\u0438\u0441\u0442\u043A\u043E\u0439 \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u044B\u0445 \u043A\u043E\u043F\u0438\u0439 \u0441\u043D\u0438\u043C\u043A\u043E\u0432 \u0441\u0435\u0430\u043D\u0441\u043E\u0432",
  "cleanup.inputHint": "on | off | max-age <\u0434\u043D\u0435\u0439> | run [--apply] [--current]",
  "cleanup.status": "\u0410\u0432\u0442\u043E\u043E\u0447\u0438\u0441\u0442\u043A\u0430: {state}. \u041C\u0430\u043A\u0441. \u0432\u043E\u0437\u0440\u0430\u0441\u0442: {days} \u0434\u043D.",
  "cleanup.enabled": "\u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0430",
  "cleanup.disabled": "\u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u0430",
  "cleanup.onOk": "\u0410\u0432\u0442\u043E\u043E\u0447\u0438\u0441\u0442\u043A\u0430 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0430.",
  "cleanup.offOk": "\u0410\u0432\u0442\u043E\u043E\u0447\u0438\u0441\u0442\u043A\u0430 \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u0430 \u2014 \u0432\u0441\u0435 \u0441\u043D\u0438\u043C\u043A\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.",
  "cleanup.maxAgeOk": "\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u044B\u0439 \u0432\u043E\u0437\u0440\u0430\u0441\u0442 \u0430\u0432\u0442\u043E\u043E\u0447\u0438\u0441\u0442\u043A\u0438: {days} \u0434\u043D.",
  "cleanup.cfgInvalid": '\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u043A\u043E\u043D\u0444\u0438\u0433\u0443\u0440\u0430\u0446\u0438\u044F \u043E\u0447\u0438\u0441\u0442\u043A\u0438 \u0441\u043D\u0438\u043C\u043A\u043E\u0432: {detail}. \u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E; \u0441\u0431\u0440\u043E\u0441\u044C\u0442\u0435 \u043A\u043E\u043D\u0444\u0438\u0433\u0443\u0440\u0430\u0446\u0438\u044E \u0441 \u043F\u043E\u043C\u043E\u0449\u044C\u044E "on|off|max-age".',
  "cleanup.saveFailed": "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043A\u043E\u043D\u0444\u0438\u0433\u0443\u0440\u0430\u0446\u0438\u044E \u043E\u0447\u0438\u0441\u0442\u043A\u0438: {detail}.",
  "cleanup.runDry": "\u041F\u0440\u043E\u0431\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A: \u0443\u0434\u0430\u043B\u0438\u0442 \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u044B\u0435 \u043A\u043E\u043F\u0438\u0438 \u0441\u043D\u0438\u043C\u043A\u043E\u0432 \u0441\u0435\u0430\u043D\u0441\u043E\u0432 ({deleted}), \u043E\u0441\u0432\u043E\u0431\u043E\u0434\u0438\u0432 {freed} \u0431\u0430\u0439\u0442. \u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u0441 --apply, \u0447\u0442\u043E\u0431\u044B \u0443\u0434\u0430\u043B\u0438\u0442\u044C.",
  "cleanup.runApply": "\u0423\u0434\u0430\u043B\u0435\u043D\u044B \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u044B\u0435 \u043A\u043E\u043F\u0438\u0438 \u0441\u043D\u0438\u043C\u043A\u043E\u0432 \u0441\u0435\u0430\u043D\u0441\u043E\u0432 ({deleted}), \u043E\u0441\u0432\u043E\u0431\u043E\u0436\u0434\u0435\u043D\u043E {freed} \u0431\u0430\u0439\u0442; \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E {kept}, \u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C {remaining} \u0431\u0430\u0439\u0442.",
  "cleanup.runFailed": "\u041E\u0448\u0438\u0431\u043A\u0430 \u043E\u0447\u0438\u0441\u0442\u043A\u0438: {detail}.",
  "cleanup.skipped": "({skipped} \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0445 \u0441\u0435\u0430\u043D\u0441\u043E\u0432 \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E.)",
  "cleanup.clearDry": "\u041F\u0440\u043E\u0431\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A: \u043E\u0447\u0438\u0441\u0442\u0438\u0442 \u0441\u043D\u0438\u043C\u043A\u0438 \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E \u0441\u0435\u0430\u043D\u0441\u0430 ({entries}), \u043E\u0441\u0432\u043E\u0431\u043E\u0434\u0438\u0432 {bytes} \u0431\u0430\u0439\u0442. \u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u0441 --apply, \u0447\u0442\u043E\u0431\u044B \u0443\u0434\u0430\u043B\u0438\u0442\u044C.",
  "cleanup.clearApply": "\u041E\u0447\u0438\u0449\u0435\u043D\u044B \u0441\u043D\u0438\u043C\u043A\u0438 \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E \u0441\u0435\u0430\u043D\u0441\u0430 ({entries}), \u043E\u0441\u0432\u043E\u0431\u043E\u0436\u0434\u0435\u043D\u043E {bytes} \u0431\u0430\u0439\u0442. \u0422\u0435\u043F\u0435\u0440\u044C \u0441\u0435\u0430\u043D\u0441 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442 \u0441\u043D\u0438\u043C\u043A\u0438 \u0437\u0430\u043D\u043E\u0432\u043E \u043E\u0442 \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F.",
  "cleanup.clearActive": "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0447\u0438\u0441\u0442\u0438\u0442\u044C \u0441\u0435\u0430\u043D\u0441 {sessionId}: \u043E\u043D \u0432\u0441\u0451 \u0435\u0449\u0451 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u0438 \u043D\u0435 \u0431\u044B\u043B \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u043F\u043E\u043F\u044B\u0442\u043A\u0443, \u043A\u043E\u0433\u0434\u0430 \u043E\u043D \u043E\u0441\u0432\u043E\u0431\u043E\u0434\u0438\u0442\u0441\u044F.",
  "cleanup.clearCancelled": "\u041E\u0447\u0438\u0441\u0442\u043A\u0430 \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u0430.",
  "cleanup.clearFailed": "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0447\u0438\u0441\u0442\u0438\u0442\u044C \u0441\u0435\u0430\u043D\u0441 {sessionId}: {detail}.",
  "cleanup.usage": "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435:\n  /snapshot-auto-cleanup                 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435\n  /snapshot-auto-cleanup on|off          \u0432\u043A\u043B\u044E\u0447\u0438\u0442\u044C/\u043E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0430\u0432\u0442\u043E\u043E\u0447\u0438\u0441\u0442\u043A\u0443\n  /snapshot-auto-cleanup max-age <\u0434\u043D\u0435\u0439>  \u0437\u0430\u0434\u0430\u0442\u044C \u043F\u043E\u0440\u043E\u0433 \u043D\u0435\u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u0438\n  /snapshot-auto-cleanup run [--apply]   \u043F\u0440\u043E\u0431\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u0438\u043B\u0438 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435 \u0441 --apply\n  /snapshot-auto-cleanup run --current [--apply]   \u043F\u0440\u043E\u0431\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A/\u043E\u0447\u0438\u0441\u0442\u043A\u0430 \u0441\u043D\u0438\u043C\u043A\u043E\u0432 \u044D\u0442\u043E\u0433\u043E \u0441\u0435\u0430\u043D\u0441\u0430"
};
var pt = {
  "plan.skip": "  n\xE3o restaurado: {path} ({reason})",
  "skipReason.oversized": "acima do limite de {limit} backups, ent\xE3o o estado registrado \xE9 anterior a altera\xE7\xF5es n\xE3o rastreadas",
  "skipReason.parent": "o diret\xF3rio pai registrado n\xE3o resolve mais para o local da captura",
  "skipReason.unsafe": "n\xE3o \xE9 um arquivo comum, ou \xE9 um link simb\xF3lico/r\xEDgido",
  "skipReason.missing": "n\xE3o h\xE1 estado registrado para este caminho",
  "error.invalidTarget": 'N\xE3o foi poss\xEDvel interpretar o destino "{raw}" (esperado <index> ou @<seq>)',
  "sep.list": ", ",
  "sep.clause": "; ",
  "failures.suffix": "; falha ao restaurar {count} arquivo(s): {list}",
  "failures.item": "{path} ({message})",
  "inflight": "J\xE1 h\xE1 um rebobinamento em andamento para esta sess\xE3o; aguarde.",
  "stopFailed": "N\xE3o foi poss\xEDvel parar o agente em execu\xE7\xE3o; rebobinamento cancelado. Tente novamente.",
  "cancelled": "Rebobinamento cancelado.",
  "failed": "Falha no rebobinamento: {error}. A sess\xE3o n\xE3o foi alterada.",
  "restore.count": "{count} arquivo(s) restaurado(s)",
  "delete.count": "{count} arquivo(s) exclu\xEDdo(s)",
  "skip.count": "{count} caminho(s) ignorado(s)",
  "noRestorable": "; nenhuma altera\xE7\xE3o de grava\xE7\xE3o restaur\xE1vel ap\xF3s o destino",
  "noCheckpoint": "n\xE3o existe um checkpoint de arquivo para a mensagem de destino",
  "backupOff": "os backups de snapshots est\xE3o desativados, a restaura\xE7\xE3o pode ficar incompleta",
  "storeUnsupported": "restaura\xE7\xE3o de arquivos indispon\xEDvel: estes snapshots usam um formato de armazenamento mais novo (v{version}) do que este plugin entende; nada foi alterado. Atualize o plugin ou limpe os snapshots desta sess\xE3o.",
  "success": "Retirado seq {targetSeq} e tudo depois dele (conversa retornada a um ponto anterior){restore}.",
  "noUserMessages": "Esta sess\xE3o ainda n\xE3o tem mensagens de usu\xE1rio para rebobinar.",
  "command.description": "Rebobinar a conversa e/ou os arquivos para um ponto anterior",
  "command.undoDescription": "Alias de /rewind",
  "engine.description": "Comando interno do dsh-rewind",
  "engine.rejected": "Comando interno: use /rewind ou /undo.",
  "engine.inputHint": "@<seq> chat|both",
  "cleanup.description": "Gerenciar a limpeza autom\xE1tica dos backups de snapshots de sess\xE3o",
  "cleanup.inputHint": "on | off | max-age <dias> | run [--apply] [--current]",
  "cleanup.status": "Limpeza autom\xE1tica: {state}. Idade m\xE1xima: {days} dia(s).",
  "cleanup.enabled": "ativada",
  "cleanup.disabled": "desativada",
  "cleanup.onOk": "Limpeza autom\xE1tica ativada.",
  "cleanup.offOk": "Limpeza autom\xE1tica desativada \u2014 todos os snapshots s\xE3o mantidos.",
  "cleanup.maxAgeOk": "Idade m\xE1xima da limpeza autom\xE1tica: {days} dia(s).",
  "cleanup.cfgInvalid": 'Configura\xE7\xE3o de limpeza de snapshots inv\xE1lida: {detail}. Nada foi executado; use "on|off|max-age" para redefinir a configura\xE7\xE3o.',
  "cleanup.saveFailed": "N\xE3o foi poss\xEDvel salvar a configura\xE7\xE3o de limpeza: {detail}.",
  "cleanup.runDry": "Simula\xE7\xE3o: removeria {deleted} backup(s) de snapshots de sess\xE3o, liberando {freed} bytes. Execute novamente com --apply para excluir.",
  "cleanup.runApply": "Removidos {deleted} backup(s) de snapshots de sess\xE3o, liberando {freed} bytes; {kept} mantido(s), restam {remaining} bytes.",
  "cleanup.runFailed": "Falha na limpeza: {detail}.",
  "cleanup.skipped": "({skipped} sess\xE3o(\xF5es) ativa(s) ignorada(s).)",
  "cleanup.clearDry": "Simula\xE7\xE3o: limparia {entries} snapshot(s) da sess\xE3o atual, liberando {bytes} bytes. Execute novamente com --apply para excluir.",
  "cleanup.clearApply": "Limpados {entries} snapshot(s) da sess\xE3o atual, liberando {bytes} bytes. Esta sess\xE3o agora registra snapshots novos a partir do estado atual.",
  "cleanup.clearActive": "N\xE3o foi poss\xEDvel limpar a sess\xE3o {sessionId}: ela ainda est\xE1 em execu\xE7\xE3o e n\xE3o p\xF4de ser parada. Tente novamente quando estiver ociosa.",
  "cleanup.clearCancelled": "Limpeza cancelada.",
  "cleanup.clearFailed": "N\xE3o foi poss\xEDvel limpar a sess\xE3o {sessionId}: {detail}.",
  "cleanup.usage": "Uso:\n  /snapshot-auto-cleanup                 mostrar status\n  /snapshot-auto-cleanup on|off          ativar/desativar a limpeza autom\xE1tica\n  /snapshot-auto-cleanup max-age <dias>  definir o limite de inatividade\n  /snapshot-auto-cleanup run [--apply]   simular, ou executar com --apply\n  /snapshot-auto-cleanup run --current [--apply]   simular/limpar os snapshots desta sess\xE3o"
};
var HOST_DICTS = { en, zh, ja, es, fr, de, ru, pt };
var DEFAULT_HOST_LOCALE = "en";
function isHostLocale(tag) {
  return Object.hasOwn(HOST_DICTS, tag);
}
function preferredLocale(preference) {
  if (typeof preference !== "string") return DEFAULT_HOST_LOCALE;
  const tag = preference.toLowerCase();
  if (isHostLocale(tag)) return tag;
  const primary = tag.split("-")[0];
  return primary !== void 0 && isHostLocale(primary) ? primary : DEFAULT_HOST_LOCALE;
}
function translate(lang, key, params = {}) {
  const dict = HOST_DICTS[lang] ?? en;
  let text = dict[key] ?? key;
  for (const [name2, value] of Object.entries(params)) {
    text = text.split(`{${name2}}`).join(String(value));
  }
  return text;
}

// src/marker.ts
var REWIND_MARKER_KIND = "dsh-rewind";
var REWIND_MARKER_SOURCE = Object.freeze({ kind: REWIND_MARKER_KIND });

// src/rewind.ts
var RewindError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "RewindError";
  }
  code;
};
var CANDIDATE_PREVIEW_CHARS = 80;
var DEFAULT_CANDIDATE_LIMIT = 100;
function isUserMessageEvent(event) {
  return event.type === "user/message";
}
function isHumanUserMessageEvent(event) {
  return isUserMessageEvent(event) && event.data.source.kind === "user";
}
function messagePreview(message) {
  const text = message.content.map((block) => block.type === "text" && typeof block.text === "string" ? block.text : "").join("").replace(/\s+/g, " ").trim();
  return text.length <= CANDIDATE_PREVIEW_CHARS ? text : `${text.slice(0, CANDIDATE_PREVIEW_CHARS - 1)}\u2026`;
}
var SEQ_TOKEN = /^@(\d+)$/;
var INDEX_TOKEN = /^(\d+)$/;
function parseRewindTarget(raw) {
  const token = raw.trim();
  const seq = SEQ_TOKEN.exec(token);
  if (seq !== null) {
    const value = Number(seq[1] ?? "");
    return Number.isSafeInteger(value) ? { kind: "seq", seq: value } : void 0;
  }
  const index = INDEX_TOKEN.exec(token);
  if (index !== null) {
    const value = Number(index[1] ?? "");
    return Number.isSafeInteger(value) && value >= 1 ? { kind: "index", index: value } : void 0;
  }
  return void 0;
}
function listRewindCandidates(events, surface, limit = DEFAULT_CANDIDATE_LIMIT) {
  const surfaceIndexes = /* @__PURE__ */ new Map();
  for (let i = 0; i < surface.length; i++) surfaceIndexes.set(surface[i], i);
  const candidates = [];
  for (let i = events.length - 1; i >= 0 && candidates.length < limit; i--) {
    const event = events[i];
    if (!isHumanUserMessageEvent(event)) continue;
    if (!surfaceIndexes.has(event.seq)) continue;
    candidates.push({
      seq: event.seq,
      time: event.time,
      preview: messagePreview(event.data),
      index: candidates.length + 1
    });
  }
  return candidates;
}
function planRewind(events, surface, target) {
  let targetSeq;
  if (target.kind === "seq") {
    targetSeq = target.seq;
  } else {
    const candidate = listRewindCandidates(events, surface, target.index)[target.index - 1];
    if (candidate === void 0) {
      throw new RewindError("invalid-index", `rewind index ${target.index} has no candidate`);
    }
    targetSeq = candidate.seq;
  }
  const targetEvent = events.find((event) => event.seq === targetSeq);
  if (targetEvent === void 0) {
    throw new RewindError("not-a-user-message", `no session event at seq ${targetSeq}`);
  }
  if (!isHumanUserMessageEvent(targetEvent)) {
    throw new RewindError(
      "not-a-user-message",
      `session event at seq ${targetSeq} is not a human user message (${targetEvent.type})`
    );
  }
  let targetIndex = surface.indexOf(targetSeq);
  if (targetIndex === -1) {
    // dsh-vscode: the target was folded out of the model-visible surface by
    // compaction (its summary node replaced the span containing it). Rewinding
    // it is still meaningful: drop the shadowing node and everything after it,
    // exactly as if the target itself were the first dropped node. SurfaceOp
    // 'replace' guarantees the summary's sourceEventSeqs cites every node it
    // shadowed, so the covering node is always findable when the target really
    // is in the log. Walk backwards to the newest covering node.
    targetIndex = -1;
    const bySeq = /* @__PURE__ */ new Map();
    for (const event of events) bySeq.set(event.seq, event);
    for (let i = surface.length - 1; i >= 0; i--) {
      const node = bySeq.get(surface[i]);
      if (node === void 0 || !Array.isArray(node.sourceEventSeqs)) continue;
      if (node.sourceEventSeqs.indexOf(targetSeq) !== -1) {
        targetIndex = i;
        break;
      }
    }
    if (targetIndex === -1) {
      throw new RewindError(
        "not-on-surface",
        `user message at seq ${targetSeq} is no longer in the model context and its shadowing node was not found`
      );
    }
  }
  const shadowedSeqs = surface.slice(targetIndex);
  return {
    targetSeq,
    targetIndex,
    shadowedSeqs,
    surfaceStart: shadowedSeqs[0],
    surfaceEnd: shadowedSeqs[shadowedSeqs.length - 1]
  };
}

// src/snapshot.ts
import { constants } from "node:fs";
import { chmod, copyFile, lstat as lstat2, mkdir, readFile, readdir as readdir2, rename as rename2, rm as rm2, stat as stat2, unlink } from "node:fs/promises";
import { basename, dirname as dirname2, join as join2 } from "node:path";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";

// src/snapshot-format.ts
import { createHash } from "node:crypto";
import { isAbsolute } from "node:path";
var CURRENT_STORE_VERSION = 3;
var CHECKPOINTS_DIR = "checkpoints";
var VERSIONS_DIR = "versions";
var META_FILE = "meta.json";
var UnknownStoreVersionError = class extends Error {
  constructor(version, source) {
    super(`checkpoint store version ${version} is newer than this plugin understands (${source})`);
    this.version = version;
    this.source = source;
    this.name = "UnknownStoreVersionError";
  }
  version;
  source;
};
function safeFileId(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}
function safeSessionId(sessionId) {
  const safe = sessionId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe === "" || safe === ".." || safe === "." ? "session" : safe;
}
function shortHash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}
function pathHash(path) {
  return createHash("sha256").update(path).digest("hex").slice(0, 16);
}
function checkpointFileName(messageId) {
  return `${safeFileId(messageId)}-${shortHash(messageId)}.json`;
}
function versionFileName(path, v) {
  return `${pathHash(path)}@v${v}`;
}
var VERSION_NAME = /^[0-9a-f]{16}@v[1-9][0-9]*$/;
function isVersionFileName(name2) {
  return VERSION_NAME.test(name2);
}
function metaToJson(meta) {
  return { store: meta.store, sessionFormat: meta.sessionFormat };
}
function parseMeta(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return void 0;
  const record = raw;
  const store = record["store"];
  const sessionFormat = record["sessionFormat"];
  if (!isSafePositiveInteger(store) || !isSafePositiveInteger(sessionFormat)) return void 0;
  return { store, sessionFormat };
}
function checkpointToJson(checkpoint) {
  return {
    store: CURRENT_STORE_VERSION,
    messageId: checkpoint.messageId,
    time: checkpoint.time,
    files: checkpoint.files
  };
}
function parseCheckpoint(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return void 0;
  const record = raw;
  if (record["store"] !== CURRENT_STORE_VERSION) return void 0;
  const messageId = record["messageId"];
  if (typeof messageId !== "string" || messageId.length === 0) return void 0;
  const time = record["time"];
  if (typeof time !== "number" || !Number.isFinite(time) || time < 0) return void 0;
  const rawFiles = record["files"];
  if (rawFiles === null || typeof rawFiles !== "object" || Array.isArray(rawFiles)) return void 0;
  const files = {};
  for (const [path, value] of Object.entries(rawFiles)) {
    if (!isAbsolute(path)) return void 0;
    const state = parseFileState(value);
    if (state === void 0) return void 0;
    files[path] = state;
  }
  return { store: CURRENT_STORE_VERSION, messageId, time, files };
}
function parseFileState(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return void 0;
  const record = raw;
  const v = record["v"];
  if (!isSafePositiveInteger(v)) return void 0;
  const blob = record["blob"];
  if (blob !== null && (typeof blob !== "string" || !isVersionFileName(blob))) return void 0;
  const size = record["size"];
  if (blob === null) {
    if (size !== void 0) return void 0;
  } else if (!isSafeNonNegativeInteger(size)) {
    return void 0;
  }
  const mode = record["mode"];
  if (mode !== void 0 && (!isSafeNonNegativeInteger(mode) || mode > 4095)) return void 0;
  const parent = record["parent"];
  if (parent !== void 0 && (typeof parent !== "string" || parent.length === 0)) return void 0;
  return {
    v,
    blob,
    ...size !== void 0 ? { size } : {},
    ...mode !== void 0 ? { mode } : {},
    ...parent !== void 0 ? { parent } : {}
  };
}
function isSafePositiveInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function isSafeNonNegativeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

// src/snapshot-fs.ts
import { lstat, open, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute as isAbsolute2, join, relative, sep } from "node:path";
var COMPARE_CHUNK_BYTES = 64 * 1024;
async function sameFileBytes(aPath, bPath) {
  const sizes = await Promise.all([stat(aPath), stat(bPath)]);
  if (sizes[0].size !== sizes[1].size) return false;
  const [a, b] = await Promise.all([open(aPath, "r"), open(bPath, "r")]);
  try {
    const aChunk = Buffer.allocUnsafe(COMPARE_CHUNK_BYTES);
    const bChunk = Buffer.allocUnsafe(COMPARE_CHUNK_BYTES);
    for (; ; ) {
      const [ra, rb] = await Promise.all([
        a.read(aChunk, 0, COMPARE_CHUNK_BYTES, null),
        b.read(bChunk, 0, COMPARE_CHUNK_BYTES, null)
      ]);
      if (ra.bytesRead !== rb.bytesRead) return false;
      if (ra.bytesRead === 0) return true;
      if (!aChunk.subarray(0, ra.bytesRead).equals(bChunk.subarray(0, rb.bytesRead))) return false;
    }
  } finally {
    await Promise.all([a.close(), b.close()]);
  }
}
function isEnoent(error) {
  return error?.code === "ENOENT";
}
async function writeJsonAtomic(file, data, afterTempWrite) {
  const tmp = `${file}.tmp`;
  await rm(tmp, { force: true }).catch(() => void 0);
  await writeFile(tmp, JSON.stringify(data), { encoding: "utf8", flag: "wx" });
  afterTempWrite?.();
  await rename(tmp, file);
}
async function dirBytes(dir) {
  let names;
  try {
    names = await readdir(dir);
  } catch {
    return 0;
  }
  let total = 0;
  for (const name2 of names) {
    if (name2.endsWith(".tmp")) continue;
    const full = join(dir, name2);
    const st = await lstat(full).catch(() => void 0);
    if (st === void 0) continue;
    if (st.isDirectory()) total += await dirBytes(full);
    else if (st.isFile()) total += st.size;
  }
  return total;
}
async function isUnsafeTarget(path) {
  try {
    const st = await lstat(path);
    return !st.isFile() || st.nlink > 1;
  } catch (error) {
    return !isEnoent(error);
  }
}
async function nearestExistingAncestor(dir) {
  let current = dir;
  for (; ; ) {
    const st = await lstat(current).catch(() => void 0);
    if (st !== void 0) return current;
    const parent = dirname(current);
    if (parent === current) return void 0;
    current = parent;
  }
}
async function locationPin(path) {
  const dir = dirname(path);
  try {
    return await realpath(dir);
  } catch (error) {
    if (!isEnoent(error)) return void 0;
  }
  const ancestor = await nearestExistingAncestor(dir);
  if (ancestor === void 0) return void 0;
  try {
    return join(await realpath(ancestor), relative(ancestor, dir));
  } catch {
    return void 0;
  }
}
async function parentStillMatches(path, recorded) {
  if (recorded === void 0) return false;
  const dir = dirname(path);
  try {
    return await realpath(dir) === recorded;
  } catch (error) {
    if (!isEnoent(error)) return false;
  }
  const ancestor = await nearestExistingAncestor(dir);
  if (ancestor === void 0) return false;
  try {
    const real = await realpath(ancestor);
    const inside = relative(real, recorded);
    const escapes = inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute2(inside);
    return inside !== "" && !escapes;
  } catch {
    return false;
  }
}
async function dirSizeAndLastActive(dir) {
  let size = 0;
  let lastActiveMs = 0;
  const visit = async (current) => {
    let st;
    try {
      st = await lstat(current);
    } catch {
      return;
    }
    if (st.mtimeMs > lastActiveMs) lastActiveMs = st.mtimeMs;
    if (!st.isDirectory()) {
      size += st.size;
      return;
    }
    let names;
    try {
      names = await readdir(current);
    } catch {
      return;
    }
    for (const name2 of names) {
      if (name2.endsWith(".tmp")) continue;
      await visit(join(current, name2));
    }
  };
  await visit(dir);
  return { size, lastActiveMs };
}

// src/snapshot.ts
var SNAPSHOT_DIR_NAME = "rewind-snapshots";
var DEFAULT_MAX_FILE_BYTES = 8 * 1024 * 1024;
var RETAINED_CHECKPOINTS = 100;
var SnapshotStore = class {
  /** Resolved store root (absolute). */
  root;
  maxFileBytes;
  hooks;
  sessions = /* @__PURE__ */ new Map();
  legacyWarned = /* @__PURE__ */ new Set();
  constructor(root, opts) {
    this.maxFileBytes = opts?.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
    this.hooks = opts?.testHooks ?? {};
    this.root = root ?? join2(resolveDshHome(opts?.dshHome), SNAPSHOT_DIR_NAME);
  }
  /** Absolute path of one session's store directory. */
  sessionDir(sessionId) {
    return join2(this.root, safeSessionId(sessionId));
  }
  /** True when `size` is over the per-file cap. */
  isOverFileCap(size) {
    return this.maxFileBytes > 0 && size !== void 0 && size > this.maxFileBytes;
  }
  /** The cap in force, for reporting (0 = unlimited). */
  get fileCapBytes() {
    return this.maxFileBytes;
  }
  /** Whether this store has already loaded `sessionId`. */
  isLoaded(sessionId) {
    return this.sessions.get(sessionId)?.loaded === true;
  }
  /** True when a path exists on disk. */
  async exists(path) {
    try {
      await stat2(path);
      return true;
    } catch (error) {
      if (isEnoent(error)) return false;
      throw error;
    }
  }
  /**
   * Load (or reload) one session: read meta, drop corrupt/orphan manifests,
   * retain the newest 100, and GC. Returns one-time warnings for the caller to
   * log. A newer store sets the session unavailable instead of throwing.
   */
  async loadSession(session, opts) {
    return await this.withLock(session.id, async (state) => {
      if (state.loaded && opts?.force !== true) return { warnings: [] };
      this.resetState(state);
      const warnings = [];
      await this.loadLocked(state, session, warnings);
      state.loaded = true;
      return { warnings };
    });
  }
  /**
   * Create one dense checkpoint per user message in `messageIds`, all with the
   * same pre-step file states and increasing times; the last becomes current.
   * Returns per-file warnings; the caller logs them without blocking the step.
   */
  async createCheckpoints(sessionId, sessionVersion, messageIds) {
    if (messageIds.length === 0) return { warnings: [] };
    return await this.withLock(sessionId, async (state) => {
      this.assertUsable(state);
      state.current = void 0;
      const warnings = [];
      const previous = state.order.at(-1);
      const files = previous === void 0 ? {} : await this.scanFiles(sessionId, previous.files, warnings);
      const created = [];
      let lastTime = state.lastTime;
      await this.ensureMeta(sessionId, sessionVersion);
      try {
        for (const messageId of messageIds) {
          const time = Math.max(Date.now(), lastTime + 1);
          lastTime = time;
          const checkpoint = {
            store: CURRENT_STORE_VERSION,
            messageId,
            time,
            files: { ...files },
            file: join2(this.checkpointsDir(sessionId), checkpointFileName(messageId))
          };
          await writeJsonAtomic(checkpoint.file, checkpointToJson(checkpoint));
          created.push(checkpoint);
        }
      } catch (error) {
        for (const checkpoint of created) await rm2(checkpoint.file, { force: true });
        throw error;
      }
      for (const checkpoint of created) {
        state.checkpoints.set(checkpoint.file, checkpoint);
        state.order.push(checkpoint);
      }
      state.lastTime = lastTime;
      state.current = created.at(-1);
      state.tracked = new Set(Object.keys(state.current.files));
      this.trimRetained(state);
      try {
        warnings.push(...await this.gc(sessionId, state));
      } catch (error) {
        warnings.push(`checkpoint GC failed: ${messageOf(error)}`);
      }
      return { warnings };
    });
  }
  /**
   * Drop the current checkpoint reference without touching disk. Used when a
   * step's batch could not be checkpointed: first touches in the rest of that
   * turn are skipped instead of landing in the previous message's manifest.
   */
  async abandonCurrent(sessionId) {
    await this.withLock(sessionId, async (state) => {
      state.current = void 0;
    });
  }
  /**
   * Record the pre-touch state of a path the current step has not seen yet.
   * A missing current checkpoint means the plugin mounted mid-turn: skip, so
   * later rows can never migrate into the previous message's manifest.
   */
  async captureFirstTouch(sessionId, path) {
    return await this.withLock(sessionId, async (state) => {
      if (!state.loaded) throw new Error(`checkpoint store for ${sessionId} is not loaded`);
      if (state.unavailable !== void 0) throw state.unavailable;
      const current = state.current;
      if (current === void 0) return { recorded: false, warnings: [] };
      if (Object.hasOwn(current.files, path)) return { recorded: false, warnings: [] };
      const warnings = [];
      let live;
      try {
        live = await lstat2(path);
      } catch (error) {
        if (!isEnoent(error)) {
          warnings.push(`first-touch probe failed for ${path}: ${messageOf(error)}`);
          return { recorded: false, warnings };
        }
      }
      const parent = await locationPin(path);
      if (parent === void 0) {
        warnings.push(`first-touch skipped ${path}: no location pin`);
        return { recorded: false, warnings };
      }
      let row;
      if (live === void 0) {
        row = { v: 1, blob: null, parent };
      } else {
        if (!live.isFile() || live.nlink > 1) return { recorded: false, warnings };
        if (this.isOverFileCap(live.size)) return { recorded: false, warnings };
        let written;
        try {
          written = await this.writeVersion(sessionId, path, 1);
        } catch (error) {
          warnings.push(`first-touch copy failed for ${path}: ${messageOf(error)}`);
          return { recorded: false, warnings };
        }
        row = { v: 1, blob: written.name, size: written.size, mode: live.mode & 4095, parent };
      }
      current.files[path] = row;
      try {
        await writeJsonAtomic(current.file, checkpointToJson(current));
      } catch (error) {
        delete current.files[path];
        throw error;
      }
      state.tracked.add(path);
      return { recorded: true, warnings };
    });
  }
  /**
   * Compute one target's preview in a single plan pass: the actions that would
   * change the disk and the tracked paths currently over the per-file cap.
   */
  async preview(sessionId, messageId) {
    return await this.withLock(sessionId, async (state) => {
      this.assertUsable(state);
      const plan = await this.planLocked(state, messageId);
      return {
        files: plan.actions.map((action) => ({ path: action.path, action: action.action })).sort((a, b) => a.path.localeCompare(b.path)),
        uncovered: plan.uncovered
      };
    });
  }
  /** Restore the workspace to one message's checkpoint. */
  async restoreAfter(sessionId, messageId) {
    return await this.withLock(sessionId, async (state) => {
      this.assertUsable(state);
      const plan = await this.planLocked(state, messageId);
      const restored = [];
      const deleted = [];
      const skipped = [...plan.skipped];
      const failed = [...plan.failed];
      if (plan.noCheckpoint) {
        return { restored, deleted, skipped, failed, noCheckpoint: true };
      }
      for (const action of plan.actions) {
        if (!await parentStillMatches(action.path, action.parent)) {
          skipped.push({ path: action.path, reason: "parent" });
          continue;
        }
        if (await isUnsafeTarget(action.path)) {
          skipped.push({ path: action.path, reason: "unsafe" });
          continue;
        }
        if (action.action === "delete") {
          try {
            await unlink(action.path);
            deleted.push(action.path);
          } catch (error) {
            if (!isEnoent(error)) failed.push({ path: action.path, message: messageOf(error) });
          }
          continue;
        }
        try {
          await this.applyRestore(action);
          restored.push(action.path);
        } catch (error) {
          failed.push({ path: action.path, message: messageOf(error) });
        }
      }
      return { restored, deleted, skipped, failed, noCheckpoint: false };
    });
  }
  /** Read the store format marker, or `null` when absent/unreadable. */
  async readStoreVersion(sessionId) {
    try {
      const raw = JSON.parse(await readFile(join2(this.sessionDir(sessionId), META_FILE), "utf8"));
      return parseMeta(raw)?.store ?? null;
    } catch {
      return null;
    }
  }
  /** Remove one session's entire directory and reset its in-memory state. */
  async clearSession(sessionId, opts) {
    const dryRun = opts?.dryRun ?? false;
    return await this.withLock(sessionId, async (state) => {
      const entries = await this.countCheckpoints(sessionId);
      const bytes = await dirBytes(this.sessionDir(sessionId));
      if (!dryRun) {
        await rm2(this.sessionDir(sessionId), { recursive: true, force: true });
        this.resetState(state);
      }
      return { sessionId, entries, bytes, dryRun };
    });
  }
  /** Remove idle session directories, keeping the active one. */
  async pruneStale(opts) {
    const { keepActiveId, dryRun = false } = opts;
    const maxAgeDays = opts.maxAgeDays;
    if (!Number.isFinite(maxAgeDays) || maxAgeDays <= 0) {
      throw new RangeError("pruneStale: maxAgeDays must be a positive finite number");
    }
    const cutoffMs = Date.now() - maxAgeDays * 864e5;
    let scanned = 0;
    let deleted = 0;
    let freedBytes = 0;
    let kept = 0;
    let skippedActive = 0;
    let remainingBytes = 0;
    const report = () => ({ scanned, deleted, freedBytes, kept, remainingBytes, skippedActive, dryRun });
    let names;
    try {
      names = await readdir2(this.root);
    } catch (error) {
      if (isEnoent(error)) return report();
      throw error;
    }
    for (const name2 of names) {
      const full = join2(this.root, name2);
      const st = await lstat2(full).catch(() => void 0);
      if (st === void 0 || !st.isDirectory()) continue;
      scanned++;
      if (keepActiveId !== void 0 && safeSessionId(keepActiveId) === name2) {
        skippedActive++;
        remainingBytes += (await dirSizeAndLastActive(full)).size;
        continue;
      }
      const { size, lastActiveMs } = await dirSizeAndLastActive(full);
      if (lastActiveMs < cutoffMs) {
        deleted++;
        freedBytes += size;
        if (!dryRun) await rm2(full, { recursive: true, force: true });
      } else {
        kept++;
        remainingBytes += size;
      }
    }
    if (!dryRun) await this.forgetMissingSessions();
    return report();
  }
  /**
   * Number of snapshots in one session directory for the clear report: current
   * manifests plus legacy per-call entry JSONs (whole-session cleanup reports
   * everything it removes). Legacy members are counted by name only; their
   * contents are never read.
   */
  async countCheckpoints(sessionId) {
    let count = (await readdir2(this.checkpointsDir(sessionId)).catch(() => [])).filter((name2) => name2.endsWith(".json")).length;
    const legacyDirs = (await readdir2(this.sessionDir(sessionId)).catch(() => [])).filter((name2) => /^\d+$/.test(name2));
    for (const name2 of legacyDirs) {
      count += (await readdir2(join2(this.sessionDir(sessionId), name2)).catch(() => [])).filter((file) => file.endsWith(".json")).length;
    }
    return count;
  }
  /** Store directories for one session. */
  checkpointsDir(sessionId) {
    return join2(this.sessionDir(sessionId), CHECKPOINTS_DIR);
  }
  versionsDir(sessionId) {
    return join2(this.sessionDir(sessionId), VERSIONS_DIR);
  }
  /** Create the per-session meta file at the first checkpoint. */
  async ensureMeta(sessionId, sessionVersion) {
    const dir = this.sessionDir(sessionId);
    const metaPath = join2(dir, META_FILE);
    await mkdir(this.checkpointsDir(sessionId), { recursive: true });
    try {
      await stat2(metaPath);
      return;
    } catch (error) {
      if (!isEnoent(error)) throw error;
    }
    await mkdir(dir, { recursive: true });
    await writeJsonAtomic(metaPath, metaToJson({ store: CURRENT_STORE_VERSION, sessionFormat: sessionVersion }));
  }
  /** Re-read every tracked path for one new message boundary. */
  async scanFiles(sessionId, previous, warnings) {
    const next = {};
    for (const [path, row] of Object.entries(previous)) {
      next[path] = await this.recheckRow(sessionId, path, row, warnings);
    }
    return next;
  }
  /** Reconcile one path's recorded row against the live disk. */
  async recheckRow(sessionId, path, previous, warnings) {
    let live;
    try {
      live = await lstat2(path);
    } catch (error) {
      if (!isEnoent(error)) {
        warnings.push(`checkpoint probe failed for ${path}: ${messageOf(error)}`);
        return previous;
      }
    }
    const parent = await locationPin(path);
    if (live === void 0) {
      if (previous.blob === null) return previous;
      if (parent === void 0) {
        warnings.push(`checkpoint skipped ${path}: no location pin`);
        return previous;
      }
      return { v: previous.v + 1, blob: null, parent };
    }
    if (!live.isFile() || live.nlink > 1) return previous;
    if (this.isOverFileCap(live.size)) return previous;
    if (parent === void 0) {
      warnings.push(`checkpoint skipped ${path}: no location pin`);
      return previous;
    }
    const same = await this.contentUnchanged(sessionId, path, previous, live);
    if (same) {
      return { ...previous, mode: live.mode & 4095, parent };
    }
    let written;
    try {
      written = await this.writeVersion(sessionId, path, previous.v + 1);
    } catch (error) {
      warnings.push(`checkpoint copy failed for ${path}: ${messageOf(error)}`);
      return previous;
    }
    return {
      v: previous.v + 1,
      blob: written.name,
      size: written.size,
      mode: live.mode & 4095,
      parent
    };
  }
  /** `(size, mtime)` fast path, then a streaming byte compare. */
  async contentUnchanged(sessionId, path, previous, live) {
    if (previous.blob === null || previous.size === void 0) return false;
    const versionPath = join2(this.versionsDir(sessionId), previous.blob);
    const version = await lstat2(versionPath).catch(() => void 0);
    if (version === void 0 || !version.isFile() || version.size !== previous.size) return false;
    if (live.size === previous.size && live.mtimeMs < version.mtimeMs) return true;
    try {
      return await sameFileBytes(versionPath, path);
    } catch {
      return false;
    }
  }
  /** Copy current bytes into a version file (temp + rename). */
  async writeVersion(sessionId, path, v) {
    const dir = this.versionsDir(sessionId);
    await mkdir(dir, { recursive: true });
    const name2 = versionFileName(path, v);
    const dest = join2(dir, name2);
    const temp = `${dest}.tmp`;
    try {
      await rm2(temp, { force: true }).catch(() => void 0);
      await copyFile(path, temp, constants.COPYFILE_EXCL);
      const copied = await stat2(temp);
      await rename2(temp, dest);
      return { name: name2, size: copied.size };
    } catch (error) {
      await rm2(temp, { force: true }).catch(() => void 0);
      throw error;
    }
  }
  /** Compute the restore plan while holding the session lock. */
  async planLocked(state, messageId) {
    const target = state.order.find((checkpoint) => checkpoint.messageId === messageId);
    if (target === void 0 || state.order.length === 0) {
      return { actions: [], skipped: [], failed: [], uncovered: [], noCheckpoint: true };
    }
    const latest = state.order[state.order.length - 1];
    const actions = [];
    const skipped = [];
    const failed = [];
    const uncovered = [];
    for (const path of Object.keys(latest.files)) {
      const row = Object.hasOwn(target.files, path) ? target.files[path] : this.firstRowAfter(state, target.time, path);
      if (row === void 0) {
        skipped.push({ path, reason: "missing" });
        continue;
      }
      if (row.parent === void 0) {
        skipped.push({ path, reason: "parent" });
        continue;
      }
      if (row.blob === null) {
        const live2 = await lstat2(path).catch((error) => {
          if (!isEnoent(error)) return void 0;
          return null;
        });
        if (live2 === null) continue;
        if (live2 !== void 0 && live2.isFile() && this.isOverFileCap(live2.size)) {
          uncovered.push({ path, size: live2.size });
        }
        if (live2 !== void 0 && !await parentStillMatches(path, row.parent)) {
          skipped.push({ path, reason: "parent" });
          continue;
        }
        if (await isUnsafeTarget(path)) {
          skipped.push({ path, reason: "unsafe" });
          continue;
        }
        actions.push({ path, action: "delete", parent: row.parent });
        continue;
      }
      const source = join2(this.versionsDir(state.sessionId), row.blob);
      const version = await lstat2(source).catch(() => void 0);
      if (version === void 0 || !version.isFile() || version.size !== row.size) {
        failed.push({ path, message: "recorded version is missing or has the wrong size" });
        continue;
      }
      if (!await parentStillMatches(path, row.parent)) {
        skipped.push({ path, reason: "parent" });
        continue;
      }
      if (await isUnsafeTarget(path)) {
        skipped.push({ path, reason: "unsafe" });
        continue;
      }
      const live = await lstat2(path).catch(() => void 0);
      if (live !== void 0 && live.isFile() && this.isOverFileCap(live.size)) {
        uncovered.push({ path, size: live.size });
        skipped.push({ path, reason: "oversized" });
        continue;
      }
      if (live !== void 0 && live.isFile() && live.size === row.size && live.mtimeMs < version.mtimeMs) {
        continue;
      }
      if (live !== void 0 && live.isFile()) {
        let same;
        try {
          same = await sameFileBytes(source, path);
        } catch (error) {
          failed.push({ path, message: messageOf(error) });
          continue;
        }
        if (same) continue;
      }
      actions.push({
        path,
        action: "restore",
        source,
        size: row.size,
        ...row.mode !== void 0 ? { mode: row.mode } : {},
        parent: row.parent
      });
    }
    actions.sort((a, b) => a.path.localeCompare(b.path));
    uncovered.sort((a, b) => a.path.localeCompare(b.path));
    return { actions, skipped, failed, uncovered, noCheckpoint: false };
  }
  /** Earliest retained row containing `path` strictly after `time`. */
  firstRowAfter(state, time, path) {
    for (const checkpoint of state.order) {
      if (checkpoint.time <= time) continue;
      if (Object.hasOwn(checkpoint.files, path)) return checkpoint.files[path];
    }
    return void 0;
  }
  /** Atomically replace one target with a version file. */
  async applyRestore(action) {
    await mkdir(dirname2(action.path), { recursive: true });
    const temp = `${action.path}.rewind-tmp`;
    try {
      await rm2(temp, { force: true }).catch(() => void 0);
      await copyFile(action.source, temp, constants.COPYFILE_EXCL);
      const copied = await stat2(temp);
      if (copied.size !== action.size) throw new Error(`version ${basename(action.source)} changed size during restore`);
      await this.hooks.beforeRestoreRename?.();
      try {
        await rename2(temp, action.path);
      } catch (error) {
        const current = await stat2(action.path).catch(() => void 0);
        if (current === void 0 || (current.mode & 128) !== 0) throw error;
        await chmod(action.path, current.mode | 128).catch(() => void 0);
        await rename2(temp, action.path);
      }
      if (action.mode !== void 0) await chmod(action.path, action.mode).catch(() => void 0);
    } finally {
      await rm2(temp, { force: true }).catch(() => void 0);
    }
  }
  /** Load one session's retained manifests and GC. */
  async loadLocked(state, session, warnings) {
    const dir = this.sessionDir(session.id);
    let names;
    try {
      names = await readdir2(dir);
    } catch (error) {
      if (isEnoent(error)) return;
      throw error;
    }
    if (this.hasLegacyMembers(names) && !this.legacyWarned.has(session.id)) {
      this.legacyWarned.add(session.id);
      warnings.push(`legacy snapshot data ignored for ${session.id}`);
    }
    const metaPath = join2(dir, META_FILE);
    let raw;
    try {
      raw = await readFile(metaPath, "utf8");
    } catch (error) {
      if (!isEnoent(error)) throw error;
      if (names.includes(CHECKPOINTS_DIR) || names.includes(VERSIONS_DIR)) {
        warnings.push(`checkpoint metadata missing for ${session.id}; discarded new storage`);
        await this.discardNewStorage(session.id);
      }
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      warnings.push(`checkpoint metadata corrupt for ${session.id}; discarded new storage`);
      await this.discardNewStorage(session.id);
      return;
    }
    const meta = parseMeta(parsed);
    if (meta === void 0) {
      warnings.push(`checkpoint metadata corrupt for ${session.id}; discarded new storage`);
      await this.discardNewStorage(session.id);
      return;
    }
    if (meta.store > CURRENT_STORE_VERSION) {
      state.unavailable = new UnknownStoreVersionError(meta.store, metaPath);
      warnings.push(`file restore disabled for ${session.id}: ${state.unavailable.message}`);
      return;
    }
    if (meta.store !== CURRENT_STORE_VERSION) {
      warnings.push(`checkpoint storage for ${session.id} discarded: store format ${meta.store} is not supported`);
      await this.discardNewStorage(session.id);
      return;
    }
    if (meta.sessionFormat !== session.version) {
      warnings.push(`checkpoint storage for ${session.id} discarded: session format ${session.version} does not match stored ${meta.sessionFormat}`);
      await this.discardNewStorage(session.id);
      return;
    }
    const messageIds = new Set(session.messageIds);
    let checkpointNames;
    try {
      checkpointNames = await readdir2(this.checkpointsDir(session.id));
    } catch (error) {
      if (!isEnoent(error)) throw error;
      checkpointNames = [];
    }
    for (const name2 of checkpointNames) {
      if (!name2.endsWith(".json")) continue;
      const file = join2(this.checkpointsDir(session.id), name2);
      const info = await lstat2(file).catch(() => void 0);
      if (info === void 0 || !info.isFile()) {
        warnings.push(`corrupt checkpoint ${name2} discarded for ${session.id}`);
        await rm2(file, { recursive: true, force: true }).catch(() => void 0);
        continue;
      }
      let raw2;
      try {
        raw2 = await readFile(file, "utf8");
      } catch (error) {
        if (isEnoent(error)) continue;
        throw error;
      }
      let checkpoint;
      try {
        checkpoint = parseCheckpoint(JSON.parse(raw2));
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        checkpoint = void 0;
      }
      if (checkpoint === void 0) {
        warnings.push(`corrupt checkpoint ${name2} discarded for ${session.id}`);
        await rm2(file, { force: true }).catch(() => void 0);
        continue;
      }
      if (!messageIds.has(checkpoint.messageId) || name2 !== checkpointFileName(checkpoint.messageId)) {
        await rm2(file, { force: true }).catch(() => void 0);
        continue;
      }
      state.checkpoints.set(file, { ...checkpoint, file });
    }
    state.order = [...state.checkpoints.values()].sort((a, b) => a.time - b.time || a.file.localeCompare(b.file));
    this.trimRetained(state);
    if (state.order.length > 0) {
      const latest = state.order[state.order.length - 1];
      state.lastTime = latest.time;
      state.tracked = new Set(Object.keys(latest.files));
    }
    state.current = void 0;
    try {
      warnings.push(...await this.gc(session.id, state));
    } catch (error) {
      warnings.push(`checkpoint GC failed for ${session.id}: ${messageOf(error)}`);
    }
  }
  /** True when a legacy per-call snapshot member is present. */
  hasLegacyMembers(names) {
    return names.some((name2) => /^\d+$/.test(name2) || name2 === "store" || name2 === "format" || name2 === "rescue" || name2 === ".pending" || name2.startsWith("journal-") || name2.startsWith("restore-journal-"));
  }
  /** Delete only the new storage; legacy members are left untouched. */
  async discardNewStorage(sessionId) {
    const dir = this.sessionDir(sessionId);
    for (const name2 of [META_FILE, CHECKPOINTS_DIR, VERSIONS_DIR]) {
      await rm2(join2(dir, name2), { recursive: true, force: true }).catch(() => void 0);
    }
  }
  /** Keep the newest {@link RETAINED_CHECKPOINTS} manifests in memory. */
  trimRetained(state) {
    if (state.order.length <= RETAINED_CHECKPOINTS) return;
    const evicted = state.order.slice(0, state.order.length - RETAINED_CHECKPOINTS);
    for (const checkpoint of evicted) state.checkpoints.delete(checkpoint.file);
    state.order = state.order.slice(-RETAINED_CHECKPOINTS);
  }
  /** Delete unreferenced versions and non-retained manifests. */
  async gc(sessionId, state) {
    const warnings = [];
    const retained = state.order.slice(-RETAINED_CHECKPOINTS);
    const retainedFiles = new Set(retained.map((checkpoint) => checkpoint.file));
    const keep = /* @__PURE__ */ new Set();
    for (const checkpoint of retained) {
      for (const row of Object.values(checkpoint.files)) {
        if (row.blob !== null) keep.add(row.blob);
      }
    }
    const checkpointNames = await readdir2(this.checkpointsDir(sessionId)).catch(() => []);
    for (const name2 of checkpointNames) {
      if (!name2.endsWith(".json") && !name2.endsWith(".tmp")) continue;
      const file = join2(this.checkpointsDir(sessionId), name2);
      if (!name2.endsWith(".tmp") && retainedFiles.has(file)) continue;
      await rm2(file, { force: true }).catch((error) => warnings.push(`failed to remove ${file}: ${messageOf(error)}`));
    }
    const versionNames = await readdir2(this.versionsDir(sessionId)).catch(() => []);
    for (const name2 of versionNames) {
      if (!name2.endsWith(".tmp") && keep.has(name2)) continue;
      const file = join2(this.versionsDir(sessionId), name2);
      await rm2(file, { force: true }).catch((error) => warnings.push(`failed to remove ${file}: ${messageOf(error)}`));
    }
    await rm2(join2(this.sessionDir(sessionId), `${META_FILE}.tmp`), { force: true }).catch(() => void 0);
    return warnings;
  }
  /** Drop in-memory state after a clear or a removed directory. */
  resetState(state) {
    state.loaded = false;
    state.unavailable = void 0;
    state.checkpoints.clear();
    state.order = [];
    state.current = void 0;
    state.tracked.clear();
    state.lastTime = 0;
  }
  /** Drop state for sessions whose directory disappeared out of band. */
  async forgetMissingSessions() {
    for (const [sessionId, state] of this.sessions) {
      const present = await this.exists(this.sessionDir(sessionId)).catch(() => true);
      if (!present) {
        this.resetState(state);
        this.sessions.delete(sessionId);
      }
    }
  }
  /** Throw the stored unavailable error, if any. */
  assertUsable(state) {
    if (!state.loaded) throw new Error("checkpoint store session is not loaded");
    if (state.unavailable !== void 0) throw state.unavailable;
  }
  /** Run `fn` after every earlier mutation of this session. */
  async withLock(sessionId, fn) {
    const state = this.stateOf(sessionId);
    const run = state.lock.then(() => fn(state));
    state.lock = run.then(() => void 0, () => void 0);
    return await run;
  }
  stateOf(sessionId) {
    let state = this.sessions.get(sessionId);
    if (state === void 0) {
      state = {
        sessionId,
        loaded: false,
        checkpoints: /* @__PURE__ */ new Map(),
        order: [],
        tracked: /* @__PURE__ */ new Set(),
        lastTime: 0,
        lock: Promise.resolve()
      };
      this.sessions.set(sessionId, state);
    }
    return state;
  }
};
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/snapshot-cleanup.ts
import { mkdir as mkdir2, readFile as readFile2, rename as rename3, writeFile as writeFile2 } from "node:fs/promises";
import { dirname as dirname3, join as join3 } from "node:path";
import { resolveDshHome as resolveDshHome2 } from "@deepseek-ai/dsh-home-paths";
var DEFAULT_MAX_AGE_DAYS = 30;
var DEFAULT_CLEANUP_CONFIG = { enabled: false, maxAgeDays: DEFAULT_MAX_AGE_DAYS };
function volatileCleanupStore(settings, writer) {
  return {
    load: () => ({
      enabled: settings.autoCleanupEnabled.get() ?? DEFAULT_CLEANUP_CONFIG.enabled,
      maxAgeDays: settings.autoCleanupMaxAgeDays.get() ?? DEFAULT_CLEANUP_CONFIG.maxAgeDays
    }),
    save: async (next) => {
      const parsed = parseCleanupConfig({ enabled: next.enabled, maxAgeDays: next.maxAgeDays });
      if (!parsed.ok) throw new RangeError(parsed.error);
      const clear = [];
      const patch = {};
      if (parsed.config.enabled === DEFAULT_CLEANUP_CONFIG.enabled) clear.push("autoCleanupEnabled");
      else patch.autoCleanupEnabled = parsed.config.enabled;
      if (parsed.config.maxAgeDays === DEFAULT_CLEANUP_CONFIG.maxAgeDays) clear.push("autoCleanupMaxAgeDays");
      else patch.autoCleanupMaxAgeDays = parsed.config.maxAgeDays;
      if (clear.length > 0) await writer.clear(writer.entryId, clear);
      if (Object.keys(patch).length > 0) await writer.update(writer.entryId, patch);
    }
  };
}
var AUTO_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1e3;
var STATE_FILENAME = "snapshot-cleanup-last-sweep.json";
function resolveCleanupStatePath(dshHome) {
  return join3(resolveDshHome2(dshHome), STATE_FILENAME);
}
async function loadLastSweepAt(path) {
  try {
    const raw = JSON.parse(await readFile2(path, "utf8"));
    const value = raw["lastSweepAt"];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}
async function saveLastSweepAt(path, ms) {
  const tmp = `${path}.tmp`;
  await mkdir2(dirname3(path), { recursive: true });
  await writeFile2(tmp, JSON.stringify({ lastSweepAt: ms }), "utf8");
  await rename3(tmp, path);
}
function isAborted(signal) {
  return signal?.aborted === true;
}
async function runAutoCleanupCheck(deps, sessionId) {
  try {
    const loaded = await deps.readConfig();
    if (!loaded.ok) {
      deps.log(`[dsh-rewind] snapshot cleanup config invalid; auto-cleanup skipped: ${loaded.error}`);
      return;
    }
    if (!loaded.config.enabled) return;
    if (isAborted(deps.signal)) return;
    if (!shouldRunAutoSweep(await loadLastSweepAt(deps.statePath), Date.now(), deps.intervalMs)) return;
    if (isAborted(deps.signal)) return;
    await deps.pruner.pruneStale({ keepActiveId: sessionId, maxAgeDays: loaded.config.maxAgeDays });
    if (isAborted(deps.signal)) return;
    await saveLastSweepAt(deps.statePath, Date.now());
  } catch (error) {
    deps.log(`[dsh-rewind] snapshot auto-cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function parseCleanupConfig(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "config must be a JSON object" };
  }
  const record = raw;
  let enabled = DEFAULT_CLEANUP_CONFIG.enabled;
  let maxAgeDays = DEFAULT_CLEANUP_CONFIG.maxAgeDays;
  if (record["enabled"] !== void 0) {
    if (typeof record["enabled"] !== "boolean") return { ok: false, error: '"enabled" must be a boolean' };
    enabled = record["enabled"];
  }
  if (record["maxAgeDays"] !== void 0) {
    const value = record["maxAgeDays"];
    if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
      return { ok: false, error: '"maxAgeDays" must be a positive integer' };
    }
    maxAgeDays = value;
  }
  return { ok: true, config: { enabled, maxAgeDays } };
}
function parseCleanupCommand(rawInput) {
  const parts = rawInput.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { action: "status" };
  switch (parts[0]) {
    case "status":
      return parts.length === 1 ? { action: "status" } : { error: "usage: /snapshot-auto-cleanup status" };
    case "on":
      return parts.length === 1 ? { action: "on" } : { error: "usage: /snapshot-auto-cleanup on" };
    case "off":
      return parts.length === 1 ? { action: "off" } : { error: "usage: /snapshot-auto-cleanup off" };
    case "max-age": {
      if (parts.length !== 2) return { error: "usage: /snapshot-auto-cleanup max-age <days>" };
      const days = Number(parts[1]);
      if (!Number.isInteger(days) || days <= 0) return { error: '"max-age" must be a positive integer (days)' };
      return { action: "max-age", value: days };
    }
    case "run-apply":
      return { error: 'the "run-apply" abbreviation was removed; use "run --apply"' };
    case "run": {
      let apply2 = false;
      let current = false;
      for (const rawFlag of parts.slice(1)) {
        if (rawFlag === "--apply") {
          apply2 = true;
        } else if (rawFlag === "--current") {
          current = true;
        } else {
          return { error: `unknown /snapshot-auto-cleanup run flag "${rawFlag}"` };
        }
      }
      return { action: "run", target: current ? "current" : "rules", apply: apply2 };
    }
    default:
      return { error: `unknown /snapshot-auto-cleanup subcommand "${parts[0]}"` };
  }
}
function shouldRunAutoSweep(lastAtMs, nowMs, intervalMs = AUTO_SWEEP_INTERVAL_MS) {
  return nowMs - lastAtMs >= intervalMs;
}

// src/index.ts
var name = "dsh-rewind";
var inject = ["commands", "tools", "settings"];
var ENGINE_COMMAND = "rewind-plugin";
var REWIND_PREVIEW_PATH = "/api/dsh-rewind/preview";
var REWIND_CANDIDATES_PATH = "/api/dsh-rewind/candidates";
var DEFAULT_FILE_CHECKPOINTING_ENABLED = true;
var Config = z.object({
  snapshotDir: z.string().required(false),
  dshHome: z.string().required(false),
  maxFileBytes: z.number().step(1).min(0).default(DEFAULT_MAX_FILE_BYTES),
  autoSweepIntervalMs: z.number().step(1).min(1).default(AUTO_SWEEP_INTERVAL_MS),
  fileCheckpointingEnabled: z.boolean().default(DEFAULT_FILE_CHECKPOINTING_ENABLED).volatile(),
  autoCleanupEnabled: z.boolean().default(DEFAULT_CLEANUP_CONFIG.enabled).volatile(),
  autoCleanupMaxAgeDays: z.number().step(1).min(1).default(DEFAULT_CLEANUP_CONFIG.maxAgeDays).volatile()
});
function isFileCheckpointingEnabled(config) {
  return config?.fileCheckpointingEnabled?.get() !== false;
}
var TRACKED_TOOLS = /* @__PURE__ */ new Set(["write", "edit"]);
function isSubagentSession(session) {
  const header = session.header;
  return header.origin === "subagent" || (header.delegationDepth ?? 0) > 0;
}
var activeLocale = "en";
var LOCALE_ENTRY = "locale";
var LOCALE_FIELD = "preference";
function readHostLocale(ctx) {
  try {
    const row = ctx.settings.describe({ redactSecrets: true }).find((entry) => entry.ns === LOCALE_ENTRY);
    return preferredLocale(row?.value?.[LOCALE_FIELD]);
  } catch {
    return "en";
  }
}
var cleanupStore;
function t(key, params) {
  return translate(activeLocale, key, params);
}
function warnCommandUnavailable(ctx, name2, error) {
  ctx.logger.warn(`[dsh-rewind] command "${name2}" was not registered: ${error instanceof Error ? error.message : String(error)}`);
  if (name2 === ENGINE_COMMAND) {
    ctx.logger.warn(`[dsh-rewind] the internal "${ENGINE_COMMAND}" engine channel is unavailable; rewind execution will not work.`);
  }
}
function mutationPathOf(exec) {
  const args = exec.arguments;
  if (exec.name === "write" || exec.name === "edit") {
    return typeof args.file_path === "string" ? args.file_path : void 0;
  }
  return void 0;
}
function storeSessionOf(session) {
  const messageIds = [];
  for (const event of session.snapshotEvents()) {
    if (event.type === "user/message") messageIds.push(event.data.id);
  }
  return { id: session.id, version: session.header.version, messageIds };
}
async function ensureStoreSession(store, session, log) {
  if (store.isLoaded(session.id)) return;
  const { warnings } = await store.loadSession(storeSessionOf(session));
  for (const warning of warnings) log(`[dsh-rewind] ${warning}`);
}
async function resolveTarget(fs, path, cwd, signal) {
  try {
    return await fs.resolve(path, { cwd, signal });
  } catch {
    return void 0;
  }
}
async function captureFirstTouch(ctx, fs, workingDirectory, store, exec) {
  if (!TRACKED_TOOLS.has(exec.name)) return;
  const agent = exec.agent;
  if (agent === void 0) return;
  if (isSubagentSession(agent.session)) return;
  const path = mutationPathOf(exec);
  if (path === void 0) return;
  const cwd = await workingDirectory.ensure(agent, exec.signal);
  const target = await resolveTarget(fs, path, cwd, exec.signal);
  if (target === void 0) return;
  if (fs.processPathFromHostPath(target.displayPath) === void 0) return;
  await ensureStoreSession(store, agent.session, (message) => ctx.logger.warn(message));
  const { warnings } = await store.captureFirstTouch(agent.session.id, target.displayPath);
  for (const warning of warnings) ctx.logger.warn(`[dsh-rewind] ${warning}`);
}
var REWIND_MARKER_CONTENT = [{ type: "text", text: "(empty message)" }];
function buildMarker() {
  return createUserMessage({
    content: REWIND_MARKER_CONTENT,
    source: REWIND_MARKER_SOURCE
  });
}
function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MiB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KiB`;
  return `${bytes} B`;
}
function resolveOrError(events, surface, raw) {
  const target = parseRewindTarget(raw);
  if (target === void 0) {
    throw new RewindError("invalid-index", t("error.invalidTarget", { raw }));
  }
  return planRewind(events, surface, target);
}
function targetMessageIdOf(session, targetSeq) {
  const event = session.snapshotEvents().find((candidate) => candidate.seq === targetSeq);
  return event?.type === "user/message" ? event.data.id : void 0;
}
async function previewImpact(ctx, store, session, seq, checkpointingEnabled) {
  const plan = resolveOrError(session.snapshotEvents(), session.surface.nodes, `@${seq}`);
  await ensureStoreSession(store, session, (message) => ctx.logger.warn(message));
  const messageId = targetMessageIdOf(session, plan.targetSeq);
  let preview = {
    files: [],
    uncovered: []
  };
  if (messageId !== void 0) {
    try {
      preview = await store.preview(session.id, messageId);
    } catch (error) {
      if (!(error instanceof UnknownStoreVersionError)) throw error;
      throw new Error(t("storeUnsupported", { version: await store.readStoreVersion(session.id) ?? 0 }));
    }
  }
  return { files: preview.files, uncovered: preview.uncovered, backupOff: !checkpointingEnabled };
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function queryFailure(code, message) {
  return { ok: false, error: { code, message, details: {} } };
}
function queryResponse(result) {
  return Response.json(result);
}
function createRewindQueryHandler(ctx, store, agentsOf, checkpointingEnabled, query) {
  return async (request) => {
    try {
      if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
        return new Response("content type must be application/json", { status: 415 });
      }
      let payload;
      try {
        payload = await request.json();
      } catch {
        return new Response("body is not JSON", { status: 400 });
      }
      if (!isRecord(payload)) return queryResponse(queryFailure("rewind/bad-request", "invalid payload"));
      const sessionId = payload["sessionId"];
      if (typeof sessionId !== "string" || sessionId.length === 0) {
        return queryResponse(queryFailure("rewind/bad-request", "sessionId must be a non-empty string"));
      }
      const agents = agentsOf();
      if (agents === void 0) return queryResponse(queryFailure("rewind/agents-unavailable", "agent registry is unavailable"));
      const agent = agents.get(sessionId);
      if (agent === void 0) return queryResponse(queryFailure("rewind/session-not-found", `session ${sessionId} is not attached`));
      const session = agent.session;
      if (query === "preview") {
        const seq = payload["seq"];
        if (!Number.isSafeInteger(seq)) return queryResponse(queryFailure("rewind/bad-request", "seq must be an integer"));
        return queryResponse({ ok: true, value: await previewImpact(ctx, store, session, seq, checkpointingEnabled()) });
      }
      return queryResponse({
        ok: true,
        value: { candidates: listRewindCandidates(session.snapshotEvents(), session.surface.nodes) }
      });
    } catch (error) {
      return queryResponse(queryFailure("rewind/failed", error instanceof Error ? error.message : String(error)));
    }
  };
}
function renderFailures(failed) {
  if (failed.length === 0) return "";
  return t("failures.suffix", {
    count: failed.length,
    list: failed.map((f) => t("failures.item", { path: f.path, message: f.message })).join(t("sep.list"))
  });
}
function renderSkipped(outcome, maxFileBytes) {
  const limit = formatBytes(maxFileBytes);
  return outcome.skipped.map((skip) => {
    const reason = {
      oversized: () => t("skipReason.oversized", { limit }),
      parent: () => t("skipReason.parent"),
      unsafe: () => t("skipReason.unsafe"),
      missing: () => t("skipReason.missing")
    }[skip.reason]();
    return t("plan.skip", { path: skip.path, reason });
  }).join("\n");
}
async function resolveObservationTarget(fs, path) {
  try {
    return await fs.resolve(path);
  } catch {
    return void 0;
  }
}
async function syncRestoreObservations(ctx, fs, agent, outcome) {
  if (fs === void 0) return;
  const actor = { agent };
  for (const path of outcome.deleted) {
    const target = await resolveObservationTarget(fs, path);
    if (target === void 0) continue;
    ctx.emit("fs/observed", target, { kind: "absent" }, actor);
  }
  for (const path of outcome.restored) {
    const target = await resolveObservationTarget(fs, path);
    if (target === void 0) continue;
    const info = await fs.stat(target).catch(() => void 0);
    if (info === void 0) continue;
    ctx.emit("fs/observed", target, { kind: "present", version: info.version }, actor);
  }
}
async function waitForAgentIdle(agent, signal, timeoutMs = 15e3) {
  if (signal.aborted) return false;
  let timer;
  let onAbort;
  try {
    await Promise.race([
      agent.whenIdle(),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("rewind idle wait timed out")), timeoutMs);
        onAbort = () => reject(new Error("rewind idle wait aborted"));
        signal.addEventListener("abort", onAbort, { once: true });
      })
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timer !== void 0) clearTimeout(timer);
    if (onAbort !== void 0) signal.removeEventListener("abort", onAbort);
  }
}
function dropPendingSteering(agent) {
  for (const message of [...agent.inbox.nextStep]) {
    agent.inbox.remove(message.id);
  }
}
async function executeRewind(ctx, store, fs, invocation, rawTarget, mode, inflight, checkpointingEnabled) {
  const { agent } = invocation;
  const sessionId = agent.session.id;
  if (inflight.has(sessionId)) {
    return { kind: "error", text: t("inflight") };
  }
  inflight.add(sessionId);
  try {
    if (agent.status !== "idle") {
      agent.cancel({ kind: "user" }, { keepInbox: true });
      const stopped = await waitForAgentIdle(agent, invocation.signal);
      if (!stopped) {
        return { kind: "error", text: t("stopFailed") };
      }
    }
    dropPendingSteering(agent);
    if (invocation.signal.aborted) {
      return { kind: "error", text: t("cancelled") };
    }
    let plan;
    try {
      plan = resolveOrError(agent.session.snapshotEvents(), agent.session.surface.nodes, rawTarget);
    } catch (error) {
      return rewindErrorResult(error);
    }
    const marker = buildMarker();
    let event;
    try {
      event = agent.session.append("user/message", marker, {
        surfaceOp: { op: "replace", startSeq: plan.surfaceStart, endSeq: plan.surfaceEnd },
        sourceEventSeqs: [...plan.shadowedSeqs]
      });
    } catch (error) {
      return {
        kind: "error",
        text: t("failed", { error: error instanceof Error ? error.message : String(error) })
      };
    }
    const targetMessageId = targetMessageIdOf(agent.session, plan.targetSeq);
    let restore = "";
    if (mode === "both") {
      let outcome;
      if (targetMessageId === void 0) {
        restore = `${t("sep.clause")}${t("noCheckpoint")}`;
      } else {
        await ensureStoreSession(store, agent.session, (message) => ctx.logger.warn(message));
        try {
          outcome = await store.restoreAfter(agent.session.id, targetMessageId);
        } catch (error) {
          if (!(error instanceof UnknownStoreVersionError)) throw error;
          const version = await store.readStoreVersion(agent.session.id);
          restore = `${t("sep.clause")}${t("storeUnsupported", { version: version ?? error.version })}`;
        }
      }
      if (outcome !== void 0) {
        await syncRestoreObservations(ctx, fs, agent, outcome);
        if (outcome.noCheckpoint) {
          restore = `${t("sep.clause")}${t("noCheckpoint")}`;
        } else {
          const parts = [];
          if (outcome.restored.length > 0) parts.push(t("restore.count", { count: outcome.restored.length }));
          if (outcome.deleted.length > 0) parts.push(t("delete.count", { count: outcome.deleted.length }));
          if (outcome.skipped.length > 0) {
            parts.push(t("skip.count", { count: outcome.skipped.length }));
            const skippedLines = renderSkipped(outcome, store.fileCapBytes);
            if (skippedLines !== "") parts.push(skippedLines);
          }
          if (!checkpointingEnabled) parts.push(t("backupOff"));
          restore = parts.length > 0 ? `${t("sep.clause")}${parts.join(t("sep.list"))}` : t("noRestorable");
        }
        restore += renderFailures(outcome.failed);
      }
    }
    return {
      kind: "success",
      text: t("success", { targetSeq: plan.targetSeq, restore }),
      sourceEventSeq: event.seq
    };
  } finally {
    inflight.delete(sessionId);
  }
}
function rewindErrorResult(error) {
  if (error instanceof RewindError) {
    const text = {
      "no-user-messages": t("noUserMessages"),
      "invalid-index": error.message,
      "not-a-user-message": error.message,
      "not-on-surface": error.message
    }[error.code];
    return { kind: "error", text };
  }
  throw error;
}
async function handleRewind(ctx, store, fs, invocation, inflight, checkpointingEnabled) {
  const session = invocation.agent.session;
  const input = invocation.rawInput.trim();
  if (input === "") {
    const candidates = listRewindCandidates(session.snapshotEvents(), session.surface.nodes, 1);
    if (candidates.length === 0) {
      return { kind: "error", text: t("noUserMessages") };
    }
    return executeRewind(ctx, store, fs, invocation, `@${candidates[0].seq}`, "chat", inflight, checkpointingEnabled);
  }
  const parts = input.split(/\s+/);
  const target = parts[0];
  const mode = parts[1];
  if (mode !== void 0 && mode !== "chat" && mode !== "both") {
    return { kind: "error", text: t("engine.rejected") };
  }
  if (mode === void 0) return { kind: "error", text: t("engine.rejected") };
  return executeRewind(ctx, store, fs, invocation, target, mode, inflight, checkpointingEnabled);
}
var autoSweepChecked = false;
async function maybeRunAutoCleanup(ctx, store, sessionId, dshHome, sweepIntervalMs, signal) {
  if (autoSweepChecked || signal?.aborted === true) return;
  autoSweepChecked = true;
  try {
    await runAutoCleanupCheck({
      pruner: store,
      readConfig: () => readCleanupPolicy(),
      statePath: resolveCleanupStatePath(dshHome),
      log: (msg) => ctx.logger.warn(msg),
      ...sweepIntervalMs === void 0 ? {} : { intervalMs: sweepIntervalMs },
      ...signal === void 0 ? {} : { signal }
    }, sessionId);
  } catch (error) {
    try {
      ctx.logger.warn(`[dsh-rewind] snapshot auto-cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    } catch {
    }
  }
}
async function readCleanupPolicy() {
  if (cleanupStore === void 0) {
    return { ok: false, error: "cleanup policy unavailable; snapshot cleanup policy cannot be read" };
  }
  return { ok: true, config: cleanupStore.load() };
}
async function writeCleanupPolicy(next) {
  if (cleanupStore === void 0) throw new Error("cleanup policy unavailable; snapshot cleanup policy cannot be written");
  await cleanupStore.save(next);
}
function formatCleanupReport(report) {
  const key = report.dryRun ? "cleanup.runDry" : "cleanup.runApply";
  const text = t(key, {
    deleted: report.deleted,
    freed: report.freedBytes,
    kept: report.kept,
    remaining: report.remainingBytes
  });
  return report.skippedActive > 0 ? `${text}
${t("cleanup.skipped", { skipped: report.skippedActive })}` : text;
}
async function handleSnapshotCleanup(store, invocation, dshHome) {
  const parsed = parseCleanupCommand(invocation.rawInput);
  if ("error" in parsed) return { kind: "error", text: t("cleanup.usage") };
  switch (parsed.action) {
    case "status": {
      const loaded = await readCleanupPolicy();
      if (!loaded.ok) return { kind: "error", text: t("cleanup.cfgInvalid", { detail: loaded.error }) };
      return {
        kind: "success",
        text: t("cleanup.status", {
          state: t(loaded.config.enabled ? "cleanup.enabled" : "cleanup.disabled"),
          days: loaded.config.maxAgeDays
        })
      };
    }
    case "on":
    case "off": {
      const loaded = await readCleanupPolicy();
      const next = { ...loaded.ok ? loaded.config : DEFAULT_CLEANUP_CONFIG, enabled: parsed.action === "on" };
      try {
        await writeCleanupPolicy(next);
      } catch (error) {
        return { kind: "error", text: t("cleanup.saveFailed", { detail: error instanceof Error ? error.message : String(error) }) };
      }
      return { kind: "success", text: t(parsed.action === "on" ? "cleanup.onOk" : "cleanup.offOk") };
    }
    case "max-age": {
      const loaded = await readCleanupPolicy();
      const next = { ...loaded.ok ? loaded.config : DEFAULT_CLEANUP_CONFIG, maxAgeDays: parsed.value };
      try {
        await writeCleanupPolicy(next);
      } catch (error) {
        return { kind: "error", text: t("cleanup.saveFailed", { detail: error instanceof Error ? error.message : String(error) }) };
      }
      return { kind: "success", text: t("cleanup.maxAgeOk", { days: parsed.value }) };
    }
    case "run": {
      const apply2 = parsed.apply;
      if (parsed.target === "current") {
        return handleClearCurrent(store, invocation, apply2);
      }
      const loaded = await readCleanupPolicy();
      if (!loaded.ok) return { kind: "error", text: t("cleanup.cfgInvalid", { detail: loaded.error }) };
      try {
        const report = await store.pruneStale({
          keepActiveId: invocation.agent.session.id,
          maxAgeDays: loaded.config.maxAgeDays,
          dryRun: !apply2
        });
        if (!report.dryRun) await saveLastSweepAt(resolveCleanupStatePath(dshHome), Date.now());
        return { kind: "success", text: formatCleanupReport(report) };
      } catch (error) {
        return { kind: "error", text: t("cleanup.runFailed", { detail: error instanceof Error ? error.message : String(error) }) };
      }
    }
  }
}
function formatClearReport(report) {
  const key = report.dryRun ? "cleanup.clearDry" : "cleanup.clearApply";
  return t(key, {
    entries: report.entries,
    bytes: report.bytes
  });
}
async function handleClearCurrent(store, invocation, apply2) {
  const { agent } = invocation;
  const sessionId = agent.session.id;
  if (apply2) {
    if (agent.status !== "idle") {
      agent.cancel({ kind: "user" }, { keepInbox: true });
      const stopped = await waitForAgentIdle(agent, invocation.signal);
      if (!stopped) {
        return { kind: "error", text: t("cleanup.clearActive", { sessionId }) };
      }
    }
    if (invocation.signal.aborted) {
      return { kind: "error", text: t("cleanup.clearCancelled") };
    }
  }
  try {
    const report = await store.clearSession(sessionId, { dryRun: !apply2 });
    return { kind: "success", text: formatClearReport(report) };
  } catch (error) {
    return { kind: "error", text: t("cleanup.clearFailed", { detail: error instanceof Error ? error.message : String(error), sessionId }) };
  }
}
var INCLUDE_ENTRY_PREFIX = "include:";
function rewindConfigKey(ctx) {
  return ctx.fiber?.entry?.id;
}
function profileEntryKey(entryId) {
  if (entryId === void 0) return void 0;
  return entryId.startsWith(INCLUDE_ENTRY_PREFIX) ? entryId.slice(INCLUDE_ENTRY_PREFIX.length) : entryId;
}
function apply(ctx, config) {
  activeLocale = readHostLocale(ctx);
  cleanupStore = void 0;
  autoSweepChecked = false;
  const lifecycle = new AbortController();
  ctx.effect(() => () => {
    lifecycle.abort();
  }, "dsh-rewind lifecycle abort");
  ctx.inject(["settings"], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber), "dsh-rewind page policy");
  });
  const dshHome = config?.dshHome;
  const store = new SnapshotStore(config?.snapshotDir, {
    dshHome,
    maxFileBytes: config?.maxFileBytes
  });
  const configKey = profileEntryKey(rewindConfigKey(ctx));
  if (config !== void 0 && configKey !== void 0) {
    const writer = {
      entryId: configKey,
      update: (id, patch) => ctx.settings.update(id, patch),
      clear: (id, fields) => ctx.settings.mutate(id, fields.map((field) => ({ op: "unset", path: [field] })))
    };
    cleanupStore = volatileCleanupStore(config, writer);
  }
  const inflight = /* @__PURE__ */ new Set();
  let fsService;
  ctx.effect(function* () {
    const withHostLocale = (handler) => (invocation) => {
      activeLocale = readHostLocale(ctx);
      return handler(invocation);
    };
    const rewindHandler = withHostLocale(
      (invocation) => handleRewind(ctx, store, fsService, invocation, inflight, isFileCheckpointingEnabled(config))
    );
    const engineHandler = withHostLocale(
      (invocation) => invocation.rawInput.trim() === "" ? Promise.resolve({ kind: "error", text: t("engine.rejected") }) : handleRewind(ctx, store, fsService, invocation, inflight, isFileCheckpointingEnabled(config))
    );
    try {
      yield ctx.commands.register({
        name: "rewind",
        description: t("command.description"),
        handler: rewindHandler
      });
    } catch (error) {
      warnCommandUnavailable(ctx, "rewind", error);
    }
    try {
      yield ctx.commands.register({
        name: "undo",
        description: t("command.undoDescription"),
        handler: rewindHandler
      });
    } catch (error) {
      warnCommandUnavailable(ctx, "undo", error);
    }
    try {
      yield ctx.commands.register({
        name: ENGINE_COMMAND,
        description: t("engine.description"),
        input: { hint: t("engine.inputHint") },
        handler: engineHandler
      });
    } catch (error) {
      warnCommandUnavailable(ctx, ENGINE_COMMAND, error);
    }
    try {
      yield ctx.commands.register({
        name: "snapshot-auto-cleanup",
        description: t("cleanup.description"),
        input: { hint: t("cleanup.inputHint") },
        handler: withHostLocale((invocation) => handleSnapshotCleanup(store, invocation, dshHome))
      });
    } catch (error) {
      warnCommandUnavailable(ctx, "snapshot-auto-cleanup", error);
    }
  }, "dsh-rewind command");
  ctx.on("agent/created", async ({ agent }) => {
    const session = agent.session;
    if (isSubagentSession(session)) return;
    try {
      if (lifecycle.signal.aborted) return;
      const { warnings } = await store.loadSession(storeSessionOf(session), { force: true });
      for (const warning of warnings) ctx.logger.warn(`[dsh-rewind] ${warning}`);
    } catch (error) {
      ctx.logger.warn(`[dsh-rewind] checkpoint store load failed for ${session.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, { global: true });
  ctx.on("agent/pre-step", async ({ agent }, next) => {
    const decision = await next();
    if (decision.kind !== "enter" || lifecycle.signal.aborted) return decision;
    const session = agent.session;
    if (isSubagentSession(session)) return decision;
    void maybeRunAutoCleanup(ctx, store, session.id, dshHome, config?.autoSweepIntervalMs, lifecycle.signal);
    try {
      if (!isFileCheckpointingEnabled(config)) {
        await store.abandonCurrent(session.id).catch(() => void 0);
        return decision;
      }
      if (inflight.has(session.id)) return decision;
      await ensureStoreSession(store, session, (message) => ctx.logger.warn(message));
      const batch = [];
      const seen = /* @__PURE__ */ new Set();
      for (const message of decision.messages) {
        if (message.source.kind !== "user" || seen.has(message.id)) continue;
        seen.add(message.id);
        batch.push(message.id);
      }
      if (batch.length === 0) return decision;
      const { warnings } = await store.createCheckpoints(session.id, session.header.version, batch);
      for (const warning of warnings) ctx.logger.warn(`[dsh-rewind] ${warning}`);
    } catch (error) {
      await store.abandonCurrent(agent.session.id).catch(() => void 0);
      ctx.logger.warn(`[dsh-rewind] checkpoint creation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return decision;
  }, { prepend: true, global: true });
  ctx.inject(["connection"], (scope) => {
    const connection = scope.connection;
    if (connection === void 0) return;
    const agentsOf = () => scope.get("agents");
    const checkpointingEnabled = () => isFileCheckpointingEnabled(config);
    const register = (path, query) => {
      try {
        scope.effect(() => connection.fetch.register({
          path,
          methods: ["POST"],
          requestBody: "buffered",
          fetch: createRewindQueryHandler(ctx, store, agentsOf, checkpointingEnabled, query)
        }), `dsh-rewind ${path} route`);
      } catch (error) {
        ctx.logger.error(`[dsh-rewind] route registration failed for ${path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    register(REWIND_PREVIEW_PATH, "preview");
    register(REWIND_CANDIDATES_PATH, "candidates");
  });
  ctx.inject(["fs", "workingDirectory"], (scope) => {
    const fs = scope.fs;
    const workingDirectory = scope.workingDirectory;
    fsService = fs;
    scope.effect(() => () => {
      fsService = void 0;
    }, "dsh-rewind fs capture");
    scope.on("tools/execute", async (exec, next) => {
      if (lifecycle.signal.aborted) return next();
      const session = exec.agent?.session;
      if (session !== void 0 && !isSubagentSession(session)) {
        void maybeRunAutoCleanup(ctx, store, session.id, dshHome, config?.autoSweepIntervalMs, lifecycle.signal);
      }
      try {
        if (!isFileCheckpointingEnabled(config)) {
          if (session !== void 0 && !isSubagentSession(session)) {
            await store.abandonCurrent(session.id).catch(() => void 0);
          }
        } else {
          await captureFirstTouch(ctx, fs, workingDirectory, store, exec);
        }
      } catch (error) {
        ctx.logger.warn(`[dsh-rewind] first-touch capture failed for ${exec.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
      return next();
    });
  });
}
export {
  Config,
  DEFAULT_FILE_CHECKPOINTING_ENABLED,
  ENGINE_COMMAND,
  SnapshotStore,
  apply,
  inject,
  name,
  profileEntryKey
};
