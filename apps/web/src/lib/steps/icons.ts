import type { StepType } from '@mytrips/core';
import Bed from 'lucide-svelte/icons/bed';
import Binoculars from 'lucide-svelte/icons/binoculars';
import Castle from 'lucide-svelte/icons/castle';
import Coffee from 'lucide-svelte/icons/coffee';
import FerrisWheel from 'lucide-svelte/icons/ferris-wheel';
import Folder from 'lucide-svelte/icons/folder';
import Landmark from 'lucide-svelte/icons/landmark';
import MapPin from 'lucide-svelte/icons/map-pin';
import Mountain from 'lucide-svelte/icons/mountain';
import Plane from 'lucide-svelte/icons/plane';
import Ship from 'lucide-svelte/icons/ship';
import ShoppingBag from 'lucide-svelte/icons/shopping-bag';
import Sparkles from 'lucide-svelte/icons/sparkles';
import SquareParking from 'lucide-svelte/icons/square-parking';
import TrainFront from 'lucide-svelte/icons/train-front';
import Trees from 'lucide-svelte/icons/trees';
import Umbrella from 'lucide-svelte/icons/umbrella';
import UtensilsCrossed from 'lucide-svelte/icons/utensils-crossed';

/** Composant d'icône Lucide (même type pour toutes les icônes). */
type Icon = typeof MapPin;

/** Icône Lucide de chaque type d'étape. */
export const STEP_ICONS: Record<StepType, Icon> = {
  hotel: Bed,
  restaurant: UtensilsCrossed,
  cafe: Coffee,
  museum: Landmark,
  monument: Castle,
  attraction: FerrisWheel,
  viewpoint: Binoculars,
  park: Trees,
  beach: Umbrella,
  shopping: ShoppingBag,
  airport: Plane,
  station: TrainFront,
  port: Ship,
  parking: SquareParking,
  hike: Mountain,
  activity: Sparkles,
  other: MapPin,
};

export const GROUP_ICON: Icon = Folder;
export const STAY_ICON: Icon = Bed;
