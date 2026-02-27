---
title: UI Customization
sidebar_position: 6
---

# UI Customization

ForgePortal is designed to be **fully white-labelable**. You can rename the portal, replace the logo, change the brand color, pin external links in the navbar, and display announcement banners — all via `forgeportal.yaml`, with no code changes required.

## Overview

All UI customization lives under the `ui:` section of `forgeportal.yaml`:

```yaml
ui:
  portalName: "Acme Developer Portal"
  logoUrl: "https://cdn.acme.com/logo-white.svg"
  faviconUrl: "https://cdn.acme.com/favicon.ico"
  primaryColor: "#e11d48"

  navLinks:
    - label: "Runbooks"
      url: "https://wiki.acme.com/runbooks"
      icon: "📖"
    - label: "On-Call"
      url: "https://app.pagerduty.com"
      icon: "🔔"
    - label: "Grafana"
      url: "https://grafana.acme.com"
      icon: "📊"

  announcement:
    message: "🚧 Scheduled maintenance Saturday 02:00–04:00 UTC"
    variant: "warning"
```

After editing `forgeportal.yaml`, restart the API service for changes to take effect. The UI fetches branding config at startup and caches it for 10 minutes.

---

## Portal Name

```yaml
ui:
  portalName: "Acme Developer Portal"
```

- Sets the text shown in the top-left of the navbar
- Sets the `<title>` of every page in the browser tab
- **Default:** `ForgePortal`
- **Max length:** 80 characters

When `logoUrl` is also set, the logo image replaces the text entirely (see [Logo](#logo) below).

---

## Logo

```yaml
ui:
  logoUrl: "https://cdn.acme.com/logo-white.svg"
```

- Replaces the portal name text in the navbar with an `<img>` element
- The image is displayed at `height: 28px` (`h-7`) — design your logo for a white/transparent background on a colored navbar
- Supports SVG (recommended), PNG, WebP, or any browser-renderable format
- Must be a publicly accessible URL (no authentication)
- `portalName` is still used as the `alt` text of the image

**Best practices for the logo image:**
- Use SVG for perfect scaling
- Use a white or light-colored version of your logo (the navbar background is your `primaryColor`)
- Aspect ratio: wide logos (≥ 3:1 width/height) work best

---

## Favicon

```yaml
ui:
  faviconUrl: "https://cdn.acme.com/favicon.ico"
```

- Replaces the browser tab icon
- Supports `.ico`, `.png`, `.svg`
- Applied dynamically without a page reload

---

## Primary Color

```yaml
ui:
  primaryColor: "#e11d48"   # Any 6-digit hex color
```

- Changes the **navbar background color** and the **brand accent color** used throughout the UI (active nav items, links, focus rings, badges)
- Must be a 6-digit hex color code (e.g. `#e11d48`, `#0ea5e9`, `#16a34a`)
- **Default:** `#6366f1` (indigo-500)

**Color suggestions by style:**

| Style | Color | Hex |
|-------|-------|-----|
| Indigo (default) | ![#6366f1](https://via.placeholder.com/12/6366f1/6366f1.png) | `#6366f1` |
| Rose / Red | | `#e11d48` |
| Sky / Blue | | `#0ea5e9` |
| Emerald / Green | | `#10b981` |
| Violet / Purple | | `#7c3aed` |
| Slate / Dark | | `#334155` |

:::tip Accessibility
Ensure your chosen color has sufficient contrast with white text (the nav links and portal name are white). Use a contrast checker like [WebAIM](https://webaim.org/resources/contrastchecker/) — aim for WCAG AA (contrast ratio ≥ 4.5:1).
:::

---

## Custom Nav Links

```yaml
ui:
  navLinks:
    - label: "Runbooks"
      url: "https://wiki.acme.com/runbooks"
      icon: "📖"
    - label: "On-Call"
      url: "https://app.pagerduty.com"
      icon: "🔔"
```

- Adds links to the navbar after the built-in items (Home, Catalog, Templates, Actions, Scorecards) and after plugin tabs
- Links open in a **new tab** (`target="_blank"`) with an external link indicator
- `icon` is optional — use any single emoji or short text (max 8 characters)
- **Maximum:** 10 custom nav links
- Also rendered in the mobile drawer

**Common use cases:**

| Link | URL pattern |
|------|------------|
| Wiki / Runbooks | `https://wiki.my-org.com/runbooks` |
| On-Call schedule | `https://app.pagerduty.com/teams` |
| Grafana dashboards | `https://grafana.my-org.com` |
| Jira project | `https://my-org.atlassian.net/jira` |
| Incident management | `https://status.my-org.com` |
| ADR repository | `https://github.com/my-org/adr` |

---

## Announcement Banner

```yaml
ui:
  announcement:
    message: "🚧 Scheduled maintenance Saturday 02:00–04:00 UTC — catalog scans will be paused"
    variant: "warning"
```

Displays a dismissable banner **above the navbar** visible to all users.

### `variant` options

| Variant | Color | Use for |
|---------|-------|---------|
| `info` | Blue | General notices, new features |
| `warning` | Amber | Scheduled maintenance, degraded performance |
| `error` | Red | Active incidents, critical issues |

**Default variant:** `info`

**Dismiss behavior:**
- Each user can dismiss the banner for their current browser session by clicking the **✕** button
- If you change the message content, the banner reappears for all users (even those who previously dismissed it)
- Changing only the `variant` without changing the `message` does **not** cause it to reappear for users who dismissed it

**To remove the banner:** delete the `announcement:` block from `forgeportal.yaml` and restart the API.

---

## Dark Mode

ForgePortal supports a per-user **dark mode toggle** in the navbar (sun/moon icon). Users' preferences are saved in their browser's `localStorage` and persist across sessions. The default respects the operating system preference (`prefers-color-scheme`).

No configuration is required to enable dark mode — it is available by default.

---

## Full Example

```yaml
# forgeportal.yaml

ui:
  portalName: "Platform Portal"
  logoUrl: "https://cdn.acme.com/platform-logo-white.svg"
  faviconUrl: "https://cdn.acme.com/favicon-32x32.png"
  primaryColor: "#0f172a"   # slate-900 for a dark, professional look

  navLinks:
    - label: "Runbooks"
      url: "https://wiki.acme.com/runbooks"
      icon: "📖"
    - label: "Status"
      url: "https://status.acme.com"
      icon: "🟢"
    - label: "PagerDuty"
      url: "https://acme.pagerduty.com"
      icon: "🔔"

  announcement:
    message: "ForgePortal v2.1 is out — see the Changelog for new features"
    variant: "info"

scm:
  # ... rest of your config
```

---

## How It Works (Technical)

The branding config is served by the API at `GET /api/v1/config/branding`. This endpoint is **public** (no authentication required) — it is safe to expose because logo URLs and color codes are not secrets.

The UI React app fetches this endpoint once at startup, caches the result for 10 minutes, and applies:
- CSS custom properties (`--color-brand`) on the `<html>` element for the primary color
- The navbar background color via an inline `style` attribute
- The portal name as `document.title` and navbar text
- The logo as an `<img>` element in the navbar
- The favicon by updating `<link rel="icon">` in the `<head>`

If the API is unreachable at startup, the UI falls back to the default ForgePortal branding with no error shown to the user.
