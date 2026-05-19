import * as React from 'react';
import * as MenubarPrimitive from '@radix-ui/react-menubar';
import { cn } from '../../lib/utils';

const Menubar = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Root
    ref={ref}
    className={cn('flex h-8 items-center gap-0 border-b border-zinc-700 bg-zinc-900 px-1', className)}
    {...props}
  />
));
Menubar.displayName = 'Menubar';

const MenubarMenu = MenubarPrimitive.Menu;

const MenubarTrigger = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex cursor-default select-none items-center px-3 py-1 text-sm font-medium text-zinc-300 outline-none',
      'hover:bg-zinc-700 hover:text-zinc-100 data-[state=open]:bg-zinc-700 data-[state=open]:text-zinc-100',
      'rounded-sm',
      className
    )}
    {...props}
  />
));
MenubarTrigger.displayName = 'MenubarTrigger';

const MenubarContent = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Content>
>(({ className, align = 'start', alignOffset = -4, sideOffset = 4, ...props }, ref) => (
  <MenubarPrimitive.Portal>
    <MenubarPrimitive.Content
      ref={ref}
      align={align}
      alignOffset={alignOffset}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[180px] overflow-hidden rounded-md border border-zinc-700 bg-zinc-800 p-1 text-zinc-200 shadow-lg',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className
      )}
      {...props}
    />
  </MenubarPrimitive.Portal>
));
MenubarContent.displayName = 'MenubarContent';

const MenubarItem = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Item> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <MenubarPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
      'focus:bg-zinc-700 focus:text-zinc-100',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      inset && 'pl-8',
      className
    )}
    {...props}
  />
));
MenubarItem.displayName = 'MenubarItem';

const MenubarSub = MenubarPrimitive.Sub;

const MenubarSubTrigger = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubTrigger> & { inset?: boolean }
>(({ className, inset, children, ...props }, ref) => (
  <MenubarPrimitive.SubTrigger
    ref={ref}
    className={cn(
      'flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
      'focus:bg-zinc-700 focus:text-zinc-100',
      'data-[state=open]:bg-zinc-700',
      inset && 'pl-8',
      className
    )}
    {...props}
  >
    {children}
    <span className="ml-auto text-xs">▶</span>
  </MenubarPrimitive.SubTrigger>
));
MenubarSubTrigger.displayName = 'MenubarSubTrigger';

const MenubarSubContent = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.SubContent
    ref={ref}
    className={cn(
      'z-50 min-w-[180px] overflow-hidden rounded-md border border-zinc-700 bg-zinc-800 p-1 text-zinc-200 shadow-lg',
      'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
MenubarSubContent.displayName = 'MenubarSubContent';

const MenubarSeparator = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-zinc-700', className)}
    {...props}
  />
));
MenubarSeparator.displayName = 'MenubarSeparator';

export {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
};
