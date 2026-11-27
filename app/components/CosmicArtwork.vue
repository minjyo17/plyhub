<template>
  <svg class="game-artwork" viewBox="0 0 640 420" preserveAspectRatio="xMidYMid slice" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="640" height="420" rx="24" fill="#16123A"/>
    <circle cx="470" cy="90" r="190" fill="#2B2466" fill-opacity=".55"/>
    <circle cx="96" cy="74" r="3" fill="#C9C2FF"/>
    <circle cx="168" cy="140" r="2" fill="#8F86D9"/>
    <circle cx="560" cy="330" r="3" fill="#C9C2FF"/>
    <circle cx="590" cy="88" r="2" fill="#8F86D9"/>
    <circle cx="70" cy="300" r="2" fill="#8F86D9"/>
    <path d="M520 192h14M527 185v14M118 228h12M124 222v12" stroke="#B9AFFF" stroke-width="3" stroke-linecap="round"/>
    <!-- 4x4 보드 -->
    <rect x="200" y="70" width="240" height="280" rx="22" fill="#221C52"/>
    <g fill="#2D2766">
      <rect x="216" y="86" width="48" height="56" rx="12"/><rect x="272" y="86" width="48" height="56" rx="12"/><rect x="328" y="86" width="48" height="56" rx="12"/><rect x="384" y="86" width="40" height="56" rx="12"/>
      <rect x="216" y="150" width="48" height="56" rx="12"/><rect x="384" y="150" width="40" height="56" rx="12"/>
      <rect x="216" y="214" width="48" height="56" rx="12"/><rect x="272" y="278" width="48" height="56" rx="12"/><rect x="384" y="278" width="40" height="56" rx="12"/>
    </g>
    <!-- 행성 + 고리 -->
    <rect x="272" y="150" width="104" height="120" rx="18" fill="#2F5F8F"/>
    <ellipse cx="324" cy="212" rx="62" ry="15" stroke="#FFD58A" stroke-width="7" transform="rotate(-18 324 212)"/>
    <circle cx="324" cy="208" r="30" fill="#F4B860"/>
    <path d="M300 200c14 6 32 6 48 0" stroke="#D98C3A" stroke-width="5" stroke-linecap="round"/>
    <path d="M286 222c26 18 62 16 84-6" stroke="#FFD58A" stroke-width="7" stroke-linecap="round" transform="rotate(-6 324 212)"/>
    <!-- 별가루 두 개가 합쳐지는 중 -->
    <rect x="328" y="278" width="48" height="56" rx="12" fill="#3B3A6E"/>
    <path d="M352 292l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#FFF3B0"/>
    <rect x="216" y="278" width="48" height="56" rx="12" fill="#3B3A6E"/>
    <path d="M240 292l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#FFF3B0"/>
    <path d="M272 306h40" stroke="#8B7BFF" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 10"/>
  </svg>
</template>
<style scoped>.game-artwork { display:block; width:100%; height:100%; object-fit:cover; }</style>
