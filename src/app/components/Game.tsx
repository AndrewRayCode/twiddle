'use client';

/* eslint-disable @typescript-eslint/no-unused-vars */
import React, {
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
} from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';
import { useGameStore } from '@/store/gameStore';
import { GRID_DIMENSIONS, TILE_SPACING } from '@/constants';

type NEIGHBOR = [number, number];
const UP: NEIGHBOR = [0, -1];
const DOWN: NEIGHBOR = [0, 1];
const LEFT: NEIGHBOR = [-1, 0];
const RIGHT: NEIGHBOR = [1, 0];

type ROTATION = 0 | 1 | 2 | 3;
const randRotation = () => Math.floor(Math.random() * 4) as ROTATION;

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

const CYLINDER_HEIGHT = 2.0;

interface PipeProps {
  highlight: boolean;
  rotation: number;
  position?: [number, number, number];
  onClick?: () => void;
  idx: string;
}

function Pipe({
  highlight,
  rotation,
  position = [0, 0, 0],
  onClick,
  idx,
}: PipeProps) {
  const { springRotation } = useSpring({
    springRotation: (rotation * Math.PI) / 2,
    config: {
      mass: 1.8,
      tension: 450,
      friction: 40,
    },
  });

  return (
    <animated.group position={position} rotation-z={springRotation}>
      {/* Vertical section */}
      <mesh position={[0, -1.0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, CYLINDER_HEIGHT, 16]} />
        <meshStandardMaterial color="orange" roughness={0.5} metalness={0.5} />
      </mesh>
      {/* Horizontal section */}
      <mesh position={[1.0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.3, 0.3, CYLINDER_HEIGHT, 16]} />
        <meshStandardMaterial color="orange" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh
        position={[0, 0, -0.1]}
        rotation={[Math.PI / 2, 0, 0]}
        onClick={onClick}
      >
        <cylinderGeometry args={[1.95, 1.95, 0.1, 32]} />
        <meshStandardMaterial
          color={highlight ? 'white' : 'gray'}
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

const dedupeNeighbors = (neighbors: [number, number][]) => {
  return neighbors.filter(
    (neighbor, index, self) =>
      index ===
      self.findIndex((t) => t[0] === neighbor[0] && t[1] === neighbor[1]),
  );
};

function RotatingPipeDemo() {
  const {
    rotations,
    neighborsToRotate,
    rotating,
    setRotations,
    setNeighborsToRotate,
    setRotating,
    addToRotationCount,
  } = useGameStore();

  // Create a single audio instance and preload it
  const rotationSound = useRef<HTMLAudioElement[] | null>(null);
  const isMobile = useRef<boolean>(false);

  useEffect(() => {
    // Check if device is mobile
    isMobile.current = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // Initialize audio once - use smaller array for mobile
    const audioCount = isMobile.current ? 1 : 5;
    rotationSound.current = Array(audioCount)
      .fill(null)
      .map(() => {
        const audio = new Audio('/stop.mp3');
        audio.load();
        return audio;
      });

    // Cleanup on unmount
    return () => {
      if (rotationSound.current) {
        rotationSound.current.forEach((l) => l.pause());
        rotationSound.current = null;
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
        playPromise.catch((error) => {
          console.log('Audio playback failed:', error);
        });
      }
    }
  }, []);

  const findNeighborsToRotate = (
    row: number,
    col: number,
    rotation: ROTATION,
    currentRotations: number[][],
  ) => {
    const neighborsToRotate: [number, number][] = [];
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

  const rotateCells = (rotations: number[][], cells: [number, number][]) => {
    setRotating(true);
    addToRotationCount(cells.length); // Count all tiles being rotated

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

    let newNeighborsToRotate: [number, number][] = [];

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

    setTimeout(() => {
      setNeighborsToRotate(newNeighborsToRotate);
      if (newNeighborsToRotate.length === 0) {
        setRotating(false);
      } else {
        rotateCells(newRotations, newNeighborsToRotate);
      }
    }, 800);
  };

  const handleClick = (row: number, col: number) => {
    if (rotating) return;
    setNeighborsToRotate([[row, col]]);
    rotateCells(rotations, [[row, col]]);
  };

  const offset = (TILE_SPACING * (GRID_DIMENSIONS[0] - 1)) / 2;

  return (
    <>
      {rotations.map((row, colIndex) =>
        row.map((rotation, rowIndex) => (
          <Pipe
            key={`${rowIndex}-${colIndex}`}
            idx={`${rowIndex}, ${colIndex}`}
            position={[
              rowIndex * TILE_SPACING - offset,
              -(colIndex * TILE_SPACING - offset),
              0,
            ]}
            rotation={rotation}
            onClick={() => handleClick(rowIndex, colIndex)}
            highlight={neighborsToRotate.some(
              ([nx, ny]) => nx === rowIndex && ny === colIndex,
            )}
          />
        )),
      )}
    </>
  );
}

function App() {
  const { rotating, resetBoard, rotationCount, highScore } = useGameStore();

  return (
    <div className="w-screen h-screen relative">
      <div className="absolute top-4 left-4 flex flex-col gap-2 bg-black/50 p-4 rounded text-white">
        <div>Rotations: {rotationCount}</div>
        <div>High Score: {highScore}</div>
      </div>
      <button
        className="absolute top-4 right-4 px-4 py-2 bg-orange-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={resetBoard}
        disabled={rotating}
        style={{ zIndex: 1000 }}
      >
        Reset Board
      </button>
      <Canvas
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [0, 0, 20] }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[0, 0, 20]} intensity={200} />
        <RotatingPipeDemo />
        <OrbitControls />
      </Canvas>
    </div>
  );
}

export default App;
