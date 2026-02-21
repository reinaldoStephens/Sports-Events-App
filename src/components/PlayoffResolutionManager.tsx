import React, { useState, useEffect } from 'react';
import PlayoffManualResolutionModal from './PlayoffManualResolutionModal';

export default function PlayoffResolutionManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [tiedGroups, setTiedGroups] = useState<any[]>([]);

  useEffect(() => {
    const handleOpen = (e: CustomEvent) => {
      setTiedGroups(e.detail.tiedGroups || []);
      setIsOpen(true);
    };

    window.addEventListener('open-playoff-resolution', handleOpen as EventListener);
    return () => {
      window.removeEventListener('open-playoff-resolution', handleOpen as EventListener);
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTiedGroups([]);
  };

  const handleConfirm = (resolutions: Map<string, string[]>) => {
    // Convert Map to an object (Record<string, string[]>) since we will pass it 
    // down to an Astro action which handles pure objects/JSON better than Maps.
    const resolutionsObj: Record<string, string[]> = {};
    resolutions.forEach((teams, group) => {
      resolutionsObj[group] = teams;
    });

    window.dispatchEvent(
      new CustomEvent('resolve-playoff-tie', {
        detail: {
          manualQualifiers: resolutionsObj,
        },
      })
    );
    handleClose();
  };

  return (
    <PlayoffManualResolutionModal
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      tiedGroups={tiedGroups}
    />
  );
}
