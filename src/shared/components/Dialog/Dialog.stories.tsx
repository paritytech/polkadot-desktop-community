import { type Meta, type StoryObj } from '@storybook/react-vite';
import { type ComponentProps, useState } from 'react';

import { Button } from '../Button/Button';

import { Dialog } from './Dialog';

type DemoProps = Pick<ComponentProps<typeof Dialog.Content>, 'width' | 'height' | 'showCloseButton'> & {
  defaultOpen?: boolean;
};

const DialogDemo = ({ defaultOpen = false, ...content }: DemoProps) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Content {...content}>
          <Dialog.Header>
            <Dialog.Title>Rename workspace</Dialog.Title>
            <Dialog.Description>Pick a name your team will recognise in the sidebar.</Dialog.Description>
          </Dialog.Header>
          <Dialog.Footer>
            <Dialog.Close asChild>
              <Button>Cancel</Button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <Button variant="primary">Save</Button>
            </Dialog.Close>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
};

const meta: Meta<typeof DialogDemo> = {
  component: DialogDemo,
  title: 'Design System/kit/Dialog',
};

export default meta;

type Story = StoryObj<typeof DialogDemo>;

export const Default: Story = {};

export const Small: Story = { args: { width: 'sm' } };

export const Medium: Story = { args: { width: 'md' } };

export const Large: Story = { args: { width: 'lg' } };

export const ExtraLarge: Story = { args: { width: 'xl' } };

export const Tall: Story = { args: { height: 'tall' } };

export const WithoutCloseButton: Story = { args: { showCloseButton: false } };

export const Open: Story = { args: { defaultOpen: true } };
