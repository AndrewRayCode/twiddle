'use client';

/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback, useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { useSpring, animated } from '@react-spring/three';
import { CELL, ROTATION, useGameStore } from '@/store/gameStore';
import { GRID_DIMENSIONS, TILE_SPACING } from '@/constants';
import { useThree } from '@react-three/fiber';
import { PerspectiveCamera, MathUtils } from 'three';

// Relative offset position
type NEIGHBOR = [number, number];
const UP: NEIGHBOR = [0, -1];
const DOWN: NEIGHBOR = [0, 1];
const LEFT: NEIGHBOR = [-1, 0];
const RIGHT: NEIGHBOR = [1, 0];

// Matrix neighbor targeting [+-x, +-y]
const RotationNeighbors: Record<ROTATION, [NEIGHBOR, NEIGHBOR]> = {
  // ┌ right down
  [0]: [RIGHT, DOWN],
  // └ up right
  [1]: [UP, RIGHT],
  // ┘ up left
  [2]: [UP, LEFT],
  // ┐ left down
  [3]: [LEFT, DOWN],
} as const;

const PIPE_LENGTH = 2.0;
const BASE_HEIGHT = 1.0;

interface PipeProps {
  color: string | null;
  rotation: number;
  position?: [number, number, number];
  onClick?: () => void;
  row: number;
  col: number;
}

const PIPE_COLOR = '#ddccff';

function Pipe({
  rotation,
  color,
  row,
  col,
  position = [0, 0, 0],
  onClick,
}: PipeProps) {
  const { hoveredCell, setHoveredCell, rotating } = useGameStore();
  const hovered =
    !rotating &&
    hoveredCell &&
    hoveredCell[0] === row &&
    hoveredCell[1] === col;

  const { springRotation } = useSpring({
    springRotation: (rotation * Math.PI) / 2,
    config: {
      mass: 1.8,
      tension: 450,
      friction: 40,
    },
  });
  const { springPipeColor, springBaseColor } = useSpring({
    springPipeColor: color ? '#eeddff' : PIPE_COLOR,
    springBaseColor: color || (hovered ? '#8899ff' : '#666677'),
    config: {
      mass: 2,
      tension: 800,
      friction: 80,
    },
  });

  return (
    <animated.group
      position={position}
      rotation-z={springRotation}
      onPointerOver={() => setHoveredCell([row, col])}
      onPointerOut={() => setHoveredCell(null)}
    >
      {/* Vertical section */}
      <mesh position={[0, -1.0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, PIPE_LENGTH, 16]} />
        <animated.meshStandardMaterial
          color={springPipeColor}
          roughness={0.2}
          metalness={0.5}
        />
      </mesh>
      {/* Horizontal section */}
      <mesh position={[1.0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.3, 0.3, PIPE_LENGTH, 16]} />
        <animated.meshStandardMaterial
          color={springPipeColor}
          roughness={0.2}
          metalness={0.5}
        />
      </mesh>
      {/* Round base */}
      <mesh
        position={[0, 0, -BASE_HEIGHT]}
        rotation={[Math.PI / 2, 0, 0]}
        onClick={onClick}
      >
        <cylinderGeometry args={[1.95, 1.95, BASE_HEIGHT, 32]} />
        <animated.meshStandardMaterial
          color={springBaseColor}
          roughness={0.5}
          metalness={0.5}
        />
      </mesh>
      {/* <Html>
        <div
          style={{
            backgroundColor: 'white',
            whiteSpace: 'nowrap',
            color: 'black',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            pointerEvents: 'none',
          }}
        >
          {idx}
        </div>
      </Html> */}
    </animated.group>
  );
}

const islandSearch = (island: Set<CELL>, board: CELL[][], cell: CELL) => {
  if (cell === undefined || island.has(cell)) {
    return;
  }
  island.add(cell);
  for (let i = -1; i <= 1; i += 1) {
    for (let j = -1; j <= 1; j += 1) {
      islandSearch(island, board, board[cell[1] + i]?.[cell[0] + j]);
    }
  }
};

const countIslands = (cells: CELL[]) => {
  // Create the board for lookup
  const board: CELL[][] = Array(GRID_DIMENSIONS[0])
    .fill(undefined)
    .map(() => Array(GRID_DIMENSIONS[1]).fill(undefined));
  cells.forEach((cell) => {
    board[cell[1]][cell[0]] = cell;
  });

  const islands: Set<CELL>[] = [];

  cells.forEach((cell) => {
    if (cell === undefined || islands.some((i) => i.has(cell))) {
      return;
    }

    const island = new Set<CELL>();
    islandSearch(island, board, cell);
    islands.push(island);
  });
  return islands;
};

const dedupeNeighbors = (neighbors: CELL[]) => {
  return neighbors.filter(
    (neighbor, index, self) =>
      index ===
      self.findIndex((t) => t[0] === neighbor[0] && t[1] === neighbor[1]),
  );
};

