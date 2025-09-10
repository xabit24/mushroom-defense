"use client";
import React, { useRef, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, useTexture } from "@react-three/drei";
import * as THREE from "three";

function v(x,y,z){ return new THREE.Vector3(x,y,z); }
const PATH = [ v(-7,0.25,4), v(-2,0.25,3), v(2,0.25,1), v(6,0.25,-2) ];

function MushroomTower({ spec, onShoot }){
  const g = useRef();
  const tex = useTexture("/mushroom.png");
  const cooldown = useRef(0);

  useFrame((_, dt)=>{
    cooldown.current = Math.max(0, cooldown.current - dt);
    if (g.current){
      g.current.rotation.y += dt * 0.2;
      g.current.position.y = 0.08 + Math.sin(performance.now()/650)*0.02;
    }
  });

  // expose fire
  (MushroomTower).tryShoot = (target)=>{
    if (!g.current) return;
    if (cooldown.current > 0) return;
    const origin = g.current.getWorldPosition(new THREE.Vector3());
    const dir = target.clone().sub(origin).normalize();
    onShoot(origin, dir, spec.dmg, spec.bulletSpeed);
    cooldown.current = spec.cooldown;
  };

  const capColor = spec.type==="fast" ? "#6EC1FF" : "#7D8CFF";
  const stemColor = spec.type==="fast" ? "#2D6AD9" : "#3C47B3";

  return (
    <group ref={g} position={[spec.pos.x, spec.pos.y, spec.pos.z]}>
      <mesh position={[0,0.6,0]} castShadow>
        <cylinderGeometry args={[0.3, 0.42, 1.1, 24]} />
        <meshStandardMaterial color={stemColor} metalness={0.15} roughness={0.65} />
      </mesh>
      <mesh position={[0,1.28,0]} castShadow>
        <sphereGeometry args={[0.78, 48, 48]} />
        <meshStandardMaterial color={capColor} metalness={0.2} roughness={0.4} />
      </mesh>
      <mesh position={[0,1.05,0]}>
        <torusGeometry args={[0.5, 0.08, 24, 64]} />
        <meshStandardMaterial color={capColor} />
      </mesh>
      {tex && (
        <mesh position={[0.52,1.28,0]} rotation={[0,Math.PI/2,0]}>
          <planeGeometry args={[0.45,0.45]} />
          <meshBasicMaterial map={tex} transparent />
        </mesh>
      )}
    </group>
  );
}

function EnemyMesh({ e }){
  const ref = useRef();
  useFrame(()=>{ if (ref.current) ref.current.position.copy(e.pos); });
  return (
    <group ref={ref}>
      <mesh castShadow>
        <boxGeometry args={[0.6,0.6,0.6]} />
        <meshStandardMaterial color={e.hp>1?"#ffb703":"#ef476f"} />
      </mesh>
      <mesh position={[0,0.35,0]}>
        <octahedronGeometry args={[0.25,0]} />
        <meshStandardMaterial color={"#023047"} metalness={0.3} roughness={0.5} />
      </mesh>
    </group>
  );
}

function BulletMesh({ b }){
  const ref = useRef();
  useFrame(()=>{ if (ref.current) ref.current.position.copy(b.pos); });
  return (
    <mesh ref={ref} castShadow>
      <sphereGeometry args={[0.12,16,16]} />
      <meshStandardMaterial color={"#90e0ef"} emissive={"#90e0ef"} emissiveIntensity={0.35} />
    </mesh>
  );
}

function HUD({ wave, score, lives }){
  return (
    <Html>
      <div style={{position:"fixed",top:16,left:16,background:"rgba(0,0,0,.5)",color:"#fff",padding:"10px 14px",borderRadius:12,fontFamily:"ui-sans-serif, system-ui",fontWeight:600}}>
        <div>Wave: {wave}</div>
        <div>Score: {score}</div>
        <div>Lives: {lives}</div>
      </div>
    </Html>
  );
}

