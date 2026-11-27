<script setup lang="ts">
// 게임 ID별 썸네일. 새 게임을 등록하면 여기에 한 줄 추가한다.
defineProps<{ gameId: string }>()
</script>
<template>
  <CosmicArtwork v-if="gameId === 'cosmic-merge'" />
  <MungtariArtwork v-else-if="gameId === 'mungtari'" />
  <SnakeArtwork v-else />
</template>
