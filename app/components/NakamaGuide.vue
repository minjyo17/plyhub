<template>
  <section id="nakama-guide" class="nakama-guide" aria-labelledby="nakama-guide-title">
    <div class="guide-heading">
      <div>
        <p class="eyebrow">서버 구조 한눈에 보기</p>
        <h2 id="nakama-guide-title">Nakama는 어떻게 내 컴퓨터에서 실행될까요?</h2>
      </div>
      <span class="guide-badge">로컬 개발 환경</span>
    </div>
    <p class="guide-intro">이미 만들어진 서버에 우리 코드와 설정을 더하고, Docker로 실행해요.</p>
    <figure>
      <picture>
        <source media="(max-width: 600px)" srcset="/images/nakama-flow-mobile.svg" width="360" height="1138">
        <img src="/images/nakama-flow.svg" width="1000" height="650" loading="lazy" alt="공식 Nakama 이미지에 우리 코드와 설정을 추가해 PlayHub 이미지를 만듭니다. Docker에서 컨테이너로 실행하면 API와 관리 콘솔이 열립니다. PostgreSQL은 계정과 점수를 별도 볼륨에 저장합니다. Nuxt 화면은 SDK를 통해 게임용 API에 연결됩니다.">
      </picture>
      <figcaption>
        <span><strong>이미지</strong> 실행할 파일을 담은 패키지</span>
        <span><strong>컨테이너</strong> 이미지를 실제로 실행한 인스턴스</span>
      </figcaption>
    </figure>
    <div class="guide-footnote">
      <p><strong>정지해도 데이터는 남아요.</strong> 저장된 계정과 점수는 데이터 볼륨에 보관돼요. 볼륨까지 삭제하면 기록도 삭제됩니다.</p>
      <a href="http://127.0.0.1:7351" target="_blank" rel="noopener noreferrer">관리 콘솔 열기 <span aria-hidden="true">↗</span><span class="sr-only"> (새 탭)</span></a>
    </div>
  </section>
</template>

<style scoped>
.nakama-guide { margin-top: 32px; padding: 28px; border: 1px solid #dfe3eb; border-radius: 16px; background: #fff; scroll-margin-top: 24px; }
.guide-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; }
.guide-heading h2 { margin-top: 8px; font-size: 22px; line-height: 1.5; letter-spacing: -.6px; }
.guide-badge { flex-shrink: 0; padding: 7px 10px; border-radius: 6px; color: #5e527f; background: #f1eef9; font-size: 11px; font-weight: 650; }
.guide-intro { margin-top: 10px; color: #647086; font-size: 14px; line-height: 1.8; }
figure { margin: 24px 0 0; }
picture, img { display: block; width: 100%; }
img { height: auto; }
figcaption { display: flex; flex-wrap: wrap; gap: 12px 28px; margin-top: 16px; padding: 16px 18px; background: #f7f8fb; border-radius: 10px; color: #647086; font-size: 13px; line-height: 1.7; }
figcaption strong { margin-right: 8px; color: #26324b; }
.guide-footnote { display: flex; gap: 24px; align-items: center; justify-content: space-between; margin-top: 20px; }
.guide-footnote p { font-size: 12px; line-height: 1.8; color: #647086; }
.guide-footnote strong { color: #21634e; }
.guide-footnote a { flex-shrink: 0; color: #6353d8; font-size: 13px; font-weight: 650; text-underline-offset: 4px; padding: 10px 0; }
@media (max-width: 720px) {
  .nakama-guide { padding: 20px 14px; }
  .guide-heading { flex-direction: column; gap: 10px; }
  .guide-heading h2 { font-size: 20px; }
  .guide-footnote { flex-direction: column; align-items: flex-start; gap: 8px; }
}
</style>
