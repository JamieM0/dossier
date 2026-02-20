<script lang="ts">
  import { goto } from "$app/navigation";

  $effect(() => {
    void goto("/profile");
  });
</script>

<section class="screen">
  <h1>Loading Dossier...</h1>
</section>
