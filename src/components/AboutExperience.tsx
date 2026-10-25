import { AboutViewer } from '@/components/AboutViewer';

interface Props {
  onBack: () => void;
  onEnterApp?: () => void;
}

export function AboutExperience({ onBack, onEnterApp }: Props) {
  return <AboutViewer variant="overlay" onClose={onBack} onEnterApp={onEnterApp} />;
}
