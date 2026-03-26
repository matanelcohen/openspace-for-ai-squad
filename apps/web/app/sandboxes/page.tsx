import { SandboxPanel } from '@/components/sandbox/sandbox-panel';

export const metadata = {
  title: 'Sandboxes — OpenSpace',
  description: 'Manage agent sandboxes and view terminal output',
};

export default function SandboxesPage() {
  return (
    <div className="h-[calc(100vh-64px)]">
      <SandboxPanel className="h-full" />
    </div>
  );
}
