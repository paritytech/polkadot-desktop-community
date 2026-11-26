import { type Meta, type StoryObj } from '@storybook/react-vite';

import { Button } from '../Button/Button';

import { Toaster } from './Toaster';
import { toast } from './toast';

const meta: Meta<typeof Toaster> = {
  component: Toaster,
  title: 'Design System/kit/Toaster',
};

export default meta;

type Story = StoryObj<typeof Toaster>;

export const Default: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Toaster />
      <Button onClick={() => toast.success({ title: 'Saved', description: 'Your changes are stored.' })}>Success</Button>
      <Button onClick={() => toast.error({ title: 'Failed', description: 'The request did not go through.' })}>Error</Button>
      <Button onClick={() => toast.info({ title: 'Heads up', description: 'Something changed.' })}>Info</Button>
      <Button onClick={() => toast.message({ title: 'Hello', description: 'Just saying.' })}>Message</Button>
      <Button
        onClick={() =>
          toast.message({
            title: 'Product removed',
            description: 'It is gone from the dashboard.',
            action: { label: 'Undo', onClick: () => undefined },
          })
        }
      >
        With action
      </Button>
    </div>
  ),
};
