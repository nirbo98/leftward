/**
 * PatientStage — the quiet, text-free stimulus area.
 *
 * PHYSICAL COORDINATES: this element is always `dir="ltr"` and positions items with the
 * physical CSS `left` property (never inline-start), so x = 0% is the physical left edge
 * of the screen regardless of the Hebrew RTL caregiver chrome around it.
 */
import { useEffect, useRef, useState } from 'react';
import { SIDE_X } from '../domain/exercises';
import type { ContrastMode, CueEvent, PhysicalSide, StimulusSize, TrialSpec } from '../domain/types';
import { Glyph } from './Glyph';

export const SIZE_VMIN: Record<StimulusSize, number> = { large: 20, xlarge: 28, huge: 38 };

export const PALETTE: Record<ContrastMode, { bg: string; fg: string; cue: string; anchor: string }> = {
  high_dark: { bg: '#0b0e12', fg: '#ffd60a', cue: '#5ad1f5', anchor: '#ff9a52' },
  high_light: { bg: '#fbfaf5', fg: '#141414', cue: '#0b5fd6', anchor: '#b4470c' },
};

/** Physical x (%) of an on-screen visual cue for a side. */
export function cueX(side: PhysicalSide): number {
  return SIDE_X[side];
}

interface Props {
  trial: TrialSpec | null;
  cues: readonly CueEvent[];
  paused: boolean;
  reducedMotion: boolean;
  photoUrls: Record<string, string>;
  /** Pursuit duration (ms) for the slow drift from physical right to physical left. */
  pursuitMs?: number;
}

export function PatientStage({ trial, cues, paused, reducedMotion, photoUrls, pursuitMs = 24000 }: Props) {
  const params = trial?.params;
  const pal = PALETTE[params?.contrast ?? 'high_dark'];
  const size = SIZE_VMIN[params?.size ?? 'huge'];
  const moving = !!trial && params?.motion === 'slow_pursuit' && !reducedMotion;

  // Slow pursuit: physical right → physical left; pausing freezes it. Never auto-starts sound.
  const [progress, setProgress] = useState(0);
  const elapsed = useRef(0);
  useEffect(() => {
    elapsed.current = 0;
    setProgress(0);
  }, [trial?.index, trial?.seed]);
  useEffect(() => {
    if (!moving || paused) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      elapsed.current += now - last;
      last = now;
      const p = Math.min(1, elapsed.current / pursuitMs);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [moving, paused, pursuitMs]);

  const visualCues = cues.filter((c) => c.type === 'visual' && c.side);
  const latestVisual = visualCues[visualCues.length - 1];
  const strong = params?.cueSalience !== 'soft';

  return (
    <div
      className="patient-stage"
      dir="ltr"
      data-testid="patient-stage"
      aria-hidden="true"
      style={{ background: pal.bg, direction: 'ltr' }}
    >
      {params?.showLeftAnchor && (
        <div className="left-anchor" data-testid="left-anchor" style={{ left: 0, background: pal.anchor }} />
      )}
      {latestVisual?.side && (
        <>
          {strong && (
            <div
              className="cue-edge"
              data-testid="visual-cue-edge"
              data-side={latestVisual.side}
              style={latestVisual.side === 'right' ? { right: 0, background: pal.cue } : { left: latestVisual.side === 'left' ? 0 : '48%', background: pal.cue }}
            />
          )}
          <div
            className="cue-ring"
            data-testid="visual-cue"
            data-side={latestVisual.side}
            data-physical-x={cueX(latestVisual.side)}
            style={{
              left: `${cueX(latestVisual.side)}%`,
              top: '50%',
              width: `${size + 8}vmin`,
              height: `${size + 8}vmin`,
              borderColor: pal.cue,
              borderWidth: strong ? '1.6vmin' : '0.7vmin',
            }}
          />
        </>
      )}
      {trial?.items.map((it) => {
        const x = it.role === 'target' && moving ? SIDE_X.right + (SIDE_X.left - SIDE_X.right) * progress : it.xPct;
        return (
          <div
            key={it.id}
            className="stim"
            data-testid={`stim-${it.role}`}
            data-physical-x={Math.round(x * 10) / 10}
            data-role={it.role}
            style={{ left: `${x}%`, top: `${it.yPct}%`, width: `${size}vmin`, height: `${size}vmin` }}
          >
            <Glyph glyph={it.glyph} fg={pal.fg} bg={pal.bg} photoUrl={photoUrls[it.glyph.replace(/^photo:/, '')]} label="" />
          </div>
        );
      })}
    </div>
  );
}
