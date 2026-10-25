---
'@svelte-vitals/core': patch
'svelte-vitals': patch
---

`performance/responsive-image` no longer reports a QR code: in source analysis, an `<img>` whose `src` is a binding or member whose name holds `qr` (`src={qrDataUrl}`, `src={totpSetupData.qrCode}`). A QR code is drawn at one fixed size, so a `srcset` has nothing to choose between, and one built at runtime (often an inline SVG data URI from a TOTP setup) is invisible to static analysis. A URL built in the template or a call (`src={qrUrl(address)}`) is still checked.
