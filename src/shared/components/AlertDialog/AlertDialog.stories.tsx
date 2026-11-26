import { type Meta, type StoryObj } from '@storybook/react-vite';
import { type ComponentProps, useState } from 'react';

import { Button } from '../Button/Button';

import { AlertDialog } from './AlertDialog';

type DemoProps = Pick<ComponentProps<typeof AlertDialog.Action>, 'variant'> & {
  defaultOpen?: boolean;
};

const AlertDialogDemo = ({ variant, defaultOpen = false }: DemoProps) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open alert</Button>
      <AlertDialog.Root open={open} onOpenChange={setOpen}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Remove this product?</AlertDialog.Title>
            <AlertDialog.Description>It leaves your dashboard until you add it again.</AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action variant={variant}>Remove</AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  );
};

const meta: Meta<typeof AlertDialogDemo> = {
  component: AlertDialogDemo,
  title: 'Design System/kit/AlertDialog',
};

export default meta;

type Story = StoryObj<typeof AlertDialogDemo>;

export const Primary: Story = { args: { variant: 'primary' } };

export const Danger: Story = { args: { variant: 'danger' } };

export const Open: Story = { args: { variant: 'danger', defaultOpen: true } };
