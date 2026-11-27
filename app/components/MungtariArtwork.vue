<template>
  <!-- 멍타리 대전 게임에서 실제로 쓰는 그림(public/images/games/mungtari/)으로 만든 썸네일 -->
  <div class="mungtari-artwork" aria-hidden="true">
    <img class="bg" src="/images/games/mungtari/cover-bg.jpg" alt="">
    <img class="bone" src="/images/games/mungtari/bone.png" alt="">
    <img class="dog kong" src="/images/games/mungtari/kong-happy.png" alt="">
    <img class="dog bori" src="/images/games/mungtari/bori-idle.png" alt="">
  </div>
</template>
<style scoped>
.mungtari-artwork { position:relative; width:100%; height:100%; overflow:hidden; border-radius:inherit; background:#5bb8f5; }
.bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:center 70%; }
.dog { position:absolute; bottom:6%; height:52%; width:auto; filter:drop-shadow(0 6px 4px rgba(60, 40, 20, .18)); }
.kong { left:14%; }
/* 보리는 오른쪽 집에서 콩이를 바라본다 */
.bori { right:14%; transform:scaleX(-1); }
.bone { position:absolute; left:50%; top:24%; width:11%; transform:translateX(-50%) rotate(-22deg); }
</style>
