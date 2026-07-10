<script>
  let { name, role, email, phone, address, city, country, avatar, company, website, twitter, linkedin } = $props();
</script>

<article>
  <img src={avatar} alt={name} width="64" height="64" />
  <h2>{name}</h2>
  <p>{role} at {company}</p>
  <p>{email} · {phone}</p>
  <p>{address}, {city}, {country}</p>
  <p><a href={website}>{website}</a></p>
  <p>{twitter} · {linkedin}</p>
</article>
