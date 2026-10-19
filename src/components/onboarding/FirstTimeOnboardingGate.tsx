import React from 'react';
import type { AppNavigationDestination } from '../../navigationTypes';
import { RequiredOnboarding, useRequiredOnboarding } from './RequiredOnboarding';

type Props = { onNavigate: (destination: AppNavigationDestination) => void };

/**
 * On the landing and public pages: a signed-in user who has not answered the required questions sees them
 * full screen, then lands on Money Home. (The workspace itself checks the same thing before it renders.)
 */
export const FirstTimeOnboardingGate: React.FC<Props> = ({ onNavigate }) => {
  const gate = useRequiredOnboarding();
  if (gate.status !== 'needed') return null;
  return <RequiredOnboarding onComplete={async (answers) => { await gate.complete(answers); onNavigate('overview'); }} />;
};
