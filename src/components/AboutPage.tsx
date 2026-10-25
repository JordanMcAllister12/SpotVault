import { AboutViewer } from '@/components/AboutViewer';

interface Props {
  onBack?: () => void;
}

export function AboutPage({ onBack }: Props) {
  return <AboutViewer variant="embedded" onClose={onBack} />;
}
