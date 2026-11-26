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
  logger.info('PlayHub leaderboards ready: playhub-test, playhub-snake')
}
