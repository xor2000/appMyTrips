<svelte:head>
  <title>MyTrips</title>
</svelte:head>

<section class="hero">
  <h1>Mes voyages</h1>
  <p>La liste des voyages arrive au prochain lot.</p>
</section>

<style>
  .hero {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  h1 {
    font-size: 32px;
    font-weight: 800;
  }

  p {
    margin: 0;
    color: var(--muted);
  }
</style>
