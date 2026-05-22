'use client';

import { NodeViewWrapper, ReactNodeViewRenderer, ReactNodeViewProps } from '@tiptap/react';
import Image from '@tiptap/extension-image';
import { useCallback, useRef, useState } from 'react';

// ─── React component rendered inside the editor for each image ────────────────

function ResizableImageView({ node, updateAttributes, selected }: ReactNodeViewProps) {
  const attrs = node.attrs as { src: string; alt?: string; width?: number | string };
  const containerRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);

  const startResize = useCallback((e: React.MouseEvent, direction: 'right' | 'left') => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = containerRef.current?.offsetWidth ?? 300;

    setResizing(true);

    const onMouseMove = (ev: MouseEvent) => {
      const delta = direction === 'right' ? ev.clientX - startX : startX - ev.clientX;
      const newWidth = Math.max(80, Math.min(startWidth + delta, 900));
      if (containerRef.current) containerRef.current.style.width = `${newWidth}px`;
    };

    const onMouseUp = (ev: MouseEvent) => {
      const delta = direction === 'right' ? ev.clientX - startX : startX - ev.clientX;
      const newWidth = Math.max(80, Math.min(startWidth + delta, 900));
      updateAttributes({ width: newWidth });
      setResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [updateAttributes]);

  const width = attrs.width;
  const style = width ? { width: `${width}px` } : { width: '100%' };

  return (
    <NodeViewWrapper
      as="div"
      className="relative inline-block my-4"
      style={{ maxWidth: '100%', ...style }}
      ref={containerRef}
    >
      {/* Image */}
      <img
        src={attrs.src}
        alt={attrs.alt ?? ''}
        className="block w-full h-auto rounded-lg"
        style={{ userSelect: 'none', pointerEvents: resizing ? 'none' : 'auto' }}
        draggable={false}
      />

      {/* Overlay border when selected or resizing */}
      {(selected || resizing) && (
        <div className="absolute inset-0 rounded-lg border-2 border-blue-500 pointer-events-none" />
      )}

      {/* Resize handles — only visible when selected */}
      {selected && (
        <>
          {/* Left handle */}
          <div
            onMouseDown={(e) => startResize(e, 'left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-6 bg-white border-2 border-blue-500 rounded-sm cursor-ew-resize shadow z-10"
          />
          {/* Right handle */}
          <div
            onMouseDown={(e) => startResize(e, 'right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-6 bg-white border-2 border-blue-500 rounded-sm cursor-ew-resize shadow z-10"
          />
          {/* Width badge */}
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded pointer-events-none">
            {width ? `${width}px` : '100%'}
          </div>
        </>
      )}
    </NodeViewWrapper>
  );
}

// ─── TipTap extension ─────────────────────────────────────────────────────────

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const w = el.getAttribute('width') ?? el.style.width;
          return w ? parseInt(w) : null;
        },
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width, style: `width:${attrs.width}px` } : {}),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});
