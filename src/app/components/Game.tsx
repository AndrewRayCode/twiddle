'use client';

import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';

const CYLINDER_HEIGHT = 1;

interface PipeProps {
  rotation: number;
  position?: [number, number, number];
  onClick?: () => void;
}

function Pipe({ rotation, position = [0, 0, 0], onClick }: PipeProps) {
  const { springRotation } = useSpring({
    springRotation: rotation,
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
        <meshStandardMaterial color="blue" roughness={0.5} metalness={0.5} />
      </mesh>
    </animated.group>
  );
}

function RotatingPipeDemo() {
  // Create a 3x3 grid of rotation states
  const [rotations, setRotations] = useState(() =>
    Array(3)
      .fill(0)
      .map(() => Array(3).fill(0)),
  );

  const handleClick = (row: number, col: number) => {
    setRotations((prev) => {
      const newRotations = [...prev.map((row) => [...row])];
      newRotations[row][col] += Math.PI / 2;
      return newRotations;
    });
  };

  const spacing = 4; // Space between pipes

  return (
    <>
      {rotations.map((row, rowIndex) =>
        row.map((rotation, colIndex) => (
          <Pipe
            key={`${rowIndex}-${colIndex}`}
            position={[(colIndex - 1) * spacing, (rowIndex - 1) * spacing, 0]}
            rotation={rotation}
            onClick={() => handleClick(rowIndex, colIndex)}
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
