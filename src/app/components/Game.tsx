'use client';

/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useCallback, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';

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

const TILE_SPACING = 4; // Space between pipes
const GRID_DIMENSIONS = [4, 6] as const; // Size of the grid

const dedupeNeighbors = (neighbors: [number, number][]) => {
  return neighbors.filter(
    (neighbor, index, self) =>
      index ===
      self.findIndex((t) => t[0] === neighbor[0] && t[1] === neighbor[1]),
  );
};

function RotatingPipeDemo() {
  // Create a 3x3 grid of rotation states
  const [rotations, setRotations] = useState<number[][]>(() =>
    Array(GRID_DIMENSIONS[0])
      .fill(0)
      .map(() =>
        Array(GRID_DIMENSIONS[1])
          .fill(0)
          .map(() => randRotation()),
      ),
  );

  const [neighborsToRotate, setNeighborsToRotate] = useState<
    [number, number][]
  >([]);

  const [rotating, setRotating] = useState(false);

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
    console.log('rotateCells', { cells });
    setRotating(true);
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
    }, 850);
  };

  const handleClick = (row: number, col: number) => {
    if (rotating) {
      return;
    }
    console.log('handleClick', { row, col });

    setNeighborsToRotate([[row, col]]);
    rotateCells(rotations, [[row, col]]);
  };

  const offset = (TILE_SPACING * (GRID_DIMENSIONS[0] - 1)) / 2; // Offset to center the grid

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
  return (
    <Canvas
      style={{ width: '100%', height: '100%' }}
      camera={{ position: [0, 0, 15] }}
    >
      <ambientLight intensity={0.9} />
      <pointLight position={[1, 1, 1]} />
      {/* <axesHelper scale={10} /> */}
      <RotatingPipeDemo />
      <OrbitControls />
    </Canvas>
  );
}

export default App;
