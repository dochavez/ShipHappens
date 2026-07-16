import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function SailorGame() {
  const mountRef = useRef(null)
  const controlRef = useRef({ forward: false, back: false, left: false, right: false })
  const [stats, setStats] = useState({ speed: 0, islands: 0, message: 'Encuentra las islas doradas' })

  useEffect(() => {
    const mount = mountRef.current
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x78bed7)
    scene.fog = new THREE.FogExp2(0x79bdd5, 0.006)

    const camera = new THREE.PerspectiveCamera(52, mount.clientWidth / mount.clientHeight, 0.1, 500)
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    mount.appendChild(renderer.domElement)

    const sky = new THREE.HemisphereLight(0xc7f1ff, 0x153449, 2.4)
    scene.add(sky)
    const sun = new THREE.DirectionalLight(0xfff0c0, 3.2)
    sun.position.set(-35, 50, -20)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    scene.add(sun)

    const waterGeometry = new THREE.PlaneGeometry(500, 500, 80, 80)
    const waterMaterial = new THREE.MeshStandardMaterial({ color: 0x126a9a, emissive: 0x063c64, emissiveIntensity: 0.32, roughness: 0.3, metalness: 0.18, flatShading: true })
    const water = new THREE.Mesh(waterGeometry, waterMaterial)
    water.rotation.x = -Math.PI / 2
    water.receiveShadow = true
    scene.add(water)
    const waterPositions = waterGeometry.attributes.position

    const boat = new THREE.Group()
    boat.position.set(0, 0.3, 18)
    scene.add(boat)
    const loader = new GLTFLoader()
    loader.load(`${import.meta.env.BASE_URL}models/newcartoonsailboat.glb`, (gltf) => {
      const model = gltf.scene
      model.scale.setScalar(2.75)
      model.traverse((node) => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true } })
      boat.add(model)
    })

    const islands = [
      { x: -22, z: -22, found: false }, { x: 28, z: -42, found: false }, { x: -43, z: 17, found: false },
      { x: 42, z: 22, found: false }, { x: 2, z: -70, found: false }
    ]
    const islandGroup = new THREE.Group()
    scene.add(islandGroup)
    function addIsland({ x, z }) {
      const group = new THREE.Group()
      group.position.set(x, 0, z)
      const sand = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.6, 0.8, 8), new THREE.MeshStandardMaterial({ color: 0xf0ce7e, roughness: 1, flatShading: true }))
      sand.position.y = 0.18
      sand.receiveShadow = true
      group.add(sand)
      for (let i = 0; i < 3; i += 1) {
        const palm = new THREE.Group()
        const angle = (i / 3) * Math.PI * 2 + 0.4
        palm.position.set(Math.cos(angle) * 1.8, 0.5, Math.sin(angle) * 1.8)
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.28, 3.8, 7), new THREE.MeshStandardMaterial({ color: 0x7b492b, roughness: 1, flatShading: true }))
        trunk.position.y = 1.9
        trunk.rotation.z = Math.cos(angle * 3) * 0.12
        trunk.castShadow = true
        palm.add(trunk)
        const leaves = new THREE.Mesh(new THREE.SphereGeometry(1.35, 7, 5), new THREE.MeshStandardMaterial({ color: 0x26784d, roughness: 0.9, flatShading: true }))
        leaves.position.y = 4.1
        leaves.scale.set(1.15, 0.45, 1.15)
        leaves.castShadow = true
        palm.add(leaves)
        group.add(palm)
      }
      const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.68), new THREE.MeshStandardMaterial({ color: 0xffc72c, emissive: 0xbd6c00, emissiveIntensity: 0.7, flatShading: true }))
      beacon.position.y = 1.65
      group.add(beacon)
      islandGroup.add(group)
    }
    islands.forEach(addIsland)

    const heading = new THREE.Vector3(0, 0, -1)
    const desiredCamera = new THREE.Vector3()
    const lookTarget = new THREE.Vector3()
    let speed = 0
    let found = 0
    let lastTime = performance.now()
    let frame = 0
    let animationId

    function setControl(name, active) { controlRef.current[name] = active }
    const keyMap = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' }
    const onKeyDown = (event) => { const action = keyMap[event.code]; if (action) { event.preventDefault(); setControl(action, true) } }
    const onKeyUp = (event) => { const action = keyMap[event.code]; if (action) { event.preventDefault(); setControl(action, false) } }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    function animate(now) {
      animationId = requestAnimationFrame(animate)
      const dt = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now
      const controls = controlRef.current
      if (controls.forward) speed += 8 * dt
      if (controls.back) speed -= 7 * dt
      speed *= Math.pow(0.38, dt)
      speed = clamp(speed, -2.5, 8)
      const turnDirection = (controls.left ? 1 : 0) - (controls.right ? 1 : 0)
      boat.rotation.y += turnDirection * (1.35 + Math.abs(speed) * 0.05) * dt * (speed >= 0 ? 1 : -1)
      heading.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), boat.rotation.y)
      boat.position.addScaledVector(heading, speed * dt)
      boat.position.x = clamp(boat.position.x, -105, 105)
      boat.position.z = clamp(boat.position.z, -105, 105)
      boat.position.y = 0.38 + Math.sin(now * 0.0024 + boat.position.x * 0.1) * 0.18
      boat.rotation.z = -turnDirection * 0.13 - Math.sin(now * 0.002) * 0.035
      boat.rotation.x = Math.cos(now * 0.0023) * 0.045

      for (let i = 0; i < waterPositions.count; i += 1) {
        const x = waterPositions.getX(i); const z = waterPositions.getZ(i)
        waterPositions.setY(i, Math.sin(x * 0.09 + now * 0.0018) * 0.26 + Math.cos(z * 0.11 + now * 0.0013) * 0.18)
      }
      waterPositions.needsUpdate = true
      waterGeometry.computeVertexNormals()
      islands.forEach((island, i) => {
        const marker = islandGroup.children[i].children.at(-1)
        marker.rotation.y += dt * 1.8
        marker.position.y = 1.65 + Math.sin(now * 0.003 + i) * 0.22
        if (!island.found && Math.hypot(boat.position.x - island.x, boat.position.z - island.z) < 6.3) {
          island.found = true
          marker.visible = false
          found += 1
        }
      })
      desiredCamera.copy(boat.position).add(new THREE.Vector3(0, 13, 24).applyAxisAngle(new THREE.Vector3(0, 1, 0), boat.rotation.y))
      camera.position.lerp(desiredCamera, 1 - Math.pow(0.0001, dt))
      lookTarget.copy(boat.position).addScaledVector(heading, 8)
      lookTarget.y = 0.9
      camera.lookAt(lookTarget)
      if ((frame += 1) % 8 === 0) setStats({ speed: Math.round(Math.abs(speed) * 12), islands: found, message: found === islands.length ? '¡Ruta completada, capitán!' : `Balizas encontradas: ${found} de ${islands.length}` })
      renderer.render(scene, camera)
    }
    animate(performance.now())
    const resize = () => { camera.aspect = mount.clientWidth / mount.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(mount.clientWidth, mount.clientHeight) }
    window.addEventListener('resize', resize)
    return () => { cancelAnimationFrame(animationId); window.removeEventListener('resize', resize); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); renderer.dispose(); waterGeometry.dispose(); waterMaterial.dispose(); mount.removeChild(renderer.domElement) }
  }, [])

  const setTouch = (action, active) => { controlRef.current[action] = active }
  const bindButton = (action) => ({ onPointerDown: () => setTouch(action, true), onPointerUp: () => setTouch(action, false), onPointerLeave: () => setTouch(action, false), onPointerCancel: () => setTouch(action, false) })
  return <main className="game-shell">
    <div ref={mountRef} className="viewport" aria-label="Juego 3D de navegación" />
    <section className="hud">
      <div><p className="eyebrow">EXPEDICIÓN 01</p><h1>Horizonte Marinero</h1></div>
      <div className="readout"><span>Velocidad</span><strong>{stats.speed} nudos</strong></div>
      <div className="mission">{stats.message}</div>
    </section>
    <div className="instructions">WASD / flechas para navegar · Acércate a las balizas doradas</div>
    <div className="touch-controls" aria-label="Controles táctiles">
      <button {...bindButton('left')} aria-label="Girar a la izquierda">←</button>
      <button {...bindButton('forward')} aria-label="Avanzar">↑</button>
      <button {...bindButton('back')} aria-label="Retroceder">↓</button>
      <button {...bindButton('right')} aria-label="Girar a la derecha">→</button>
    </div>
  </main>
}
