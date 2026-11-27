/// <reference path="../types/nakama-runtime/index.d.ts" />

// Nakama expects InitModule in the global scope, not an ES module export.
const InitModule: nkruntime.InitModule = function (_ctx, logger, nk, _initializer) {
  // Idempotent: an existing leaderboard and its scores are kept on restart.
  // Stage 3 will use this ID for the test game's score submission.
  nk.leaderboardCreate(
    'playhub-test',
    false, // Client score writes are allowed for this local demo.
    nkruntime.SortOrder.DESCENDING,
    nkruntime.Operator.BEST,
    null, // No scheduled score reset.
    { gameId: 'test-game', title: 'PlayHub test leaderboard' },
    true,
  )
  nk.leaderboardCreate(
    'playhub-snake', false, nkruntime.SortOrder.DESCENDING,
    nkruntime.Operator.BEST, null,
    { gameId: 'snake', title: 'Snake Garden' }, true,
  )
  nk.leaderboardCreate(
    'playhub-cosmic-merge', false, nkruntime.SortOrder.DESCENDING,
    nkruntime.Operator.BEST, null,
    { gameId: 'cosmic-merge', title: '코스믹 머지' }, true,
  )
  nk.leaderboardCreate(
    'playhub-mungtari', false, nkruntime.SortOrder.DESCENDING,
    nkruntime.Operator.BEST, null,
    { gameId: 'mungtari', title: '멍타리 대전' }, true,
  )
  logger.info('PlayHub leaderboards ready: playhub-test, playhub-snake, playhub-cosmic-merge, playhub-mungtari')
}
