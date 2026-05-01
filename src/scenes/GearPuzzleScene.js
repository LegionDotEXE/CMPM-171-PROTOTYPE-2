/* buildPositions calculates where each gear should be positioned relative
 * to each other based on edges between gears and which direction gears 
 * prefer to be placed. It returns a lookup of positions by gear id.
 * 
*/
function buildPositions(gears, edges) {
  const byId = Object.fromEntries(gears.map(g => [g.id, g])); // building a lookup system for easy access
  const pos = {};
  const placed = new Set(); // previous positions of gears

  pos[gears[0].id] = { x: 0, y: 0 }; // start with first gear placed at origin
  placed.add(gears[0].id);

  const queue = [gears[0].id]; // BFS from first gear
  // for each placed gear, find neighbors and place them as well
  while(queue.length) {
    const currentId = queue.shift();
    const currentPos = pos[currentId];
    // find every gear that shares an edge with current gear
    const neighbors = edges.filter(e => e[0] === currentId || e[1] === currentId).map(e => e[0] === currentId ? e[1] : e[0]);

    neighbors.forEach(neighborId => { // skip if already placed this gear
      if(placed.has(neighborId)) return;
      const currentGear = byId[currentId];
      const neighborGear = byId[neighborId];

      if(!currentGear || !neighborGear) { // safety check for gear id that doesn't exist
        console.warn('buildPositions: unknown gear id referenced in edges: ${!currentGear ? currentId : neighborId}');
        return;
      }

      const angle = neighborGear.angleHint ?? 0; // angleHint tells us which direction 
      // to place neighbor relative to the current gear in radians. 

      // place neighbor so two gears are just touching: distance between centers
      // = sum of both radii
      pos[neighborId] = {
        x: currentPos.x + Math.cos(angle) * (neighborGear.r + currentGear.r),
        y: currentPos.y + Math.sin(angle) * (neighborGear.r + currentGear.r),
      };
      placed.add(neighborId);
      queue.push(neighborId); // queue neighbor so its own neighbors get placed too
    });
  }
  return pos;
}

// each puzzle defines label (display name), gears (list of gears and properties, including their ids, radii, teeth, type, lockSteps, angleHint, and edges.)
// the types include driver (always spinning, not able to be interacted with), locked (jammed, player must hold and release), free (spins freely, no player interaction), lock (target gear to be unlocked)
const PUZZLES = [
  {
    label: 'BYPASS-1', 
    gears: [
      {id: 'DRIVER', r: 40, teeth: 13, type: 'driver'},
      {id: 'G1', r: 42, teeth: 14, type: 'locked', lockSteps: 2, angleHint: 0}, // right
      {id: 'G2', r: 44, teeth: 14,  type: 'free', angleHint: -Math.PI/4}, // top-right
      {id: 'LOCK', r: 44, teeth: 14,  type: 'lock', angleHint: Math.PI/4}, // bottom-right
    ],
    edges: [['DRIVER','G1'], ['G1','G2'], ['G2','LOCK']]
  },
  {
    label: 'BYPASS-2',
    gears: [
      {id: 'DRIVER', r: 38, teeth: 12, type: 'driver'},
      {id: 'G1', r: 42, teeth: 14, type: 'locked', lockSteps: 3, angleHint: -Math.PI/4}, // top-right
      {id: 'G2', r: 42, teeth: 14, type: 'free', angleHint: Math.PI/4}, // bottom-right
      {id: 'G3', r: 44, teeth: 14, type: 'locked', lockSteps: 2, angleHint: 0}, // right from G1
      {id: 'LOCK', r: 44, teeth: 14, type: 'lock', angleHint: 0}, // right from G3
    ],
    edges: [['DRIVER','G1'], ['DRIVER','G2'], ['G1','G3'], ['G2','G3'], ['G3','LOCK']]
  }
];

const BASE_FILL_TIME = 1.4; // time it takes to fill from empty to full on puzzle 0. gets shorter on later puzzles.
const ZONE_LOW = 0.55; 
const ZONE_HIGH = 0.80;

