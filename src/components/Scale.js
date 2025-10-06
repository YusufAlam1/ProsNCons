import React, { useEffect, useRef } from "react";
import Matter from "matter-js";

function Scale({ prosData = [], consData = [] }) {
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const renderRef = useRef(null);
  const leftPlatformRef = useRef(null);
  const rightPlatformRef = useRef(null);
  const prosObjectsRef = useRef([]);
  const consObjectsRef = useRef([]);

  useEffect(() => {
    // Create engine
    const engine = Matter.Engine.create();
    engineRef.current = engine;
    
    // Disable gravity initially for smooth setup
    engine.world.gravity.y = 0.8;

    // Create renderer
    const render = Matter.Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width: 500,
        height: 400,
        wireframes: false,
        background: 'transparent',
        showAngleIndicator: false,
        showVelocity: false,
      }
    });
    renderRef.current = render;

    // Create scale structure
    const ground = Matter.Bodies.rectangle(250, 380, 500, 20, { 
      isStatic: true,
      render: { fillStyle: '#8B4513' }
    });

    // Main support beam (vertical)
    const support = Matter.Bodies.rectangle(250, 300, 8, 160, { 
      isStatic: true,
      render: { fillStyle: '#654321' }
    });

    // Balance beam (horizontal bar that can rotate)
    const beam = Matter.Bodies.rectangle(250, 200, 200, 6, {
      render: { fillStyle: '#654321' }
    });

    // Create constraint to attach beam to support (allowing rotation)
    const beamConstraint = Matter.Constraint.create({
      bodyA: support,
      bodyB: beam,
      pointA: { x: 0, y: -50 },
      pointB: { x: 0, y: 0 },
      length: 0,
      stiffness: 1
    });

    // Left platform
    const leftPlatform = Matter.Bodies.rectangle(180, 180, 80, 8, {
      render: { fillStyle: '#D2691E' }
    });
    leftPlatformRef.current = leftPlatform;

    // Right platform  
    const rightPlatform = Matter.Bodies.rectangle(320, 180, 80, 8, {
      render: { fillStyle: '#D2691E' }
    });
    rightPlatformRef.current = rightPlatform;

    // Constraints to attach platforms to beam
    const leftConstraint = Matter.Constraint.create({
      bodyA: beam,
      bodyB: leftPlatform,
      pointA: { x: -70, y: 0 },
      pointB: { x: 0, y: 0 },
      length: 20,
      stiffness: 0.8
    });

    const rightConstraint = Matter.Constraint.create({
      bodyA: beam,
      bodyB: rightPlatform,
      pointA: { x: 70, y: 0 },
      pointB: { x: 0, y: 0 },
      length: 20,
      stiffness: 0.8
    });

    // Add all bodies to world
    Matter.World.add(engine.world, [
      ground, support, beam, beamConstraint,
      leftPlatform, rightPlatform, leftConstraint, rightConstraint
    ]);

    // Start the engine and renderer
    Matter.Engine.run(engine);
    Matter.Render.run(render);

    // Cleanup function
    return () => {
      Matter.Render.stop(render);
      Matter.Engine.clear(engine);
      if (sceneRef.current && render.canvas) {
        sceneRef.current.removeChild(render.canvas);
      }
    };
  }, []);

  // Update physics objects when pros/cons change
  useEffect(() => {
    if (!engineRef.current) return;

    // Remove existing pros objects
    prosObjectsRef.current.forEach(obj => {
      Matter.World.remove(engineRef.current.world, obj);
    });
    prosObjectsRef.current = [];

    // Remove existing cons objects
    consObjectsRef.current.forEach(obj => {
      Matter.World.remove(engineRef.current.world, obj);
    });
    consObjectsRef.current = [];

    // Add pros objects (green circles on left platform)
    prosData.forEach((pro, index) => {
      const size = Math.max(8, pro.weight * 3); // Size based on weight
      const x = 160 + (index % 3) * 15; // Arrange in rows
      const y = 100 - Math.floor(index / 3) * 20;
      
      const prosObject = Matter.Bodies.circle(x, y, size, {
        render: { 
          fillStyle: '#28c95a',
          strokeStyle: '#20b34e',
          lineWidth: 2
        },
        restitution: 0.3,
        friction: 0.8
      });

      Matter.World.add(engineRef.current.world, prosObject);
      prosObjectsRef.current.push(prosObject);
    });

    // Add cons objects (red circles on right platform)
    consData.forEach((con, index) => {
      const size = Math.max(8, con.weight * 3); // Size based on weight
      const x = 340 + (index % 3) * 15; // Arrange in rows
      const y = 100 - Math.floor(index / 3) * 20;
      
      const consObject = Matter.Bodies.circle(x, y, size, {
        render: { 
          fillStyle: '#e74c3c',
          strokeStyle: '#c0392b',
          lineWidth: 2
        },
        restitution: 0.3,
        friction: 0.8
      });

      Matter.World.add(engineRef.current.world, consObject);
      consObjectsRef.current.push(consObject);
    });

  }, [prosData, consData]);

  return (
    <div className="scale-visualization">
      <div 
        ref={sceneRef} 
        style={{ 
          border: '2px solid #ddd', 
          borderRadius: '12px',
          backgroundColor: '#f8f9fa'
        }} 
      />
      <div style={{ 
        marginTop: '16px', 
        textAlign: 'center',
        fontFamily: '"Permanent Marker", cursive',
        fontSize: '1.1em',
        color: '#333'
      }}>
        <div>Pros: {prosData.length} items</div>
        <div>Cons: {consData.length} items</div>
        <div style={{ fontSize: '0.9em', marginTop: '8px' }}>
          Total Weight - Pros: {prosData.reduce((sum, p) => sum + p.weight, 0)} | 
          Cons: {consData.reduce((sum, c) => sum + c.weight, 0)}
        </div>
      </div>
    </div>
  );
}

export default Scale;