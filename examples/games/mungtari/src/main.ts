// 화면·입력·진행. 판정은 전부 sim.ts(applyAction)에 맡기고, 여기서는 보여주기만 한다.
import {
  applyAction, createMatch, launchPoint, makeRng, other, previewPath, dogHitboxes, DOG_X, RULES, WORLD,
  type Action, type BoneResult, type ItemId, type MatchState, type Pt, type Side,
} from './sim.ts';
import { planBotShot, type Difficulty } from './bot.ts';
import { connection, embedded, reportHeight, saveScore } from './platform.ts';
import { makeCode, normalizeCode, parseMsg, CODE_LENGTH, type Msg } from './online.ts';
import type { Player, Room } from '@playhub/game-sdk';
import { img, isSoundOn, play, preloadImages, setSoundOn, startBgm } from './assets.ts';
import { INK, drawBackground, drawBone, drawBubble, drawDog, drawFence, drawItemIcon, drawPaw } from './draw.ts';

// ── 조정 포인트: 연출 ─────────────────────────────────
const CHARGE_SECONDS = 1.6; // 게이지가 0 → 끝까지 차는 시간
const FLIGHT_SPEED = 1.3; // 뼈다귀 날아가는 재생 속도 (1 = 실제 물리 시간)
const DOUBLE_DELAY = 0.28; // 더블 뼈다귀 두 번째가 출발하는 간격 (초)
const AFTER_SHOT = 1.0; // 착탄 후 다음 턴까지 쉬는 시간

const NAMES: Record<Side, string> = { left: '콩이', right: '보리' };
const ITEM_INFO: Record<ItemId, { name: string; desc: string }> = {
  double: { name: '더블', desc: '같은 궤도로 2개 연속 던지기 (두 번째는 살짝 짧게)' },
  big: { name: '왕뼈다귀', desc: '데미지 1.5배. 무거워서 바람은 덜 타지만 덜 날아가요' },
  calm: { name: '바람 멈춤', desc: '이번 턴 바람을 0으로' },
  sniff: { name: '킁킁 코', desc: '이번 턴 뼈다귀가 떨어질 곳까지 전체 궤적을 점선으로 보여 줘요' },
};
const OUTCOME_TEXT = { head: '머리 명중!', body: '명중!', graze: '스침', miss: '빗나감', fence: '울타리에 막혔다!', out: '앗, 너무 세게!' };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('game');
const ctx = canvas.getContext('2d')!;
const gaugeFill = $('gauge-fill');
const gaugeLast = $('gauge-last');
const gaugeLastLabel = $('gauge-last-label');
const itemsEl = $('items');
const hintEl = $('hint');

// remote: 친구 차례(친구 대전), wait: 내가 던진 수를 방장에게 보내고 결과를 기다리는 중(게스트)
type Phase = 'menu' | 'lobby' | 'aim' | 'charge' | 'bot' | 'remote' | 'wait' | 'fly' | 'over';

interface Flight {
  shooter: Side;
  bones: BoneResult[];
  delays: number[];
  landed: boolean[];
  elapsed: number;
  end: number;
  next: MatchState;
}
interface FloatText { x: number; y: number; text: string; color: string; life: number; big: boolean }
interface Puff { x: number; y: number; vx: number; vy: number; r: number; life: number; star: boolean }
interface BotPlan { action: Extract<Action, { kind: 'throw' }>; t: number; startAim: number }

let phase: Phase = 'menu';
let difficulty: Difficulty = 'normal';
// 봇 대전에서는 늘 콩이(left). 친구 대전에서는 방장이 콩이, 게스트가 보리.
let mode: 'bot' | 'online' = 'bot';
let me: Side = 'left';
const foe = () => other(me);
const foeTurn = () => phase === 'bot' || phase === 'remote';
let match: MatchState = createMatch(1);
let botRng = makeRng(1);
let t = 0;
let timer: number = RULES.TURN_SECONDS;
let aim: Record<Side, number> = { left: 45, right: 45 };
let power = 0;
let lastPower: Record<Side, number | null> = { left: null, right: null };
let selected: ItemId | null = null;
let flight: Flight | null = null;
let botPlan: BotPlan | null = null;
let shownHp: Record<Side, number> = { left: RULES.HP, right: RULES.HP };
let targetHp: Record<Side, number> = { left: RULES.HP, right: RULES.HP };
let lastLanding: Pt | null = null; // 내 지난번 착탄 지점 (연습용 표시)
let floats: FloatText[] = [];
let puffs: Puff[] = [];
let banner = { text: '', life: 0 };
const fx: Record<Side, { hurt: number; throwing: number; bubble: string; bubbleLife: number }> = {
  left: { hurt: 0, throwing: 0, bubble: '', bubbleLife: 0 },
  right: { hurt: 0, throwing: 0, bubble: '', bubbleLife: 0 },
};

// ── 캔버스 크기 (레티나 대응) ──────────────────────────
let scale = 1;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth || WORLD.W;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round((cssW * WORLD.H * dpr) / WORLD.W);
  scale = canvas.width / WORLD.W;
}
window.addEventListener('resize', resize);
resize();

