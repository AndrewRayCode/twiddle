'use client';

import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';

type NEIGHBOR = [number, number];
const UP: NEIGHBOR = [0, -1];
const DOWN: NEIGHBOR = [0, 1];
const LEFT: NEIGHBOR = [-1, 0];
const RIGHT: NEIGHBOR = [1, 0];

type ROTATION = 0 | 1 | 2 | 3;

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

const CYLINDER_HEIGHT = 1;

interface PipeProps {
  highlight: boolean;
  rotation: number;
  position?: [number, number, number];
  onClick?: () => void;
}

function Pipe({
  highlight,
  rotation,
  position = [0, 0, 0],
  onClick,
}: PipeProps) {
  const { springRotation } = useSpring({
    springRotation: (rotation * Math.PI) / 2,
    config: {
      mass: 1,
      tension: 120,
      friction: 14,
    },
  });

  return (
    <animated.group
      position={position}
      rotation-z={springRotation}
      onClick={onClick}
    >
      {/* Vertical section */}
      <mesh position={[0, -1.5, 0]}>
        <cylinderGeometry args={[0.3, 0.3, CYLINDER_HEIGHT, 16]} />
        <meshStandardMaterial color="orange" roughness={0.5} metalness={0.5} />
      </mesh>
      {/* Horizontal section */}
      <mesh position={[1.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.3, 0.3, CYLINDER_HEIGHT, 16]} />
        <meshStandardMaterial color="orange" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial
          color={highlight ? 'white' : 'blue'}
          roughness={0.5}
          metalness={0.5}
        />
      </mesh>
    </animated.group>
  );
}

function RotatingPipeDemo() {
  // Create a 3x3 grid of rotation states
  const [rotations, setRotations] = useState<ROTATION[][]>(() =>
    Array(3)
      .fill(0)
      .map(() => Array(3).fill(0)),
  );

  const [neighborsToRotate, setNeighborsToRotate] = useState<
    [number, number][]
  >([]);

  const [rotating, setRotating] = useState(false);

  const handleClick = (row: number, col: number) => {
    if (rotating) {
      return;
    }

    const newRotation = ((rotations[row][col] + 1) % 4) as ROTATION;

    setRotations((prev) => {
      const newRotations = [...prev.map((row) => [...row])];
      newRotations[row][col] = newRotation;
      return newRotations;
    });

    setRotating(true);
    setTimeout(() => {
      const neighborsToRotate: [number, number][] = [];
      RotationNeighbors[newRotation].forEach(([dx, dy]) => {
        const nx = row + dx;
        const ny = col + dy;
        const neighbor = rotations[nx][ny];
        console.log({ dx, dy, nx, ny, neighbor });
        if (neighbor !== undefined) {
          const neighborPointsAtUsToo = RotationNeighbors[neighbor].some(
            ([ndx, ndy]) => {
              return nx + ndx === row && ny + ndy === col;
            },
          );
          if (neighborPointsAtUsToo) {
            neighborsToRotate.push([nx, ny]);
          }
        }
      });
      console.log({ neighborsToRotate });
      setNeighborsToRotate(neighborsToRotate);

      setRotating(false);
    }, 1000);
  };

  const spacing = 4; // Space between pipes

  return (
    <>
      {rotations.map((row, colIndex) =>
        row.map((rotation, rowIndex) => (
          <Pipe
            key={`${rowIndex}-${colIndex}`}
            position={[(colIndex - 1) * spacing, (rowIndex - 1) * spacing, 0]}
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
      <RotatingPipeDemo />
      <OrbitControls />
    </Canvas>
  );
}

export default App;
