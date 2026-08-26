import type { Hand, Tile, WinContext } from './types'

/** An ankan is concealed; every other meld kind opens the hand. */
export function isClosed(hand: Hand): boolean {
  return hand.melds.every((meld) => meld.kind === 'ankan')
}

/** Every physical tile in the hand, including all four tiles of a kan. */
export function allTiles(hand: Hand): Tile[] {
  return [...hand.concealed, ...hand.melds.flatMap((m) => m.tiles), hand.winningTile]
}

export function isDealer(ctx: WinContext): boolean {
  return ctx.seatWind === 'E'
}