// ── 게임 시작 / 턴 진행 ────────────────────────────────
const newSeed = () => (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;

function newGame(level: Difficulty) {
  difficulty = level;
  mode = 'bot';
  me = 'left';
  resetBoard(newSeed());
}

function resetBoard(seed: number) {
  match = createMatch(seed, 'left');
  botRng = makeRng(seed ^ 0xb0b1);
  shownHp = { left: RULES.HP, right: RULES.HP };
  targetHp = { ...shownHp };
  aim = { left: 45, right: 45 };
  lastPower = { left: null, right: null };
  lastLanding = null;
  floats = [];
  puffs = [];
  flight = null;
  $('menu').hidden = true;
  $('lobby').hidden = true;
  $('result').hidden = true;
  startBgm();
  startTurn();
}

function startTurn() {
  timer = RULES.TURN_SECONDS;
  power = 0;
  selected = null;
  const online = mode === 'online';
  banner = { text: online ? (match.current === me ? '내 차례!' : `친구(${NAMES[match.current]}) 차례`) : `${NAMES[match.current]} 차례`, life: 1.4 };
  if (match.current === me) {
    phase = 'aim';
  } else if (online) {
    phase = 'remote';
  } else {
    phase = 'bot';
    const action = planBotShot(match, difficulty, botRng) as BotPlan['action'];
    botPlan = { action, t: 0, startAim: aim.right };
  }
  renderItems();
  pump();
}

// decided: 친구 대전에서 방장이 보내 준 판정 결과. 게스트는 이 상태를 그대로 따른다.
function fire(shooter: Side, action: Action, decided?: MatchState) {
  if (mode === 'online' && !isHost() && !decided) {
    // 게스트는 판정하지 않는다. 내 수를 방장에게 보내고 결과(result)를 기다린다.
    if (action.kind === 'throw') lastPower[shooter] = Math.min(action.power, 1);
    send({ t: 'throw', turn: match.turn, action });
    phase = 'wait';
    power = 0;
    renderItems();
    pump();
    return;
  }
  const { state: computed, shot } = applyAction(match, action);
  const next = decided ?? computed;
  if (mode === 'online' && isHost()) send({ t: 'result', turn: match.turn, action, state: next });
  power = 0;
  if (!shot) {
    // 시간 초과
    say(shooter, '시간 초과!');
    flight = { shooter, bones: [], delays: [], landed: [], elapsed: 0, end: AFTER_SHOT, next };
    phase = 'fly';
    renderItems();
    return;
  }
  if (action.kind === 'throw') {
    lastPower[shooter] = Math.min(action.power, 1);
    aim[shooter] = action.angle;
    if (action.item) say(shooter, ITEM_INFO[action.item].name + '!');
  }
  fx[shooter].throwing = 1;
  play('throw');
  const delays = shot.bones.map((_, i) => i * DOUBLE_DELAY);
  const durations = shot.bones.map((b) => (b.points.length - 1) / 60 / FLIGHT_SPEED);
  const end = Math.max(...delays.map((d, i) => d + durations[i])) + AFTER_SHOT;
  flight = { shooter, bones: shot.bones, delays, landed: shot.bones.map(() => false), elapsed: 0, end, next };
  if (action.kind === 'throw' && action.item === 'calm') windShown = 0;
  phase = 'fly';
  selected = null;
  renderItems();
}

function endTurn() {
  if (!flight) return;
  match = flight.next;
  targetHp = { ...match.hp };
  flight = null;
  windShown = match.wind;
  if (match.over) {
    phase = 'over';
    play(match.winner === me ? 'win' : 'lose');
    setTimeout(showResult, 900);
    renderItems();
    return;
  }
  startTurn();
}

function showResult() {
  if (!match.over) return; // 결과를 띄우기 전에 새 판이 시작됐다
  if (mode === 'online') return showOnlineResult();
  paintResultButtons();
  const w = match.winner;
  $('result-title').textContent = w === 'left' ? '콩이 승리!' : w === 'right' ? '보리 승리…' : '무승부';
  const why = match.hp.left <= 0 || match.hp.right <= 0 ? '' : `${RULES.MAX_TURNS}턴이 끝나서 HP가 많은 쪽이 이겼어요. `;
  $('result-sub').textContent =
    w === 'left' ? `${why}보리가 꼬리를 내렸어요.` : w === 'right' ? `${why}다음엔 바람을 더 잘 읽어 봐요.` : '둘 다 지쳐서 같이 낮잠을 자요.';
  $('result-left').textContent = String(match.hp.left);
  $('result-right').textContent = String(match.hp.right);
  $('result').hidden = false;
  void saveWin();
}

// 랭킹 점수: 이겼을 때만. 남은 HP와 빨리 이긴 만큼, 난이도가 높을수록 크게.
const LEVEL_MULT: Record<Difficulty, number> = { easy: 1, normal: 2, hard: 3 };
function winScore(hpLeft: number, turnsUsed: number, level: Difficulty) {
  const fast = Math.max(0, RULES.MAX_TURNS - turnsUsed);
  return (hpLeft * 10 + fast * 20) * LEVEL_MULT[level];
}

async function saveWin() {
  const el = $('result-save');
  if (match.winner !== 'left') {
    el.textContent = embedded ? '보리를 이기면 랭킹에 점수가 올라가요' : '';
    return;
  }
  const score = winScore(match.hp.left, match.turn, difficulty);
  el.textContent = embedded ? `${score}점 등록하는 중...` : `${score}점 · 연습 모드라 서버에는 저장하지 않아요`;
  if (!embedded) return;
  const result = await saveScore(score);
  el.textContent =
    result === 'saved' ? `${score}점 랭킹에 등록했어요`
    : result === 'offline' ? 'PlayHub에 연결되지 않아 랭킹에 등록하지 못했어요'
    : '랭킹 등록에 실패했어요';
}

function say(side: Side, text: string) {
  fx[side].bubble = text;
  fx[side].bubbleLife = 1.3;
}

// ── 착탄 연출 ─────────────────────────────────────────
function onLand(bone: BoneResult, shooter: Side) {
  const p = bone.points[bone.points.length - 1];
  if (shooter === me && bone.outcome !== 'out') lastLanding = p;
  const color = bone.victim === 'left' ? '#d64b3c' : bone.victim === 'right' ? '#d64b3c' : INK;

  if (bone.outcome === 'out') {
    floats.push({ x: Math.min(Math.max(p.x, 120), WORLD.W - 120), y: 120, text: OUTCOME_TEXT.out, color: INK, life: 1.4, big: false });
    return;
  }
  for (let i = 0; i < 8; i++) {
    const a = Math.PI + (i / 7) * Math.PI;
    puffs.push({ x: p.x, y: p.y + bone.radius * 0.6, vx: Math.cos(a) * 50, vy: Math.sin(a) * 30, r: 5 + (i % 3) * 2, life: 0.6, star: false });
  }
  if (bone.outcome === 'fence') play('fence');
  if (bone.victim) {
    play('hit');
    if (bone.outcome !== 'graze') setTimeout(() => play('yelp'), 120);
    targetHp[bone.victim] = Math.max(0, targetHp[bone.victim] - bone.damage);
    fx[bone.victim].hurt = 1;
    say(bone.victim, bone.outcome === 'graze' ? '앗!' : '깨갱!');
    const head = dogHitboxes(bone.victim).head;
    floats.push({ x: head.x, y: head.y - 108, text: `${OUTCOME_TEXT[bone.outcome]} -${bone.damage}`, color, life: 1.4, big: bone.outcome === 'head' });
    if (bone.outcome === 'head') {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        puffs.push({ x: p.x, y: p.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120 - 40, r: 6, life: 0.7, star: true });
      }
    }
  } else {
    floats.push({ x: p.x, y: p.y - 40, text: OUTCOME_TEXT[bone.outcome], color, life: 1.2, big: false });
  }
}

