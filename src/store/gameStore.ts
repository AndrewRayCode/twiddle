import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GRID_DIMENSIONS } from '../constants';

type ROTATION = 0 | 1 | 2 | 3;
type NEIGHBOR = [number, number];

const randRotation = () => Math.floor(Math.random() * 4) as ROTATION;

interface GameState {
  rotations: number[][];
  neighborsToRotate: [number, number][];
  rotating: boolean;
  rotationCount: number;
  highScore: number;
  setRotations: (rotations: number[][]) => void;
  setNeighborsToRotate: (neighbors: [number, number][]) => void;
  setRotating: (rotating: boolean) => void;
  incrementRotationCount: () => void;
  resetBoard: () => void;
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
      neighborsToRotate: [],
      rotating: false,
      rotationCount: 0,
      highScore: 0,
      setRotations: (rotations) => set({ rotations }),
      setNeighborsToRotate: (neighbors) =>
        set({ neighborsToRotate: neighbors }),
      setRotating: (rotating) => set({ rotating }),
      incrementRotationCount: () =>
        set((state) => ({
          rotationCount: state.rotationCount + 1,
          highScore: Math.max(state.rotationCount + 1, state.highScore),
        })),
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
            neighborsToRotate: [],
            rotationCount: 0,
          };
        }),
    }),
    {
      name: 'pipe-game-storage',
      partialize: (state) => ({ highScore: state.highScore }),
    },
  ),
);
