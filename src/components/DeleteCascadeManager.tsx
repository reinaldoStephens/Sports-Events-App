import { useState, useEffect } from 'react';
import DeleteCascadeWarning from './DeleteCascadeWarning';

interface DeleteCascadeManagerProps {}

export default function DeleteCascadeManager({}: DeleteCascadeManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [modalData, setModalData] = useState<{
    affectedMatches: any[];
    totalEvents: number;
    impactMessage: string;
    showCascadeOption?: boolean;
    onConfirm: (cascade: boolean) => void;
  } | null>(null);

  useEffect(() => {
    // Setup global function to show cascade warning
    const handleShowCascadeWarning = (options: {
      affectedMatches: any[];
      totalEvents: number;
      impactMessage: string;
      showCascadeOption?: boolean;
      onConfirm: (cascade: boolean) => void;
    }) => {
      setModalData(options);
      setIsOpen(true);
    };

    (window as any).showCascadeWarning = handleShowCascadeWarning;

    return () => {
      delete (window as any).showCascadeWarning;
    };
  }, []);

  const handleConfirm = (cascade: boolean) => {
    if (modalData?.onConfirm) {
      modalData.onConfirm(cascade);
    }
    setIsOpen(false);
    setModalData(null);
  };

  const handleCancel = () => {
    setIsOpen(false);
    setModalData(null);
  };

  if (!modalData) return null;

  return (
    <DeleteCascadeWarning
      isOpen={isOpen}
      affectedMatches={modalData.affectedMatches}
      totalEvents={modalData.totalEvents}
      impactMessage={modalData.impactMessage}
      showCascadeOption={modalData.showCascadeOption}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
}