export class GearPuzzleScene extends Phaser.Scene {
  constructor() {
    super({key: 'GearPuzzleScene'});
  }

  create() { // sets up background, shared graphics layers, UI text, buttons, and loads first puzzle
    const { width, height } = this.scale;
    this._width = width;
    this._height = height;
    
    const bg = this.add.graphics();
    bg.fillStyle(0x080c14, 1);
    bg.fillRect(0, 0, width, height);

    this.gfx = this.add.graphics(); // gears and edges
    this.gfxOverlay = this.add.graphics().setDepth(50); // hold bar UI, drawn in front of everything

    // Puzzle state
    this._puzzleIndex = 0;
    this._won = false;

    this._titleText = this.add.text(width / 2, 24, '', {
      fontFamily: 'monospace', fontSize: '18px', color: '#c9d6e8',
    }).setOrigin(0.5, 0).setDepth(10);

    this._statusText = this.add.text(width / 2, height - 28, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#4a6a8a',
    }).setOrigin(0.5, 1).setDepth(10);

    this._makeBtn(width / 2 - 90, height - 60, 'Prev', () => {
      if(this._puzzleIndex > 0) this._load(this._puzzleIndex - 1);
    });
    this._makeBtn(width / 2 + 10, height - 60, 'Next', () => {
      if(this._puzzleIndex < PUZZLES.length - 1) this._load(this._puzzleIndex + 1);
    });

