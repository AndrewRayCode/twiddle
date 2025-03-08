'use client';

/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback, useState, useRef, useEffect, RefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { useSpring, animated } from '@react-spring/three';
import { CELL, ROTATION, useGameStore } from '@/store/gameStore';
import { GRID_DIMENSIONS, TILE_SPACING } from '@/constants';
import { useThree } from '@react-three/fiber';
import {
  PerspectiveCamera as ThreePerspectiveCamera,
  MathUtils,
  Mesh,
  Material,
} from 'three';
import { PerspectiveCamera, Environment } from '@react-three/drei';
import { useGLTF } from '@react-three/drei';
import { GLTF } from 'three-stdlib';

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

const BASE_HEIGHT = 1.3;

const PIPE_COLOR = '#ddccff';
const BASE_COLOR = '#666677';
const BASE_ROTATING_COLOR = '#eeeeff';
const BASE_COLOR_HOVER = '#8899ff';
const PIPE_ROTATING_COLOR = '#ff5577';

// Add type for the GLB model
type GLTFResult = GLTF & {
  nodes: {
    Cylinder: Mesh; // Make sure this matches the name of your mesh in the GLB file
  };
  materials: {
    PipeMaterial: Material; // Make sure this matches the material name
  };
};

interface PipeProps {
  isRotating: boolean;
  islandColor: string | null;
  rotation: number;
  position?: [number, number, number];
  onClick?: () => void;
  row: number;
  col: number;
}

function Pipe({
  rotation,
  isRotating,
  islandColor,
  row,
  col,
  position = [0, 0, 0],
  onClick,
}: PipeProps) {
  const { nodes, materials } = useGLTF('/flip/Pipe.glb') as GLTFResult;
  const { hoveredCell, setHoveredCell, rotating } = useGameStore();
  const hovered =
    !rotating &&
    hoveredCell &&
    hoveredCell[0] === row &&
    hoveredCell[1] === col;

  const { springRotation } = useSpring({
    springRotation: (rotation * Math.PI) / 2,
    config: {
      mass: 0.7,
      tension: 300,
      friction: 20,
    },
  });
  const { springPipeColor, springBaseColor } = useSpring({
    springPipeColor:
      islandColor || (isRotating ? PIPE_ROTATING_COLOR : PIPE_COLOR),
    springBaseColor:
      islandColor ||
      (isRotating
        ? BASE_ROTATING_COLOR
        : hovered
          ? BASE_COLOR_HOVER
          : BASE_COLOR),
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
      {/* Main pipe model */}
      <mesh geometry={nodes.Cylinder.geometry} onClick={onClick}>
        <animated.meshStandardMaterial
          color={springPipeColor}
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>

      {/* Base cylinder */}
      <mesh
        position={[0, 0, -BASE_HEIGHT / 2]}
        rotation={[Math.PI / 2, 0, 0]}
        onClick={onClick}
      >
        <cylinderGeometry args={[1.95, 1.95, BASE_HEIGHT, 32]} />
        <animated.meshStandardMaterial
          color={springBaseColor}
          roughness={0.6}
          metalness={0.0}
        />
      </mesh>
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
    const audioCount = isMobile.current ? 1 : 3;
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

    // Update all of the new rotations *before* we find neighbors
    const newRotations = [...rotations.map((row) => [...row])];
    cells.forEach(([row, col]) => {
      const newUnboundRotation = newRotations[col][row] + 1;
      newRotations[col][row] = newUnboundRotation;
    });

    // Find the new neighbors for the rotated cells
    cells.forEach(([row, col]) => {
      const newRotation = (newRotations[col][row] % 4) as ROTATION;

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

    // Save the rotations (triggers the UI update)
    setRotations(newRotations);

    // Schedule the next rotation, which will be rotating all of the cells that
    // are currently rotating.
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
              isRotating={!!cell}
              islandColor={
                islandBonus > 1 && cell
                  ? groupColors[islands.findIndex((i) => i.has(cell))]
                  : null
              }
            />
          );
        }),
      )}
    </>
  );
}

const DEFAULT_FOV = 50;

const CameraController = ({
  fov,
  setFov,
  cameraRef,
}: {
  fov: number;
  setFov: (fov: number) => void;
  cameraRef: RefObject<ThreePerspectiveCamera | null>;
}) => {
  useEffect(() => {
    const updateCamera = () => {
      if (!cameraRef.current) return;
      const gridAspect = GRID_DIMENSIONS[0] / GRID_DIMENSIONS[1];
      if (cameraRef.current.aspect > gridAspect) {
        setFov(DEFAULT_FOV);
      } else {
        // window too narrow
        const cameraHeight = Math.tan(MathUtils.degToRad(fov / 2));
        const ratio = cameraRef.current.aspect / gridAspect;
        const newCameraHeight = cameraHeight / ratio;
        const newFov = MathUtils.radToDeg(Math.atan(newCameraHeight)) * 2.0;
        setFov(newFov);
      }
    };

    updateCamera();
    window.addEventListener('resize', updateCamera);
    return () => window.removeEventListener('resize', updateCamera);
  }, []);

  return null;
};

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

  const [fov, setFov] = useState(DEFAULT_FOV);

  const cameraRef = useRef<ThreePerspectiveCamera>(null);

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
      <div
        className="absolute top-4 left-4 flex flex-col gap-2 bg-blue-950/80 p-4 rounded-lg border border-blue-400/30 backdrop-blur-sm"
        style={{
          zIndex: 1000,
          textShadow: '0px 1px 1px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div className="text-blue-100 font-semibold flex items-center gap-2">
          <span className="text-blue-400">Rotations:</span>
          <span className="font-mono text-lg">
            {rotationCount.toLocaleString()}
          </span>
        </div>
        <div className="text-blue-100 font-semibold flex items-center gap-2">
          <span className="text-blue-400">High Score:</span>
          <span className="font-mono text-lg">
            {highScore.toLocaleString()}
          </span>
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
      <Canvas shadows style={{ width: '100%', height: '100%' }}>
        <PerspectiveCamera
          makeDefault
          fov={fov}
          position={[0, 0, 50]}
          ref={cameraRef}
        />
        <CameraController fov={fov} setFov={setFov} cameraRef={cameraRef} />
        <ambientLight intensity={0.1} />
        <pointLight position={[-10, -10, 20]} intensity={500} />
        <pointLight position={[10, 10, 20]} intensity={500} />
        <GameContainer />
        <Environment
          preset="sunset"
          background
          blur={0.8}
          backgroundIntensity={0.1}
          environmentIntensity={0.5}
        />
      </Canvas>
    </div>
  );
}

// Add this at the end of the file to preload the model
useGLTF.preload('/flip/Pipe.glb');

export default App;