// ── 입력 ──────────────────────────────────────────────
function toWorld(e: PointerEvent): Pt {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * WORLD.W, y: ((e.clientY - r.top) / r.height) * WORLD.H };
}
function aimAt(p: Pt) {
  const o = launchPoint(me);
  const dx = Math.max((p.x - o.x) * (me === 'left' ? 1 : -1), 0.001);
  const dy = o.y - p.y;
  aim[me] = Math.round(Math.min(90, Math.max(0, (Math.atan2(dy, dx) * 180) / Math.PI)));
}
const myTurn = () => phase === 'aim' || phase === 'charge';

canvas.addEventListener('pointerdown', (e) => {
  if (phase !== 'aim') return;
  canvas.setPointerCapture(e.pointerId);
  aimAt(toWorld(e));
  phase = 'charge';
  power = 0;
});
canvas.addEventListener('pointermove', (e) => {
  if (myTurn()) aimAt(toWorld(e));
});
const release = () => {
  if (phase === 'charge') fire(me, { kind: 'throw', angle: aim[me], power, item: selected });
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

// 키보드: ←→(또는 ↑↓)로 각도, 스페이스 꾹 눌러 던지기
window.addEventListener('keydown', (e) => {
  if (!myTurn() || e.target instanceof HTMLInputElement) return;
  // 화살표 왼쪽/오른쪽은 내 강아지가 보는 방향 기준 (보리는 거꾸로)
  const up = me === 'left' ? 'ArrowLeft' : 'ArrowRight';
  const down = me === 'left' ? 'ArrowRight' : 'ArrowLeft';
  if (e.key === 'ArrowUp' || e.key === up) aim[me] = Math.min(90, aim[me] + 1);
  else if (e.key === 'ArrowDown' || e.key === down) aim[me] = Math.max(0, aim[me] - 1);
  else if (e.code === 'Space' && phase === 'aim' && !e.repeat) {
    phase = 'charge';
    power = 0;
  } else return;
  e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') release();
});

document.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((b) =>
  b.addEventListener('click', () => newGame(b.dataset.level as Difficulty)),
);
$('again').addEventListener('click', () => {
  if (mode === 'online') hostStart();
  else newGame(difficulty);
});
$('to-menu').addEventListener('click', () => {
  if (mode === 'online') leaveOnline('');
  $('result').hidden = true;
  $('menu').hidden = false;
  phase = 'menu';
});

// ── 친구 대전 (초대코드 1:1) ──────────────────────────
// 방장이 판정한다. 게스트는 내 수(throw)를 보내고, 방장이 보낸 결과(result)대로 연출만 한다.
const REMOTE_GRACE = 5; // 친구 차례 시간이 끝나고 이만큼 더 기다린 뒤 방장이 시간 초과로 넘긴다
const AIM_INTERVAL = 0.1; // 조준 중계 간격 (초)
let room: Room | null = null;
let rival: Player | null = null;
let myId = '';
let inbox: Extract<Msg, { turn: number }>[] = [];
let aimClock = 0;
let onlineNote = ''; // 결과 화면에 덧붙일 말 (친구가 나감 등)
let busy = false;
const isHost = () => me === 'left';

function send(msg: Msg) {
  room?.send(msg).catch(() => {
    if (msg.t !== 'aim') hintEl.textContent = '친구에게 보내지 못했어요. 연결을 확인해 주세요.';
  });
}

function streamAim(dt: number) {
  aimClock += dt;
  if (aimClock < AIM_INTERVAL) return;
  aimClock = 0;
  send({ t: 'aim', angle: aim[me], power: phase === 'charge' ? Math.min(power, 1) : 0, item: selected });
}

// 받은 수·결과를 지금 턴에 맞을 때 처리한다. 연출 중이면 끝날 때까지 쌓아 둔다.
function pump() {
  while (mode === 'online' && inbox.length) {
    const msg = inbox[0];
    if (msg.turn < match.turn || match.over) { inbox.shift(); continue; }
    if (msg.turn > match.turn) return;
    if (msg.t === 'result' && !isHost()) {
      if (phase === 'fly' || phase === 'over') return;
      inbox.shift();
      selectedBot = null;
      fire(match.current, msg.action, msg.state);
      return;
    }
    if (msg.t === 'throw' && isHost()) {
      if (phase !== 'remote') return;
      inbox.shift();
      selectedBot = null;
      fire(foe(), msg.action);
      return;
    }
    inbox.shift(); // 내가 받을 수 없는 종류 (방장에게 온 result 등)
  }
}

function onRoomMessage(data: unknown, from: Player) {
  const msg = parseMsg(data);
  if (!msg || !rival || from.userId !== rival.userId) return;
  if (msg.t === 'start') {
    if (isHost()) return;
    if (msg.guest !== myId) return leaveOnline('방이 꽉 찼어요. 다른 코드로 들어가 주세요.');
    if (phase === 'lobby' || phase === 'over') beginOnline(msg.seed);
    return;
  }
  if (msg.t === 'aim') {
    if (phase !== 'remote') return;
    aim[foe()] = msg.angle;
    power = msg.power;
    selectedBot = msg.item;
    return;
  }
  inbox.push(msg);
  pump();
}

function onRoomPlayers({ joined, left }: { joined: Player[]; left: Player[] }) {
  if (rival && left.some((p) => p.userId === rival!.userId)) {
    if (phase === 'lobby' && isHost()) {
      rival = null;
      $('lobby-note').textContent = '친구가 나갔어요. 코드를 다시 보내 주세요.';
      return;
    }
    endOnline(phase === 'lobby' ? '방장이 방을 나갔어요.' : '친구가 방을 나갔어요.', true);
    return;
  }
  // 방장: 처음 들어온 한 명과 바로 시작. 그 뒤에 온 사람은 start의 guest가 자기가 아니라서 스스로 나간다.
  if (isHost() && !rival && phase === 'lobby' && joined.length) {
    rival = joined[0];
    hostStart();
  }
}

function hostStart() {
  if (!isHost() || !rival || !room) return;
  const seed = newSeed();
  send({ t: 'start', seed, guest: rival.userId });
  beginOnline(seed);
}

function beginOnline(seed: number) {
  mode = 'online';
  inbox = [];
  aimClock = 0;
  onlineNote = '';
  selectedBot = null;
  resetBoard(seed);
}

function enterRoom(r: Room, side: Side, host: Player | null) {
  room = r;
  me = side;
  rival = host;
  mode = 'online';
  inbox = [];
  onlineNote = '';
  r.onMessage(onRoomMessage);
  r.onPlayers(onRoomPlayers);
  r.onClose(() => {
    if (room === r) endOnline('연결이 끊겼어요.', false);
  });
}

// 대전 도중 방이 끝남 (친구가 나감·연결 끊김). 남은 사람이 이긴 걸로 한다.
function endOnline(reason: string, iWin: boolean) {
  const r = room;
  room = null;
  rival = null;
  inbox = [];
  void r?.leave();
  if (phase === 'lobby' || phase === 'menu') return showMenu(reason);
  onlineNote = reason;
  if (phase !== 'over') {
    if (flight) match = flight.next; // 날아가던 수의 결과까지는 반영한다
    targetHp = { ...match.hp };
    flight = null;
    power = 0;
    match = { ...match, over: true, winner: iWin ? me : null };
    phase = 'over';
    renderItems();
    showOnlineResult();
  } else if (!$('result').hidden) showOnlineResult();
}

// 내가 나감
function leaveOnline(note: string) {
  const r = room;
  room = null;
  rival = null;
  inbox = [];
  void r?.leave();
  showMenu(note);
}

function showMenu(note: string) {
  mode = 'bot';
  me = 'left';
  phase = 'menu';
  $('lobby').hidden = true;
  $('result').hidden = true;
  $('menu').hidden = false;
  $('online-note').textContent = note;
  renderItems();
}

function showLobby(code: string) {
  phase = 'lobby';
  $('menu').hidden = true;
  $('result').hidden = true;
  $('lobby').hidden = false;
  $('lobby-code').textContent = code;
  $('lobby-title').textContent = isHost() ? '친구를 기다리는 중…' : '방장이 시작하기를 기다리는 중…';
  $('lobby-note').textContent = isHost() ? '이 코드를 친구에게 보내 주세요. 친구가 들어오면 바로 시작해요.' : '곧 시작해요!';
  $('lobby-copy').hidden = !isHost();
}

function showOnlineResult() {
  const w = match.winner;
  $('result-title').textContent = w === me ? '내가 이겼다!' : w === 'draw' ? '무승부' : w ? '친구가 이겼어요' : '대전 종료';
  const why = match.hp.left <= 0 || match.hp.right <= 0 ? '' : `${RULES.MAX_TURNS}턴이 끝나서 HP가 많은 쪽이 이겼어요. `;
  $('result-sub').textContent =
    onlineNote || (w === me ? `${why}친구를 이겼어요!` : w === 'draw' ? '둘 다 지쳐서 같이 낮잠을 자요.' : `${why}다음엔 바람을 더 잘 읽어 봐요.`);
  $('result-left').textContent = String(match.hp.left);
  $('result-right').textContent = String(match.hp.right);
  $('result-save').textContent = '친구 대전은 랭킹에 저장하지 않아요';
  paintResultButtons();
  $('result').hidden = false;
}

function paintResultButtons() {
  const again = $<HTMLButtonElement>('again');
  const toMenu = $('to-menu');
  if (mode !== 'online') {
    again.hidden = false;
    again.disabled = false;
    again.textContent = '다시 하기';
    toMenu.textContent = '난이도 바꾸기';
    return;
  }
  toMenu.textContent = room ? '방 나가기' : '처음으로';
  again.hidden = !room || !rival;
  again.disabled = !isHost();
  again.textContent = isHost() ? '한 판 더' : '방장이 다시 시작하면 시작돼요';
}

async function readySdk() {
  const sdk = await connection;
  if (!sdk) {
    $('online-note').textContent = embedded ? 'PlayHub에 연결되지 않아 친구 대전을 할 수 없어요' : 'PlayHub 포털에서 열면 친구와 대전할 수 있어요';
    return null;
  }
  myId = sdk.user.userId;
  return sdk;
}

async function createRoom() {
  if (busy) return;
  busy = true;
  $('online-note').textContent = '방을 만드는 중…';
  try {
    const sdk = await readySdk();
    if (!sdk) return;
    // 아주 드물게 이미 누가 쓰는 코드면 다른 코드로 다시 만든다
    for (let i = 0; i < 3; i++) {
      const code = makeCode();
      const r = await sdk.joinRoom(code);
      if (r.others.length === 0) {
        $('online-note').textContent = '';
        enterRoom(r, 'left', null);
        showLobby(code);
        return;
      }
      await r.leave();
    }
    $('online-note').textContent = '방을 만들지 못했어요. 다시 눌러 주세요.';
  } catch {
    $('online-note').textContent = '방을 만들지 못했어요. 연결을 확인해 주세요.';
  } finally {
    busy = false;
  }
}

async function joinByCode(raw: string) {
  if (busy) return;
  const code = normalizeCode(raw);
  if (code.length !== CODE_LENGTH) {
    $('online-note').textContent = `초대코드 ${CODE_LENGTH}자리를 입력해 주세요`;
    return;
  }
  busy = true;
  $('online-note').textContent = '방에 들어가는 중…';
  try {
    const sdk = await readySdk();
    if (!sdk) return;
    const r = await sdk.joinRoom(code);
    if (r.others.length !== 1) {
      await r.leave();
      $('online-note').textContent = r.others.length ? '방이 꽉 찼어요' : '그 코드의 방을 찾지 못했어요';
      return;
    }
    $('online-note').textContent = '';
    enterRoom(r, 'right', r.others[0]);
    showLobby(code);
  } catch {
    $('online-note').textContent = '방에 들어가지 못했어요. 연결을 확인해 주세요.';
  } finally {
    busy = false;
  }
}

$('room-create').addEventListener('click', () => void createRoom());
const codeInput = $<HTMLInputElement>('room-code');
codeInput.addEventListener('input', () => {
  codeInput.value = normalizeCode(codeInput.value);
});
$('room-join').addEventListener('click', () => void joinByCode(codeInput.value));
codeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') void joinByCode(codeInput.value);
});
$('lobby-leave').addEventListener('click', () => leaveOnline(''));
$('lobby-copy').addEventListener('click', async () => {
  const el = $('lobby-code');
  const code = el.textContent ?? '';
  let ok = false;
  try {
    await navigator.clipboard.writeText(code);
    ok = true;
  } catch {
    // iframe에서 클립보드 권한이 없으면 글자를 선택해서 복사한다
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    try { ok = document.execCommand('copy'); } catch { ok = false; }
  }
  $('lobby-note').textContent = ok ? '복사했어요! 친구에게 보내 주세요.' : '코드를 선택해 두었어요. 복사해서 친구에게 보내 주세요.';
});
if (!embedded) {
  $<HTMLButtonElement>('room-create').disabled = true;
  $<HTMLButtonElement>('room-join').disabled = true;
  codeInput.disabled = true;
  $('online-note').textContent = 'PlayHub 포털에서 열면 친구와 대전할 수 있어요';
}

