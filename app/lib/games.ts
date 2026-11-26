// Platform-owned registry. Only playable, registered games appear in the catalogue.
export const games = [{
  id: 'snake', title: 'Snake Garden', subtitle: '한 입 더. 조금 더 길게.',
  description: '먹이를 모으고, 벽을 피하고, 최고 기록에 도전하세요.',
  genre: '아케이드', tags: ['아케이드', '싱글 플레이'],
  controls: '방향키 · WASD · 화면 방향 버튼',
  about: '작은 정원에서 시작하는 스네이크 게임입니다. 먹이를 먹을수록 몸이 길어지고 움직임이 빨라집니다. 벽과 내 몸을 피하며 정원을 자유롭게 누벼보세요.',
  rules: ['먹이를 먹을 때마다 10점을 얻어요.', '벽이나 내 몸에 닿으면 한 판이 끝나요.', '가장 높은 점수가 랭킹에 남아요.'],
}] as const
export function gameUrl(value: string, portalOrigin: string) {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.origin === portalOrigin) throw new Error('게임은 포털과 다른 HTTP(S) 출처에서 실행해야 합니다.')
  return url
}
