// Testy mechanického modelu (node web/tests/kinematics.test.mjs)
import assert from 'node:assert/strict';
import { Kinematics, makeConfig } from '../js/kinematics.js';
import { CATALOG } from '../js/catalog.js';
import { gon, toGon, toArcsec, arcmin, formatAngle, TAU, wrapPi } from '../js/geodesy.js';

const ts = new Kinematics(makeConfig(CATALOG[0]));
const near = (a, b, e, m) => assert.ok(Math.abs(a - b) < e, `${m}: ${a} ≠ ${b}`);

near(toGon(ts.readings().v), 100, 1e-4, 'vodorovná záměra = 100 gon');
ts.rotateAlidade(-gon(10));
near(toGon(ts.readings().hz), 10, 1e-3, 'Hz roste po směru hodin');

const t2 = new Kinematics(makeConfig(CATALOG[0]));
const fb = t2.turnH(1);
assert.ok(fb.ticks >= 24 && fb.ticks <= 26, 'cvaknutí po 0,01 gon');
near(toGon(t2.readings().hz), 0.25, 1e-3, '1 otáčka = 0,25 gon');

const f = new Kinematics(makeConfig(CATALOG[0]));
f.pitch(0.1); const I = f.readings();
f.rotateAlidade(Math.PI); f.pitch(Math.PI - 0.2); const II = f.readings();
assert.equal(II.face, 'II');
near(I.v + II.v, TAU, 1e-5, 'V(I) + V(II) = 400 gon');
near(wrapPi(II.hz - I.hz - Math.PI), 0, 1e-5, 'Hz(II) = Hz(I) + 200 gon');

const lv = new Kinematics(makeConfig(CATALOG[0]));
lv.s.setupTilt = [0.01, 0];
assert.equal(lv.levelState(), 'out');
assert.equal(lv.readings().hz, null, 'mimo rozsah kompenzátoru se neměří');
const turns = (0.01 * 1.732 * lv.c.screwRadius / 2) / lv.c.screwLead;
lv.turnScrew(1, turns); lv.turnScrew(2, -turns);
assert.ok(toArcsec(lv.tiltMagnitude()) < 30, 'šrouby vyrovnají sklon stativu');
assert.equal(lv.levelState(), 'leveled');

const b = new Kinematics(makeConfig(CATALOG[0]));
b.turnScrew(2, 0.2);
const o = b.bubbleOffset();
assert.ok(o[0] > 0 && o[1] < 0, 'bublina uteče k vyšší straně');

const al = new Kinematics(makeConfig(CATALOG[3]));
al.s.setupTilt = [0, arcmin(5)];
near(al.losMeasurement()[1], 0, 1e-12, 'kompenzátor nivelačního přístroje drží záměru vodorovně');

assert.equal(formatAngle(gon(123.45678), 'gon'), '123.4568');
assert.equal(formatAngle(Math.PI / 2, 'dms'), '90°00\'00"');
console.log('✓ všechny testy mechaniky prošly');
