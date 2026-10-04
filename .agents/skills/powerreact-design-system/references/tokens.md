<!-- GENERATED from src/theme/tokens.css by scripts/sync-agent-skills.mjs. Do not edit: change the tokens and run npm run skills:sync. -->

# Design tokens (all roles, both themes)

Components use these roles through `bg-u-*` / `text-u-*` / `border-u-*` utilities (mapped in `src/index.css`) or `var(--u-*)`.
Values are CSS as written in `src/theme/tokens.css`.

| Role | Neo-Glass (light) | Nocturne (dark) |
| :--- | :--- | :--- |
| `--u-font-display` | `'Space Grotesk Variable', 'Segoe UI', system-ui, sans-serif` | _(same as Neo-Glass)_ |
| `--u-font-body` | `'Montserrat Variable', 'Segoe UI', system-ui, sans-serif` | _(same as Neo-Glass)_ |
| `--u-ease` | `cubic-bezier(0.16, 1, 0.3, 1)` | _(same as Neo-Glass)_ |
| `--u-canvas` | `#f5faff` | `#0a0f12` |
| `--u-scene` | `radial-gradient(820px 540px at 7% 3%, rgba(98, 192, 197, 0.18), transparent 64%), radial-gradient(740px 480px at 96% 12%, rgba(52, 167, 173, 0.12), transparent 62%), radial-gradient(920px 580px at 68% 112%, rgba(208, 227, 236, 0.45), transparent 66%), linear-gradient(145deg, #ffffff 0%, #f5faff 48%, #eef5f7 100%)` | `linear-gradient(135deg, #0d1317 0%, #062b3f 40%, #00355a 60%, #1a2b32 100%)` |
| `--u-orb` | `radial-gradient(circle at 42% 42%, rgba(138, 243, 249, 0.36), rgba(98, 192, 197, 0.14) 44%, transparent 72%)` | `radial-gradient(circle at 50% 50%, rgba(52, 167, 173, 0.75), transparent 70%)` |
| `--u-orb-opacity` | `0.62` | `0.55` |
| `--u-blob-a` | `transparent` | `#34a7ad` |
| `--u-blob-b` | `transparent` | `#237a7f` |
| `--u-plane-highlight` | `radial-gradient(650px 260px at 20% -3%, rgba(255, 255, 255, 0.9), transparent 68%)` | `none` |
| `--u-rays` | `none` | `repeating-linear-gradient(90deg, transparent 0 88px, rgba(255, 255, 255, 0.035) 88px 112px, transparent 112px 176px)` |
| `--u-plane-bg` | `linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(255, 255, 255, 0.5)), linear-gradient(132deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.1) 52%, rgba(224, 242, 243, 0.22))` | `#070b0e` |
| `--u-plane-border` | `rgba(255, 255, 255, 0.94)` | `rgba(255, 255, 255, 0.07)` |
| `--u-plane-shadow` | `inset 0 1px 0 rgba(255, 255, 255, 0.96), inset 0 -1px 0 rgba(109, 121, 122, 0.06), 0 18px 54px rgba(13, 19, 23, 0.07)` | `0 40px 100px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.07)` |
| `--u-plane-blur` | `blur(28px) saturate(132%)` | `none` |
| `--u-plane-radius` | `24px` | `36px` |
| `--u-glow` | `none` | `radial-gradient(55% 60% at 50% 100%, rgba(138, 215, 219, 0.75) 0%, rgba(98, 192, 197, 0.6) 24%, rgba(52, 167, 173, 0.4) 45%, transparent 75%), linear-gradient(to top, rgba(120, 205, 210, 0.85) 0%, rgba(52, 167, 173, 0.7) 16%, rgba(35, 122, 127, 0.6) 32%, rgba(0, 53, 90, 0.6) 50%, rgba(0, 53, 90, 0) 80%)` |
| `--u-rule` | `linear-gradient(90deg, rgba(52, 167, 173, 0.4), rgba(52, 167, 173, 0.12) 22%, rgba(109, 121, 122, 0.09) 60%, transparent)` | `transparent` |
| `--u-header-divider` | `rgba(13, 19, 23, 0.1)` | `rgba(255, 255, 255, 0.22)` |
| `--u-eyebrow` | `#237a7f` | `rgba(236, 241, 247, 0.62)` |
| `--u-logo-frame` | `#37a9ae` | `#37a9ae` |
| `--u-logo-word` | `#00355a` | `#ffffff` |
| `--u-card-bg` | `rgba(255, 255, 255, 0.72)` | `linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.07)), rgba(22, 28, 32, 0.88)` |
| `--u-card-solid` | `#ffffff` | `#161c20` |
| `--u-card-border` | `rgba(220, 229, 232, 0.94)` | `rgba(255, 255, 255, 0.1)` |
| `--u-card-radius` | `14px` | `20px` |
| `--u-card-shadow` | `0 8px 26px rgba(13, 19, 23, 0.04)` | `inset 0 1px 0 rgba(255, 255, 255, 0.08)` |
| `--u-card-blur` | `blur(15px)` | `blur(24px) saturate(140%)` |
| `--u-card-pad` | `18px` | `20px 22px` |
| `--u-kpi-pad` | `16px 17px 14px` | `16px 20px` |
| `--u-card-hover-border` | `#34a7ad` | `rgba(138, 243, 249, 0.38)` |
| `--u-card-hover-shadow` | `0 6px 16px rgba(52, 167, 173, 0.08), 0 8px 26px rgba(13, 19, 23, 0.04)` | `inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 0 1px rgba(138, 243, 249, 0.08)` |
| `--u-card-hover-lift` | `-2px` | `0px` |
| `--u-gap` | `16px` | `20px` |
| `--u-title` | `#0d1317` | `#ffffff` |
| `--u-text` | `#161c20` | `#e2e8f0` |
| `--u-text-soft` | `#3d4949` | `#cbd3da` |
| `--u-subtitle` | `#819095` | `#959aa0` |
| `--u-label` | `#748388` | `#b6bbc1` |
| `--u-axis` | `#748388` | `#959aa0` |
| `--u-primary` | `#34a7ad` | `#8af3f9` |
| `--u-secondary` | `#8a9b9c` | `#95989a` |
| `--u-neutral` | `#b8cacb` | `#b7c9d2` |
| `--u-grid` | `#e9eef4` | `#2a2f33` |
| `--u-grid-dash` | `none` | `4 6` |
| `--u-track` | `#eff4fa` | `#262c30` |
| `--u-interaction` | `#237a7f` | `#8af3f9` |
| `--u-bar-1` | `#34a7ad` | `#237a7f` |
| `--u-bar-2` | `#62c0c5` | `#62c0c5` |
| `--u-bar-3` | `#62c0c5` | `#8af3f9` |
| `--u-bar-glow` | `none` | `0 0 16px rgba(138, 243, 249, 0.35)` |
| `--u-area` | `#34a7ad` | `#34a7ad` |
| `--u-area-opacity` | `0.18` | `0.55` |
| `--u-ac` | `#0d1317` | `#ffffff` |
| `--u-series-1` | `#34a7ad` | `#8af3f9` |
| `--u-series-2` | `#62c0c5` | `#34a7ad` |
| `--u-series-3` | `#b8cacb` | `#237a7f` |
| `--u-series-4` | `#d4e6e7` | `#b7c9d2` |
| `--u-series-5` | `#237a7f` | `#62c0c5` |
| `--u-series-6` | `#506169` | `#6cd6dd` |
| `--u-ok` | `#34a7ad` | `#8af3f9` |
| `--u-ok-text` | `#00696e` | `#8af3f9` |
| `--u-ok-bg` | `#e0f2f3` | `rgba(138, 243, 249, 0.12)` |
| `--u-warn` | `#8b6a3a` | `#f5a524` |
| `--u-warn-text` | `#7a5c30` | `#f5a524` |
| `--u-warn-bg` | `#f7f1e8` | `rgba(245, 165, 36, 0.14)` |
| `--u-bad` | `#ba1a1a` | `#ff7a6b` |
| `--u-bad-text` | `#ba1a1a` | `#ff7a6b` |
| `--u-bad-bg` | `#ffdad6` | `rgba(255, 122, 107, 0.14)` |
| `--u-delta-up` | `#237a7f` | `#8af3f9` |
| `--u-delta-down` | `#9a5e51` | `#ff7a6b` |
| `--u-mark-bg` | `#e0f2f3` | `rgba(138, 243, 249, 0.1)` |
| `--u-mark-fg` | `#237a7f` | `#8af3f9` |
| `--u-curtain-bg` | `rgba(255, 255, 255, 0.97)` | `rgba(22, 28, 32, 0.97)` |
| `--u-curtain-accent` | `#237a7f` | `#8af3f9` |
| `--u-curtain-glow` | `rgba(52, 167, 173, 0.55)` | `rgba(138, 243, 249, 0.55)` |
| `--u-tooltip-bg` | `#0d1317` | `#ffffff` |
| `--u-tooltip-text` | `#ffffff` | `#0d1317` |
| `--u-tooltip-muted` | `rgba(255, 255, 255, 0.7)` | `rgba(13, 19, 23, 0.62)` |
| `--u-tooltip-shadow` | `0 10px 30px rgba(13, 19, 23, 0.18)` | `0 12px 34px rgba(0, 0, 0, 0.45)` |
| `--u-th-bg` | `#f6f9fa` | `#1b2226` |
| `--u-th-text` | `#5c6f75` | `#959aa0` |
| `--u-td-text` | `#3d4949` | `#e2e8f0` |
| `--u-row-alt` | `#fafcfd` | `rgba(255, 255, 255, 0.025)` |
| `--u-row-line` | `#f0f4f5` | `#262c30` |
| `--u-row-hover` | `#f6f9fa` | `rgba(255, 255, 255, 0.04)` |
| `--u-row-selected` | `#e0f2f3` | `rgba(138, 243, 249, 0.08)` |
| `--u-input-bg` | `#ffffff` | `#1b2226` |
| `--u-input-border` | `#bcc9c9` | `#3e4447` |
| `--u-input-placeholder` | `#8c9da3` | `#7d8389` |
| `--u-focus-ring` | `0 0 0 3px rgba(52, 167, 173, 0.18)` | `0 0 0 3px rgba(138, 243, 249, 0.2)` |
| `--u-focus` | `#34a7ad` | `#8af3f9` |
| `--u-btn-bg` | `#237a7f` | `#237a7f` |
| `--u-btn-bg-hover` | `#00696e` | `#2b8f95` |
| `--u-btn-text` | `#ffffff` | `#ffffff` |
| `--u-btn-border` | `#237a7f` | `rgba(138, 243, 249, 0.55)` |
| `--u-ghost-bg` | `rgba(255, 255, 255, 0.7)` | `rgba(255, 255, 255, 0.06)` |
| `--u-ghost-border` | `#dce5e8` | `rgba(255, 255, 255, 0.1)` |
| `--u-ghost-hover` | `#e0f2f3` | `rgba(255, 255, 255, 0.1)` |
| `--u-tabs-bg` | `rgba(255, 255, 255, 0.56)` | `rgba(255, 255, 255, 0.06)` |
| `--u-tabs-border` | `rgba(109, 121, 122, 0.1)` | `rgba(255, 255, 255, 0.08)` |
| `--u-tabs-shadow` | `0 6px 18px rgba(13, 19, 23, 0.045)` | `none` |
| `--u-tab-text` | `#637278` | `rgba(236, 241, 247, 0.66)` |
| `--u-tab-active-bg` | `rgba(255, 255, 255, 0.94)` | `#ffffff` |
| `--u-tab-active-text` | `#0d1317` | `#0d1317` |
| `--u-tab-active-shadow` | `0 1px 2px rgba(13, 19, 23, 0.04), 0 6px 18px rgba(13, 19, 23, 0.06)` | `none` |
| `--u-tab-dot` | `#34a7ad` | `#237a7f` |
| `--u-shell-header-bg` | `#1a2b32` | `#070b0e` |
| `--u-shell-header-border` | `rgba(255, 255, 255, 0.06)` | `rgba(255, 255, 255, 0.07)` |
| `--u-shell-header-text` | `#ffffff` | `#ffffff` |
| `--u-shell-header-muted` | `rgba(236, 241, 247, 0.68)` | `rgba(236, 241, 247, 0.62)` |
| `--u-shell-control-bg` | `rgba(255, 255, 255, 0.07)` | `rgba(255, 255, 255, 0.06)` |
| `--u-shell-control-border` | `rgba(255, 255, 255, 0.12)` | `rgba(255, 255, 255, 0.1)` |
| `--u-shell-control-active-bg` | `#237a7f` | `#237a7f` |
| `--u-sidebar-bg` | `#f6f9fa` | `#0b1115` |
| `--u-sidebar-border` | `#dce5e8` | `rgba(255, 255, 255, 0.07)` |
| `--u-sidebar-text` | `#3d4949` | `#cbd3da` |
| `--u-sidebar-muted` | `#8c9da3` | `#6f777d` |
| `--u-sidebar-hover` | `#eef4f6` | `rgba(255, 255, 255, 0.05)` |
| `--u-sidebar-active-bg` | `#e0f2f3` | `rgba(138, 243, 249, 0.1)` |
| `--u-sidebar-active-text` | `#00696e` | `#8af3f9` |
| `--u-panel-bg` | `rgba(255, 255, 255, 0.86)` | `rgba(16, 22, 26, 0.94)` |
| `--u-panel-solid` | `#ffffff` | `#10161a` |
| `--u-panel-border` | `#dce5e8` | `rgba(255, 255, 255, 0.1)` |
| `--u-panel-shadow` | `0 8px 24px rgba(13, 19, 23, 0.08)` | `0 24px 60px rgba(0, 0, 0, 0.45)` |
| `--u-overlay` | `rgba(13, 19, 23, 0.6)` | `rgba(3, 6, 8, 0.7)` |
| `--u-modal-shadow` | `0 20px 48px rgba(13, 19, 23, 0.16)` | `0 30px 80px rgba(0, 0, 0, 0.55)` |
| `--u-bubble-user-bg` | `#237a7f` | `#237a7f` |
| `--u-bubble-user-text` | `#ffffff` | `#ffffff` |
| `--u-bubble-bot-bg` | `#f6f9fa` | `rgba(255, 255, 255, 0.06)` |
| `--u-bubble-bot-border` | `#dce5e8` | `rgba(255, 255, 255, 0.1)` |
| `--u-code-bg` | `#1a2b32` | `#0b1115` |
| `--u-code-surface` | `#13222a` | `#070b0e` |
| `--u-code-border` | `rgba(255, 255, 255, 0.08)` | `rgba(255, 255, 255, 0.08)` |
| `--u-code-text` | `#d4e6e7` | `#d4e6e7` |
| `--u-code-muted` | `#8a9b9c` | `#959aa0` |
| `--u-code-accent` | `#6cd6dd` | `#8af3f9` |
| `--u-scrollbar` | `#c9d5d8` | `#2d3336` |
| `--u-scrollbar-hover` | `#a8b8bd` | `#3e4447` |
