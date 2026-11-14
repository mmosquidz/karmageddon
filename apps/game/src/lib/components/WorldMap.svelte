<script lang="ts">
  import { LAND_PATH } from "$lib/land";
  import { mapPoint } from "$lib/format";

  let {
    latitude,
    longitude,
    label,
  }: { latitude: number; longitude: number; label: string } = $props();

  const point = $derived(mapPoint(latitude, longitude));
</script>

<svg
  class="world-map"
  viewBox="0 0 360 180"
  role="img"
  aria-label={`Carte du monde, naissance à ${label}`}
>
  <rect class="ocean" width="360" height="180" />
  <path class="land" d={LAND_PATH} />
  <circle class="halo" cx={point.x} cy={point.y} r="6" />
  <circle class="mark" cx={point.x} cy={point.y} r="3.2" />
</svg>

<style>
  .world-map {
    display: block;
    width: 100%;
    height: auto;
    overflow: hidden;
    border-radius: 0.75rem;
    background: #d7e4ea;
  }

  .world-map .ocean {
    fill: #d7e4ea;
  }

  .world-map .land {
    fill: #9aafa8;
  }

  .world-map .halo {
    fill: #ffffff;
  }

  .world-map .mark {
    fill: oklch(0.42 0.1 165);
  }
</style>
