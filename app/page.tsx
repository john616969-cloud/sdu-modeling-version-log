import { VersionWorkspace } from '@/components/version-workspace';

export default function Home() {
  return <VersionWorkspace preview={process.env.NODE_ENV === 'development'} />;
}
