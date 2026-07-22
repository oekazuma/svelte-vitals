---
title: seo/sitemap-in-robots · Sitemap referenced in robots.txt
description: robots.txt should point crawlers at your sitemap.
---

**Severity:** info

## What it checks

When both `robots.txt` and a sitemap exist, the static `static/robots.txt` should contain a `Sitemap:` line. (A `+server` robots endpoint is not inspected statically.)

## Why it matters

A `Sitemap:` line in robots.txt helps crawlers discover your sitemap; without it, discovery relies on manual submission.

## How to fix

Add a `Sitemap:` line to `static/robots.txt`:

```text
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml
```