const groupColors = [
  '#FFB3B3', // Light Red
  '#B3FFB3', // Light Green
  '#B3D9FF', // Light Blue
  '#FFB3FF', // Light Magenta
  '#FFFFB3', // Light Yellow
  '#B3FFFF', // Light Cyan
  '#FFD9B3', // Light Orange
  '#FFB3D9', // Light Pink
  '#D9FFB3', // Light Lime
  '#D9B3FF', // Light Purple
];

function GameContainer() {
  const {
    rotations,
    cellsToRotate,
    rotating,
    setRotations,
    setCellsToRotate,
    setRotating,
    addToRotationCount,
    setIslandBonus,
    islandBonus,
  } = useGameStore();

  // Create a single audio instance and preload it
  const rotationSound = useRef<HTMLAudioElement[] | null>(null);
  const isMobile = useRef<boolean>(false);

  const [islands, setIslands] = useState<Set<CELL>[]>([]);

  // Add new audio ref for bonus sound
  const bonusSound = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    isMobile.current = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // Initialize rotation sounds
    const audioCount = isMobile.current ? 1 : 5;
    rotationSound.current = Array(audioCount)
      .fill(null)
      .map(() => {
        const audio = new Audio('/flip/stop.mp3');
        audio.load();
        return audio;
      });

    // Initialize bonus sound
    bonusSound.current = new Audio('/flip/bonus.mp3');
    bonusSound.current.load();
    bonusSound.current.volume = 0.5;

    return () => {
      if (rotationSound.current) {
        rotationSound.current.forEach((l) => l.pause());
        rotationSound.current = null;
      }
      if (bonusSound.current) {
        bonusSound.current.pause();
        bonusSound.current = null;
      }
    };
  }, []);

  const playRotationSound = useCallback((i: number) => {
    if (rotationSound.current) {
      const audioIndex = isMobile.current ? 0 : i;
      // Reset the audio to start if it's already playing
      rotationSound.current[audioIndex].currentTime = 0;
      // Create a play promise and handle any autoplay restrictions
      const playPromise = rotationSound.current[audioIndex].play();
      if (playPromise) {
        playPromise.catch(console.error);
      }
    }
  }, []);

  const findNeighborsToRotate = (
    row: number,
    col: number,
    rotation: ROTATION,
    currentRotations: number[][],
  ) => {
    const neighborsToRotate: CELL[] = [];
    RotationNeighbors[rotation].forEach(([dx, dy]) => {
      const nx = row + dx;
      const ny = col + dy;
      const neighborUnbounded = currentRotations[ny]?.[nx];
      if (neighborUnbounded !== undefined) {
        const neighbor = (neighborUnbounded % 4) as ROTATION;
        const neighborPointsAtUsToo = RotationNeighbors[neighbor].some(
          ([ndx, ndy]) => {
            const points = nx + ndx === row && ny + ndy === col;
            return points;
          },
        );
        if (neighborPointsAtUsToo) {
          neighborsToRotate.push([nx, ny]);
        }
      }
    });
    return neighborsToRotate;
  };

  const rotateCells = (rotations: number[][], cells: CELL[]) => {
    setRotating(true);

    addToRotationCount(cells.length);

    const islands = countIslands(cells).filter((i) => i.size > 2);
    const islandBonus = Math.max(islands.length, 1);
    setIslandBonus(islandBonus);
    setIslands(islands);

    // Play bonus sound if we have an island bonus
    if (islandBonus > 1 && bonusSound.current) {
      bonusSound.current.currentTime = 0;
      bonusSound.current.play().catch(console.error);
    }

    for (
      let i = 0;
      i <
      Math.max(Math.min(rotationSound.current!.length - 1, cells.length), 1);
      i++
    ) {
      ((i: number) =>
        setTimeout(
          () => {
            playRotationSound(i);
          },
          60 * i + Math.random() * 40,
        ))(i);
    }

    let newNeighborsToRotate: CELL[] = [];

    const newRotations = [...rotations.map((row) => [...row])];

    cells.forEach(([row, col]) => {
      const newUnboundRotation = newRotations[col][row] + 1;
      const newRotation = (newUnboundRotation % 4) as ROTATION;

      newRotations[col][row] = newUnboundRotation;

      const neighbors = findNeighborsToRotate(
        row,
        col,
        newRotation,
        newRotations,
      );
      if (neighbors.length > 0) {
        newNeighborsToRotate.push(...neighbors);
        newNeighborsToRotate.push([row, col]);
      }
    });

    newNeighborsToRotate = dedupeNeighbors(newNeighborsToRotate);

    setRotations(newRotations);

    setTimeout(
      () => {
        setCellsToRotate(newNeighborsToRotate);
        if (newNeighborsToRotate.length === 0) {
          setRotating(false);
        } else {
          rotateCells(newRotations, newNeighborsToRotate);
        }
      },
      islandBonus > 1 ? 2000 : 800,
    );
  };

  const handleClick = (row: number, col: number) => {
    if (rotating) return;
    setCellsToRotate([[row, col]]);
    rotateCells(rotations, [[row, col]]);
  };

  const offset = (TILE_SPACING * (GRID_DIMENSIONS[0] - 1)) / 2;

  return (
    <>
      {rotations.map((row, colIndex) =>
        row.map((rotation, rowIndex) => {
          const cell = cellsToRotate.find(
            ([nx, ny]) => nx === rowIndex && ny === colIndex,
          );
          return (
            <Pipe
              key={`${rowIndex}-${colIndex}`}
              position={[
                rowIndex * TILE_SPACING - offset,
                -(colIndex * TILE_SPACING - offset),
                0,
              ]}
              rotation={rotation}
              row={rowIndex}
              col={colIndex}
              onClick={() => handleClick(rowIndex, colIndex)}
              color={
                cell
                  ? islandBonus > 1
                    ? groupColors[islands.findIndex((i) => i.has(cell))]
                    : 'white'
                  : null
              }
            />
          );
        }),
      )}
    </>
  );
}

