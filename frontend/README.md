# Nexus AI Agent Management Platform

A responsive frontend demo for managing AI agents and workflows. The application uses React, TypeScript, regular CSS, and Vite. All records and actions are local demo data; there is no backend connection or real access enforcement.

## Start the development server

```sh
npm install
npm run dev
```

## Available checks

```sh
npm run lint
npm run build
```

## Demo areas

- Dashboard, Agents, Workflows, and the visual workflow editor
- Monitoring, Analytics, and Performance & Costs
- Human Approvals, Execution Logs, Error Tracking, and Permissions & Security

The workflow editor uses the already-installed `@xyflow/react` package. Charts are built with inline SVG and CSS. Demo approvals, retries, role edits, filters, and searches update frontend state only.