// ── 아이템 칸 ─────────────────────────────────────────
function renderItems() {
  itemsEl.innerHTML = '';
  for (let i = 0; i < RULES.START_ITEMS; i++) {
    const id = match.items[me][i];
    const btn = document.createElement('button');
    btn.className = 'item';
    if (!id) {
      btn.classList.add('used');
      itemsEl.appendChild(btn);
      continue;
    }
    btn.title = `${ITEM_INFO[id].name}: ${ITEM_INFO[id].desc}`;
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    drawItemIcon(c.getContext('2d')!, id, 96);
    const label = document.createElement('span');
    label.textContent = ITEM_INFO[id].name;
    btn.append(c, label);
    btn.disabled = phase !== 'aim';
    if (selected === id) btn.classList.add('on');
    btn.addEventListener('click', () => {
      if (phase !== 'aim') return;
      selected = selected === id ? null : id;
      windShown = selected === 'calm' ? 0 : match.wind;
      renderItems();
    });
    itemsEl.appendChild(btn);
  }
  updateHint();
}

function updateHint() {
  if (phase === 'aim' || phase === 'charge') {
    hintEl.textContent = selected ? `${ITEM_INFO[selected].name} 장착! ${ITEM_INFO[selected].desc}` : '꾸욱 눌러서 힘을 모으고, 떼면 던져요. 게이지 끝까지 가면 맵 밖으로!';
  } else if (phase === 'bot') hintEl.textContent = '보리가 바람을 재는 중…';
  else if (phase === 'remote') hintEl.textContent = `친구(${NAMES[foe()]})가 조준하는 중…`;
  else if (phase === 'wait') hintEl.textContent = '던지는 중…';
  else if (phase === 'fly') hintEl.textContent = '';
  else hintEl.textContent = '';
}

