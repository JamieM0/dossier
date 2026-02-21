<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";

  onMount(() => {
    void goto("/profile");
  });
</script>

<section class="screen">
  <h1>Loading Dossier...</h1>
</section>
