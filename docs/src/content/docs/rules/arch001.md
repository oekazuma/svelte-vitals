---
title: ARCH001 · Component size
description: Very large components should be split up.
---

**Severity:** info · **Category:** architecture

## What it checks

Flags a `.svelte` component longer than 400 lines (static/CLI analysis of `src/**/*.svelte`).

## Why it matters

A very large component is hard to read, test, and reuse, and usually means several responsibilities should be split out — a common shape for AI-generated code.

## How to fix

Extract sections into smaller, focused child components (and reusable `.svelte.ts` modules for logic).
