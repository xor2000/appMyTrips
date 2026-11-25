<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';
  import type { ResultGroup } from '#lib/places/results.ts';
  import { STEP_ICONS } from '#lib/steps/icons.ts';

  /**
   * Résultats d'une recherche de lieux groupés (« Rechercher », « Explorer la zone ») : par groupe,
   * un titre (icône, libellé, nombre) avec un filet, puis la liste de ses lieux, nommée par son
   * titre (un titre ne peut pas être un enfant direct d'une liste).
   */
  interface Props {
    groups: ResultGroup<T>[];
    /** Nom accessible de l'ensemble (« Lieux trouvés », « Résultats »). */
    label: string;
    /** Préfixe des identifiants des titres (uniques dans la page). */
    idPrefix: string;
    /** Clé d'un lieu dans son groupe (`{#each}`). */
    key: (item: T, index: number) => string | number;
    /** Ligne d'un lieu (`ResultRow`). */
    row: Snippet<[T]>;
  }

  let { groups, label, idPrefix, key, row }: Props = $props();
</script>

<div class="results" role="group" aria-label={label}>
  {#each groups as group (group.key)}
    {@const Icon = STEP_ICONS[group.icon]}
    <section class="group">
      <h3 id={`${idPrefix}-${group.key}`}>
        <Icon size={14} aria-hidden="true" />{group.label}
        <span class="group-count"
          >{group.items.length}<span class="visually-hidden"
            >{group.items.length > 1 ? ' lieux' : ' lieu'}</span
          ></span
        >
      </h3>
      <ul class="list" aria-labelledby={`${idPrefix}-${group.key}`}>
        {#each group.items as item, i (key(item, i))}
          {@render row(item)}
        {/each}
      </ul>
    </section>
  {/each}
</div>

<style>
  .results {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .group h3 {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    padding-bottom: var(--space-1);
    border-bottom: 1px solid var(--line);
    color: var(--muted);
    font: 700 12px var(--font-display);
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .group-count {
    margin-left: auto;
    font-weight: 600;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
</style>
