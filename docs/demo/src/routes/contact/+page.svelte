<script>
  import ContactCard from '$lib/ContactCard.svelte';
</script>

<svelte:head>
  <title>Contact | Demo Store — Reach the Team Directly</title>
  <meta
    name="description"
    content="Get in touch with Demo Store's founder for wholesale, press, or custom order inquiries."
  />
  <link rel="canonical" href="https://example.com/contact" />
  <meta property="og:title" content="Contact Demo Store — Reach the Team Directly" />
  <meta
    property="og:description"
    content="Get in touch with Demo Store's founder for wholesale, press, or custom order inquiries."
  />
  <meta property="og:image" content="https://example.com/og-contact.png" />
  <meta property="og:url" content="https://example.com/contact" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "ContactPage",
      "name": "Contact Demo Store"
    }
  </script>
</svelte:head>

<h1>Contact</h1>
<ContactCard
  name="Ada Lovelace"
  role="Founder"
  email="ada@example.com"
  phone="+1 555 0100"
  address="1 Analytical Engine Way"
  city="London"
  country="UK"
  avatar="/avatars/ada.jpg"
  company="Demo Store"
  website="https://example.com"
  twitter="@ada"
  linkedin="ada-lovelace"
/>
