'use client'

import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  label: string
  href?: string
  onClick?: () => void
  icon?: string
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[]
  accentColor?: string
  separator?: string
  className?: string
  onClick?: (item: BreadcrumbItem) => void
}

export function Breadcrumb({
  items,
  accentColor = '#00ff41',
  separator = '/',
  className,
  onClick,
}: BreadcrumbProps) {
  return (
    <nav className={cn('text-xs font-mono', className)}>
      <ol className="flex items-center gap-2 flex-wrap">
        {items.map((item, idx) => (
          <li key={`${item.label}-${idx}`} className="flex items-center gap-2">
            {idx > 0 && (
              <span style={{ color: accentColor, opacity: 0.5 }}>
                {separator}
              </span>
            )}

            <BreadcrumbItemComponent
              item={item}
              isLast={idx === items.length - 1}
              accentColor={accentColor}
              onClick={() => {
                item.onClick?.()
                onClick?.(item)
              }}
            />
          </li>
        ))}
      </ol>
    </nav>
  )
}

interface BreadcrumbItemComponentProps {
  item: BreadcrumbItem
  isLast: boolean
  accentColor: string
  onClick: () => void
}

function BreadcrumbItemComponent({
  item,
  isLast,
  accentColor,
  onClick,
}: BreadcrumbItemComponentProps) {
  const isClickable = !isLast && (item.href || item.onClick)

  const content = (
    <span className="flex items-center gap-1">
      {item.icon && <span>{item.icon}</span>}
      <span>{item.label}</span>
    </span>
  )

  if (!isClickable) {
    return (
      <span
        aria-current={isLast ? 'page' : undefined}
        style={{
          color: accentColor,
          opacity: isLast ? 1 : 0.7,
        }}>
        {content}
      </span>
    )
  }

  if (item.href) {
    return (
      <a
        href={item.href}
        onClick={onClick}
        className="transition-opacity hover:opacity-100"
        style={{
          color: accentColor,
          opacity: 0.7,
          textDecoration: 'none',
        }}>
        {content}
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="transition-opacity hover:opacity-100"
      style={{
        color: accentColor,
        opacity: 0.7,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        font: 'inherit',
      }}>
      {content}
    </button>
  )
}
