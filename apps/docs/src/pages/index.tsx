import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import styles from './index.module.css';

// ── Feature cards ────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon:  '🗂️',
    title: 'Software Catalog',
    description:
      'A unified, auto-discovered catalog of all your services, libraries, APIs, and teams. ' +
      'Populated from GitHub/GitLab — zero manual YAML required.',
  },
  {
    icon:  '⚡',
    title: 'Templates & Scaffolding',
    description:
      'Golden-path templates that spin up services, bootstrap CI/CD, and open PRs — all ' +
      'in one click. Powered by a Postgres-backed action runner with retries and audit logs.',
  },
  {
    icon:  '🏆',
    title: 'Scorecards',
    description:
      'Bronze / Silver / Gold maturity levels for every service. Rule engine checks README, ' +
      'CI config, docs, and more. One-click fix actions open PRs automatically.',
  },
  {
    icon:  '🔌',
    title: 'Plugin System',
    description:
      'The simplest plugin model in the IDP space. ' +
      'Three types (UI, backend, fullstack), one manifest, one CLI command. ' +
      'No forking. No config DSL. Just TypeScript.',
  },
] as const;

function FeatureCard({ icon, title, description }: (typeof FEATURES)[number]) {
  return (
    <div className={clsx('col col--3', styles.featureCard)}>
      <div className={styles.featureIcon}>{icon}</div>
      <Heading as="h3">{title}</Heading>
      <p>{description}</p>
    </div>
  );
}

// ── Comparison table ─────────────────────────────────────────────────────────

const COMPARISON = [
  { feature: 'Initial setup time', forgeportal: '< 5 min (docker compose up)',          backstage: '2–4 hours' },
  { feature: 'Plugin creation',    forgeportal: '< 2 min (npx create-forge-plugin)',     backstage: '30–60 min' },
  { feature: 'Backend language',   forgeportal: 'TypeScript (same as UI)',               backstage: 'TypeScript (same)' },
  { feature: 'Config format',      forgeportal: 'forgeportal.yaml (Zod validated)',      backstage: 'app-config.yaml' },
  { feature: 'Auth',               forgeportal: 'OIDC (any provider)',                   backstage: 'Many auth providers' },
  { feature: 'Search',             forgeportal: 'PostgreSQL FTS',                        backstage: 'Pluggable (Lunr, Elastic…)' },
  { feature: 'Scorecards',         forgeportal: '✅ Built-in + auto-fix PRs',            backstage: '3rd-party plugins' },
  { feature: 'License',            forgeportal: 'MIT',                                   backstage: 'Apache 2.0' },
] as const;

// ── Hero ──────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className={styles.heroTitle}>
          ⚡ ForgePortal
        </Heading>
        <p className={styles.heroSubtitle}>
          The Internal Developer Portal that developers actually love.
          <br />
          <strong>Open-source · Self-hosted · Ships in days, not months.</strong>
        </p>
        <div className={styles.heroCta}>
          <Link
            className="button button--primary button--lg"
            to="/docs/getting-started/overview"
          >
            Get Started →
          </Link>
          <Link
            className="button button--secondary button--lg"
            href="https://github.com/your-org/forgeportal"
          >
            GitHub ↗
          </Link>
        </div>
        <p className={styles.heroNote}>
          Built on PostgreSQL, Fastify, React, and TypeScript.
          No Kubernetes required for local dev.
        </p>
      </div>
    </header>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Home(): React.ReactElement {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="ForgePortal — the open-source Internal Developer Portal. Catalog, templates, scorecards, and plugins in one self-hostable platform."
    >
      <Hero />

      <main>
        {/* Feature cards */}
        <section className={styles.features}>
          <div className="container">
            <Heading as="h2" className={styles.sectionTitle}>
              Everything your engineering org needs, out of the box
            </Heading>
            <div className="row">
              {FEATURES.map((f) => (
                <FeatureCard key={f.title} {...f} />
              ))}
            </div>
          </div>
        </section>

        {/* Quick install */}
        <section className={styles.quickInstall}>
          <div className="container">
            <Heading as="h2">Up and running in 60 seconds</Heading>
            <pre className={styles.codeBlock}>
              <code>{`git clone https://github.com/your-org/forgeportal
cd forgeportal
cp deployments/docker-compose/.env.example deployments/docker-compose/.env
docker compose -f deployments/docker-compose/docker-compose.yml up`}</code>
            </pre>
            <p>
              Then open <a href="http://localhost:3000">http://localhost:3000</a> → your catalog is live.{' '}
              <Link to="/docs/getting-started/quick-start-docker">Full guide →</Link>
            </p>
          </div>
        </section>

        {/* Comparison table */}
        <section className={styles.comparison}>
          <div className="container">
            <Heading as="h2">ForgePortal vs Backstage</Heading>
            <p className={styles.comparisonSubtitle}>
              We love Backstage — ForgePortal is what we wished it was when we started.
            </p>
            <div className={styles.tableWrapper}>
              <table>
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>⚡ ForgePortal</th>
                    <th>Backstage</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.feature}>
                      <td>{row.feature}</td>
                      <td><strong>{row.forgeportal}</strong></td>
                      <td>{row.backstage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className={styles.finalCta}>
          <div className="container">
            <Heading as="h2">Ready to build your IDP?</Heading>
            <p>
              Start with Docker Compose in 5 minutes. Customize with plugins.
              Ship to Kubernetes when you&apos;re ready.
            </p>
            <Link
              className="button button--primary button--lg"
              to="/docs/getting-started/overview"
            >
              Read the Docs →
            </Link>
          </div>
        </section>
      </main>
    </Layout>
  );
}
