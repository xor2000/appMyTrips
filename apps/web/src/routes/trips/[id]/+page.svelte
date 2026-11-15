<script lang="ts">
  import type { Role, TripSnapshot } from '@mytrips/core';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { ApiError, deleteMember, getTrip, putMember, updateTrip } from '#lib/api.ts';
  import { dayTitle, formatPeriod, plural } from '#lib/format.ts';
  import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
  import DayTabs from '#lib/components/DayTabs.svelte';
  import ShareDialog from '#lib/components/ShareDialog.svelte';
  import SplitPane from '#lib/components/SplitPane.svelte';
  import TripFormDialog, { type TripFormValues } from '#lib/components/TripFormDialog.svelte';
  import TripMap from '#lib/components/TripMap.svelte';

  let snapshot = $state<TripSnapshot | null>(null);
  let status = $state<'loading' | 'ready' | 'not_found' | 'error'>('loading');
  let loadError = $state<string | null>(null);
  let notice = $state<string | null>(null);
  let selectedDay = $state<string | null>(null);
  let editing = $state(false);
  let sharing = $state(false);
  /** Modification de période en attente de confirmation (jours non vides à supprimer). */
  let pendingPeriod = $state<{ values: TripFormValues; dates: string[] } | null>(null);

  const id = $derived(page.params.id ?? '');
  const trip = $derived(snapshot?.trip);
  const canEdit = $derived(snapshot?.role === 'owner' || snapshot?.role === 'editor');
  const isOwner = $derived(snapshot?.role === 'owner');
  const days = $derived(snapshot?.days ?? []);
  const day = $derived(days.find((d) => d.id === selectedDay) ?? null);

  async function load() {
    try {
      snapshot = await getTrip(id);
      status = 'ready';
      if (selectedDay && !snapshot.days.some((d) => d.id === selectedDay)) selectedDay = null;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) status = 'not_found';
      else {
        status = 'error';
        loadError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  $effect(() => {
    if (id) load();
  });

  /** Applique une modification ; sur conflit de version, recharge le voyage et prévient. */
  async function apply(action: () => Promise<TripSnapshot | void>) {
    try {
      const next = await action();
      snapshot = next ?? (await getTrip(id));
      notice = null;
    } catch (e) {
      if (e instanceof ApiError && e.code === 'version_conflict') {
        await load();
        notice = e.message;
        return;
      }
      throw e;
    }
  }

  async function saveTrip(values: TripFormValues, force = false) {
    if (!trip) return;
    try {
      await apply(() => updateTrip(id, trip.version, values, { force }));
      editing = false;
      pendingPeriod = null;
    } catch (e) {
      if (e instanceof ApiError && e.code === 'days_not_empty') {
        editing = false;
        pendingPeriod = { values, dates: (e.body.dates as string[]) ?? [] };
        return;
      }
      throw e;
    }
  }

  async function addMember(email: string, role: Role) {
    await apply(() => putMember(id, email, role));
  }

  async function removeMember(email: string) {
    await apply(() => deleteMember(id, email));
  }
</script>

<svelte:head>
  <title>{trip ? `${trip.name} · MyTrips` : 'Voyage · MyTrips'}</title>
</svelte:head>

{#if status === 'loading'}
  <p class="state">Chargement du voyage…</p>
{:else if status === 'not_found'}
  <div class="state">
    <h1>Voyage introuvable</h1>
    <p>Ce voyage n’existe pas, ou il n’est pas partagé avec vous.</p>
    <a class="btn btn-soft" href={resolve('/')}>Retour aux voyages</a>
  </div>
{:else if status === 'error'}
  <div class="state">
    <p class="form-error" role="alert">{loadError}</p>
  </div>
{:else if snapshot && trip}
  <div class="trip">
    <header class="trip-header">
      <div class="title-row">
        <a class="back" href={resolve('/')} aria-label="Retour aux voyages">←</a>
        <div class="title">
          <h1>{trip.name}</h1>
          <p>
            {formatPeriod(trip.startDate, trip.endDate)} · {plural(snapshot.days.length, 'jour')}
            {#if snapshot.role === 'viewer'}
              <span class="chip readonly">Lecture seule</span>
            {/if}
          </p>
        </div>
        <div class="tools">
          {#if canEdit}
            <button type="button" class="btn btn-soft" onclick={() => (editing = true)}>
              Modifier
            </button>
          {/if}
          {#if isOwner}
            <button type="button" class="btn btn-primary" onclick={() => (sharing = true)}>
              Partager
            </button>
          {/if}
        </div>
      </div>
      <DayTabs days={snapshot.days} selected={selectedDay} onSelect={(d) => (selectedDay = d)} />
      {#if notice}
        <p class="notice" role="status">{notice}</p>
      {/if}
    </header>

    <div class="body">
      <SplitPane>
        {#snippet left()}
          <section class="panel">
            {#if day}
              <h2>{dayTitle(day.date)}</h2>
              <p class="hours">{day.dayStart ?? trip.dayStart} → {day.dayEnd ?? trip.dayEnd}</p>
              {#if day.notes}
                <p class="notes">{day.notes}</p>
              {/if}
              <div class="empty-day">
                <p>Aucune étape pour ce jour.</p>
                <p class="muted">
                  L’ajout d’étapes (hôtels, visites, restaurants…) arrive bientôt.
                </p>
              </div>
            {:else}
              <h2>Tout le voyage</h2>
              <ol class="day-list">
                {#each days as d, i (d.id)}
                  <li>
                    <button type="button" onclick={() => (selectedDay = d.id)}>
                      <b>J{i + 1}</b>
                      <span>{dayTitle(d.date)}</span>
                    </button>
                  </li>
                {/each}
              </ol>
            {/if}
          </section>
        {/snippet}
        {#snippet right()}
          <TripMap />
        {/snippet}
      </SplitPane>
    </div>
  </div>

  {#if editing}
    <TripFormDialog
      initial={{ name: trip.name, startDate: trip.startDate, endDate: trip.endDate }}
      onSubmit={(values) => saveTrip(values)}
      onClose={() => (editing = false)}
    />
  {/if}

  {#if pendingPeriod}
    {@const pending = pendingPeriod}
    <ConfirmDialog
      title="Supprimer des jours ?"
      message={`La nouvelle période retire ${plural(pending.dates.length, 'jour')} contenant des informations (${pending.dates.map(dayTitle).join(', ')}). Elles seront perdues.`}
      confirmLabel="Supprimer ces jours"
      onConfirm={() => saveTrip(pending.values, true)}
      onCancel={() => (pendingPeriod = null)}
    />
  {/if}

  {#if sharing}
    <ShareDialog
      members={snapshot.members}
      onAdd={addMember}
      onRemove={removeMember}
      onClose={() => (sharing = false)}
    />
  {/if}
{/if}

<style>
  .state {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
    max-width: 640px;
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
    color: var(--muted);
  }

  .state h1 {
    color: var(--fg);
  }

  .trip {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .trip-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-6);
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .back {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-pill);
    background: var(--surface-2);
    color: var(--fg);
    text-decoration: none;
    font-size: 18px;
  }

  .title {
    flex: 1;
    min-width: 0;
  }

  h1 {
    font-size: 24px;
    font-weight: 800;
  }

  .title p {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }

  .readonly {
    background: var(--warn-soft);
    color: var(--warn);
  }

  .tools {
    display: flex;
    gap: var(--space-2);
  }

  .notice {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--warn-soft);
    color: var(--warn);
    font-size: 13px;
    font-weight: 600;
  }

  .body {
    flex: 1;
    min-height: 0;
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-6);
  }

  .panel h2 {
    font-size: 20px;
  }

  .hours {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--muted);
  }

  .notes {
    margin: 0;
    white-space: pre-wrap;
  }

  .empty-day {
    padding: var(--space-6);
    border: 2px dashed var(--line);
    border-radius: var(--radius-lg);
    text-align: center;
  }

  .empty-day p {
    margin: 0;
  }

  .muted {
    color: var(--muted);
    font-size: 13px;
  }

  .day-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .day-list button {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-3) var(--space-4);
    border: 0;
    border-radius: var(--radius-md);
    background: var(--surface);
    box-shadow: var(--shadow-card);
    color: var(--fg);
    text-align: left;
    cursor: pointer;
  }

  .day-list b {
    font-family: var(--font-display);
    color: var(--accent-strong);
  }
</style>
