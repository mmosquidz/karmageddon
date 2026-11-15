<script lang="ts">
  let { code }: { code: string } = $props();

  let missing = $state(false);
  const file = $derived(/^[a-zA-Z]{2}$/.test(code) ? `/flags/${code.toLowerCase()}.svg` : null);
</script>

{#if file && !missing}
  <img
    class="flag"
    src={file}
    alt=""
    width="30"
    height="22"
    onerror={() => {
      missing = true;
    }}
  />
{/if}

<style>
  .flag {
    width: 1.85rem;
    height: 1.35rem;
    flex: none;
    object-fit: cover;
    border-radius: 1px;
    box-shadow: 0 0 0 1px rgb(20 52 76 / 22%);
  }
</style>
