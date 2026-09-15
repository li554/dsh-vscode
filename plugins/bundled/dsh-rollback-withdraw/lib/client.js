window.__ModuleLoader__.load({
  id: "dsh-rollback-withdraw",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    let react = require("react");
    const React = react;

    const CSS =
      '.rlbk-btn{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0;margin:0;font-size:12px;line-height:1}' +
      '.rlbk-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}' +
      '.rlbk-btn[data-armed]{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent)}' +
      '.rlbk-btn:disabled{opacity:.4;cursor:not-allowed}' +
      '.rlbk-err{font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary);margin-left:6px;white-space:nowrap}' +
      '.rlbk-time{font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary)}' +
      '.rlbk-user-row{display:flex;flex-direction:column;align-items:flex-end;gap:4px;min-width:0}' +
      '.rlbk-user-stack{display:flex;flex-direction:column;align-items:flex-end;gap:6px;max-width:100%}' +
      '.rlbk-bubble{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:8px 12px;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:22px;max-width:min(640px,100%)}' +
      '.rlbk-extra{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:8px 12px;overflow:auto;max-width:min(640px,100%);font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}' +
      '.rlbk-img{border-radius:8px;max-width:min(320px,100%);max-height:240px;object-fit:cover}' +
      '.rlbk-user-actions{display:flex;align-items:center;gap:4px}' +
      '.rlbk-git-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0;margin:0;opacity:.55;position:relative}' +
      '.rlbk-git-btn:hover{background:var(--dsw-alias-bg-layer-2);opacity:1}' +
      '.rlbk-git-btn[data-repo]{opacity:1}' +
      '.rlbk-git-btn[data-on]{color:var(--dsw-alias-brand-primary)}' +
      '.rlbk-git-btn[data-on]::after{content:"";position:absolute;width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-state-success-primary);bottom:3px;right:3px}' +
      '.rlbk-git-btn:disabled{opacity:.35;cursor:not-allowed}';

    if (typeof document !== "undefined") {
      try {
        const styleId = "dsh-rollback-withdraw-css";
        if (document.getElementById(styleId) === null) {
          const tag = document.createElement("style");
          tag.id = styleId;
          tag.textContent = CSS;
          document.head.appendChild(tag);
        }
      } catch (e) { /* ignore */ }
    }

    async function rpc(method, args) {
      try {
        const res = await fetch("/rollback/rpc", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ method, args: args || {} })
        });
        return await res.json();
      } catch (e) {
        return null;
      }
    }

    const ERRORS = {
      "no-snapshot": "该消息早于插件安装，无可恢复快照",
      "running": "当前回合正在运行，请等待结束",
      "no-prior-turn": "第一条消息无法撤回",
      "session-not-found": "会话不存在",
      "message-not-found": "无法定位该消息",
      "bad-args": "参数错误",
      "no-workspace": "会话没有工作区",
      "restore-failed": "代码恢复失败，请检查工作区",
      "fork-failed": "会话分叉失败",
      "rollback-failed": "回滚失败"
    };

    const inject = ["slots", "sessions", "timer"];

    function apply(ctx) {
      const slots = ctx.get("slots");
      const sessions = ctx.get("sessions");
      if (slots === undefined || sessions === undefined) return;

      const initTriggered = new Set();
      function ensureInit(sessionId) {
        if (initTriggered.has(sessionId)) return;
        initTriggered.add(sessionId);
        rpc("init", { sessionId }).then(() => {}).catch(() => {});
      }

      async function executeWithdraw(sessionId, kind, ident) {
        const res = await rpc("prepare", { sessionId, kind, ...ident });
        if (!res || !res.ok) return { ok: false, reason: (res && res.reason) || "unknown" };
        const childId = await sessions.fork({ sessionId, atSeq: res.boundarySeq, increaseTitle: true });
        sessions.open(childId);
        return { ok: true };
      }

      function undoIcon() {
        return React.createElement("svg", {
          viewBox: "0 0 16 16",
          width: 14,
          height: 14,
          "aria-hidden": true,
          style: { display: "block" }
        }, React.createElement("path", {
          d: "M6.2 2.8L2 7l4.2 4.2M2 7h6.8a3.4 3.4 0 0 1 0 6.8",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.5,
          strokeLinecap: "round",
          strokeLinejoin: "round"
        }));
      }

      function gitIcon() {
        return React.createElement("svg", {
          viewBox: "0 0 16 16",
          width: 15,
          height: 15,
          "aria-hidden": true,
          style: { display: "block", position: "relative" }
        },
          React.createElement("circle", { cx: 4, cy: 4, r: 1.7, fill: "currentColor" }),
          React.createElement("circle", { cx: 4, cy: 12, r: 1.7, fill: "currentColor" }),
          React.createElement("circle", { cx: 12, cy: 5, r: 1.7, fill: "currentColor" }),
          React.createElement("path", {
            d: "M4 5.7v4.6M4 5.7c0 3.2 4 2.6 8 2.8",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 1.4,
            strokeLinecap: "round"
          })
        );
      }

      const timer = ctx.get("timer");

      function WithdrawControl({ disabled, onWithdraw }) {
        const [armed, setArmed] = React.useState(false);
        const [busy, setBusy] = React.useState(false);
        const [dead, setDead] = React.useState(false);
        const [error, setError] = React.useState(null);
        const disarmTimer = React.useRef(null);
        React.useEffect(() => () => {
          if (disarmTimer.current) disarmTimer.current();
        }, []);
        const effDisabled = disabled || dead || busy;
        const click = async () => {
          if (effDisabled) return;
          if (!armed) {
            setError(null);
            setArmed(true);
            if (disarmTimer.current) disarmTimer.current();
            disarmTimer.current = timer !== undefined ? timer.timeout(() => setArmed(false), 3000) : null;
            return;
          }
          setBusy(true);
          try {
            const outcome = await onWithdraw();
            if (!outcome.ok) {
              setError(ERRORS[outcome.reason] || "回滚失败");
              if (outcome.reason === "no-snapshot" || outcome.reason === "no-prior-turn") setDead(true);
            }
          } catch (e) {
            setError(ERRORS["rollback-failed"]);
          } finally {
            setBusy(false);
            setArmed(false);
          }
        };
        return React.createElement(React.Fragment, null,
          React.createElement("button", {
            type: "button",
            className: "rlbk-btn",
            "data-armed": armed || undefined,
            disabled: effDisabled,
            title: armed ? "再次点击确认撤回" : "撤回到此消息之前（恢复代码并回滚对话）",
            "aria-label": "撤回",
            onClick: click
          }, busy ? React.createElement("span", null, "…") : undoIcon()),
          error !== null && React.createElement("span", { className: "rlbk-err" }, error)
        );
      }

      function GitToggle({ sessionId }) {
        const [state, setState] = React.useState(null);
        const [busy, setBusy] = React.useState(false);
        React.useEffect(() => {
          let alive = true;
          rpc("config.get", { sessionId }).then((r) => {
            if (alive && r && r.ok) setState({ gitAutoCommit: r.gitAutoCommit, inGitRepo: r.inGitRepo });
          }).catch(() => {});
          return () => { alive = false; };
        }, [sessionId]);
        const toggle = async () => {
          if (busy || state === null) return;
          setBusy(true);
          try {
            const next = !state.gitAutoCommit;
            const r = await rpc("config.set", { sessionId, gitAutoCommit: next });
            if (r && r.ok) setState({ ...state, gitAutoCommit: next });
          } catch (e) { /* keep state */ } finally { setBusy(false); }
        };
        const on = state !== null && state.gitAutoCommit;
        const inRepo = state !== null && state.inGitRepo;
        const title = state === null
          ? "加载中…"
          : inRepo
            ? (on ? "git 模式已开启：每回合结束自动 commit 作为回滚点（点击关闭）" : "git 模式已关闭：使用文件快照作为回滚点（点击开启）")
            : "当前工作区不是 git 仓库，此开关暂不生效";
        return React.createElement("button", {
          type: "button",
          className: "rlbk-git-btn",
          "data-on": on || undefined,
          "data-repo": inRepo || undefined,
          disabled: state === null || busy || (state !== null && !state.inGitRepo),
          title,
          "aria-label": "git 自动提交回滚点开关",
          onClick: toggle
        }, gitIcon());
      }

      slots.inject("conversation.chat.assistant-actions", () => slots.register(
        { name: "conversation.chat.assistant-actions", id: "rollback-withdraw", order: 20, priority: -10 },
        (props) => React.createElement(WithdrawControl, {
          disabled: false,
          onWithdraw: () => executeWithdraw(props.sessionId, "assistant", { messageId: props.messageId })
        })
      ));

      slots.inject("conversation.session.header.actions", () => slots.register(
        { name: "conversation.session.header.actions", id: "rollback-git-toggle", order: 30, priority: -10 },
        (props) => React.createElement(GitToggle, { sessionId: props.sessionId })
      ));

      function ImageItem({ attachment, load }) {
        const [src, setSrc] = React.useState(null);
        React.useEffect(() => {
          let alive = true;
          Promise.resolve(load(attachment)).then((url) => { if (alive) setSrc(url); }).catch(() => {});
          return () => { alive = false; };
        }, [attachment, load]);
        return src === null ? null : React.createElement("img", { src, className: "rlbk-img", alt: "" });
      }

      function UserWithRollback({ node, sessionId, loadImage }) {
        const data = node && node.data;
        React.useEffect(() => { ensureInit(sessionId); }, [sessionId]);
        if (!data) return null;

        const texts = [];
        const images = [];
        const rest = [];
        const content = Array.isArray(data.content) ? data.content : [];
        for (const block of content) {
          if (block && block.type === "text" && typeof block.text === "string") texts.push(block.text);
          else if (block && block.type === "image" && block.attachment !== undefined) images.push(block.attachment);
          else rest.push(block);
        }
        const text = texts.join("");
        const seq = typeof data.seq === "number" ? data.seq : -1;
        const time = typeof data.time === "number"
          ? new Date(data.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : null;

        return React.createElement("div", { className: "rlbk-user-row", "data-time-hover-root": true },
          React.createElement("div", { className: "rlbk-user-stack" },
            images.map((attachment, i) => React.createElement(ImageItem, { key: i, attachment, load: loadImage })),
            text !== "" && React.createElement("div", { className: "rlbk-bubble" }, text),
            rest.map((block, i) => React.createElement("div", {
              key: i,
              className: "rlbk-extra"
            }, JSON.stringify(block, null, 2)))
          ),
          React.createElement("div", { className: "rlbk-user-actions" },
            time !== null && React.createElement("span", { className: "rlbk-time" }, time),
            React.createElement(WithdrawControl, {
              disabled: false,
              onWithdraw: () => executeWithdraw(sessionId, "user", { seq })
            })
          )
        );
      }

      slots.inject("conversation.chat.node", () => slots.register(
        { name: "conversation.chat.node", key: "user", priority: -10 },
        (props) => React.createElement(UserWithRollback, {
          node: props.node,
          sessionId: props.sessionId,
          loadImage: props.loadImage
        })
      ));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
