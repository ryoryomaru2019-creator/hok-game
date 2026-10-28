import { getSquidPreset } from '../src/studio/model.js';
import { evaluateTrack } from '../src/studio/animator.js';

function ensureIndependentTracks(clip) {
  if (!clip || !clip.tracks) return;
  for (const partId in clip.tracks) {
    const kfs = clip.tracks[partId];
    if (!Array.isArray(kfs)) continue;

    const newKfs = [];
    let hasCompound = false;

    for (const k of kfs) {
      if (k.prop) {
        newKfs.push(k);
      } else {
        hasCompound = true;
        if (k.tx !== undefined || k.ty !== undefined) {
          newKfs.push({
            time: k.time,
            prop: 'pos',
            tx: k.tx ?? 0,
            ty: k.ty ?? 0,
            easing: k.easing || 'easeInOutQuad',
            bezier: k.bezier ? [...k.bezier] : undefined
          });
        }
        if (k.sx !== undefined || k.sy !== undefined) {
          newKfs.push({
            time: k.time,
            prop: 'scale',
            sx: k.sx ?? 1,
            sy: k.sy ?? 1,
            easing: k.easing || 'easeInOutQuad',
            bezier: k.bezier ? [...k.bezier] : undefined
          });
        }
        if (k.rot !== undefined) {
          newKfs.push({
            time: k.time,
            prop: 'rot',
            rot: k.rot ?? 0,
            easing: k.easing || 'easeInOutQuad',
            bezier: k.bezier ? [...k.bezier] : undefined
          });
        }
        if (k.op !== undefined) {
          newKfs.push({
            time: k.time,
            prop: 'opacity',
            op: k.op ?? 1,
            easing: k.easing || 'easeInOutQuad',
            bezier: k.bezier ? [...k.bezier] : undefined
          });
        }
        if (k.tx === undefined && k.ty === undefined && k.sx === undefined && k.sy === undefined && k.rot === undefined && k.op === undefined) {
          newKfs.push(k);
        }
      }
    }

    if (hasCompound) {
      newKfs.sort((a, b) => a.time - b.time);
      clip.tracks[partId] = newKfs;
    }
  }
}

const squid = getSquidPreset();
const clipBefore = JSON.parse(JSON.stringify(squid.animations.swim));
const resBefore = evaluateTrack(clipBefore.tracks.squid_mantle, 0.25);

ensureIndependentTracks(squid.animations.swim);
const resAfter = evaluateTrack(squid.animations.swim.tracks.squid_mantle, 0.25);

console.log('Result before ensureIndependentTracks:', resBefore);
console.log('Result after ensureIndependentTracks:', resAfter);
