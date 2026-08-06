---
'@svelte-vitals/core': patch
---

Document what a floored inventory is, and guard the margin the floor depends on.

Five of the nine `(category, scope)` groups hold less than 25 points of checks, so `inventories` reports 25
for all of them — a group with one rule and a group with eight look identical there. That number is the
divisor a score used, not a count of what ran, and the reporters guide now says so. It also now says that
`keys` counts per category rather than per project, so one run can show `seo` at 13 keys and `architecture`
at 334.

A test now fails if the floor stops ordering `info` below `warning`. That ordering holds only while the
widest group stays under 125 points; the widest today is 110, so a few more `warning` rules there would
re-invert them. The test turns that into a failing build rather than a silent change in what a score means.
