import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GRID_DIMENSIONS } from '../constants';

export type ROTATION = 0 | 1 | 2 | 3;
export type CELL = [number, number];

const randRotation = () => Math.floor(Math.random() * 4) as ROTATION;

interface GameState {
  rotations: number[][];
  cellsToRotate: CELL[];
  rotating: boolean;
  rotationCount: number;
  highScore: number;
  islandBonus: number;
  setRotations: (rotations: number[][]) => void;
  setCellsToRotate: (neighbors: CELL[]) => void;
  setRotating: (rotating: boolean) => void;
  addToRotationCount: (count: number) => void;
  resetBoard: () => void;
  setIslandBonus: (bonus: number) => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      rotations: Array(GRID_DIMENSIONS[0])
        .fill(0)
        .map(() =>
          Array(GRID_DIMENSIONS[1])
            .fill(0)
            .map(() => randRotation()),
        ),
      cellsToRotate: [],
      rotating: false,
      rotationCount: 0,
      highScore: 0,
      islandBonus: 1,
      setRotations: (rotations) => set({ rotations }),
      setCellsToRotate: (neighbors) => set({ cellsToRotate: neighbors }),
      setRotating: (rotating) => set({ rotating }),
      addToRotationCount: (count) =>
        set((state) => {
          const score = (state.rotationCount + count) * state.islandBonus;
          return {
            rotationCount: score,
            highScore: Math.max(score, state.highScore),
          };
        }),
      resetBoard: () =>
        set((state) => {
          if (state.rotating) return state;
          return {
            rotations: Array(GRID_DIMENSIONS[0])
              .fill(0)
              .map(() =>
                Array(GRID_DIMENSIONS[1])
                  .fill(0)
                  .map(() => randRotation()),
              ),
            cellsToRotate: [],
            rotationCount: 0,
          };
        }),
      setIslandBonus: (bonus) => set({ islandBonus: bonus }),
    }),
    {
      name: 'pipe-game-storage',
      partialize: (state) => ({ highScore: state.highScore }),
    },
  ),
);
