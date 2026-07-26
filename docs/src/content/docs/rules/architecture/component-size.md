---
title: architecture/component-size · Component size
description: Very large components should be split up.
---

**Severity:** info · **Category:** architecture

## What it checks

Flags a `.svelte` component longer than 200 lines (static/CLI analysis of `src/**/*.svelte`).

The threshold comes from the same measurement as `architecture/prop-count`: across 7 real Svelte 5 codebases the median per-repository 90th percentile is 124 lines and the 95th is 179. 200 sits deliberately above both, because length is a weaker signal than a wide prop surface — tables, forms, and generated markup are legitimately long.

## Why it matters

A very large component is hard to read, test, and reuse, and usually means several responsibilities should be split out — a common shape for AI-generated code.

## How to fix

Extract sections into smaller, focused child components (and reusable `.svelte.ts` modules for logic).
