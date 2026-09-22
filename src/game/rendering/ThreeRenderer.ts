import * as THREE from "three";
import { ARENA, ATTACKS } from "../constants";
import type { Effect, Fighter } from "../types";

interface FighterModel {
  root: THREE.Group;
  body: THREE.Group;
  arms: THREE.Group[];
  legs: THREE.Group[];
  cloth: THREE.MeshStandardMaterial;
  shield: THREE.Mesh;
  slash: THREE.Mesh;
  marker: THREE.Mesh;
}

/** An independent WebGL renderer; all combat state stays in GameEngine. */
export class ThreeRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 16 / 9, .1, 100);
  private observer: ResizeObserver;
  private fighters: FighterModel[];
  private particles: THREE.Mesh[] = [];
  private lost: (event: Event) => void;
  private disposed = false;

  constructor(private container: HTMLElement, onError: () => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.domElement.setAttribute("aria-label", "3Dの道場。奥行きのある舞台と2人のファイター");
    this.renderer.domElement.setAttribute("role", "img");
    this.lost = event => { event.preventDefault(); if (!this.disposed) onError(); };
    this.renderer.domElement.addEventListener("webglcontextlost", this.lost);
    container.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color("#9eae99");
    this.scene.fog = new THREE.Fog("#9eae99", 17, 40);
    this.camera.position.set(0, 8, 10.5);
    this.camera.lookAt(0, .35, 0);
    this.scene.add(new THREE.HemisphereLight(0xffeed2, 0x395847, 2.2));
    const sun = new THREE.DirectionalLight(0xffddb0, 3);
    sun.position.set(-3, 10, 4); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: .1, far: 25 });
    sun.shadow.normalBias = .03;
    this.scene.add(sun);
    this.environment();
    this.fighters = [this.fighter(0x537f76, 0xa0d8c5), this.fighter(0xa16850, 0xf0b595)];
    const particleGeometry = new THREE.BoxGeometry(.045, .045, .045);
    for (let i = 0; i < 48; i++) {
      const particle = new THREE.Mesh(particleGeometry, new THREE.MeshBasicMaterial({ color: 0xffe4a5, transparent: true }));
      particle.visible = false; this.scene.add(particle); this.particles.push(particle);
    }
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
  }

  private material(color: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness: .9, flatShading: true });
  }

  private box(parent: THREE.Object3D, size: number[], position: number[], material: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size as [number, number, number]), material);
    mesh.position.set(...position as [number, number, number]);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
    return mesh;
  }

  private environment(): void {
    const wood = this.material(0x625d43), trim = this.material(0x454e37), plank = this.material(0x9d9870);
    this.box(this.scene, [9.8, .25, 5.8], [0, -.2, 0], wood);
    for (let x = 0; x < 12; x++) this.box(this.scene, [.79, .08, 5.65], [(x - 5.5) * .81, -.035, 0], plank);
    const mat = this.material(0x899971);
    this.box(this.scene, [8.7, .025, 4.45], [0, .025, 0], mat);
    const border = this.material(0xc5bd91);
    for (const z of [-2.23, 2.23]) this.box(this.scene, [8.7, .025, .045], [0, .045, z], border);
    for (const x of [-4.35, 4.35]) this.box(this.scene, [.045, .025, 4.45], [x, .045, 0], border);
    for (const x of [-2.16, 0, 2.16]) this.box(this.scene, [.018, .015, 4.42], [x, .045, 0], trim);
    this.box(this.scene, [8.65, .015, .018], [0, .045, 0], trim);
    // Rail and lanterns are outside the playable bounds; the camera-facing edge stays open.
    for (const x of [-4.65, 4.65]) {
      for (const z of [-2.65, 2.65]) this.box(this.scene, [.14, .9, .14], [x, .38, z], trim);
      this.box(this.scene, [.12, .12, 5.5], [x, .8, 0], wood);
    }
    this.box(this.scene, [9.4, .12, .12], [0, .8, -2.65], wood);
    for (const x of [-4, 4]) {
      this.box(this.scene, [.15, 2.7, .15], [x, 1.2, -3], wood);
      this.box(this.scene, [.65, .13, .6], [x, 2.4, -3], trim);
      const lantern = this.material(0xf4d896); lantern.emissive.setHex(0x8a5727); lantern.emissiveIntensity = .3;
      this.box(this.scene, [.38, .48, .38], [x, 2.1, -3], lantern);
    }
    this.box(this.scene, [30, .2, 30], [0, -.7, -3], this.material(0x617859));
    // Low-poly trees and hills keep the scene self-contained and inexpensive to draw.
    const leaves = this.material(0x456b51), trunk = this.material(0x66583f);
    for (const [x, z, height] of [[-7,-5,3],[-5.8,-8,4],[-8,0,3.5],[6,-5,3.6],[8,-9,5],[7,2,3],[-4,-12,4],[3,-10,3]]) {
      this.box(this.scene, [.16, height, .16], [x, height / 2 - .6, z], trunk);
      for (let level = 0; level < 3; level++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(height * (.3 - level * .055), height * .6, 7), leaves);
        cone.position.set(x, height * (.42 + level * .23), z); cone.castShadow = true; this.scene.add(cone);
      }
    }
    for (const [x,z,h] of [[-13,-17,9],[-3,-22,13],[12,-23,11],[20,-20,7]]) {
      const hill = new THREE.Mesh(new THREE.ConeGeometry(h * .9, h, 5), this.material(0x758c74));
      hill.position.set(x, h / 2 - 1, z); this.scene.add(hill);
    }
    for (const x of [-1.5,1.5]) this.box(this.scene, [.22, 3.8, .22], [x, 1.3, -6], trim);
    this.box(this.scene, [3.9,.25,.4], [0,3.1,-6], wood);
    this.box(this.scene, [3.4,.16,.2], [0,2.35,-6], wood);
  }

  private fighter(color: number, accent: number): FighterModel {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body); this.scene.add(root);
    const cloth = this.material(color), dark = this.material(0x2e4137), skin = this.material(0xe1c3a1), belt = this.material(0xd9ceaa);
    this.box(body, [.43,.47,.27], [0,.79,0], cloth);
    this.box(body, [.44,.06,.29], [0,.57,0], belt);
    this.box(body, [.08,.25,.04], [.08,.43,.18], belt);
    this.box(body, [.075,.4,.02], [.08,.8,.15], belt);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), skin); head.position.y = 1.18; head.castShadow = true; body.add(head);
    this.box(body, [.3,.09,.29], [0,1.28,-.02], dark);
    this.box(body, [.31,.045,.31], [0,1.22,0], this.material(accent));
    for (const x of [-.065,.065]) this.box(body, [.025,.025,.025], [x,1.17,.148], dark);
    const arms: THREE.Group[] = [], legs: THREE.Group[] = [];
    for (const x of [-1,1]) {
      const arm = new THREE.Group(); arm.position.set(x*.28,.97,0);
      this.box(arm, [.13,.34,.14], [0,-.16,0], cloth);
      this.box(arm, [.14,.13,.15], [0,-.34,.015], skin);
      body.add(arm); arms.push(arm);
      const leg = new THREE.Group(); leg.position.set(x*.13,.54,0);
      this.box(leg, [.16,.45,.17], [0,-.22,0], cloth);
      this.box(leg, [.19,.09,.27], [0,-.49,.045], dark);
      root.add(leg); legs.push(leg);
    }
    const shield = new THREE.Mesh(new THREE.RingGeometry(.34,.39,28), new THREE.MeshBasicMaterial({color:accent, transparent:true, opacity:.65, side:THREE.DoubleSide}));
    shield.position.set(0,.8,.5); body.add(shield);
    const slash = new THREE.Mesh(new THREE.TorusGeometry(.76,.035,5,22,Math.PI), new THREE.MeshBasicMaterial({color:0xfbe0a5,transparent:true,opacity:.8}));
    slash.rotation.x = Math.PI / 2; slash.position.set(0,.7,.25); body.add(slash);
    const marker = new THREE.Mesh(new THREE.RingGeometry(.27,.32,32),new THREE.MeshBasicMaterial({color:accent,transparent:true,opacity:.8,side:THREE.DoubleSide}));
    marker.rotation.x = -Math.PI/2; marker.position.y=.065; this.scene.add(marker);
    return { root, body, arms, legs, cloth, shield, slash, marker };
  }

  private pose(model: FighterModel, fighter: Fighter, time: number): void {
    const { root, body, arms, legs } = model;
    root.position.set((fighter.x - 480) / 100, (ARENA.floor - fighter.y) / 100 + .055, fighter.z / 100);
    root.rotation.y = Math.atan2(fighter.headingX, fighter.headingZ);
    model.marker.position.set(root.position.x,.065,root.position.z);
    const running = Math.hypot(fighter.vx, fighter.vz) > 30;
    const stride = running ? Math.sin(time * 18) * .5 : 0;
    legs[0].rotation.x = stride; legs[1].rotation.x = -stride;
    arms[0].rotation.x = -.45 - stride * .4; arms[1].rotation.x = -.45 + stride * .4;
    arms[0].rotation.z = .13; arms[1].rotation.z = -.13;
    body.rotation.x = fighter.action === "dodge" ? .6 : fighter.action === "hitStun" ? -.25 : .04;
    body.position.y = fighter.action === "dodge" ? -.16 : Math.sin(time*3)*.006;
    model.cloth.emissive.setHex(fighter.flash > 0 ? 0xffead5 : 0x000000);
    model.cloth.emissiveIntensity = fighter.flash > 0 ? .8 : 0;
    const attack = fighter.action === "normalAttack" || fighter.action === "heavyAttack" ? ATTACKS[fighter.action] : null;
    const active = Boolean(attack && fighter.actionTime >= attack.startup && fighter.actionTime <= attack.startup + attack.active);
    if (attack) {
      arms[1].rotation.x = active ? -Math.PI/2 : fighter.actionTime < attack.startup ? .7 : -.55;
      arms[1].position.z = active ? .35 : 0;
      body.rotation.x = active ? .2 : -.05;
    } else arms[1].position.z = 0;
    if (fighter.guarding) { arms[0].rotation.x=-2; arms[1].rotation.x=-2; }
    if (fighter.y < ARENA.floor-5) { legs[0].rotation.x=-.5;legs[1].rotation.x=.5; }
    model.shield.visible = fighter.guarding;
    model.slash.visible = active;
    model.slash.scale.setScalar(fighter.action === "heavyAttack" ? 1.2 : .9);
  }

  render(player: Fighter, ai: Fighter, effects: Effect[], time: number, shake: number): void {
    if (this.disposed || this.renderer.getContext().isContextLost()) return;
    this.pose(this.fighters[0], player, time); this.pose(this.fighters[1], ai, time);
    for (let i=0;i<this.particles.length;i++) {
      const mesh=this.particles[i], effect=effects[i]; mesh.visible=Boolean(effect);
      if (effect) { mesh.position.set((effect.x-480)/100,(ARENA.floor-effect.y)/100,(effect.z??0)/100); (mesh.material as THREE.MeshBasicMaterial).opacity=effect.life/effect.maxLife; }
    }
    this.camera.position.x = shake > 0 ? Math.sin(time*90)*shake*.004 : 0;
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height || this.disposed) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.zoom = Math.min(1.2, this.camera.aspect * 1.05);
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.disposed = true; this.observer.disconnect();
    this.renderer.domElement.removeEventListener("webglcontextlost", this.lost);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    this.scene.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material); } });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
    this.scene.traverse(object => { if (object instanceof THREE.DirectionalLight) object.shadow.dispose(); });
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}
