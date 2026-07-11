import { BonsaiDNA } from './types';
import { Skeleton } from './skeleton';

const MURRAY_EXP = 2.6;
const TIP_R = 0.8;
const TWIG_R = 0.55;

/**
 * Pipe model / Murray's law: the parent's cross-section supports the sum of
 * its children's (r_parent^k = Σ r_child^k). Segments are appended child-after-
 * parent during growth, so a reverse scan is a valid post-order traversal.
 */
export function applyThickness(skel: Skeleton, dna: BonsaiDNA): void {
  const { segs } = skel;
  const acc = new Float64Array(segs.length);

  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    const own = s.twig ? TWIG_R : TIP_R;
    const r = acc[i] > 0 ? Math.pow(acc[i], 1 / MURRAY_EXP) : own;
    s.radius = Math.max(r, own);
    if (s.parent >= 0) acc[s.parent] += Math.pow(s.radius * 1.02, MURRAY_EXP);
  }

  // scale so the trunk base matches the DNA's base thickness
  const rootR = segs.length > 0 ? segs[0].radius : 1;
  const scale = dna.baseRadius / Math.max(0.001, rootR);
  for (const s of segs) {
    if (s.twig) {
      s.radius = Math.min(0.8, s.radius);
    } else {
      // extra taper with age of the wood: the top of the tree is younger and thinner
      const taper = 1 - 0.35 * Math.min(1, s.birth / 0.75);
      s.radius = Math.min(dna.baseRadius * taper, Math.max(0.7, s.radius * scale * taper));
    }
  }
}
