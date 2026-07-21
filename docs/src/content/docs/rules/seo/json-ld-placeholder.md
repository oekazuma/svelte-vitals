---
title: seo/json-ld-placeholder · JSON-LD placeholder text
description: JSON-LD should not contain unreplaced placeholder text.
---

**Severity:** info

## What it checks

Flags obvious placeholder/boilerplate text (e.g. `lorem ipsum`, `Your Company Name`) left in a JSON-LD value.

## Why it matters

Leftover placeholder text ships misleading structured data to search engines.

## How to fix

Replace the placeholder with the real value for the page.
