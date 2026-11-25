<script lang="ts">
  import { STEP_TYPE_INFO, type Place } from '@mytrips/core';
  import { onMount } from 'svelte';
  import PlaceSearch from '#lib/components/steps/PlaceSearch.svelte';
  import { placeResultGroups } from '#lib/places/results.ts';
  import type { MenuPoint } from '#lib/steps/contextMenu.ts';
  import ResultGroups from './ResultGroups.svelte';
  import ResultRow from './ResultRow.svelte';
  import SidePanel from './SidePanel.svelte';

  interface Props {
    search: (q: string) => Promise<Place[]>;
    /** Références OSM des étapes du voyage (lieux déjà ajoutés). */
    addedRefs: Set<string>;
    /** Résultat choisi (popup ouverte sur la carte). */
    selected: Place | null;
    onSelect: (place: Place) => void;
    onContextMenu: (place: Place, point: MenuPoint) => void;
    onBack: () => void;
    /** Délai avant la recherche, en millisecondes (anti-rebond). */
    delay?: number;
  }

  let { search, addedRefs, selected, onSelect, onContextMenu, onBack, delay }: Props = $props();

  let field: HTMLDivElement | undefined = $state();

  // Le panneau s'ouvre pour chercher : le champ reçoit le focus.
  onMount(() => field?.querySelector('input')?.focus());

  const meta = (place: Place) =>
    `${STEP_TYPE_INFO[place.type].label}${place.address ? ` · ${place.address}` : ''}`;
</script>

<SidePanel label="Rechercher" title="Rechercher" {onBack}>
  <div bind:this={field}>
    <PlaceSearch {search} {delay} onPick={onSelect}>
      {#snippet list(places)}
        <!-- Clé par position : le géocodeur peut renvoyer deux fois le même lieu. -->
        <ResultGroups
          groups={placeResultGroups(places)}
          label="Résultats"
          idPrefix="search-group"
          key={(_, i) => i}
        >
          {#snippet row(place)}
            <ResultRow
              name={place.name}
              type={place.type}
              meta={meta(place)}
              selected={place === selected}
              added={place.osmRef !== null && addedRefs.has(place.osmRef)}
              onSelect={() => onSelect(place)}
              onContextMenu={(at) => onContextMenu(place, at)}
            />
          {/snippet}
        </ResultGroups>
      {/snippet}
    </PlaceSearch>
  </div>
</SidePanel>
