import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const deadZone = (value, threshold = 0.18) => Math.abs(value) > threshold ? value : 0

export function SailorGame() {
  const mountRef = useRef(null)
  const controlsRef = useRef({ forward: false, reverse: false, left: false, right: false, jump: false })
  const startedRef = useRef(false)
  const audioStartRef = useRef(null)
  const collectSoundRef = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [started, setStarted] = useState(false)
  const [stats, setStats] = useState({ speed: 0, islands: 0, controller: 'Teclado listo', message: 'Encuentra las islas doradas' })

  useEffect(() => { startedRef.current = started }, [started])

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

    scene.add(new THREE.HemisphereLight(0xc7f1ff, 0x153449, 2.4))
    const sun = new THREE.DirectionalLight(0xfff0c0, 3.2)
    sun.position.set(-35, 50, -20)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    scene.add(sun)

    const manager = new THREE.LoadingManager()
    const textures = new THREE.TextureLoader(manager)
    const gltfLoader = new GLTFLoader(manager)
    const seaTexture = textures.load(`${import.meta.env.BASE_URL}models/sea%20waves.jpg`)
    seaTexture.colorSpace = THREE.SRGBColorSpace
    seaTexture.wrapS = seaTexture.wrapT = THREE.RepeatWrapping
    seaTexture.repeat.set(5, 5)
    manager.onLoad = () => setLoaded(true)
    manager.onError = () => setLoaded(true)

    const waterGeometry = new THREE.PlaneGeometry(500, 500, 80, 80)
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x1980ae, map: seaTexture, emissive: 0x063c64, emissiveIntensity: 0.22,
      roughness: 0.38, metalness: 0.12, flatShading: true,
    })
    const water = new THREE.Mesh(waterGeometry, waterMaterial)
    water.rotation.x = -Math.PI / 2
    water.receiveShadow = true
    scene.add(water)
    const waterPositions = waterGeometry.attributes.position

    const boat = new THREE.Group()
    boat.position.set(0, 0.42, 18)
    scene.add(boat)
    gltfLoader.load(`${import.meta.env.BASE_URL}models/newcartoonsailboat.glb`, (gltf) => {
      const model = gltf.scene
      model.scale.setScalar(2.75)
      // El GLB fue modelado sobre el eje X; esta corrección alinea su proa al eje -Z del juego.
      model.rotation.y = Math.PI / 2
      model.traverse((node) => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true } })
      boat.add(model)
    })

    const splashGroup = new THREE.Group()
    scene.add(splashGroup)
    const splashGeometry = new THREE.SphereGeometry(0.11, 5, 4)
    const splashMaterial = new THREE.MeshBasicMaterial({ color: 0xd9f9ff, transparent: true, opacity: 0.9 })
    const splashParticles = []
    function splash(position, heading, intensity) {
      const particle = new THREE.Mesh(splashGeometry, splashMaterial.clone())
      const side = new THREE.Vector3(-heading.z, 0, heading.x)
      particle.position.copy(position).addScaledVector(heading, -1.15).addScaledVector(side, (Math.random() - 0.5) * 1.5)
      particle.position.y = 0.38
      splashGroup.add(particle)
      splashParticles.push({ particle, velocity: side.multiplyScalar((Math.random() - 0.5) * 2.3).add(new THREE.Vector3(heading.x * -1.6, 1.5 + Math.random() * intensity, heading.z * -1.6)), life: 0.55 + Math.random() * 0.4 })
    }

    const islands = [
      { x: -22, z: -22, found: false }, { x: 28, z: -42, found: false }, { x: -43, z: 17, found: false },
      { x: 42, z: 22, found: false }, { x: 2, z: -70, found: false },
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
    let thrustTime = 0
    let jumpOffset = 0
    let jumpVelocity = 0
    let splashTimer = 0
    let gamepadJumpWasDown = false
    let lastTime = performance.now()
    let frame = 0
    let animationId
    let audioContext
    let masterGain
    let musicEnabled = false
    let nextMusicAt = 0
    let musicStep = 0

    function playTone(frequency, at, duration, type = 'sine', volume = 0.06) {
      if (!audioContext || !masterGain || audioContext.state !== 'running') return
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()
      oscillator.type = type
      oscillator.frequency.setValueAtTime(frequency, at)
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(volume, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)
      oscillator.connect(gain).connect(masterGain)
      oscillator.start(at)
      oscillator.stop(at + duration + 0.03)
    }

    function startAudio() {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return
      if (!audioContext) {
        audioContext = new AudioContext()
        masterGain = audioContext.createGain()
        masterGain.gain.value = 0.33
        masterGain.connect(audioContext.destination)
      }
      audioContext.resume()
      musicEnabled = true
      nextMusicAt = audioContext.currentTime + 0.06
    }

    function playCollectSound() {
      if (!audioContext || audioContext.state !== 'running') return
      const at = audioContext.currentTime + 0.02
      playTone(659.25, at, 0.16, 'triangle', 0.12)
      playTone(783.99, at + 0.1, 0.22, 'triangle', 0.12)
      playTone(987.77, at + 0.2, 0.38, 'sine', 0.1)
    }

    audioStartRef.current = startAudio
    collectSoundRef.current = playCollectSound

    function setControl(name, active) { controlsRef.current[name] = active }
    const keyMap = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'reverse', ArrowDown: 'reverse', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'jump' }
    const onKeyDown = (event) => {
      const action = keyMap[event.code]
      if (!action) return
      event.preventDefault()
      if (action === 'jump' && event.repeat) return
      setControl(action, true)
    }
    const onKeyUp = (event) => { const action = keyMap[event.code]; if (action) { event.preventDefault(); setControl(action, false) } }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    function animate(now) {
      animationId = requestAnimationFrame(animate)
      const dt = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now
      const controls = controlsRef.current
      const gamepad = navigator.getGamepads?.().find((pad) => pad?.connected)
      const stickX = gamepad ? deadZone(gamepad.axes[0] || 0) : 0
      const stickY = gamepad ? deadZone(gamepad.axes[1] || 0) : 0
      const forward = controls.forward || stickY < -0.18
      const reverse = controls.reverse || stickY > 0.18
      const right = controls.right || stickX > 0.18
      const left = controls.left || stickX < -0.18
      const jumpPressed = controls.jump || Boolean(gamepad?.buttons[0]?.pressed)

      if (musicEnabled && audioContext?.state === 'running') {
        const melody = [0, 7, 12, 7, 3, 10, 7, 5]
        while (nextMusicAt < audioContext.currentTime + 0.14) {
          const note = melody[musicStep % melody.length]
          playTone(220 * (2 ** (note / 12)), nextMusicAt, 0.28, 'triangle', 0.085)
          if (musicStep % 4 === 0) playTone(110, nextMusicAt, 0.2, 'sine', 0.07)
          musicStep += 1
          nextMusicAt += 0.36
        }
      }

      if (startedRef.current) {
        const inputStrength = Math.max(forward ? 1 : 0, Math.max(0, -stickY))
        thrustTime = forward ? clamp(thrustTime + dt * inputStrength, 0, 2.5) : Math.max(0, thrustTime - dt * 1.8)
        if (forward) speed += (7.5 + thrustTime * 6.5) * inputStrength * dt
        if (reverse) speed -= 7 * Math.max(1, stickY) * dt
        speed *= Math.pow(0.42, dt)
        speed = clamp(speed, -3, 11)
        const turnDirection = (left ? 1 : 0) - (right ? 1 : 0)
        boat.rotation.y += turnDirection * (1.45 + Math.abs(speed) * 0.075) * dt * (speed >= 0 ? 1 : -1)
        heading.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), boat.rotation.y)
        boat.position.addScaledVector(heading, speed * dt)
        boat.position.x = clamp(boat.position.x, -105, 105)
        boat.position.z = clamp(boat.position.z, -105, 105)
        if (jumpPressed && !gamepadJumpWasDown && jumpOffset <= 0.01) jumpVelocity = 6.4
        jumpVelocity -= 18 * dt
        jumpOffset = Math.max(0, jumpOffset + jumpVelocity * dt)
        if (jumpOffset === 0) jumpVelocity = 0
        const waveBob = Math.sin(now * 0.0024 + boat.position.x * 0.1) * 0.18
        boat.position.y = 0.45 + waveBob + jumpOffset
        boat.rotation.z = -turnDirection * 0.13 - Math.sin(now * 0.002) * 0.035
        boat.rotation.x = Math.cos(now * 0.0023) * 0.045 - Math.min(jumpVelocity, 0) * 0.018
        gamepadJumpWasDown = jumpPressed

        splashTimer -= dt
        if (speed > 1.5 && splashTimer <= 0) {
          const intensity = 0.9 + thrustTime * 2.4
          const count = 1 + Math.floor(thrustTime * 2)
          for (let i = 0; i < count; i += 1) splash(boat.position, heading, intensity)
          splashTimer = clamp(0.22 - thrustTime * 0.06, 0.065, 0.22)
        }
      } else {
        speed *= Math.pow(0.12, dt)
      }

      seaTexture.offset.x = now * 0.000025
      seaTexture.offset.y = now * 0.00005
      for (let i = 0; i < waterPositions.count; i += 1) {
        const x = waterPositions.getX(i); const z = waterPositions.getZ(i)
        waterPositions.setY(i, Math.sin(x * 0.09 + now * 0.0018) * 0.26 + Math.cos(z * 0.11 + now * 0.0013) * 0.18)
      }
      waterPositions.needsUpdate = true
      waterGeometry.computeVertexNormals()
      for (let i = splashParticles.length - 1; i >= 0; i -= 1) {
        const item = splashParticles[i]
        item.life -= dt
        item.velocity.y -= 7 * dt
        item.particle.position.addScaledVector(item.velocity, dt)
        item.particle.scale.setScalar(clamp(item.life * 1.7, 0.1, 1.15))
        item.particle.material.opacity = clamp(item.life * 1.8, 0, 0.9)
        if (item.life <= 0) { splashGroup.remove(item.particle); item.particle.material.dispose(); splashParticles.splice(i, 1) }
      }
      islands.forEach((island, i) => {
        const marker = islandGroup.children[i].children.at(-1)
        marker.rotation.y += dt * 1.8
        marker.position.y = 1.65 + Math.sin(now * 0.003 + i) * 0.22
        if (!island.found && Math.hypot(boat.position.x - island.x, boat.position.z - island.z) < 6.3) {
          island.found = true
          marker.visible = false
          found += 1
          playCollectSound()
        }
      })
      desiredCamera.copy(boat.position).add(new THREE.Vector3(0, 13, 24).applyAxisAngle(new THREE.Vector3(0, 1, 0), boat.rotation.y))
      camera.position.lerp(desiredCamera, 1 - Math.pow(0.0001, dt))
      lookTarget.copy(boat.position).addScaledVector(heading, 8)
      lookTarget.y = 0.9 + jumpOffset * 0.22
      camera.lookAt(lookTarget)
      if ((frame += 1) % 8 === 0) setStats({
        speed: Math.round(Math.abs(speed) * 12), islands: found,
        controller: gamepad ? `Xbox conectado: ${gamepad.id.slice(0, 22)}` : 'Teclado listo',
        message: found === islands.length ? '¡Ruta completada, capitán!' : `Balizas encontradas: ${found} de ${islands.length}`,
      })
      renderer.render(scene, camera)
    }
    animate(performance.now())
    const resize = () => { camera.aspect = mount.clientWidth / mount.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(mount.clientWidth, mount.clientHeight) }
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      audioStartRef.current = null
      collectSoundRef.current = null
      if (audioContext && audioContext.state !== 'closed') audioContext.close()
      splashGeometry.dispose(); splashMaterial.dispose(); waterGeometry.dispose(); waterMaterial.dispose(); renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [])

  const setTouch = (action, active) => { controlsRef.current[action] = active }
  const bindButton = (action) => ({ onPointerDown: () => setTouch(action, true), onPointerUp: () => setTouch(action, false), onPointerLeave: () => setTouch(action, false), onPointerCancel: () => setTouch(action, false) })
  const startGame = () => { audioStartRef.current?.(); setStarted(true) }

  return <main className="game-shell">
    <div ref={mountRef} className="viewport" aria-label="Juego 3D de navegación" />
    <section className="hud">
      <div><p className="eyebrow">EXPEDICIÓN 01</p><h1>Horizonte Marinero</h1></div>
      <div className="readout"><span>Velocidad</span><strong>{stats.speed} nudos</strong></div>
      <div className="mission">{stats.message}</div>
      <div className="controller-status">{stats.controller}</div>
    </section>
    <div className="instructions">W avanzar · A izquierda · S reversa · D derecha · Espacio saltar · Xbox: stick izquierdo + botón A</div>
    <div className="touch-controls" aria-label="Controles táctiles">
      <button {...bindButton('left')} aria-label="Girar a la izquierda">←</button>
      <button {...bindButton('forward')} aria-label="Avanzar">↑</button>
      <button {...bindButton('jump')} aria-label="Saltar">⤒</button>
      <button {...bindButton('right')} aria-label="Girar a la derecha">→</button>
    </div>
    {!started && <section className="welcome-screen" aria-live="polite" style={{ '--sea-texture': `url(${import.meta.env.BASE_URL}models/sea%20waves.jpg)` }}>
      <div className="welcome-card">
        <p className="eyebrow">EXPEDICIÓN 01</p><h2>Horizonte Marinero</h2>
        <p className="loading-label">LOADING GAME<span className="loading-dots">...</span></p>
        <p>{loaded ? 'El mar está listo para zarpar.' : 'Cargando modelo y corrientes del mar.'}</p>
        <button className="start-button" disabled={!loaded} onClick={startGame}>{loaded ? 'Comenzar expedición' : 'Preparando travesía'}</button>
      </div>
    </section>}
  </main>
}
