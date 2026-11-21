import type { ReactNode } from 'react';
import { Page } from '../components/ui';
import { navigate } from '../state/router';
import { DataSection } from './settings/DataSection';
import { EvidenceAndSafety, OperatorGuide } from './settings/InfoSections';
import { PersonalCueManager } from './settings/PersonalCueManager';
import { AdvancedSettings, MotionSettings, SoundSettings, StimulusSettings } from './settings/sections';

function Section({ id, title, children, open }: { id: string; title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="card section" id={id} open={open} data-testid={`section-${id}`}>
      <summary>
        <h2>{title}</h2>
      </summary>
      {children}
    </details>
  );
}

export function SettingsScreen() {
  return (
    <Page title="הגדרות ועזרה" onBack={() => navigate('home')}>
      <Section id="guide" title="מדריך קצר למלווה">
        <OperatorGuide />
      </Section>
      <Section id="personal" title="פנייה אישית בשם או בכינוי">
        <PersonalCueManager />
      </Section>
      <Section id="sound" title="קול">
        <SoundSettings />
      </Section>
      <Section id="stimuli" title="מה מופיע על המסך">
        <StimulusSettings />
      </Section>
      <Section id="motion" title="תנועה ונגישות">
        <MotionSettings />
      </Section>
      <Section id="data" title="נתונים: גיבוי, העברה ומחיקה">
        <DataSection />
      </Section>
      <Section id="advanced" title="אפשרויות מתקדמות">
        <AdvancedSettings />
      </Section>
      <Section id="evidence" title="מידע, ראיות ובטיחות">
        <EvidenceAndSafety />
      </Section>
    </Page>
  );
}
