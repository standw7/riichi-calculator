export type Suit = 'm' | 'p' | 's' | 'z'

export type Wind = 'E' | 'S' | 'W' | 'N'

export interface Tile {
  suit: Suit
  /** 1-9 for numbered suits; 1-4 winds (E,S,W,N), 5-7 dragons (White,Green,Red) for 'z'. */
  rank: number
  red: boolean
}

export type MeldKind = 'chi' | 'pon' | 'minkan' | 'ankan' | 'shouminkan'

export interface Meld {
  kind: MeldKind
  tiles: Tile[]
  /** Which tile was claimed from another player. Absent for an ankan. */
  calledTile?: Tile
}

export type WinSource = 'ron' | 'tsumo'

export interface Hand {
  concealed: Tile[]
  melds: Meld[]
  winningTile: Tile
  winSource: WinSource
}

export type RiichiState = 'none' | 'riichi' | 'double'

export interface WinContext {
  seatWind: Wind
  roundWind: Wind
  riichi: RiichiState
  ippatsu: boolean
  haitei: boolean
  houtei: boolean
  rinshan: boolean
  chankan: boolean
  tenhou: boolean
  chiihou: boolean
  doraIndicators: Tile[]
  uraIndicators: Tile[]
  honba: number
  riichiSticks: number
}
