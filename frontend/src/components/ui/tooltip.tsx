interface TooltipProps {
  text: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Tooltip({ text, children, position = 'top', className }: TooltipProps) {
  const pos = {
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left:   'right-full top-1/2 -translate-y-1/2 mr-2',
    right:  'left-full top-1/2 -translate-y-1/2 ml-2',
  }[position];

  const arrow = {
    top:    'top-full left-1/2 -translate-x-1/2 border-t-gray-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-800',
    left:   'left-full top-1/2 -translate-y-1/2 border-l-gray-800',
    right:  'right-full top-1/2 -translate-y-1/2 border-r-gray-800',
  }[position];

  return (
    <span className={`relative group inline-flex ${className ?? ''}`}>
      {children}
      <span className={`absolute ${pos} px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50`}>
        {text}
        <span className={`absolute border-4 border-transparent ${arrow}`} />
      </span>
    </span>
  );
}
