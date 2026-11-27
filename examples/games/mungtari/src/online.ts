// 친구 대전(초대코드 1:1)에서 주고받는 메시지. 화면 코드 없이 규칙만 둔다.
// 방장(방을 만든 쪽)이 콩이(left), 참여한 쪽이 보리(right)다.
// 판정은 방장만 한다: 방장이 applyAction으로 계산한 결과(result)를 보내면 게스트는 그대로 따른다.
import { ITEM_IDS, RULES, type Action, type ItemId, type MatchState, type Side } from './sim.ts';

export type Msg =
  | { t: 'start'; seed: number; guest: string } // 방장 → 게스트: 새 판 시작. guest는 함께할 사람의 userId
  | { t: 'aim'; angle: number; power: number; item: ItemId | null } // 조준 중계 (보여주기용)
  | { t: 'throw'; turn: number; action: Action } // 게스트 → 방장: 내 수
  | { t: 'result'; turn: number; action: Action; state: MatchState }; // 방장 → 게스트: 판정 결과

// 헷갈리는 글자(0·O, 1·I·L)는 뺀다.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

export function makeCode(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(CODE_LENGTH));
  return Array.from(bytes, (n) => ALPHABET[n % ALPHABET.length]).join('');
}

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
}

// ── 받은 메시지 검사. 상대 게임이 보낸 값이라 모양을 확인하고 쓴다 ──
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const isInt = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && isNum(v, lo, hi);
const isSide = (v: unknown): v is Side => v === 'left' || v === 'right';
const isItem = (v: unknown): v is ItemId => ITEM_IDS.includes(v as ItemId);
const isItemOrNull = (v: unknown): v is ItemId | null => v === null || isItem(v);

function isAction(v: unknown): v is Action {
  if (!isObj(v)) return false;
  if (v.kind === 'skip') return true;
  return v.kind === 'throw' && isNum(v.angle, 0, 90) && isNum(v.power, 0, 1) && isItemOrNull(v.item);
}

function isState(v: unknown): v is MatchState {
  if (!isObj(v) || !isObj(v.hp) || !isObj(v.items)) return false;
  const items = v.items;
  return (
    isInt(v.seed, 0, 0xffffffff) &&
    isInt(v.turn, 0, RULES.MAX_TURNS) &&
    isSide(v.current) &&
    isNum(v.hp.left, 0, RULES.HP) &&
    isNum(v.hp.right, 0, RULES.HP) &&
    (['left', 'right'] as const).every((s) => Array.isArray(items[s]) && (items[s] as unknown[]).length <= RULES.START_ITEMS && (items[s] as unknown[]).every(isItem)) &&
    isInt(v.wind, -RULES.WIND_MAX, RULES.WIND_MAX) &&
    typeof v.over === 'boolean' &&
    (v.winner === null || v.winner === 'draw' || isSide(v.winner))
  );
}

export function parseMsg(data: unknown): Msg | null {
  if (!isObj(data)) return null;
  switch (data.t) {
    case 'start':
      return isInt(data.seed, 0, 0xffffffff) && typeof data.guest === 'string' ? (data as Msg) : null;
    case 'aim':
      return isNum(data.angle, 0, 90) && isNum(data.power, 0, 1) && isItemOrNull(data.item) ? (data as Msg) : null;
    case 'throw':
      return isInt(data.turn, 0, RULES.MAX_TURNS) && isAction(data.action) ? (data as Msg) : null;
    case 'result':
      return isInt(data.turn, 0, RULES.MAX_TURNS) && isAction(data.action) && isState(data.state) ? (data as Msg) : null;
    default:
      return null;
  }
}
