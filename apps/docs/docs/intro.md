---
id: intro
title: Welcome to ForgePortal
sidebar_position: 1
slug: /
---

# Welcome to ForgePortal ⚡

> **ForgePortal** is an open-source Internal Developer Portal (IDP) — self-hosted, built on
> PostgreSQL, Fastify, React, and TypeScript. It gives your engineering org a single place to
> discover services, scaffold new ones, enforce quality standards, and extend the platform with
> plugins — all without forking or maintaining a complex system.

## What is ForgePortal?

An Internal Developer Portal is the **homepage for your engineering platform**. It answers:

- *What services do we have?* → **Software Catalog**
- *How do I create a new service?* → **Templates & Scaffolding**
- *How healthy are our services?* → **Scorecards**
- *How do I integrate my tool?* → **Plugin System**

ForgePortal is the platform you build **once** and use **forever**. Unlike Backstage (which we
love and drew inspiration from), ForgePortal is designed to be:

| Priority | How ForgePortal delivers it |
|----------|-----------------------------|
| **Fast to set up** | `docker compose up` → working portal in 5 minutes |
| **Simple to operate** | Two services (API + Worker), one database (PostgreSQL) |
| **Easy to extend** | `npx create-forge-plugin` → new plugin in 2 minutes |
| **Safe by default** | OIDC auth, RBAC, secret redaction, webhook verification out of the box |

## Where to start

<div className="row">
  <div className="col col--6">

  ### I want to try it now
  → [Quick Start (Docker Compose)](/docs/getting-started/quick-start-docker)

  </div>
  <div className="col col--6">

  ### I want to build a plugin
  → [Plugin Developer Guide](/docs/plugin-development/overview)

  </div>
  <div className="col col--6">

  ### I want to understand the concepts
  → [Core Concepts](/docs/concepts/architecture)

  </div>
  <div className="col col--6">

  ### I want to deploy it in production
  → [Deployment Guide](/docs/deployment/docker-compose)

  </div>
  <div className="col col--6">

  ### I want to see available plugins
  → [Available Plugins](/docs/plugins)

  </div>
</div>
