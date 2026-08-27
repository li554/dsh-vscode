/**
 * dsh-archive-manager — browser half (Codex Archive Manager, settings section).
 *
 * Registers an independent "归档管理" settings section in DeepSeek Harness Settings.
 * Features:
 *   1. View & preview archived session transcripts (with user/assistant chat history).
 *   2. Unarchive (restore) sessions back to sidebar.
 *   3. Physically delete archived sessions from disk (session.jsonl.zstd) and registries.
 *   4. Batch deletion & project-level cleanup.
 */

(function () {
  'use strict';

  window.__ModuleLoader__.load({
    id: '@mlgbnb/dsh-archive-manager',
    factory: function (require) {
      var module = { exports: {} };
      var exports = module.exports;
      Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

      var React = require('react');
      var h = React.createElement;
      var useState = React.useState;
      var useEffect = React.useEffect;
      var useRef = React.useRef;

      var API_BASE = '/api/dsh-archive-manager';
      var CSS_ID = 'dsh-archive-manager-codex-styles';
      var NS = 'archive-manager';

      // ---- Codex (lucide) SVG icons ----
      function svgEl(children, size) {
        size = size || 14;
        return h('svg', {
          width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
          stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round',
          strokeLinejoin: 'round', xmlns: 'http://www.w3.org/2000/svg'
        }, children);
      }
      function IconArchive(s) { return svgEl([h('rect', { width: 20, height: 5, x: 2, y: 3, rx: 1 }), h('path', { d: 'M4 8v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8' }), h('path', { d: 'M10 12h4' })], s); }
      function IconSearch(s) { return svgEl([h('circle', { cx: 11, cy: 11, r: 8 }), h('path', { d: 'm21 21-4.3-4.3' })], s); }
      function IconFolder(s) { return svgEl([h('path', { d: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z' })], s); }
      function IconTrash(s) { return svgEl([h('path', { d: 'M3 6h18' }), h('path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' }), h('path', { d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }), h('line', { x1: 10, x2: 10, y1: 11, y2: 17 }), h('line', { x1: 14, x2: 14, y1: 11, y2: 17 })], s); }
      function IconEye(s) { return svgEl([h('path', { d: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z' }), h('circle', { cx: 12, cy: 12, r: 3 })], s); }
      function IconRotateCcw(s) { return svgEl([h('path', { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }), h('path', { d: 'M3 3v5h5' })], s); }
      function IconFilter(s) { return svgEl([h('polygon', { points: '22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3' })], s); }
      function IconChevronDown(s) { return svgEl([h('path', { d: 'm6 9 6 6 6-6' })], s); }
      function IconCheck(s) { return svgEl([h('path', { d: 'M20 6 9 17l-5-5' })], s); }
      function IconClose(s) { return svgEl([h('path', { d: 'M18 6 6 18' }), h('path', { d: 'm6 6 12 12' })], s); }
      function IconMore(s) { return svgEl([h('circle', { cx: 12, cy: 12, r: 1 }), h('circle', { cx: 19, cy: 12, r: 1 }), h('circle', { cx: 5, cy: 12, r: 1 })], s); }
      function IconHardDrive(s) { return svgEl([h('line', { x1: 22, x2: 2, y1: 12, y2: 12 }), h('path', { d: 'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z' }), h('line', { x1: 6, x2: 6.01, y1: 16, y2: 16 }), h('line', { x1: 10, x2: 10.01, y1: 16, y2: 16 })], s); }

      // ---- CSS ----
      var CSS_TEXT = [
        '[data-dsh-archive-manager] { list-style: none; }',
        '.cdx-am-section-header { display: flex; align-items: flex-start; gap: 12px; padding: 4px 4px 16px 4px; }',
        '.cdx-am-section-icon { color: var(--dsw-alias-label-secondary, #61666b); display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px; background: var(--dsw-alias-bg-module-platform, #f5f6f7); flex-shrink: 0; margin-top: 2px; }',
        '.cdx-am-section-titles { display: flex; flex-direction: column; gap: 2px; min-width: 0; }',
        '.cdx-am-section-title { font-size: 18px; font-weight: 600; color: var(--dsw-alias-label-primary, #0f1115); line-height: 1.3; margin: 0; }',
        '.cdx-am-section-lede { font-size: 13px; color: var(--dsw-alias-label-tertiary, #86909c); margin: 0; line-height: 1.4; }',
        '.cdx-am-container { padding: 4px 0 6px 0; display: flex; flex-direction: column; gap: 14px; box-sizing: border-box; width: 100%; position: relative; }',
        '.cdx-am-container * { box-sizing: border-box; }',
        '.cdx-am-search-row { width: 100%; position: relative; box-sizing: border-box; }',
        '.cdx-am-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--dsw-alias-label-tertiary, #86909c); pointer-events: none; display: inline-flex; }',
        '.cdx-am-search-input { width: 100%; height: 36px; padding: 0 34px 0 34px; background: var(--dsw-alias-bg-module-platform, #f5f6f7); border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1)); border-radius: 18px; color: var(--dsw-alias-label-primary, #0f1115); font-size: 13px; outline: none; box-sizing: border-box; transition: border-color 0.15s, background 0.15s; }',
        '.cdx-am-search-input:focus { border-color: var(--dsw-alias-brand-primary, #3b82f6); background: var(--dsw-alias-bg-base, #ffffff); }',
        '.cdx-am-search-input::placeholder { color: var(--dsw-alias-label-tertiary, #86909c); }',
        '.cdx-am-search-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 20px; height: 20px; border-radius: 50%; background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06)); border: none; color: var(--dsw-alias-label-tertiary, #86909c); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.12s; }',
        '.cdx-am-search-clear:hover { background: var(--dsw-alias-interactive-bg-active, rgba(0, 0, 0, 0.12)); color: var(--dsw-alias-label-primary, #0f1115); }',
        '.cdx-am-filter-row { display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box; }',
        '.cdx-am-btn-delete-all { height: 34px; padding: 0 14px; border-radius: 18px; font-size: 13px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; flex-shrink: 0; transition: all 0.15s; border: 1px solid var(--dsw-alias-state-error-secondary, rgba(220, 38, 38, 0.35)); background: transparent; color: var(--dsw-alias-state-error-primary, #dc2626); white-space: nowrap; }',
        '.cdx-am-btn-delete-all:hover { background: var(--dsw-alias-interactive-bg-hover-danger, rgba(220, 38, 38, 0.08)); border-color: var(--dsw-alias-state-error-primary, #dc2626); }',
        '.cdx-am-btn-delete-all:disabled { opacity: 0.45; cursor: default; }',
        '.cdx-am-dropdown-container { flex: 1; min-width: 0; position: relative; }',
        '.cdx-am-dropdown-btn { width: 100%; height: 34px; padding: 0 12px; background: var(--dsw-alias-bg-module-platform, #f5f6f7); border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08)); border-radius: 18px; color: var(--dsw-alias-label-primary, #0f1115); font-size: 13px; outline: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: space-between; gap: 8px; user-select: none; box-sizing: border-box; transition: background 0.15s, border-color 0.15s; }',
        '.cdx-am-dropdown-btn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05)); border-color: var(--dsw-alias-label-dimmed, rgba(0, 0, 0, 0.16)); }',
        '.cdx-am-dropdown-icon { color: var(--dsw-alias-label-tertiary, #86909c); display: inline-flex; align-items: center; flex-shrink: 0; }',
        '.cdx-am-dropdown-label { flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 400; color: var(--dsw-alias-label-primary, inherit); }',
        '.cdx-am-dropdown-chevron { color: var(--dsw-alias-label-tertiary, #86909c); display: inline-flex; align-items: center; flex-shrink: 0; transition: transform 0.15s ease; }',
        '.cdx-am-dropdown-chevron.open { transform: rotate(180deg); }',
        '.cdx-am-dropdown-popover { position: absolute; left: 0; top: calc(100% + 4px); min-width: 100%; max-height: 240px; overflow-y: auto; z-index: 1000; background: var(--dsw-alias-bg-layer-2, #ffffff); border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1)); border-radius: 10px; padding: 4px; box-shadow: var(--dsw-shadow-lv2, 0 8px 24px rgba(0, 0, 0, 0.14)); display: none; box-sizing: border-box; }',
        '.cdx-am-dropdown-popover[data-open=\"true\"] { display: flex; flex-direction: column; gap: 2px; animation: cdxFadeIn 0.12s ease-out; }',
        '.cdx-am-dropdown-item { width: 100%; min-height: 32px; padding: 6px 10px; border-radius: 6px; background: transparent; border: none; color: var(--dsw-alias-label-primary, #0f1115); font-size: 13px; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 8px; box-sizing: border-box; transition: background 0.12s; }',
        '.cdx-am-dropdown-item:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05)); }',
        '.cdx-am-dropdown-item.selected { font-weight: 500; color: var(--dsw-alias-brand-primary, #3b82f6); }',
        '.cdx-am-dropdown-item-check { width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--dsw-alias-brand-primary, #3b82f6); }',
        '.cdx-am-dropdown-item-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
        '.cdx-am-group { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }',
        '.cdx-am-group-header { display: flex; align-items: center; justify-content: space-between; padding: 4px 4px; color: var(--dsw-alias-label-secondary, #61666b); font-size: 13px; position: relative; }',
        '.cdx-am-btn-more { width: 28px; height: 28px; border-radius: 6px; background: transparent; border: none; color: var(--dsw-alias-label-tertiary, #86909c); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: color 0.15s, background 0.15s; }',
        '.cdx-am-btn-more:hover { color: var(--dsw-alias-label-primary, inherit); background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05)); }',
        '.cdx-am-menu-popover { position: absolute; right: 0; top: calc(100% + 4px); z-index: 100; background: var(--dsw-alias-bg-layer-2, #ffffff); border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1)); border-radius: 8px; padding: 4px; box-shadow: var(--dsw-shadow-lv2, 0 8px 24px rgba(0, 0, 0, 0.12)); white-space: nowrap; width: max-content; display: none; }',
        '.cdx-am-menu-popover[data-open=\"true\"] { display: block; animation: cdxFadeIn 0.12s ease-out; }',
        '.cdx-am-menu-item { width: 100%; height: 32px; padding: 0 12px; border-radius: 4px; background: transparent; border: none; color: var(--dsw-alias-state-error-primary, #dc2626); font-size: 13px; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 8px; white-space: nowrap; transition: background 0.12s; }',
        '.cdx-am-menu-item:hover { background: var(--dsw-alias-interactive-bg-hover-danger, rgba(220, 38, 38, 0.08)); color: var(--dsw-alias-state-error-primary, #dc2626); }',
        '.cdx-am-group-title { display: inline-flex; align-items: center; gap: 8px; font-weight: 500; color: var(--dsw-alias-label-primary, inherit); }',
        '.cdx-am-group-meta { display: inline-flex; align-items: center; gap: 8px; color: var(--dsw-alias-label-tertiary, #86909c); font-size: 12px; }',
        '.cdx-am-group-list { background: var(--dsw-alias-bg-layer-1, rgba(0, 0, 0, 0.02)); border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08)); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }',
        '.cdx-am-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.06)); transition: background 0.12s; gap: 12px; }',
        '.cdx-am-item:last-child { border-bottom: none; }',
        '.cdx-am-item:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.04)); }',
        '.cdx-am-item-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }',
        '.cdx-am-item-title { color: var(--dsw-alias-label-primary, inherit); font-size: 13.5px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.4; }',
        '.cdx-am-item-meta-line { display: flex; align-items: center; gap: 12px; font-size: 12px; color: var(--dsw-alias-label-tertiary, #86909c); }',
        '.cdx-am-item-size-badge { display: inline-flex; align-items: center; gap: 4px; padding: 1px 6px; border-radius: 4px; background: var(--dsw-alias-bg-module-platform, rgba(0,0,0,0.04)); font-family: monospace; font-size: 11px; }',
        '.cdx-am-item-actions { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; }',
        '.cdx-am-btn-action { height: 28px; padding: 0 10px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.15s; border: 1px solid transparent; }',
        '.cdx-am-btn-preview { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05)); border-color: var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08)); color: var(--dsw-alias-label-primary, inherit); }',
        '.cdx-am-btn-preview:hover { background: var(--dsw-alias-interactive-bg-active, rgba(0, 0, 0, 0.09)); }',
        '.cdx-am-btn-unarchive { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06)); border-color: var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1)); color: var(--dsw-alias-label-primary, inherit); }',
        '.cdx-am-btn-unarchive:hover { background: var(--dsw-alias-interactive-bg-active, rgba(0, 0, 0, 0.1)); border-color: var(--dsw-alias-label-dimmed, rgba(0, 0, 0, 0.2)); }',
        '.cdx-am-btn-danger { background: transparent; border-color: transparent; color: var(--dsw-alias-state-error-primary, #dc2626); }',
        '.cdx-am-btn-danger:hover { background: var(--dsw-alias-interactive-bg-hover-danger, rgba(220, 38, 38, 0.08)); }',
        '.cdx-am-empty { padding: 32px 16px; text-align: center; color: var(--dsw-alias-label-tertiary, #86909c); font-size: 13px; }',
        '.cdx-am-loading { padding: 24px; text-align: center; color: var(--dsw-alias-label-tertiary, #86909c); font-size: 13px; }',
        '.cdx-am-toast { padding: 8px 12px; border-radius: 6px; font-size: 12.5px; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between; gap: 8px; animation: cdxFadeIn 0.15s ease-out; }',
        '.cdx-am-toast-error { background: var(--dsw-alias-interactive-bg-hover-danger, rgba(239, 68, 68, 0.12)); color: var(--dsw-alias-state-error-primary, #ef4444); border: 1px solid var(--dsw-alias-state-error-secondary, rgba(239, 68, 68, 0.3)); }',
        '.cdx-am-toast-success { background: var(--dsw-alias-state-success-tertiary, rgba(34, 197, 94, 0.12)); color: var(--dsw-alias-state-success-primary, #22c55e); border: 1px solid var(--dsw-alias-state-success-secondary, rgba(34, 197, 94, 0.3)); }',
        '.cdx-am-toast-close { background: transparent; border: none; color: inherit; opacity: 0.7; cursor: pointer; padding: 2px; border-radius: 4px; display: flex; align-items: center; justify-content: center; }',
        '.cdx-am-toast-close:hover { opacity: 1; background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.08)); }',

        '/* Modal Backdrop & Dialog */',
        '.cdx-am-modal-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; animation: cdxFadeIn 0.15s ease-out; }',
        '.cdx-am-modal { width: 100%; max-width: 680px; max-height: 85vh; background: var(--dsw-alias-bg-layer-2, #ffffff); border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1)); border-radius: 12px; box-shadow: 0 16px 36px rgba(0, 0, 0, 0.22); display: flex; flex-direction: column; overflow: hidden; animation: cdxSlideUp 0.18s ease-out; }',
        '.cdx-am-modal-header { padding: 16px 20px; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.08)); display: flex; align-items: center; justify-content: space-between; gap: 12px; }',
        '.cdx-am-modal-title { font-size: 15px; font-weight: 600; color: var(--dsw-alias-label-primary, inherit); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
        '.cdx-am-modal-body { padding: 16px 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 12px; }',
        '.cdx-am-modal-footer { padding: 12px 20px; border-top: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.08)); display: flex; align-items: center; justify-content: flex-end; gap: 10px; background: var(--dsw-alias-bg-module-platform, rgba(0,0,0,0.02)); }',
        '.cdx-am-msg-card { padding: 10px 14px; border-radius: 8px; font-size: 13px; line-height: 1.5; display: flex; flex-direction: column; gap: 4px; }',
        '.cdx-am-msg-user { background: var(--dsw-alias-interactive-bg-hover, rgba(59, 130, 246, 0.08)); border-left: 3px solid var(--dsw-alias-brand-primary, #3b82f6); }',
        '.cdx-am-msg-assistant { background: var(--dsw-alias-bg-module-platform, rgba(0, 0, 0, 0.03)); border-left: 3px solid var(--dsw-alias-label-tertiary, #9ca3af); }',
        '.cdx-am-msg-role { font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--dsw-alias-label-secondary, #61666b); }',
        '.cdx-am-msg-text { white-space: pre-wrap; word-break: break-word; color: var(--dsw-alias-label-primary, inherit); }',

        'body[data-ds-dark-theme] .cdx-am-section-icon { background: var(--dsw-alias-bg-module-platform, #353638); color: var(--dsw-alias-label-secondary, #9ca3af); }',
        'body[data-ds-dark-theme] .cdx-am-section-title { color: var(--dsw-alias-label-primary, #f9fafb); }',
        'body[data-ds-dark-theme] .cdx-am-search-input { background: var(--dsw-alias-bg-module-platform, #353638); border-color: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12)); color: var(--dsw-alias-label-primary, #f9fafb); }',
        'body[data-ds-dark-theme] .cdx-am-search-input:focus { background: var(--dsw-alias-bg-base, #151517); }',
        'body[data-ds-dark-theme] .cdx-am-dropdown-btn { background: var(--dsw-alias-bg-module-platform, #353638); border-color: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12)); color: var(--dsw-alias-label-primary, #f9fafb); }',
        'body[data-ds-dark-theme] .cdx-am-dropdown-btn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08)); border-color: var(--dsw-alias-label-dimmed, rgba(255, 255, 255, 0.22)); }',
        'body[data-ds-dark-theme] .cdx-am-dropdown-popover { background: var(--dsw-alias-bg-layer-2, #262628); border-color: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.15)); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45); }',
        'body[data-ds-dark-theme] .cdx-am-dropdown-item { color: var(--dsw-alias-label-primary, #f9fafb); }',
        'body[data-ds-dark-theme] .cdx-am-dropdown-item:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08)); }',
        'body[data-ds-dark-theme] .cdx-am-menu-popover { background: var(--dsw-alias-bg-layer-2, #262628); border-color: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.15)); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4); }',
        'body[data-ds-dark-theme] .cdx-am-btn-unarchive { background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08)); border-color: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12)); }',
        'body[data-ds-dark-theme] .cdx-am-btn-preview { background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08)); border-color: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12)); }',
        'body[data-ds-dark-theme] .cdx-am-modal { background: var(--dsw-alias-bg-layer-2, #1e1e20); border-color: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.14)); box-shadow: 0 16px 36px rgba(0, 0, 0, 0.55); }',
        'body[data-ds-dark-theme] .cdx-am-modal-footer { background: var(--dsw-alias-bg-module-platform, rgba(255, 255, 255, 0.02)); }',

        '/* nav icon override */',
        '.cdx-am-nav-icon-svg { width: 16px; height: 16px; flex: none; display: inline-block; vertical-align: middle; stroke: currentColor; }',
        '[data-dsh-archive-nav="true"] > [class*="_navIcon"]:not(.cdx-am-nav-icon-svg) { display: none !important; }',
        '@keyframes cdxFadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }',
        '@keyframes cdxSlideUp { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }'
      ].join('\n');

      function injectStyles() {
        if (typeof document === 'undefined') return;
        var existing = document.querySelector('style[data-plugin-css="' + CSS_ID + '"]');
        if (existing) existing.remove();
        var tag = document.createElement('style');
        tag.dataset.plugin = 'dsh-archive-manager';
        tag.dataset.pluginCss = CSS_ID;
        tag.textContent = CSS_TEXT;
        document.head.appendChild(tag);
      }

      // ---- API helpers ----
      function fetchJson(url, options) {
        return fetch(url, options).then(function (res) {
          if (!res.ok) {
            return res.text().then(function (text) {
              try { var j = JSON.parse(text); throw new Error(j.error || text); }
              catch (e) { throw new Error(text || res.statusText); }
            });
          }
          return res.json();
        });
      }

      function formatDate(ts) {
        if (!ts) return '—';
        var d = new Date(ts);
        if (isNaN(d.getTime())) return '—';
        try {
          return d.toLocaleString(navigator.language || 'zh-CN', {
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
          });
        } catch (e) {
          var min = d.getMinutes(); if (min < 10) min = '0' + min;
          return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + min;
        }
      }

      function formatSize(bytes) {
        if (!bytes || bytes <= 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
      }

      function fmt(t, key, a, b) {
        var s = (t && typeof t === 'function') ? (t(key) || key) : key;
        if (a !== undefined) s = s.replace('{0}', String(a));
        if (b !== undefined) s = s.replace('{1}', String(b));
        return s;
      }

      // ---- ArchiveManagerSection (React) ----
      function ArchiveManagerSection(props) {
        var t = (props && typeof props.t === 'function') ? props.t : function (k) { return k; };

        var a0 = useState([]); var archives = a0[0], setArchives = a0[1];
        var a1 = useState(true); var loading = a1[0], setLoading = a1[1];
        var a2 = useState(null); var error = a2[0], setError = a2[1];
        var a3 = useState(null); var success = a3[0], setSuccess = a3[1];
        var a4 = useState(''); var query = a4[0], setQuery = a4[1];
        var a5 = useState('ALL'); var selectedWs = a5[0], setSelectedWs = a5[1];
        var a6 = useState('NEWEST'); var sortOrder = a6[0], setSortOrder = a6[1];
        var a7 = useState(null); var openDropdown = a7[0], setOpenDropdown = a7[1];
        var a8 = useState(null); var openMenu = a8[0], setOpenMenu = a8[1];
        var a9 = useState(false); var busy = a9[0], setBusy = a9[1];

        // Preview modal state: { open, sid, title, loading, data, error }
        var a10 = useState(null); var previewModal = a10[0], setPreviewModal = a10[1];

        var pollRef = useRef(null);
        var toastRef = useRef(null);
        var composingRef = useRef(false);

        function showToast(kind, msg) {
          if (toastRef.current) { clearTimeout(toastRef.current); toastRef.current = null; }
          if (kind === 'success') { setSuccess(msg); setError(null); }
          else { setError(msg); setSuccess(null); }
          toastRef.current = setTimeout(function () { setError(null); setSuccess(null); toastRef.current = null; }, 3500);
        }

        function load() {
          fetchJson(API_BASE + '/archives').then(function (d) {
            setLoading(false);
            setArchives(Array.isArray(d.archives) ? d.archives : []);
            setError(null);
          }).catch(function (e) {
            setLoading(false);
            setError(fmt(t, 'loadFailed') + ': ' + (e.message || String(e)));
          });
        }

        function openPreview(item) {
          setPreviewModal({
            open: true,
            sid: item.sessionId,
            title: item.title,
            workspaceTitle: item.workspaceTitle,
            workspacePath: item.workspacePath,
            loading: true,
            data: null,
            error: null
          });
          fetchJson(API_BASE + '/detail?sessionId=' + encodeURIComponent(item.sessionId))
            .then(function (d) {
              setPreviewModal(function (prev) {
                if (!prev || prev.sid !== item.sessionId) return prev;
                return Object.assign({}, prev, { loading: false, data: d });
              });
            })
            .catch(function (err) {
              setPreviewModal(function (prev) {
                if (!prev || prev.sid !== item.sessionId) return prev;
                return Object.assign({}, prev, { loading: false, error: err.message || String(err) });
              });
            });
        }

        function unarchive(sid, title) {
          if (busy) return;
          setBusy(true);
          fetchJson(API_BASE + '/unarchive', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sessionId: sid })
          }).then(function () {
            setBusy(false);
            if (previewModal && previewModal.sid === sid) setPreviewModal(null);
            showToast('success', fmt(t, 'restoredToast', title || sid));
            load();
          }).catch(function (e) {
            setBusy(false);
            showToast('error', fmt(t, 'unarchiveFailed') + ': ' + (e.message || String(e)));
          });
        }

        function del(sid, title) {
          if (busy) return;
          if (!confirm(fmt(t, 'confirmDelete', title || sid))) return;
          setBusy(true);
          fetchJson(API_BASE + '/delete', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sessionId: sid })
          }).then(function () {
            setBusy(false);
            if (previewModal && previewModal.sid === sid) setPreviewModal(null);
            showToast('success', fmt(t, 'deleted'));
            load();
          }).catch(function (e) {
            setBusy(false);
            showToast('error', fmt(t, 'deleteFailed') + ': ' + (e.message || String(e)));
          });
        }

        function delWs(wsTitle, sids) {
          if (busy || !sids || sids.length === 0) return;
          if (!confirm(fmt(t, 'confirmDeleteWs', wsTitle, sids.length))) return;
          setBusy(true);
          setOpenMenu(null);
          fetchJson(API_BASE + '/delete', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sessionIds: sids })
          }).then(function () {
            setBusy(false);
            showToast('success', fmt(t, 'deletedWsToast', wsTitle));
            load();
          }).catch(function (e) {
            setBusy(false);
            showToast('error', fmt(t, 'deleteWsFailed') + ': ' + (e.message || String(e)));
          });
        }

        function delAll() {
          if (busy || archives.length === 0) return;
          if (!confirm(fmt(t, 'confirmDeleteAll', archives.length))) return;
          setBusy(true);
          fetchJson(API_BASE + '/delete-all', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({})
          }).then(function (r) {
            setBusy(false);
            var n = r && Array.isArray(r.removed) ? r.removed.length : archives.length;
            showToast('success', fmt(t, 'deletedAllToast', n));
            load();
          }).catch(function (e) {
            setBusy(false);
            showToast('error', fmt(t, 'deleteAllFailed') + ': ' + (e.message || String(e)));
          });
        }

        useEffect(function () {
          load();
          pollRef.current = setInterval(function () {
            if (document.visibilityState === 'visible' && !busy && !previewModal) {
              fetchJson(API_BASE + '/archives').then(function (d) {
                setArchives(Array.isArray(d.archives) ? d.archives : []);
              }).catch(function () {});
            }
          }, 2000);
          return function () {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            if (toastRef.current) { clearTimeout(toastRef.current); toastRef.current = null; }
          };
        }, [busy, previewModal]);

        useEffect(function () {
          function onDoc(e) {
            if (!e || !e.target || !e.target.closest) return;
            if (!e.target.closest('[data-am-dropdown-toggle]') && !e.target.closest('.cdx-am-dropdown-popover')) {
              if (openDropdown) setOpenDropdown(null);
            }
            if (!e.target.closest('[data-am-more-btn]') && !e.target.closest('.cdx-am-menu-popover')) {
              if (openMenu) setOpenMenu(null);
            }
          }
          document.addEventListener('click', onDoc);
          return function () { document.removeEventListener('click', onDoc); };
        }, [openDropdown, openMenu]);

        var q = query.trim().toLowerCase();
        var filtered = archives.filter(function (a) {
          if (selectedWs !== 'ALL' && (a.workspaceTitle || t('noProject')) !== selectedWs) return false;
          if (q) {
            var mt = (a.title || '').toLowerCase().indexOf(q) >= 0;
            var mw = (a.workspaceTitle || '').toLowerCase().indexOf(q) >= 0;
            if (!mt && !mw) return false;
          }
          return true;
        });

        var groups = {};
        for (var i = 0; i < filtered.length; i++) {
          var a = filtered[i];
          var gName = a.workspaceTitle || t('noProject');
          if (!groups[gName]) groups[gName] = [];
          groups[gName].push(a);
        }
        var groupNames = Object.keys(groups);
        groupNames.forEach(function (g) {
          groups[g].sort(function (x, y) {
            var tx = x.createdAt || 0, ty = y.createdAt || 0;
            return sortOrder === 'OLDEST' ? tx - ty : ty - tx;
          });
        });

        var wsList = [];
        var seen = {};
        for (var k = 0; k < archives.length; k++) {
          var name = archives[k].workspaceTitle || t('noProject');
          if (!seen[name]) { seen[name] = true; wsList.push(name); }
        }

        var sortLabel = sortOrder === 'OLDEST' ? t('sortOldest') : t('sortAll');
        var wsLabel = selectedWs === 'ALL' ? t('allProjects') : selectedWs;
        var sortOpen = openDropdown === 'sort';
        var wsOpen = openDropdown === 'workspace';

        return h('div', { className: 'cdx-am-container' },
          h('div', { className: 'cdx-am-section-header' },
            h('span', { className: 'cdx-am-section-icon' }, IconArchive(18)),
            h('div', { className: 'cdx-am-section-titles' },
              h('h2', { className: 'cdx-am-section-title' }, t('title')),
              h('p', { className: 'cdx-am-section-lede' }, t('description'))
            )
          ),
          error ? h('div', { className: 'cdx-am-toast cdx-am-toast-error' },
            h('span', null, error),
            h('button', { type: 'button', className: 'cdx-am-toast-close', onClick: function () { setError(null); } }, IconClose(14))
          ) : null,
          success ? h('div', { className: 'cdx-am-toast cdx-am-toast-success' },
            h('span', null, success),
            h('button', { type: 'button', className: 'cdx-am-toast-close', onClick: function () { setSuccess(null); } }, IconClose(14))
          ) : null,
          h('div', { className: 'cdx-am-search-row' },
            h('span', { className: 'cdx-am-search-icon' }, IconSearch(14)),
            h('input', {
              type: 'text', className: 'cdx-am-search-input', placeholder: t('searchPlaceholder'),
              value: query,
              onCompositionStart: function () { composingRef.current = true; },
              onCompositionEnd: function (e) { composingRef.current = false; setQuery(e.target.value); },
              onChange: function (e) { if (!composingRef.current) setQuery(e.target.value); }
            }),
            query ? h('button', { type: 'button', className: 'cdx-am-search-clear', title: t('clearSearch'), onClick: function () { setQuery(''); } }, IconClose(14)) : null
          ),
          h('div', { className: 'cdx-am-filter-row' },
            h('div', { className: 'cdx-am-dropdown-container' },
              h('button', {
                type: 'button', className: 'cdx-am-dropdown-btn',
                'data-am-dropdown-toggle': 'sort', 'aria-expanded': sortOpen,
                onClick: function (e) { e.stopPropagation(); setOpenDropdown(sortOpen ? null : 'sort'); setOpenMenu(null); }
              },
                h('span', { className: 'cdx-am-dropdown-icon' }, IconFilter(13)),
                h('span', { className: 'cdx-am-dropdown-label' }, sortLabel),
                h('span', { className: 'cdx-am-dropdown-chevron' + (sortOpen ? ' open' : '') }, IconChevronDown(10))
              ),
              h('div', { className: 'cdx-am-dropdown-popover', 'data-open': sortOpen },
                h('button', { type: 'button', className: 'cdx-am-dropdown-item' + (sortOrder === 'NEWEST' ? ' selected' : ''), onClick: function (e) { e.stopPropagation(); setSortOrder('NEWEST'); setOpenDropdown(null); } },
                  h('span', { className: 'cdx-am-dropdown-item-check' }, sortOrder === 'NEWEST' ? IconCheck(14) : null),
                  h('span', { className: 'cdx-am-dropdown-item-text' }, t('sortAll'))
                ),
                h('button', { type: 'button', className: 'cdx-am-dropdown-item' + (sortOrder === 'OLDEST' ? ' selected' : ''), onClick: function (e) { e.stopPropagation(); setSortOrder('OLDEST'); setOpenDropdown(null); } },
                  h('span', { className: 'cdx-am-dropdown-item-check' }, sortOrder === 'OLDEST' ? IconCheck(14) : null),
                  h('span', { className: 'cdx-am-dropdown-item-text' }, t('sortOldest'))
                )
              )
            ),
            h('div', { className: 'cdx-am-dropdown-container' },
              h('button', {
                type: 'button', className: 'cdx-am-dropdown-btn',
                'data-am-dropdown-toggle': 'workspace', 'aria-expanded': wsOpen,
                onClick: function (e) { e.stopPropagation(); setOpenDropdown(wsOpen ? null : 'workspace'); setOpenMenu(null); }
              },
                h('span', { className: 'cdx-am-dropdown-icon' }, IconFolder(13)),
                h('span', { className: 'cdx-am-dropdown-label' }, wsLabel),
                h('span', { className: 'cdx-am-dropdown-chevron' + (wsOpen ? ' open' : '') }, IconChevronDown(10))
              ),
              h('div', { className: 'cdx-am-dropdown-popover', 'data-open': wsOpen },
                h('button', { type: 'button', className: 'cdx-am-dropdown-item' + (selectedWs === 'ALL' ? ' selected' : ''), onClick: function (e) { e.stopPropagation(); setSelectedWs('ALL'); setOpenDropdown(null); } },
                  h('span', { className: 'cdx-am-dropdown-item-check' }, selectedWs === 'ALL' ? IconCheck(14) : null),
                  h('span', { className: 'cdx-am-dropdown-item-text' }, t('allProjects'))
                ),
                wsList.map(function (name) {
                  return h('button', { key: name, type: 'button', className: 'cdx-am-dropdown-item' + (selectedWs === name ? ' selected' : ''), onClick: function (e) { e.stopPropagation(); setSelectedWs(name); setOpenDropdown(null); } },
                    h('span', { className: 'cdx-am-dropdown-item-check' }, selectedWs === name ? IconCheck(14) : null),
                    h('span', { className: 'cdx-am-dropdown-item-text' }, name)
                  );
                })
              )
            ),
            h('button', {
              type: 'button',
              className: 'cdx-am-btn-delete-all',
              title: t('deleteAllTip'),
              disabled: busy || archives.length === 0,
              onClick: delAll
            }, IconTrash(13), h('span', null, t('deleteAll')))
          ),
          loading ? h('div', { className: 'cdx-am-loading' }, t('loading'))
          : archives.length === 0 ? h('div', { className: 'cdx-am-empty' }, t('empty'))
          : h('div', { className: 'cdx-am-list-slot' },
            groupNames.length === 0 ? h('div', { className: 'cdx-am-empty' }, t('noMatch'))
            : groupNames.map(function (gTitle) {
              var items = groups[gTitle];
              var sids = items.map(function (x) { return x.sessionId; });
              var menuOpen = openMenu === gTitle;
              return h('div', { className: 'cdx-am-group', key: gTitle },
                h('div', { className: 'cdx-am-group-header' },
                  h('div', { className: 'cdx-am-group-title' }, IconFolder(14), h('span', null, gTitle)),
                  h('div', { className: 'cdx-am-group-meta' },
                    h('span', null, items.length + t('countUnit')),
                    h('div', { style: { position: 'relative' } },
                      h('button', { type: 'button', className: 'cdx-am-btn-more', 'data-am-more-btn': gTitle, title: t('projectActions'), onClick: function (e) { e.stopPropagation(); setOpenMenu(menuOpen ? null : gTitle); setOpenDropdown(null); } }, IconMore(14)),
                      h('div', { className: 'cdx-am-menu-popover', 'data-open': menuOpen },
                        h('button', { type: 'button', className: 'cdx-am-menu-item', onClick: function (e) { e.stopPropagation(); delWs(gTitle, sids); } },
                          IconTrash(14), h('span', null, t('deleteAllInProject'))
                        )
                      )
                    )
                  )
                ),
                h('div', { className: 'cdx-am-group-list' },
                  items.map(function (item) {
                    return h('div', { className: 'cdx-am-item', key: item.sessionId },
                      h('div', { className: 'cdx-am-item-main' },
                        h('div', { className: 'cdx-am-item-title', title: item.title }, item.title),
                        h('div', { className: 'cdx-am-item-meta-line' },
                          h('span', null, formatDate(item.createdAt)),
                          item.turns ? h('span', null, item.turns + ' 轮对话') : null,
                          item.dataSize > 0 ? h('span', { className: 'cdx-am-item-size-badge' }, IconHardDrive(11), formatSize(item.dataSize)) : null
                        )
                      ),
                      h('div', { className: 'cdx-am-item-actions' },
                        h('button', {
                          type: 'button', className: 'cdx-am-btn-action cdx-am-btn-preview',
                          title: t('viewDetail'),
                          onClick: function () { openPreview(item); }
                        }, IconEye(13), h('span', null, t('preview'))),
                        h('button', {
                          type: 'button', className: 'cdx-am-btn-action cdx-am-btn-unarchive',
                          title: t('unarchiveTip'),
                          onClick: function () { unarchive(item.sessionId, item.title); }
                        }, IconRotateCcw(12), h('span', null, t('unarchive'))),
                        h('button', {
                          type: 'button', className: 'cdx-am-btn-action cdx-am-btn-danger',
                          title: t('deleteArchive'),
                          onClick: function () { del(item.sessionId, item.title); }
                        }, IconTrash(13), h('span', null, t('deletePermanently')))
                      )
                    );
                  })
                )
              );
            })
          ),

          /* Preview / Detail Modal */
          previewModal ? h('div', {
            className: 'cdx-am-modal-backdrop',
            onClick: function (e) { if (e.target === e.currentTarget) setPreviewModal(null); }
          },
            h('div', { className: 'cdx-am-modal' },
              h('div', { className: 'cdx-am-modal-header' },
                h('h3', { className: 'cdx-am-modal-title', title: previewModal.title },
                  '查看会话：' + (previewModal.title || previewModal.sid)
                ),
                h('button', {
                  type: 'button', className: 'cdx-am-toast-close',
                  onClick: function () { setPreviewModal(null); }
                }, IconClose(16))
              ),
              h('div', { className: 'cdx-am-modal-body' },
                previewModal.loading ? h('div', { className: 'cdx-am-loading' }, '正在从磁盘解压读取会话记录…')
                : previewModal.error ? h('div', { className: 'cdx-am-empty', style: { color: 'var(--dsw-alias-state-error-primary)' } }, '读取失败: ' + previewModal.error)
                : (!previewModal.data || !previewModal.data.messages || previewModal.data.messages.length === 0) ? h('div', { className: 'cdx-am-empty' }, '此会话暂无保存的文本消息记录。')
                : previewModal.data.messages.map(function (m, idx) {
                  return h('div', {
                    key: idx,
                    className: 'cdx-am-msg-card ' + (m.role === 'user' ? 'cdx-am-msg-user' : 'cdx-am-msg-assistant')
                  },
                    h('div', { className: 'cdx-am-msg-role' }, (m.role === 'user' ? '👤 用户' : '🤖 助手') + (m.time ? ' · ' + formatDate(m.time) : '')),
                    h('div', { className: 'cdx-am-msg-text' }, m.content)
                  );
                })
              ),
              h('div', { className: 'cdx-am-modal-footer' },
                h('button', {
                  type: 'button', className: 'cdx-am-btn-action cdx-am-btn-preview',
                  onClick: function () { setPreviewModal(null); }
                }, t('close')),
                h('button', {
                  type: 'button', className: 'cdx-am-btn-action cdx-am-btn-unarchive',
                  onClick: function () { unarchive(previewModal.sid, previewModal.title); }
                }, IconRotateCcw(12), h('span', null, t('unarchive'))),
                h('button', {
                  type: 'button', className: 'cdx-am-btn-action cdx-am-btn-danger',
                  onClick: function () { del(previewModal.sid, previewModal.title); }
                }, IconTrash(13), h('span', null, t('deletePermanently')))
              )
            )
          ) : null
        );
      }

      // ---- locales ----
      var zh = {
        title: '归档管理', description: '查看、恢复或彻底物理删除已归档的会话记录。',
        searchPlaceholder: '搜索已归档聊天', clearSearch: '清空搜索',
        sortAll: '全部聊天', sortOldest: '最早优先',
        allProjects: '所有项目', noProject: '无项目',
        countUnit: ' 个聊天', projectActions: '项目操作',
        deleteAllInProject: '彻底删除项目全部归档', deleteArchive: '物理删除会话',
        deleteAll: '全部删除', deleteAllTip: '彻底删除所有归档会话（含磁盘文件）',
        deletedAllToast: '已彻底删除全部 {0} 个归档会话。', deleteAllFailed: '全部删除失败',
        confirmDeleteAll: '确认彻底物理删除全部 {0} 个归档会话？\n所有磁盘文件与记录将一并移除，无法恢复！',
        deletePermanently: '物理删除', preview: '查看内容', viewDetail: '查看会话历史记录',
        unarchive: '恢复会话', unarchiveTip: '恢复到侧边栏', close: '关闭',
        loading: '加载已归档对话中…', empty: '暂无已归档的对话。', noMatch: '未找到匹配的归档对话。',
        deleted: '已从磁盘彻底删除会话', loadFailed: '加载失败', unarchiveFailed: '恢复失败',
        deleteFailed: '删除失败', deleteWsFailed: '删除项目归档失败',
        confirmDelete: '确认从磁盘彻底物理删除会话「{0}」？\n此操作将删除 session.jsonl.zstd 文件并清理所有记录，无法恢复！',
        confirmDeleteWs: '确认彻底物理删除「{0}」项目下的全部 {1} 个归档会话？\n磁盘文件将全部移除，无法恢复！',
        restoredToast: '已恢复会话「{0}」到侧边栏。', deletedWsToast: '已彻底删除「{0}」项目下的所有归档会话。'
      };
      var en = {
        title: 'Archive Manager', description: 'View, restore, or permanently delete archived conversation logs.',
        searchPlaceholder: 'Search archived chats', clearSearch: 'Clear search',
        sortAll: 'All chats', sortOldest: 'Oldest first',
        allProjects: 'All projects', noProject: 'No project',
        countUnit: ' chats', projectActions: 'Project actions',
        deleteAllInProject: 'Delete all in project', deleteArchive: 'Delete session permanently',
        deleteAll: 'Delete all', deleteAllTip: 'Permanently delete all archived sessions (including disk files)',
        deletedAllToast: 'Permanently deleted all {0} archived sessions.', deleteAllFailed: 'Failed to delete all archives',
        confirmDeleteAll: 'Permanently delete ALL {0} archived sessions?\nAll disk files and records will be removed and cannot be undone!',
        deletePermanently: 'Delete', preview: 'View', viewDetail: 'View chat history',
        unarchive: 'Restore', unarchiveTip: 'Restore to sidebar', close: 'Close',
        loading: 'Loading archived chats...', empty: 'No archived conversations.', noMatch: 'No matching archived chats.',
        deleted: 'Session permanently deleted from disk', loadFailed: 'Load failed', unarchiveFailed: 'Restore failed',
        deleteFailed: 'Delete failed', deleteWsFailed: 'Failed to delete project archives',
        confirmDelete: 'Permanently delete session \"{0}\" from disk?\nThis will remove session.jsonl.zstd and cannot be undone!',
        confirmDeleteWs: 'Permanently delete all {1} archived chats in \"{0}\"?\nAll disk files will be removed and cannot be undone!',
        restoredToast: 'Restored conversation \"{0}\" to sidebar.', deletedWsToast: 'Permanently deleted all archives in \"{0}\".'
      };

      // ---- apply ----
      
      // ---- Permanent Nav Icon Watcher ----
      var ARCHIVE_SVG_INNER = '<rect width="20" height="5" x="2" y="3" rx="1"></rect><path d="M4 8v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8"></path><path d="M10 12h4"></path>';

      function setupNavIconWatcher() {
        if (typeof document === 'undefined') return;

        function syncNavIcons() {
          var navCells = document.querySelectorAll('[class*="_navCell"]');
          if (!navCells || navCells.length === 0) return;

          for (var i = 0; i < navCells.length; i++) {
            var cell = navCells[i];
            var labelSpan = cell.querySelector('[class*="_navLabel"]') || cell;
            var text = (labelSpan.textContent || '').trim();
            if (text === '归档管理' || text === 'Archive Manager' || text === '归档' || text === 'Archives') {
              if (!cell.hasAttribute('data-dsh-archive-nav')) {
                cell.setAttribute('data-dsh-archive-nav', 'true');
              }
              var defaultIcon = cell.querySelector('[class*="_navIcon"]:not(.cdx-am-nav-icon-svg)');
              var customIcon = cell.querySelector('.cdx-am-nav-icon-svg');

              if (!customIcon) {
                customIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                customIcon.setAttribute('width', '16');
                customIcon.setAttribute('height', '16');
                customIcon.setAttribute('viewBox', '0 0 24 24');
                customIcon.setAttribute('fill', 'none');
                customIcon.setAttribute('stroke', 'currentColor');
                customIcon.setAttribute('stroke-width', '2');
                customIcon.setAttribute('stroke-linecap', 'round');
                customIcon.setAttribute('stroke-linejoin', 'round');
                customIcon.setAttribute('aria-hidden', 'true');
                var defClass = defaultIcon ? (defaultIcon.className.baseVal || defaultIcon.className || '') : '';
                customIcon.className.baseVal = 'cdx-am-nav-icon-svg ' + defClass;
                customIcon.innerHTML = ARCHIVE_SVG_INNER;
                if (defaultIcon) {
                  defaultIcon.style.display = 'none';
                  defaultIcon.parentNode.insertBefore(customIcon, defaultIcon);
                } else {
                  cell.insertBefore(customIcon, cell.firstChild);
                }
              } else {
                if (defaultIcon && defaultIcon.style.display !== 'none') {
                  defaultIcon.style.display = 'none';
                }
              }
            }
          }
        }

        syncNavIcons();

        try {
          var observer = new MutationObserver(function () {
            syncNavIcons();
          });
          observer.observe(document.body, { childList: true, subtree: true });
        } catch (e) {}

        document.addEventListener('click', function () {
          setTimeout(syncNavIcons, 20);
          setTimeout(syncNavIcons, 120);
        }, true);
      }

      function apply(ctx) {
        injectStyles();
        setupNavIconWatcher();
        if (ctx && ctx.effect) {
          ctx.effect(function () {
            return function () {
              var styleTag = document.querySelector('style[data-plugin-css="' + CSS_ID + '"]');
              if (styleTag) styleTag.remove();
            };
          }, 'dsh-archive-manager: ui mount');
        }
        if (ctx && ctx.locale) {
          var off = ctx.locale.register(NS, { zh: zh, en: en });
          if (ctx.effect) ctx.effect(function () { return function () { if (off) off(); }; }, 'dsh-archive-manager: locale');
        }
        if (ctx && ctx.slots) {
          ctx.slots.inject('settings.section', function () {
            return ctx.slots.register({
              name: 'settings.section', id: 'archive-manager', order: 1000,
              label: function () { return ctx.locale.bind(NS)('title'); },
              locale: NS
            }, ArchiveManagerSection);
          });
        }
      }

      exports.apply = apply;
      exports.inject = ['slots', 'locale'];
      exports.default = { apply: apply, inject: ['slots', 'locale'] };

      return module.exports;
    }
  });
})();