// ── 매 프레임 갱신 ────────────────────────────────────
let windShown = 0;

function update(dt: number) {
  t += dt;
  for (const s of ['left', 'right'] as Side[]) {
    fx[s].hurt = Math.max(0, fx[s].hurt - dt * 1.4);
    fx[s].throwing = Math.max(0, fx[s].throwing - dt * 3);
    fx[s].bubbleLife = Math.max(0, fx[s].bubbleLife - dt);
    // HP 바는 부드럽게 줄어든다
    shownHp[s] += (targetHp[s] - shownHp[s]) * Math.min(1, dt * 6);
  }
  banner.life = Math.max(0, banner.life - dt);
  floats = floats.filter((f) => (f.life -= dt) > 0);
  for (const f of floats) f.y -= dt * 30;
  puffs = puffs.filter((p) => (p.life -= dt) > 0);
  for (const p of puffs) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.star ? 300 : -20) * dt;
  }

  if (phase === 'aim' || phase === 'charge') {
    timer -= dt;
    if (phase === 'charge') {
      power += dt / CHARGE_SECONDS;
      if (power >= 1) {
        power = 1;
        fire(me, { kind: 'throw', angle: aim[me], power: 1, item: selected });
        return;
      }
    }
    if (timer <= 0) {
      fire(me, { kind: 'skip' });
      return;
    }
    if (mode === 'online') streamAim(dt);
  } else if (phase === 'remote') {
    timer -= dt;
    // 게스트의 수가 끝내 안 오면 방장이 시간 초과로 넘긴다
    if (isHost() && timer <= -REMOTE_GRACE) fire(foe(), { kind: 'skip' });
  } else if (phase === 'bot' && botPlan) {
    // 보리: 1초 동안 각도를 맞추고, 그다음 힘을 모아서 던진다
    timer -= dt;
    botPlan.t += dt;
    const { action } = botPlan;
    const think = 1.0;
    const k = Math.min(1, botPlan.t / think);
    const ease = k * k * (3 - 2 * k);
    aim.right = botPlan.startAim + (action.angle - botPlan.startAim) * ease + (k < 1 ? Math.sin(t * 9) * 3 * (1 - k) : 0);
    if (k === 1 && botPlan.t < think + 0.05 && action.item) selectedBot = action.item;
    if (botPlan.t > think + 0.25) {
      power = Math.min(action.power, ((botPlan.t - think - 0.25) / CHARGE_SECONDS));
      if (power >= action.power) {
        aim.right = action.angle;
        botPlan = null;
        selectedBot = null;
        fire('right', action);
      }
    }
  } else if (phase === 'fly' && flight) {
    flight.elapsed += dt;
    flight.bones.forEach((b, i) => {
      if (flight!.landed[i]) return;
      const idx = (flight!.elapsed - flight!.delays[i]) * 60 * FLIGHT_SPEED;
      if (idx >= b.points.length - 1) {
        flight!.landed[i] = true;
        onLand(b, flight!.shooter);
      }
    });
    if (flight.elapsed >= flight.end) endTurn();
  }
}
let selectedBot: ItemId | null = null;

