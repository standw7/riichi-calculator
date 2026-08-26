import type { Suit, Tile, Wind } from './types'

const SUIT_ORDER: readonly Suit[] = ['m', 'p', 's', 'z']
const SUIT_BASE: Record<Suit, number> = { m: 0, p: 9, s: 18, z: 27 }

export const WIND_ORDER: readonly Wind[] = ['E', 'S', 'W', 'N']

export function tileId(tile: Tile): number {
  return SUIT_BASE[tile.suit] + tile.rank - 1
}

export function tileFromId(id: number): Tile {
  if (id < 0 || id > 33) throw new Error(`Tile id out of range: ${id}`)
  if (id >= 27) return { suit: 'z', rank: id - 26, red: false }
  if (id >= 18) return { suit: 's', rank: id - 17, red: false }
  if (id >= 9) return { suit: 'p', rank: id - 8, red: false }
  return { suit: 'm', rank: id + 1, red: false }
}

export function toCounts(tiles: Tile[]): number[] {
  const counts = new Array<number>(34).fill(0)
  for (const tile of tiles) counts[tileId(tile)] += 1
  return counts
}

export function isHonor(tile: Tile): boolean {
  return tile.suit === 'z'
}

export function isTerminal(tile: Tile): boolean {
  return tile.suit !== 'z' && (tile.rank === 1 || tile.rank === 9)
}

export function isTerminalOrHonor(tile: Tile): boolean {
  return isHonor(tile) || isTerminal(tile)
}

export function parseTiles(notation: string): Tile[] {
  const tiles: Tile[] = []
  let pending: number[] = []

  for (const char of notation) {
    if (char >= '0' && char <= '9') {
      pending.push(Number(char))
      continue
    }
    if (!SUIT_ORDER.includes(char as Suit)) {
      throw new Error(`Unknown suit: ${char}`)
    }
    const suit = char as Suit
    for (const digit of pending) {
      if (digit === 0) {
        if (suit === 'z') throw new Error('Honors have no red five')
        tiles.push({ suit, rank: 5, red: true })
      } else if (suit === 'z' && digit > 7) {
        throw new Error(`Invalid honor rank: ${digit}`)
      } else {
        tiles.push({ suit, rank: digit, red: false })
      }
    }
    pending = []
  }

  if (pending.length > 0) throw new Error('Trailing digits without a suit')
  return tiles
}

export function tilesToNotation(tiles: Tile[]): string {
  let out = ''
  for (const suit of SUIT_ORDER) {
    const inSuit = tiles.filter((t) => t.suit === suit)
    if (inSuit.length === 0) continue
    out += inSuit.map((t) => (t.red ? '0' : String(t.rank))).join('') + suit
  }
  return out
}

export function sortTiles(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => {
    const byId = tileId(a) - tileId(b)
    if (byId !== 0) return byId
    // Red fives sort before ordinary fives at the same tileId, so notation order is deterministic.
    return Number(b.red) - Number(a.red)
  })
}
