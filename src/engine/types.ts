export type Suit = 'm' | 'p' | 's' | 'z'

export type Wind = 'E' | 'S' | 'W' | 'N'

export interface Tile {
  suit: Suit
  /** 1-9 for numbered suits; 1-4 winds (E,S,W,N), 5-7 dragons (White,Green,Red) for 'z'. */
  rank: number
  red: boolean
}