// ── 그리기 ────────────────────────────────────────────
function render() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawBackground(ctx, t, windShown);

  // 지난번 내 착탄 지점
  if (lastLanding && myTurn()) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    drawPaw(ctx, lastLanding.x, WORLD.GROUND + 14, 0.9, INK);
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.fillText('지난번', lastLanding.x, WORLD.GROUND + 36);
    ctx.restore();
  }

  drawFence(ctx, t, windShown);

  const winner = match.over && phase === 'over' ? match.winner : null;
  for (const s of ['left', 'right'] as Side[]) {
    drawDog(ctx, s, DOG_X[s], {
      t,
      aim: aim[s],
      hurt: fx[s].hurt,
      throwing: fx[s].throwing,
      charging: (phase === 'charge' && s === me) || (foeTurn() && s === foe() && power > 0),
      mood: winner === s ? 'happy' : winner && winner !== 'draw' ? 'sad' : 'idle',
    });
  }

  // 조준선
  const shooter: Side | null = myTurn() ? me : foeTurn() ? foe() : null;
  if (shooter) drawAim(shooter);

  // 킁킁 코 미리보기
  if (myTurn() && selected === 'sniff') {
    const p = phase === 'charge' ? Math.min(power, 0.99) : lastPower[me] ?? 0.65;
    const pts = previewPath({ side: me, angle: aim[me], power: p, wind: match.wind });
    ctx.fillStyle = 'rgba(74,52,40,0.7)';
    pts.forEach((pt, i) => {
      if (i % 4 !== 0 || pt.y < 0) return;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    // 떨어질 곳 표시 (X)
    const end = pts[pts.length - 1];
    if (end.x > 0 && end.x < WORLD.W) {
      ctx.save();
      ctx.strokeStyle = '#e4574a';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(end.x - 7, end.y - 7);
      ctx.lineTo(end.x + 7, end.y + 7);
      ctx.moveTo(end.x + 7, end.y - 7);
      ctx.lineTo(end.x - 7, end.y + 7);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 날아가는 뼈다귀
  if (flight) {
    flight.bones.forEach((b, i) => {
      if (flight!.landed[i] && b.outcome === 'out') return;
      const raw = (flight!.elapsed - flight!.delays[i]) * 60 * FLIGHT_SPEED;
      if (raw < 0) return;
      const idx = Math.min(b.points.length - 1, raw);
      const i0 = Math.floor(idx);
      const i1 = Math.min(b.points.length - 1, i0 + 1);
      const f = idx - i0;
      const x = b.points[i0].x + (b.points[i1].x - b.points[i0].x) * f;
      const y = b.points[i0].y + (b.points[i1].y - b.points[i0].y) * f;
      const landedNow = flight!.landed[i];
      if (landedNow && b.victim) return; // 맞으면 사라진다
      const rot = landedNow ? 0.15 : (flight!.shooter === 'left' ? 1 : -1) * raw * 0.22;
      if (y < -10) drawOffscreen(x, y);
      else drawBone(ctx, x, y, rot, b.radius);
    });
  }

  for (const p of puffs) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    const sprite = img(p.star ? 'fx-star' : 'fx-dust');
    if (sprite) {
      const size = p.star ? p.r * 3 : p.r * 2.4 * (1.6 - p.life);
      ctx.drawImage(sprite, p.x - size / 2, p.y - size / 2, size, size);
    } else if (p.star) {
      ctx.fillStyle = '#ffd34d';
      drawStar(p.x, p.y, p.r);
    } else {
      ctx.fillStyle = '#e8d9bd';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1.6 - p.life), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  for (const s of ['left', 'right'] as Side[]) {
    if (fx[s].bubbleLife > 0) {
      drawBubble(ctx, DOG_X[s] + (s === 'left' ? 10 : -10), WORLD.GROUND - 126, fx[s].bubble, Math.min(1, fx[s].bubbleLife * 3));
    }
  }
  for (const f of floats) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.life * 2);
    ctx.font = `900 ${f.big ? 26 : 20}px "Apple SD Gothic Neo", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#fffaf1';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }

  drawHud();

  // 게이지 (HTML)
  const shownPower = phase === 'charge' || (foeTurn() && power > 0) ? power : 0;
  gaugeFill.style.width = `${shownPower * 100}%`;
  gaugeFill.classList.toggle('hot', shownPower > 0.9);
  const lp = lastPower[me];
  // 지난번에 던진 힘 눈금 (다음 턴에 힘 조절할 때 기준으로 쓰라고)
  const showLast = lp != null && !foeTurn();
  gaugeLast.style.display = gaugeLastLabel.style.display = showLast ? 'block' : 'none';
  if (lp != null) gaugeLast.style.left = gaugeLastLabel.style.left = `${lp * 100}%`;
}

function drawAim(side: Side) {
  const o = launchPoint(side);
  const f = side === 'left' ? 1 : -1;
  const a = (aim[side] * Math.PI) / 180;
  const charging = side === me ? phase === 'charge' : power > 0;
  const len = 46 + (charging ? power : 0) * 70;
  ctx.save();
  ctx.strokeStyle = 'rgba(74,52,40,0.7)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.setLineDash([2, 8]);
  ctx.beginPath();
  ctx.moveTo(o.x + Math.cos(a) * 14 * f, o.y - Math.sin(a) * 14);
  ctx.lineTo(o.x + Math.cos(a) * len * f, o.y - Math.sin(a) * len);
  ctx.stroke();
  ctx.setLineDash([]);
  // 화살촉
  const hx = o.x + Math.cos(a) * (len + 6) * f;
  const hy = o.y - Math.sin(a) * (len + 6);
  ctx.translate(hx, hy);
  ctx.rotate(f > 0 ? -a : Math.PI + a);
  ctx.fillStyle = side === 'left' ? '#e4574a' : '#4f8fbf';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-5, -6);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // 각도 숫자
  ctx.save();
  ctx.font = '800 14px system-ui, sans-serif';
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(aim[side])}°`, o.x - 46 * f, o.y - 50);
  ctx.restore();
}

function drawOffscreen(x: number, y: number) {
  const cx = Math.min(WORLD.W - 20, Math.max(20, x));
  ctx.save();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(cx, 6);
  ctx.lineTo(cx - 8, 20);
  ctx.lineTo(cx + 8, 20);
  ctx.closePath();
  ctx.fill();
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(-y / 10)}m`, cx, 34);
  ctx.restore();
}

function drawStar(x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function drawHud() {
  ctx.save();
  // HP 바
  for (const s of ['left', 'right'] as Side[]) {
    const w = 250;
    const x = s === 'left' ? 20 : WORLD.W - 20 - w;
    const y = 18;
    const ratio = Math.max(0, shownHp[s]) / RULES.HP;
    ctx.fillStyle = 'rgba(255,250,241,0.92)';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 44, 12);
    ctx.fill();
    ctx.stroke();
    ctx.font = '800 15px "Apple SD Gothic Neo", system-ui, sans-serif';
    ctx.fillStyle = INK;
    ctx.textBaseline = 'middle';
    ctx.textAlign = s === 'left' ? 'left' : 'right';
    ctx.fillText(NAMES[s], s === 'left' ? x + 12 : x + w - 12, y + 22);
    const bx = s === 'left' ? x + 58 : x + 12;
    const bw = w - 70;
    ctx.fillStyle = '#eadfcc';
    ctx.beginPath();
    ctx.roundRect(bx, y + 14, bw, 16, 8);
    ctx.fill();
    ctx.fillStyle = ratio > 0.5 ? '#7cc06b' : ratio > 0.25 ? '#f2b84b' : '#e4574a';
    const fw = bw * ratio;
    if (fw > 0) {
      ctx.beginPath();
      ctx.roundRect(s === 'left' ? bx : bx + bw - fw, y + 14, fw, 16, 8);
      ctx.fill();
    }
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(targetHp[s])), bx + bw / 2, y + 23);
    // 상대(봇·친구)가 장착한 아이템 표시
    if (s === foe() && selectedBot && foeTurn()) {
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = s === 'left' ? 'left' : 'right';
      ctx.fillText(`${NAMES[s]}: ${ITEM_INFO[selectedBot].name} 장착`, s === 'left' ? x : x + w, y + 60);
    }
    // 친구 대전: 내 강아지 표시
    if (mode === 'online' && s === me) {
      ctx.font = '800 12px system-ui, sans-serif';
      ctx.fillStyle = '#d64b3c';
      ctx.textAlign = s === 'left' ? 'left' : 'right';
      ctx.fillText('▲ 나', s === 'left' ? x + 12 : x + w - 12, y + 60);
    }
  }

  // 바람 상자
  const cx = WORLD.W / 2;
  ctx.fillStyle = 'rgba(255,250,241,0.92)';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(cx - 92, 14, 184, 36, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = '800 14px "Apple SD Gothic Neo", system-ui, sans-serif';
  ctx.fillText('바람', cx - 80, 32);
  const n = Math.abs(windShown);
  if (n === 0) {
    ctx.textAlign = 'center';
    ctx.fillText('잠잠', cx + 18, 32);
  } else {
    const dir = Math.sign(windShown);
    ctx.fillStyle = '#5f87ad';
    for (let i = 0; i < n; i++) {
      const ax = cx - 26 + i * 15;
      ctx.beginPath();
      ctx.moveTo(ax + 6 * dir, 32);
      ctx.lineTo(ax - 4 * dir, 25);
      ctx.lineTo(ax - 4 * dir, 39);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.font = '900 17px system-ui, sans-serif';
    ctx.fillText(String(n), cx + 70, 32);
  }

  // 타이머 + 턴
  const tx = cx;
  const ty = 82;
  const live = phase === 'aim' || phase === 'charge' || foeTurn();
  const sec = Math.max(0, Math.ceil(timer));
  ctx.fillStyle = 'rgba(255,250,241,0.92)';
  ctx.beginPath();
  ctx.arc(tx, ty, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (live) {
    ctx.strokeStyle = sec <= 5 ? '#e4574a' : '#7cc06b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(tx, ty, 14, -Math.PI / 2, -Math.PI / 2 + (Math.max(0, timer) / RULES.TURN_SECONDS) * Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = sec <= 5 && live ? '#d64b3c' : INK;
  ctx.textAlign = 'center';
  ctx.font = '900 14px system-ui, sans-serif';
  ctx.fillText(live ? String(sec) : '·', tx, ty + 1);
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.fillStyle = INK;
  ctx.fillText(`${Math.min(match.over ? match.turn : match.turn + 1, RULES.MAX_TURNS)} / ${RULES.MAX_TURNS}턴`, tx, ty + 34);

  // 차례 알림
  if (banner.life > 0) {
    drawBubble(ctx, cx, 160, banner.text, Math.min(1, banner.life * 2.5));
  }
  ctx.restore();
}

// ── 루프 ──────────────────────────────────────────────
let prev = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;
  if (canvas.width !== Math.round(canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2))) resize();
  update(dt);
  if (phase !== 'fly' && phase !== 'over') windShown = selected === 'calm' && myTurn() ? 0 : match.wind;
  render();
  updateHint();
  requestAnimationFrame(frame);
}
// 소리 켜기/끄기
const soundBtn = $<HTMLButtonElement>('sound');
const paintSound = () => {
  soundBtn.textContent = isSoundOn() ? '소리 켜짐' : '소리 꺼짐';
  soundBtn.setAttribute('aria-pressed', String(isSoundOn()));
};
soundBtn.addEventListener('click', () => {
  setSoundOn(!isSoundOn());
  paintSound();
});
paintSound();

// 포털(iframe) 안에서 돌 때: 내 화면 높이를 포털에 알려서 iframe 높이를 딱 맞게 한다
reportHeight(document.querySelector<HTMLElement>('.app')!);

preloadImages(() => renderItems()); // 아이템 아이콘은 그림이 다 오면 다시 그린다
renderItems();
requestAnimationFrame(frame);

// 개발 서버에서만: 콘솔에서 상태를 들여다보는 창구 (빌드 결과물에는 빠진다)
if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
  (window as unknown as Record<string, unknown>).__mungtari = {
    get match() { return match; },
    get phase() { return phase; },
    get mode() { return mode; },
    get me() { return me; },
  };
}