function Game(){
  const [enemies, setEnemies] = useState([]);
  const [bullets, setBullets] = useState([]);
  const [wave, setWave] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(10);
  const eid = useRef(0);
  const bid = useRef(0);

  const towers = useMemo(()=>[
    { type:"fast",  pos:v(-1,0, 1.2), range:4.2, cooldown:0.28, bulletSpeed:9, dmg:1 },
    { type:"heavy", pos:v( 2,0,-0.5), range:5.0, cooldown:0.9,  bulletSpeed:7, dmg:2 },
  ], []);

  useEffect(()=>{
    let spawning = true;
    let spawned = 0;
    const count = 6 + wave * 3;
    const hpBase = 2 + Math.floor(wave/2);
    const speedBase = 1.1 + wave*0.06;

    const iv = setInterval(()=>{
      if (!spawning) return;
      if (spawned >= count){ spawning = false; clearInterval(iv); return; }
      setEnemies(prev=>[...prev, { id:eid.current++, pos: PATH[0].clone(), hp: hpBase, speed: speedBase }]);
      spawned++;
    }, 800);

    const check = setInterval(()=>{
      if (!spawning && enemies.length === 0){
        clearInterval(check);
        setWave(w=>w+1);
      }
    }, 1000);

    return ()=>{ clearInterval(iv); clearInterval(check); };
  }, [wave, enemies.length]);

  const onShoot = (origin, dir, dmg, speed)=>{
    setBullets(prev=>[...prev, { id: bid.current++, pos: origin.clone().add(dir.clone().multiplyScalar(0.9)), vel: dir.clone().multiplyScalar(speed), dmg }]);
  };

  useFrame((_, dt)=>{
    // move enemies
    setEnemies(prev=>{
      const next = [];
      for (const e of prev){
        let targetIdx = 1;
        for (let i=1;i<PATH.length;i++){ if (e.pos.distanceTo(PATH[i])>0.01){ targetIdx = i; break; } }
        const target = PATH[targetIdx] || PATH[PATH.length-1];
        const dir = target.clone().sub(e.pos).normalize();
        const newPos = e.pos.clone().addScaledVector(dir, e.speed*dt);
        if (targetIdx === PATH.length-1 && newPos.distanceTo(target) < 0.28){
          setLives(l=>Math.max(0,l-1));
        } else next.push({ ...e, pos: newPos });
      }
      return next;
    });

    // towers fire
    towers.forEach(spec=>{
      let nearest = null;
      let minD = Infinity;
      enemies.forEach(e=>{
        const d = spec.pos.distanceTo(e.pos);
        if (d < spec.range && d < minD){ minD = d; nearest = e; }
      });
      if (nearest){
        (MushroomTower).tryShoot(nearest.pos);
      }
    });

    // bullets
    setBullets(prev=>{
      const out = [];
      for (const b of prev){
        const np = b.pos.clone().addScaledVector(b.vel, dt);
        if (np.length() > 40){ continue; }
        let hit = false;
        setEnemies(ep=>{
          const arr = [];
          for (const e of ep){
            if (!hit && e.pos.distanceTo(np) < 0.45){
              hit = true;
              const nhp = e.hp - b.dmg;
              if (nhp <= 0) setScore(s=>s+10);
              else arr.push({ ...e, hp: nhp });
            } else arr.push(e);
          }
          return arr;
        });
        if (!hit) out.push({ ...b, pos: np });
      }
      return out;
    });
  });

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[4,6,4]} intensity={1.1} castShadow />
      <HUD wave={wave} score={score} lives={lives} />

      <mesh rotation={[-Math.PI/2,0,0]} receiveShadow>
        <planeGeometry args={[30, 20]} />
        <meshStandardMaterial color={"#0f1e2e"} />
      </mesh>

      {PATH.map((p,i)=> (
        <mesh key={i} position={[p.x, p.y-0.1, p.z]}>
          <cylinderGeometry args={[0.16,0.16,0.02,16]} />
          <meshStandardMaterial color={"#274863"} />
        </mesh>
      ))}

      {towers.map((spec, i)=>(
        <MushroomTower key={i} spec={spec} onShoot={onShoot} />
      ))}

      {enemies.map(e=> <EnemyMesh key={e.id} e={e} />)}
      {bullets.map(b=> <BulletMesh key={b.id} b={b} />)}

      <OrbitControls enablePan={false} minDistance={6} maxDistance={18} target={[0,1,0]} />
    </>
  );
}

export default function Page(){
  return (
    <div style={{ width: "100vw", height: "100dvh", background: "#071521" }}>
      <Canvas shadows camera={{ position: [8,7,10], fov: 50 }}>
        <color attach="background" args={["#071521"]} />
        <Game />
      </Canvas>
    </div>
  );
}