    this._load(0);
  }

  update(time, delta) {
    const dt = delta / 1000;
    this.gfx.clear();
    this.gfxOverlay.clear();

    this._propagate();

    // draw edges
    this.edges.forEach(([aId, bId]) => {
      const a = this._getGear(aId), b = this._getGear(bId);
      if(!a || !b) return;
      this.gfx.lineStyle(1, 0x1a2e40, 1);
      this.gfx.strokeLineShape(new Phaser.Geom.Line(a.x, a.y, b.x, b.y));
    });

    this.gears.forEach(gear => {
      gear.angle += gear.rotSpeed * dt;

      let strokeColor = 0x2a4a6a;
      let fillColor   = 0x0d1f30;

      if(gear.type === 'driver') {
        strokeColor = 0x1d6a9e;
        fillColor   = 0x0a1828;
      } else if(gear.type === 'lock') {
        const allAligned = this.gears.filter(g => g.type === 'locked').every(g => g.isAligned);
        strokeColor = allAligned ? 0x1d9e75 : 0x4a2a6a;
        fillColor   = allAligned ? 0x0a2820 : 0x140a20;
      } else if(gear.type === 'locked' && !gear.isAligned) {
        strokeColor = gear._flashMiss > 0 ? 0xff2222 : 0x9e3a1d;
        fillColor   = 0x200a0a;
      } else if(gear.type === 'locked' && gear.isAligned) {
        strokeColor = 0x1d9e4a;
        fillColor   = 0x0a2010;
      }

      if(this._hovered === gear.id && !gear.isAligned) {
        strokeColor = 0xffcc00;
      }

      this._drawGear(this.gfx, gear, strokeColor, fillColor);

      if(gear.type === 'locked' && !gear.isAligned) {
        this.gfx.fillStyle(0xffffff, 0.85);
        this.gfx.fillCircle(gear.x, gear.y, 5);
        const label = `${gear.stepsLeft}`;
        // steps left displayed near gear
      }
    });

    // hold bar fill
    if(this._holdState?.holding) {
      const fillTime = BASE_FILL_TIME * Math.pow(0.85, this._puzzleIndex);
      this._holdState.fill = Math.min(1, (this._holdState.fill ?? 0) + dt / fillTime);

      const gear = this._getGear(this._holdState.gearId);
      if(gear) this._drawHoldBar(gear, this._holdState.fill);

      if(this._holdState.fill >= 1) this._failHold();
    }

    // win check
    if(!this._won) {
      const lockGear = this._getGear('LOCK');
      if(lockGear && Math.abs(lockGear.rotSpeed) > 0.01) {
        this._winTimer = (this._winTimer ?? 0) + dt;
        if(this._winTimer > 1.2) this._win();
      } else {
        this._winTimer = 0;
      }
    }

    if(!this._won) {
      const anyLocked = this.gears.some(g => g.type === 'locked' && !g.isAligned);
      this._statusText.setText(
        this._holdState?.holding
        ? 'release in the green zone!'
        : anyLocked ? 'hold on a red gear - release in the green zone'
        : 'chain ready - spinning up...'
      ).setColor(this._holdState?.holding ? '#ffcc00'
        : anyLocked ? '#185fa5' : '#d8abf6'
      );
    }
  }

  // Draws the timing bar while held showing the green zone. 
  _drawHoldBar(gear, fill) {
    const g = this.gfxOverlay;
    const bw = gear.r * 1.8;
    const bh = 10;
    const bx = gear.x - bw / 2;
    const by = gear.y - gear.r - 28;

    g.fillStyle(0x040810, 0.92);
    g.fillRoundedRect(bx - 6, by - 6, bw + 12, bh + 12, 4);

    g.fillStyle(0x1a2e40, 1);
    g.fillRect(bx, by, bw, bh);
  
    // green zone marker
    g.fillStyle(0x1d9e75, 0.3);
    g.fillRect(bx + bw * ZONE_LOW, by, bw * (ZONE_HIGH - ZONE_LOW), bh);
  
    // filled portion
    const inZone   = fill >= ZONE_LOW && fill <= ZONE_HIGH;
    const barColor = inZone ? 0x1d9e75 : (fill < ZONE_LOW ? 0xffcc00 : 0xcc3322);
    g.fillStyle(barColor, 1);
    g.fillRect(bx, by, bw * fill, bh);
  
    // border
    g.lineStyle(1, 0x4a6a8a, 1);
    g.strokeRect(bx, by, bw, bh);
  
    // zone edge ticks
    g.lineStyle(1.5, 0x1d9e75, 1);
    g.strokeLineShape(new Phaser.Geom.Line(
      bx + bw * ZONE_LOW, by - 3,
      bx + bw * ZONE_LOW, by + bh + 3
    ));
    g.strokeLineShape(new Phaser.Geom.Line(
      bx + bw * ZONE_HIGH, by - 3,
      bx + bw * ZONE_HIGH, by + bh + 3
    ));
  }

  // when player presses down on locked gear
  _startHold(gearId) {
    if(this._won) return;

    const g = this._getGear(gearId);
    if(!g || g.isAligned) return;

    this._holdState = {
      gearId,
      fill: 0,
      holding: true,
    };
  }

  // if bar is in green zone, counts as one successful step. if not, flashes gear red as fail feedback
  _releaseHold() {
    if(!this._holdState) return;
    const {gearId, fill} = this._holdState;
    this._holdState = null;

    const g = this._getGear(gearId);
    if(!g || g.isAligned) return;

    if(fill >= ZONE_LOW && fill <= ZONE_HIGH) {
      g.stepsLeft--; // visual cues for how many more successful turns needed to unlock
      g.angle += (Math.PI * 2) / g.teeth / 2;
      this.cameras.main.shake(60, 0.0025); // camera shake
      if(g.stepsLeft <= 0) { // gear is unjammed
        g.isAligned = true;
        g.stepsLeft = 0;
      } // flash gear red briefly
    } else g._flashMiss = 0.25;
  }

  // bar goes too far past green zone, meaning the player held too long.
  _failHold() {
    if(!this._holdState) return;
    const gearId = this._holdState.gearId;
    this._holdState = null;

    const g = this._getGear(gearId);
    if(g) g._flashMiss = 0.3;
  }

  // loads puzzle by index in array. destroys any existing interactive zones, positions
  // the gears and wiring up pointer events on each locked gear
  _load(index) {
    this._puzzleIndex = index;
    this._hovered = null;
    this._holdState = null;
    const puzzle = PUZZLES[index];
    this._won = false;
    this._winTimer = 0;

    if(this._hitZones) this._hitZones.forEach(z => z.destroy());
    this._hitZones = [];

    if(this._holdLabel) this._holdLabel.setVisible(false);

    const position = buildPositions(puzzle.gears, puzzle.edges);
    const ids = Object.keys(position);
    const minX = Math.min(...ids.map(id => position[id].x));
    const maxX = Math.max(...ids.map(id => position[id].x));
    const minY = Math.min(...ids.map(id => position[id].y));
    const maxY = Math.max(...ids.map(id => position[id].y));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const shiftX = this._width / 2 - centerX;
    const shiftY = this._height / 2 - centerX;

    this.gears = puzzle.gears.map((g, i) => ({
      ...g,
      x: position[g.id].x + shiftX,
      y: position[g.id].y + shiftY,
      angle: i === 0 ? 0 : Math.PI / (g.teeth ?? 12),
      rotSpeed: 0,
      isAligned: g.type !== 'locked',
      stepsLeft: g.lockSteps ?? 0,
      _flashMiss: 0,
    }));

    this.edges = puzzle.edges;
    this._titleText.setText(puzzle.label);
    this._statusText.setText('hold on a red gear, release in the green zone').setColor('#4a6a8a');

    this.gears.forEach(gear => {
      if(gear.type !== 'locked') return;

      const z = this.add.circle(gear.x, gear.y, gear.r + 10).setInteractive({useHandCursor: true}).setDepth(8);

      z.on('pointerdown', () => this._startHold(gear.id));
      z.on('pointerup', () => this._releaseHold());
      z.on('pointerout', () => {
        if(this._holdState?.gearId === gear.id) this._releaseHold();
        this._hovered = null;
      });
      z.on('pointerover', () => { this._hovered = gear.id; });

      this._hitZones.push(z);
    });

    this.input.on('pointerup', () => {
      if(this._holdState) this._releaseHold();
    });
  }

  _win() { // called once LOCK gear has spun for long enough. shows success msg and flashes the screen
    this._won = true;
    this._statusText.setText('bypass successful!').setColor('#1d9e75');
    this.cameras.main.flash(400, 29, 158, 117);
  }

  // simulaltes how rotation flows through the gear chain. gears can only pass rotation to neighbor if it is aligned. lock gear can receive rotation even if not aligned. smaller gears spin faster, larger spin slower. meshed gears spin in opposite directions. 
  _propagate() {
    this.gears.forEach(g => g.rotSpeed = 0);
    const driver = this._getGear('DRIVER');
    if(!driver) return;
    driver.rotSpeed = 1.5;

    const visited = new Set(['DRIVER']); // bfs to pass rotations to aligned neighbors from driver
    const queue = ['DRIVER'];

    while(queue.length) {
      const currentId = queue.shift();
      const currentGear = this._getGear(currentId);
      this._neighbors(currentId).forEach(neighborId => {
        if(visited.has(neighborId)) return;
        const neighborGear = this._getGear(neighborId);

        // locked gear blocks the chain. don't propagate through it except for lock gear which always accepts spin
        if(!currentGear.isAligned || (!neighborGear.isAligned && neighborGear.type !== 'lock')) return;
        visited.add(neighborId);
        queue.push(neighborId);
        neighborGear.rotSpeed = -(currentGear.rotSpeed * currentGear.r / neighborGear.r);
      });
    }
  }

  _getGear(id) {
    return this.gears.find(g => g.id === id);
  }

  _neighbors(id) { // returns ids of all gears connected to a given gear by its edges
    return this.edges.filter(e => e[0] === id || e[1] === id).map(e => e[0] === id ? e[1] : e[0]);
  }

  _makeBtn(x, y, label, callback) {
    const w = 80, h = 24;
    const g = this.add.graphics().setDepth(9);
    g.fillStyle(0x0d1f30, 1);
    g.lineStyle(0.5, 0x2a4a6a, 1);
    g.fillRect(x, y, w, h);
    g.strokeRect(x, y, w, h);
    this.add.text(x + w / 2, y + h / 2, label, {
      fontFamily: 'monospace', fontSize: '11px', color: '#c9d6e8',
    }).setOrigin(0.5).setDepth(10);
    this.add.rectangle(x + w / 2, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true })
      .setDepth(11)
      .on('pointerdown', callback);
  }

  _drawGear(g, gear, strokeColor, fillColor) {
    const { x, y, teeth, angle } = gear;

    if(gear._flashMiss > 0) {
      gear._flashMiss -= 1 / 60;
      strokeColor = 0xff2222;
    }

    if(!gear._pts) gear._pts = this._buildGearPath(teeth, gear.r);

    g.fillStyle(fillColor, 1);
    g.lineStyle(1.5, strokeColor, 1);
    g.beginPath();

    const cos = Math.cos(angle), sin = Math.sin(angle);
    gear._pts.forEach(({x: px, y: py}, i) => {
      const rx = x + px * cos - py * sin;
      const ry = y + px * sin + py * cos;
      i === 0 ? g.moveTo(rx, ry) : g.lineTo(rx, ry);
    });

    g.closePath();
    g.fillPath();
    g.strokePath();

    g.fillStyle(strokeColor, 1);
    g.fillCircle(x, y, gear.r * 0.3);
  }

  // generates outline pts for single gear tooth profile, then repeats N times around the circle. 
  _buildGearPath(N, pitchRadius, pressureAngle = 20) {
    const PA    = pressureAngle * Math.PI / 180;
    const P     = N / (pitchRadius * 2);
    const D     = pitchRadius * 2;
    const BC    = D * Math.cos(PA);
    const OD    = (N + 2) / P;
    const RD    = (N - 2.3) / P;
    const rbase = BC / 2;
    const rmax  = OD / 2;
    const rmin  = RD / 2;
    const AM    = 180 / Math.PI;

    const polarToLinear = ({ r, a }) => {
      const rad = ((a % 360 + 360) % 360) / AM;
      return { x: Math.cos(rad) * r, y: -Math.sin(rad) * r };
    };
    const linearToPolar = ({ x, y }) => {
      const r = Math.sqrt(x * x + y * y);
      let a = Math.asin(Math.max(-1, Math.min(1, y / r))) * AM;
      if (x < 0) a = 180 - a;
      return { r, a: (a + 360) % 360 };
    };

    const pts = [{ r: rmin, a: 0 }];
    let ac = 0, step = 0.1, first = true;

    for (let i = 1; i < 100; i += step) {
      const bpl = polarToLinear({ r: rbase, a: -i });
      const len  = (rbase * Math.PI * 2 / 360) * i;
      const opl  = polarToLinear({ r: len, a: -i + 90 });
      const np   = linearToPolar({ x: bpl.x + opl.x, y: bpl.y + opl.y });

      if (np.r < rmin) continue;
      if (first) { first = false; step = (2 / N) * 10; }
      if (np.r < D / 2) ac = np.a;
      if (np.r > rmax)  { np.r = rmax; pts.push(np); break; }
      pts.push(np);
    }

    const fa  = 360 / N;
    const ma  = fa / 2 + 2 * ac;
    pts[0].a  = (fa - ma) > 0 ? 0 : -(fa - ma) / 2;
    while (pts[pts.length - 1].a > ma / 2) pts.pop();

    const m = pts.length;
    for (let i = m - 1; i >= 0; i--)
      pts.push({ r: pts[i].r, a: ma - pts[i].a });

    const single = pts.slice();
    for (let i = 1; i < N; i++)
      for (let p = 0; p < single.length; p++)
        pts.push({ r: single[p].r, a: single[p].a + fa * i });

    return pts.map(p => {
      const lin = polarToLinear(p);
      return { x: lin.x, y: lin.y };
    });
  }
}
