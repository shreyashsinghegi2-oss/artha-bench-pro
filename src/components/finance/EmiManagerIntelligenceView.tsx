import React, { useEffect, useState } from 'react';
import { AppNavigationDestination } from '../../navigationTypes';
import { EMI_RECORDS_CHANGED_EVENT, EmiRecord, loadEmiRecords, saveEmiRecords } from '../../services/emiStorage';
import { EmiIntelligencePanel } from './EmiIntelligencePanel';
import { EmiManagerView } from './EmiManagerView';

type Props = { onNavigate: (destination: AppNavigationDestination) => void };

export const EmiManagerIntelligenceView: React.FC<Props> = ({ onNavigate }) => {
  const [records, setRecords] = useState<EmiRecord[]>(loadEmiRecords);
  const [managerVersion, setManagerVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setRecords(loadEmiRecords());
    window.addEventListener(EMI_RECORDS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(EMI_RECORDS_CHANGED_EVENT, refresh);
  }, []);

  const importRecords = (incoming: EmiRecord[]) => {
    const current = loadEmiRecords();
    saveEmiRecords([...incoming, ...current]);
    setRecords(loadEmiRecords());
    setManagerVersion((value) => value + 1);
  };

  return (
    <>
      <div className="mx-auto max-w-[1500px] px-4 pt-7 sm:px-6">
        <EmiIntelligencePanel records={records} onNavigate={onNavigate} onImportRecords={importRecords} />
      </div>
      <EmiManagerView key={managerVersion} onNavigate={onNavigate} />
    </>
  );
};