const fov = 50;

function App() {
  const {
    hoveredCell,
    rotating,
    resetBoard,
    rotationCount,
    highScore,
    islandBonus,
  } = useGameStore();
  const resetSound = useRef<HTMLAudioElement | null>(null);

  const CameraController = () => {
    const { camera: tc, size } = useThree();

    useEffect(() => {
      const updateCamera = () => {
        const camera = tc as PerspectiveCamera;
        const gridAspect = GRID_DIMENSIONS[0] / GRID_DIMENSIONS[1];
        if (camera.aspect > gridAspect) {
          // window too large
          camera.fov = fov;
        } else {
          // window too narrow
          const cameraHeight = Math.tan(MathUtils.degToRad(fov / 2));
          const ratio = camera.aspect / gridAspect;
          const newCameraHeight = cameraHeight / ratio;
          camera.fov = MathUtils.radToDeg(Math.atan(newCameraHeight)) * 2;
        }
      };

      updateCamera();
      window.addEventListener('resize', updateCamera);
      return () => window.removeEventListener('resize', updateCamera);
    }, [tc, size]);

    return null;
  };

  useEffect(() => {
    resetSound.current = new Audio('/flip/reset.mp3');
    resetSound.current.load();
    resetSound.current.volume = 0.25;

    return () => {
      if (resetSound.current) {
        resetSound.current.pause();
        resetSound.current = null;
      }
    };
  }, []);

  const handleReset = () => {
    if (resetSound.current) {
      resetSound.current.currentTime = 0;
      resetSound.current.play().catch(console.error);
    }
    resetBoard();
  };

  return (
    <div
      className={`w-screen h-screen relative ${!rotating && hoveredCell ? 'cursor-pointer' : ''}`}
    >
      <div className="absolute top-4 left-4 flex flex-col gap-2 bg-blue-950/80 p-4 rounded-lg border border-blue-400/30 backdrop-blur-sm">
        <div className="text-blue-100 font-semibold flex items-center gap-2">
          <span className="text-blue-400">Rotations:</span>
          <span className="font-mono text-lg">{rotationCount}</span>
        </div>
        <div className="text-blue-100 font-semibold flex items-center gap-2">
          <span className="text-blue-400">High Score:</span>
          <span className="font-mono text-lg">{highScore}</span>
        </div>
        {islandBonus > 1 && (
          <div
            className="animate-[flash_0.5s_ease-in-out_infinite] 
            bg-gradient-to-r from-blue-500/20 to-purple-500/20 
            px-3 py-1 rounded-md border border-blue-400/30
            text-blue-100 font-semibold flex items-center gap-2"
          >
            <span className="text-blue-300">Island Bonus:</span>
            <span className="font-mono text-lg text-purple-300">
              {islandBonus}x
            </span>
          </div>
        )}
      </div>
      <button
        className="absolute top-4 right-4 px-6 py-3 rounded-lg 
          font-semibold transition-all duration-300 ease-in-out
          bg-gradient-to-b from-blue-400 to-blue-600
          text-white text-shadow-sm
          hover:from-blue-500 hover:to-blue-700 hover:scale-105
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 
          disabled:hover:from-blue-400 disabled:hover:to-blue-600"
        onClick={handleReset}
        disabled={rotating}
        style={{
          zIndex: 1000,
          textShadow: '0px 1px 1px rgba(0, 0, 0, 0.5)',
        }}
      >
        Reset Board
      </button>
      <Canvas
        style={{ width: '100%', height: '100%' }}
        camera={{
          type: 'PerspectiveCamera',
          position: [0, 0, 50],
          fov,
          near: 0.1,
          far: 1000,
        }}
      >
        <CameraController />
        <ambientLight intensity={0.9} />
        <pointLight position={[-10, -10, 20]} intensity={500} />
        <pointLight position={[10, 10, 20]} intensity={500} />
        <GameContainer />
      </Canvas>
    </div>
  );
}

export default App;
